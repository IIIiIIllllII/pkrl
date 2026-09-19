from __future__ import annotations
import json
from pathlib import Path
import numpy as np
from gen3rl.features.schema import FEATURE_SPECS, FEATURE_INDEX, PAIR_SPECS, SCHEMA_VERSION

def collect(policy):
    return {"action_bias":policy.action_bias.detach().cpu().numpy(),
            **{f"feature_{s.name}":p.detach().cpu().numpy() for s,p in zip(FEATURE_SPECS,policy.tables)},
            **{f"pair_{a}_{b}":p.detach().cpu().numpy() for (a,b),p in zip(PAIR_SPECS,policy.pairs)}}

def quantize(tables, scale=None):
    maxabs=max(float(np.max(np.abs(v))) for v in tables.values()) or 1.0
    scale=float(scale or 127/maxabs)
    return {k:np.clip(np.rint(v*scale),-127,127).astype(np.int8) for k,v in tables.items()},scale

def integer_score(q, features):
    scores=q["action_bias"].astype(np.int32).copy()
    for i,s in enumerate(FEATURE_SPECS): scores += q[f"feature_{s.name}"][features[:4,i]].astype(np.int32)
    for a,b in PAIR_SPECS: scores += q[f"pair_{a}_{b}"][features[:4,FEATURE_INDEX[a]],features[:4,FEATURE_INDEX[b]]].astype(np.int32)
    return np.clip(scores,-32768,32767).astype(np.int16)

def export_policy(policy, output=Path("artifacts")):
    output=Path(output); generated=output/"generated"; generated.mkdir(parents=True,exist_ok=True)
    tables=collect(policy); q,scale=quantize(tables); np.savez(output/"lut_float.npz",**tables)
    (output/"lut_quantized.json").write_text(json.dumps({k:v.tolist() for k,v in q.items()},separators=(",",":")))
    offsets={}; flat=[]
    for name,arr in q.items(): offsets[name]={"offset":len(flat),"shape":list(arr.shape)}; flat.extend(arr.flatten().tolist())
    manifest={"schema_version":SCHEMA_VERSION,"scale":scale,"parameters":len(flat),"bytes":len(flat),"tables":offsets}
    (output/"lut_manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    enums="\n".join(f"#define RL_FEATURE_{s.name.upper()} {i}" for i,s in enumerate(FEATURE_SPECS))
    (generated/"battle_ai_rl_lut.h").write_text("""#ifndef GUARD_BATTLE_AI_RL_LUT_H\n#define GUARD_BATTLE_AI_RL_LUT_H\n#include <stdint.h>\n#define RL_FEATURE_COUNT %d\n#define RL_LUT_PARAMETERS %d\n%s\nextern const int8_t gBattleAiRlLut[RL_LUT_PARAMETERS];\nvoid BattleAiRlScore(const uint8_t features[4][RL_FEATURE_COUNT], int16_t scores[4]);\n#endif\n"""%(len(FEATURE_SPECS),len(flat),enums))
    terms=[]
    for i,s in enumerate(FEATURE_SPECS): terms.append(f"gBattleAiRlLut[{offsets['feature_'+s.name]['offset']} + features[m][{i}]]")
    for a,b in PAIR_SPECS:
        key=f"pair_{a}_{b}"; width=FEATURE_SPECS[FEATURE_INDEX[b]].size
        terms.append(f"gBattleAiRlLut[{offsets[key]['offset']} + features[m][{FEATURE_INDEX[a]}] * {width} + features[m][{FEATURE_INDEX[b]}]]")
    data=",".join(map(str,flat)); expr=" + ".join(terms)
    (generated/"battle_ai_rl_lut.c").write_text(f'''#include "battle_ai_rl_lut.h"\nconst int8_t gBattleAiRlLut[RL_LUT_PARAMETERS] = {{{data}}};\nvoid BattleAiRlScore(const uint8_t f[4][RL_FEATURE_COUNT], int16_t out[4]) {{\n  for (unsigned m=0;m<4;m++) {{ int32_t s=gBattleAiRlLut[m] + {expr.replace('features','f')};\n    if(s>32767)s=32767; if(s<-32768)s=-32768; out[m]=(int16_t)s; }}\n}}\n''')
    return manifest,q

