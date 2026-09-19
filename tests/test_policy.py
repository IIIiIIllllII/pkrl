import numpy as np
import torch
from gen3rl.features.schema import FEATURE_SPECS
from gen3rl.policy.lut import AdditiveLUTPolicy, NumpyLUTActor

def test_forward_mask_gradient():
    p=AdditiveLUTPolicy(); x=torch.zeros((2,9,len(FEATURE_SPECS)),dtype=torch.long)
    mask=torch.zeros((2,9),dtype=torch.bool); mask[:,:4]=True; mask[:,2]=False
    logits=p(x,mask); assert torch.all(logits[:,2] < -1e8)
    p.distribution(x,mask).entropy().mean().backward()
    assert any(v.grad is not None for v in p.parameters())

def test_no_legal_rejected():
    p=AdditiveLUTPolicy(); x=torch.zeros((1,9,len(FEATURE_SPECS)),dtype=torch.long)
    try: p(x,torch.zeros((1,9),dtype=torch.bool))
    except ValueError: return
    assert False

def test_forced_single_switch_is_selected_and_has_zero_entropy():
    p=AdditiveLUTPolicy(); x=torch.zeros((1,9,len(FEATURE_SPECS)),dtype=torch.long)
    mask=torch.zeros((1,9),dtype=torch.bool); mask[0,4]=True
    dist=p.distribution(x,mask)
    assert int(dist.sample())==4
    assert float(dist.entropy().detach())==0.0

def test_numpy_actor_matches_torch_logits_and_log_probability():
    torch.manual_seed(17)
    rng = np.random.default_rng(17)
    policy = AdditiveLUTPolicy()
    features = np.zeros((9, len(FEATURE_SPECS)), dtype=np.int64)
    for column, spec in enumerate(FEATURE_SPECS):
        features[:, column] = rng.integers(0, spec.size, size=9)
    mask = np.array([True, False, True, True, False, True, False, False, False])
    actor = NumpyLUTActor(policy)
    np_logits = actor.logits(features, mask)
    torch_logits = policy(
        torch.as_tensor(features).unsqueeze(0),
        torch.as_tensor(mask).unsqueeze(0),
    )[0].detach().numpy()
    assert np.allclose(np_logits[mask], torch_logits[mask], atol=1e-6)
    action, logp = actor.act(features, mask, deterministic=True)
    expected = torch.distributions.Categorical(logits=torch.as_tensor(torch_logits)).log_prob(torch.tensor(action))
    assert abs(logp - float(expected)) < 1e-6

def test_numpy_actor_forced_switch():
    policy = AdditiveLUTPolicy()
    features = np.zeros((9, len(FEATURE_SPECS)), dtype=np.int64)
    mask = np.zeros(9, dtype=bool)
    mask[7] = True
    action, logp = NumpyLUTActor(policy).act(features, mask)
    assert action == 7
    assert abs(logp) < 1e-12
