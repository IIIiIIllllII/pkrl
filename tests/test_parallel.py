import numpy as np
import pytest
import torch

from gen3rl.features.schema import FEATURE_SPECS
from gen3rl.parallel import RolloutPool, derive_battle_seed, initial_seed_schedule, validate_policy_versions
from gen3rl.policy.lut import AdditiveLUTPolicy
from gen3rl.rl.ppo import PPOTrainer
from gen3rl.runner import _batch_episode

def test_generation_and_frozen_policy_are_reproducible():
    torch.manual_seed(501); policy=AdditiveLUTPolicy(); snapshots=[]
    for _ in range(2):
        with RolloutPool(2,411) as pool:
            results,_=pool.collect(policy,9,0,{"synthetic":1.0},{"random":1.0},target_decisions=128)
        snapshot=[]
        for result in results:
            snapshot.append((result["battle_index"],result["reward"],[t[2] for t in result["traces"]]))
            for features,mask,action,logp,_ in result["traces"]:
                with torch.no_grad(): expected=policy.distribution(torch.as_tensor(features)[None],torch.as_tensor(mask)[None]).log_prob(torch.tensor([action])).item()
                assert abs(logp-expected)<1e-5
        snapshots.append(snapshot)
    assert snapshots[0]==snapshots[1]


def test_worker_seed_schedule_is_reproducible_and_disjoint():
    first=initial_seed_schedule(9917,4)
    assert first==initial_seed_schedule(9917,4)
    assert len({row["worker_seed"] for row in first})==4
    assert len({derive_battle_seed(9917,i) for i in range(100)})==100
    with pytest.raises(RuntimeError,match="mixed policy versions"):
        validate_policy_versions([{"policy_version":2},{"policy_version":3}],2)


def test_parallel_rollout_is_versioned_unique_legal_and_ppo_ready():
    policy=AdditiveLUTPolicy()
    with RolloutPool(2,44001) as pool:
        results,metrics=pool.collect(policy,7,0,{"synthetic":1.0},{"damage":1.0},max_battles=4)
    assert len(results)==4 and metrics["policy_version"]==7
    assert len({row["battle_id"] for row in results})==4
    assert {row["worker_id"] for row in results}=={0,1}
    batches=[]
    trainer=PPOTrainer(policy,len(FEATURE_SPECS))
    for row in results:
        assert row["policy_version"]==7 and row["illegal_actions"]==0
        assert row["traces"]
        assert row["reward"]==(1.0 if row["winner"]=="p1" else -1.0 if row["winner"]=="p2" else 0.0)
        for features,mask,action,logp,_ in row["traces"]:
            assert features.shape==(9,len(FEATURE_SPECS))
            assert mask.shape==(9,) and mask[action]
            assert np.isfinite(logp)
        batches.append(_batch_episode(trainer,row["traces"],row["reward"]))
    # Arrival order is irrelevant: complete episodes are concatenated before
    # GAE/PPO, and each episode computes its own terminal bootstrap boundary.
    joined=[torch.cat([batch[i] for batch in reversed(batches)]) for i in range(6)]
    stats=trainer.update(*joined)
    assert all(np.isfinite(value) for value in stats.__dict__.values())
