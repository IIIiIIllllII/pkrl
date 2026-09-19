from __future__ import annotations
import random
class RandomLegalAgent:
    def __init__(self, seed=0): self.rng=random.Random(seed)
    def choose(self, legal, request=None): return self.rng.choice(legal)
class DamageHeuristicAgent:
    def choose(self, legal, request=None):
        moves=((request or {}).get("active") or [{}])[0].get("moves",[])
        def score(a):
            if a["index"]>=4: return -1
            m=moves[a["index"]] if a["index"]<len(moves) else {}
            return int(m.get("basePower",0))*int(m.get("accuracy",100) is True or m.get("accuracy",100))
        return max(legal,key=score)
class VanillaInspiredAgent(DamageHeuristicAgent): pass
class SelfPlaySnapshotAgent:
    def __init__(self, policy): self.policy=policy

