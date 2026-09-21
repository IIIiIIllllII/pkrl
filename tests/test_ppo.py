import torch
import pytest
from gen3rl.rl.ppo import compute_gae,PPOTrainer
from gen3rl.policy.lut import AdditiveLUTPolicy
from gen3rl.features.schema import FEATURE_SPECS,SCHEMA_VERSION
def test_gae_finite():
    a,r=compute_gae(torch.tensor([0.,1.]),torch.tensor([.1,.2]),torch.tensor([0.,1.]))
    assert torch.isfinite(a).all() and torch.isfinite(r).all()

def test_masked_ppo_update_and_resume(tmp_path):
    p=AdditiveLUTPolicy(); trainer=PPOTrainer(p,len(FEATURE_SPECS),gradient_clip=0.25); n=8
    assert trainer.gradient_clip == 0.25
    features=torch.zeros((n,9,len(FEATURE_SPECS)),dtype=torch.long); masks=torch.zeros((n,9),dtype=torch.bool); masks[:,:4]=True; masks[0]=False; masks[0,4]=True
    actions=torch.tensor([4]+[0]*(n-1))
    with torch.no_grad(): old=p.distribution(features,masks).log_prob(actions)
    stats=trainer.update(features,masks,actions,old,torch.zeros(n),torch.arange(n,dtype=torch.float),epochs=2,minibatch_size=4)
    assert all(torch.isfinite(torch.tensor(x)) for x in stats.__dict__.values())
    path=tmp_path/'resume.pt'; trainer.checkpoint(path,{}, {"feature_schema_version":SCHEMA_VERSION},{"decisions":123},["snapshot.pt"])
    other=PPOTrainer(AdditiveLUTPolicy(),len(FEATURE_SPECS)); state=other.load(path)
    assert state['counters']['decisions']==123 and state['opponent_pool']==['snapshot.pt'] and other.step==trainer.step

def test_v1_checkpoint_is_rejected_by_v1_1_loader(tmp_path):
    trainer=PPOTrainer(AdditiveLUTPolicy(),len(FEATURE_SPECS)); path=tmp_path/'old-v1.pt'
    trainer.checkpoint(path,{}, {"feature_schema_version":"gen3-lut-v1"})
    with pytest.raises(ValueError,match="not compatible with v1.1"):
        PPOTrainer(AdditiveLUTPolicy(),len(FEATURE_SPECS)).load(path)
