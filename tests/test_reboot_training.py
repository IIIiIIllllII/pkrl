import copy
import random
import numpy as np
import pytest
import torch

from gen3rl.features.schema import FEATURE_SPECS, SCHEMA_VERSION
from gen3rl.policy.lut import AdditiveLUTPolicy, NumpyLUTActor
from gen3rl.rl.ppo import PPOTrainer, compute_gae
from gen3rl.runner import _batch_episode, _batch_generation


def test_numpy_rejects_empty_mask_including_deterministic():
    actor=NumpyLUTActor(AdditiveLUTPolicy())
    with pytest.raises(ValueError,match="no legal action"):
        actor.act(np.zeros((9,20),dtype=np.int64),np.zeros(9,dtype=bool),True)


def test_optimized_gae_matches_original_recurrence_at_episode_boundaries():
    torch.manual_seed(82)
    r=torch.randn(257); v=torch.randn(257); d=torch.zeros(257); d[[3,8,62,256]]=1
    expected=torch.zeros_like(r); last=torch.zeros(())
    for t in reversed(range(len(r))):
        nxt=v[t+1] if t+1<len(v) else torch.zeros(())
        delta=r[t]+.99*nxt*(1-d[t])-v[t]
        last=delta+.99*.95*(1-d[t])*last; expected[t]=last
    a,ret=compute_gae(r,v,d)
    torch.testing.assert_close(a,expected,rtol=0,atol=0)
    torch.testing.assert_close(ret,expected+v,rtol=0,atol=0)


def test_batched_preprocessing_matches_episode_reference():
    trainer=PPOTrainer(AdditiveLUTPolicy(),20)
    rng=np.random.default_rng(52); episodes=[]
    for n in (2,13,7):
        traces=[]
        for _ in range(n):
            f=np.stack([rng.integers(0,s.size,size=9) for s in FEATURE_SPECS],axis=1)
            traces.append((f,np.ones(9,dtype=bool),1,-1.2,0))
        episodes.append((traces,1.0))
    original=[_batch_episode(trainer,t,r) for t,r in episodes]
    actual=_batch_generation(trainer,episodes,.99,.95,{})
    for i,value in enumerate(actual):
        torch.testing.assert_close(value,torch.cat([b[i] for b in original]),rtol=1e-5,atol=1e-6)


def test_checkpoint_restores_rng_optimizer_and_next_update(tmp_path):
    torch.manual_seed(19); random.seed(19); np.random.seed(19)
    trainer=PPOTrainer(AdditiveLUTPolicy(),20)
    f=torch.zeros((12,9,20),dtype=torch.long); mask=torch.ones((12,9),dtype=torch.bool)
    actions=torch.zeros(12,dtype=torch.long)
    with torch.no_grad(): old=trainer.policy.distribution(f,mask).log_prob(actions)
    batch=(f,mask,actions,old,torch.randn(12),torch.randn(12))
    trainer.update(*batch,epochs=2,minibatch_size=4)
    trainer.training_state={"sampling_rng":random.Random(18).getstate(),"schedule":42}
    path=tmp_path/"resume.pt"
    trainer.checkpoint(path,{}, {"feature_schema_version":SCHEMA_VERSION},{"policy_version":1},["pool.pt"])
    expected_random=(random.random(),np.random.random(),torch.rand(3))
    trainer.update(*batch,epochs=2,minibatch_size=4)
    other=PPOTrainer(AdditiveLUTPolicy(),20); state=other.load(path)
    assert (random.random(),np.random.random()) == expected_random[:2]
    assert torch.equal(torch.rand(3),expected_random[2])
    assert other.training_state["schedule"]==42 and state["opponent_pool"]==["pool.pt"]
    other.update(*batch,epochs=2,minibatch_size=4)
    for a,b in zip(list(trainer.policy.parameters())+list(trainer.value.parameters()),list(other.policy.parameters())+list(other.value.parameters())):
        torch.testing.assert_close(a,b,rtol=0,atol=0)


def test_cartridge_cache_does_not_expose_mutable_teams():
    from gen3rl.teams import cartridge_match
    first=cartridge_match(3); expected=copy.deepcopy(first)
    first[0][0]["moves"]=[]
    assert cartridge_match(3)==expected

def test_showdown_seed_keeps_high_bits_and_is_reproducible():
    from gen3rl.runner import showdown_seed
    assert showdown_seed(3)==showdown_seed(3)
    assert showdown_seed(3)!=showdown_seed(3+65536)
    assert len({tuple(showdown_seed(i)) for i in range(10000)})==10000

def test_mid_update_failure_recovers_exact_generation_and_resume(monkeypatch):
    import json
    from pathlib import Path
    import gen3rl.runner as runner
    config={"feature_schema":SCHEMA_VERSION,"seed":771,"workers":1,"max_decisions":24,"rollout_size":8,
        "ppo":{"epochs":2,"minibatch":4},"checkpoint_decisions":[8],"milestone_evaluation_decisions":[],
        "opponent_mixture":{"historical":1.0}}
    def fake_battle(policy,seed,*args,actor=None,**kwargs):
        f=np.zeros((9,20),dtype=np.int64); m=np.ones(9,dtype=bool)
        traces=[]
        for _ in range(4):
            action,lp=actor.act(f,m); traces.append((f.copy(),m.copy(),action,lp,0.0))
        return traces,1.0,"p1",.001
    monkeypatch.setattr(runner,"battle",fake_battle)
    control=runner.train_run(config)
    original=PPOTrainer.update; calls=0
    def interrupted(self,*args,**kwargs):
        nonlocal calls
        calls+=1
        result=original(self,*args,**kwargs)
        if calls==2: raise RuntimeError("injected failure after optimizer step")
        return result
    monkeypatch.setattr(PPOTrainer,"update",interrupted)
    with pytest.raises(RuntimeError,match="injected failure") as error:
        runner.train_run(config)
    checkpoint=str(error.value).split("saved at ",1)[1].split(": ",1)[0]
    saved=torch.load(checkpoint,weights_only=False)
    assert saved["counters"]["updates"]==1 and saved["counters"]["decisions"]==8
    assert len(saved["opponent_pool"])==1
    monkeypatch.setattr(PPOTrainer,"update",original)
    resumed=runner.train_run(config,resume=checkpoint)
    a=torch.load(control["checkpoint"],weights_only=False); b=torch.load(resumed["checkpoint"],weights_only=False)
    for group in ("policy","value"):
        for key in a[group]: torch.testing.assert_close(a[group][key],b[group][key],rtol=0,atol=0)
    assert a["step"]==b["step"]==3
    assert torch.equal(a["rng"]["torch"],b["rng"]["torch"])
