from __future__ import annotations
import torch
from torch import nn
from gen3rl.features.schema import FEATURE_SPECS, FEATURE_INDEX, PAIR_SPECS, MOVE_ACTIONS, parameter_count
import numpy as np
from gen3rl.features.schema import SCHEMA_VERSION

def validate_checkpoint_schema(state, source="checkpoint"):
    actual=state.get("metadata",{}).get("feature_schema_version")
    if actual != SCHEMA_VERSION:
        raise ValueError(f"{source} uses feature schema {actual!r}; expected {SCHEMA_VERSION}. "
                         "v1 weights are not compatible with v1.1 semantics")

class AdditiveLUTPolicy(nn.Module):
    """No hidden layers: every move logit is exactly a sum of table entries."""
    def __init__(self):
        super().__init__()
        self.action_bias = nn.Parameter(torch.zeros(MOVE_ACTIONS))
        self.tables = nn.ParameterList([nn.Parameter(torch.zeros(f.size)) for f in FEATURE_SPECS])
        self.pairs = nn.ParameterList([
            nn.Parameter(torch.zeros(FEATURE_SPECS[FEATURE_INDEX[a]].size, FEATURE_SPECS[FEATURE_INDEX[b]].size))
            for a, b in PAIR_SPECS
        ])
        for p in self.parameters(): nn.init.normal_(p, std=0.01)

    @property
    def parameter_count(self): return parameter_count()

    def forward(self, features: torch.Tensor, legal_mask: torch.Tensor) -> torch.Tensor:
        # features [batch, actions, feature], deployment policy covers move slots 0..3.
        # Switch actions intentionally have neutral, non-trainable logits in v1.
        # They must start at zero so a forced-switch-only request remains valid.
        scores = torch.zeros(legal_mask.shape, dtype=torch.float32, device=features.device)
        move = self.action_bias.unsqueeze(0).expand(features.shape[0], -1).clone()
        for i, table in enumerate(self.tables): move = move + table[features[:, :MOVE_ACTIONS, i]]
        for table, (a, b) in zip(self.pairs, PAIR_SPECS):
            move = move + table[features[:, :MOVE_ACTIONS, FEATURE_INDEX[a]], features[:, :MOVE_ACTIONS, FEATURE_INDEX[b]]]
        scores[:, :MOVE_ACTIONS] = move
        # Experimental switch logits are neutral and not exported in ROM v1.
        scores = scores.masked_fill(~legal_mask, -1e9)
        if (~legal_mask).all(dim=1).any(): raise ValueError("state has no legal action")
        return scores

    def distribution(self, features, legal_mask):
        return torch.distributions.Categorical(logits=self(features, legal_mask))

class NumpyLUTActor:
    """Low-overhead single-state actor using an immutable snapshot of LUT weights."""
    def __init__(self, policy: AdditiveLUTPolicy):
        self.bias=policy.action_bias.detach().cpu().numpy().copy()
        self.tables=[p.detach().cpu().numpy().copy() for p in policy.tables]
        self.pairs=[p.detach().cpu().numpy().copy() for p in policy.pairs]
    def logits(self, features, mask):
        scores=np.zeros(len(mask),dtype=np.float32); move=self.bias.copy()
        for i,table in enumerate(self.tables): move += table[features[:MOVE_ACTIONS,i]]
        for table,(a,b) in zip(self.pairs,PAIR_SPECS): move += table[features[:MOVE_ACTIONS,FEATURE_INDEX[a]],features[:MOVE_ACTIONS,FEATURE_INDEX[b]]]
        scores[:MOVE_ACTIONS]=move; scores[~mask]=-np.inf; return scores
    def act(self, features, mask, deterministic=False):
        scores=self.logits(features,mask)
        if deterministic: action=int(np.argmax(scores))
        else:
            finite=np.isfinite(scores); shifted=scores[finite]-np.max(scores[finite]); probs=np.exp(shifted,dtype=np.float64); probs/=probs.sum()
            action=int(np.random.choice(np.flatnonzero(finite),p=probs))
        finite=np.isfinite(scores); denom=np.log(np.exp(scores[finite]-np.max(scores[finite]),dtype=np.float64).sum())+np.max(scores[finite])
        return action,float(scores[action]-denom)
