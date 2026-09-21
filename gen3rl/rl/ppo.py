from __future__ import annotations
from dataclasses import dataclass
import random, numpy as np
import torch
from torch import nn

def compute_gae(rewards, values, dones, gamma=0.99, lam=0.95):
    advantages = torch.zeros_like(rewards); last = torch.zeros((), device=rewards.device)
    for t in reversed(range(len(rewards))):
        next_value = torch.zeros((), device=values.device) if t == len(rewards)-1 else values[t+1]
        delta = rewards[t] + gamma * next_value * (1-dones[t]) - values[t]
        last = delta + gamma * lam * (1-dones[t]) * last; advantages[t] = last
    return advantages, advantages + values

class ValueNetwork(nn.Module):
    def __init__(self, n_features: int):
        super().__init__(); self.net = nn.Sequential(nn.Linear(n_features, 64), nn.Tanh(), nn.Linear(64, 1))
    def forward(self, x): return self.net(x.float()).squeeze(-1)

@dataclass
class PPOStats:
    policy_loss: float; value_loss: float; entropy: float; approx_kl: float; clip_fraction: float; grad_norm: float

class PPOTrainer:
    def __init__(self, policy, n_features, lr=3e-4, clip=0.2, entropy_coef=0.01, value_coef=0.5, gradient_clip=0.5, device="cpu"):
        self.device=torch.device(device); self.policy = policy.to(self.device); self.value = ValueNetwork(n_features*4).to(self.device); self.clip = clip
        self.entropy_coef = entropy_coef; self.value_coef = value_coef
        self.gradient_clip = float(gradient_clip)
        self.optimizer = torch.optim.Adam(list(policy.parameters()) + list(self.value.parameters()), lr=lr); self.step = 0

    def update(self, features, masks, actions, old_logp, returns, advantages, epochs=1, minibatch_size=None):
        tensors=[features,masks,actions,old_logp,returns,advantages]
        features,masks,actions,old_logp,returns,advantages=[x.to(self.device) for x in tensors]
        advantages = (advantages - advantages.mean()) / (advantages.std(unbiased=False) + 1e-8)
        n=len(features); minibatch_size=min(int(minibatch_size or n),n); collected=[]
        for _ in range(int(epochs)):
            for idx in torch.randperm(n,device=self.device).split(minibatch_size):
                dist=self.policy.distribution(features[idx],masks[idx]); logp=dist.log_prob(actions[idx]); ratio=(logp-old_logp[idx]).exp()
                p1=ratio*advantages[idx]; p2=ratio.clamp(1-self.clip,1+self.clip)*advantages[idx]
                policy_loss=-torch.minimum(p1,p2).mean(); entropy=dist.entropy().mean()
                state=features[idx,:4,:].reshape(len(idx),-1).float(); value_loss=(self.value(state)-returns[idx]).pow(2).mean()
                loss=policy_loss+self.value_coef*value_loss-self.entropy_coef*entropy
                if not torch.isfinite(loss): raise FloatingPointError("non-finite PPO loss")
                self.optimizer.zero_grad(); loss.backward()
                params=list(self.policy.parameters())+list(self.value.parameters()); grad=torch.nn.utils.clip_grad_norm_(params,self.gradient_clip)
                if not torch.isfinite(grad): raise FloatingPointError("non-finite gradient")
                self.optimizer.step()
                with torch.no_grad(): kl=(old_logp[idx]-logp).mean(); cf=((ratio-1).abs()>self.clip).float().mean()
                collected.append([float(x.detach()) for x in (policy_loss,value_loss,entropy,kl,cf,grad)])
        self.step += 1; means=np.mean(collected,axis=0)
        return PPOStats(*map(float,means))

    def checkpoint(self, path, config, metadata, counters=None, opponent_pool=None):
        torch.save({"policy":self.policy.state_dict(),"value":self.value.state_dict(),"optimizer":self.optimizer.state_dict(),
                    "step":self.step,"config":config,"metadata":metadata,"counters":counters or {},"opponent_pool":opponent_pool or [],
                    "rng":{"python":random.getstate(),"numpy":np.random.get_state(),"torch":torch.get_rng_state(),
                           "cuda":torch.cuda.get_rng_state_all() if torch.cuda.is_available() else None}}, path)

    def load(self, path):
        state=torch.load(path, map_location=self.device, weights_only=False)
        from gen3rl.policy.lut import validate_checkpoint_schema
        validate_checkpoint_schema(state,str(path))
        self.policy.load_state_dict(state["policy"])
        self.value.load_state_dict(state["value"]); self.optimizer.load_state_dict(state["optimizer"]); self.step=state["step"]
        rng=state.get("rng",{});
        if rng.get("python") is not None: random.setstate(rng["python"])
        if rng.get("numpy") is not None: np.random.set_state(rng["numpy"])
        if rng.get("torch") is not None: torch.set_rng_state(rng["torch"].cpu())
        if self.device.type=="cuda" and rng.get("cuda") is not None: torch.cuda.set_rng_state_all(rng["cuda"])
        return state
