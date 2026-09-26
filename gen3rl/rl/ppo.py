from __future__ import annotations
from dataclasses import dataclass
import random, numpy as np
import torch
import time
import os
import tempfile
from pathlib import Path
from torch import nn

def compute_gae(rewards, values, dones, gamma=0.99, lam=0.95):
    if rewards.device.type == "cpu":
        # Same recurrence and float32 rounding, without a tiny torch dispatch
        # for every scalar operation of every transition.
        r=rewards.detach().numpy(); v=values.detach().numpy(); d=dones.detach().numpy()
        a=np.empty_like(r); last=np.float32(0)
        for t in range(len(r)-1,-1,-1):
            nxt=v[t+1] if t+1<len(v) else np.float32(0)
            delta=r[t]+np.float32(gamma)*nxt*(np.float32(1)-d[t])-v[t]
            last=delta+np.float32(gamma*lam)*(np.float32(1)-d[t])*last
            a[t]=last
        advantages=torch.from_numpy(a)
        return advantages, advantages+values
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
        self.profile={}
        self.training_state={}

    def update(self, features, masks, actions, old_logp, returns, advantages, epochs=1, minibatch_size=None):
        total_start=time.perf_counter(); timing={}
        def record(name, tick): timing[name]=timing.get(name,0.0)+time.perf_counter()-tick
        tick=time.perf_counter()
        tensors=[features,masks,actions,old_logp,returns,advantages]
        features,masks,actions,old_logp,returns,advantages=[x.to(self.device) for x in tensors]
        if not masks[torch.arange(len(actions),device=self.device),actions].all():
            raise ValueError("PPO batch contains illegal actions")
        if not all(torch.isfinite(x).all() for x in (old_logp,returns,advantages)):
            raise FloatingPointError("non-finite PPO batch")
        states=features[:,:4,:].reshape(len(features),-1).float()
        params=list(self.policy.parameters())+list(self.value.parameters())
        record("tensor_conversion_seconds",tick)
        advantages = (advantages - advantages.mean()) / (advantages.std(unbiased=False) + 1e-8)
        n=len(features); minibatch_size=min(int(minibatch_size or n),n); collected=[]
        for epoch in range(int(epochs)):
            epoch_start=time.perf_counter()
            for idx in torch.randperm(n,device=self.device).split(minibatch_size):
                tick=time.perf_counter()
                dist=self.policy.distribution(features[idx],masks[idx]); logp=dist.log_prob(actions[idx]); ratio=(logp-old_logp[idx]).exp()
                p1=ratio*advantages[idx]; p2=ratio.clamp(1-self.clip,1+self.clip)*advantages[idx]
                policy_loss=-torch.minimum(p1,p2).mean(); entropy=dist.entropy().mean()
                value_loss=(self.value(states[idx])-returns[idx]).pow(2).mean()
                loss=policy_loss+self.value_coef*value_loss-self.entropy_coef*entropy
                if not torch.isfinite(loss): raise FloatingPointError("non-finite PPO loss")
                record("forward_seconds",tick); tick=time.perf_counter()
                self.optimizer.zero_grad(); loss.backward()
                record("backward_seconds",tick); tick=time.perf_counter()
                grad=torch.nn.utils.clip_grad_norm_(params,self.gradient_clip)
                if not torch.isfinite(grad): raise FloatingPointError("non-finite gradient")
                record("gradient_clip_seconds",tick); tick=time.perf_counter()
                self.optimizer.step()
                record("optimizer_step_seconds",tick); tick=time.perf_counter()
                with torch.no_grad(): kl=(old_logp[idx]-logp).mean(); cf=((ratio-1).abs()>self.clip).float().mean()
                collected.append([float(x.detach()) for x in (policy_loss,value_loss,entropy,kl,cf,grad)])
                record("metrics_seconds",tick)
            timing[f"epoch_{epoch}_seconds"]=time.perf_counter()-epoch_start
        self.step += 1; means=np.mean(collected,axis=0)
        if not all(torch.isfinite(p).all() for p in params): raise FloatingPointError("non-finite updated parameters")
        timing["total_seconds"]=time.perf_counter()-total_start; self.profile=timing
        return PPOStats(*map(float,means))

    def checkpoint(self, path, config, metadata, counters=None, opponent_pool=None):
        from gen3rl.features.schema import SEMANTICS_REVISION
        metadata={"semantics_revision":SEMANTICS_REVISION,**metadata}
        state={"policy":self.policy.state_dict(),"value":self.value.state_dict(),"optimizer":self.optimizer.state_dict(),
                    "step":self.step,"config":config,"metadata":metadata,"counters":counters or {},"opponent_pool":opponent_pool or [],
                    "training_state":self.training_state,
                    "rng":{"python":random.getstate(),"numpy":np.random.get_state(),"torch":torch.get_rng_state(),
                           "cuda":torch.cuda.get_rng_state_all() if torch.cuda.is_available() else None}}
        path=Path(path)
        with tempfile.NamedTemporaryFile(dir=path.parent,prefix=path.name+".",suffix=".tmp",delete=False) as f:
            temporary=f.name
            try:
                torch.save(state,f); f.flush(); os.fsync(f.fileno())
                os.replace(temporary,path)
            finally:
                if os.path.exists(temporary): os.unlink(temporary)

    def load(self, path):
        state=torch.load(path, map_location=self.device, weights_only=False)
        from gen3rl.policy.lut import validate_checkpoint_schema
        validate_checkpoint_schema(state,str(path))
        self.training_state=state.get("training_state",{})
        self.policy.load_state_dict(state["policy"])
        self.value.load_state_dict(state["value"]); self.optimizer.load_state_dict(state["optimizer"]); self.step=state["step"]
        rng=state.get("rng",{});
        if rng.get("python") is not None: random.setstate(rng["python"])
        if rng.get("numpy") is not None: np.random.set_state(rng["numpy"])
        if rng.get("torch") is not None: torch.set_rng_state(rng["torch"].cpu())
        if self.device.type=="cuda" and rng.get("cuda") is not None: torch.cuda.set_rng_state_all(rng["cuda"])
        return state
