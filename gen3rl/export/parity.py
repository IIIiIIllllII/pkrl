from __future__ import annotations
import ctypes, json, subprocess, tempfile
from pathlib import Path
import numpy as np
from gen3rl.features.schema import FEATURE_SPECS, FEATURE_INDEX, PAIR_SPECS
from .lut import integer_score

def verify(root=Path("artifacts"), samples=5000, seed=17):
    root=Path(root); q={k:np.asarray(v,dtype=np.int8) for k,v in json.loads((root/"lut_quantized.json").read_text()).items()}
    rng=np.random.default_rng(seed); vectors=np.empty((samples,4,len(FEATURE_SPECS)),dtype=np.uint8)
    for i,s in enumerate(FEATURE_SPECS): vectors[:,:,i]=rng.integers(0,s.size,size=(samples,4),dtype=np.uint8)
    expected=np.stack([integer_score(q,x) for x in vectors])
    floats={k:v for k,v in np.load(root/"lut_float.npz").items()}
    def float_score(x):
        score=floats["action_bias"].copy()
        for j,spec in enumerate(FEATURE_SPECS): score += floats[f"feature_{spec.name}"][x[:,j]]
        for a,b in PAIR_SPECS: score += floats[f"pair_{a}_{b}"][x[:,FEATURE_INDEX[a]],x[:,FEATURE_INDEX[b]]]
        return score
    float_scores=np.stack([float_score(x) for x in vectors])
    scale=json.loads((root/"lut_manifest.json").read_text())["scale"]
    restored=expected.astype(np.float64)/scale
    agreement=float(np.mean(np.argmax(float_scores,axis=1)==np.argmax(expected,axis=1)))
    float_ties=float(np.mean(np.sum(float_scores==float_scores.max(axis=1,keepdims=True),axis=1)>1))
    int_ties=float(np.mean(np.sum(expected==expected.max(axis=1,keepdims=True),axis=1)>1))
    with tempfile.TemporaryDirectory(prefix="gen3rl-parity-") as td:
        lib=Path(td)/"liblut.so"; subprocess.run(["cc","-std=c99","-shared","-fPIC","-O2",
             "-I",str(root/"generated"),str(root/"generated/battle_ai_rl_lut.c"),"-o",str(lib)],check=True)
        dll=ctypes.CDLL(str(lib)); fn=dll.BattleAiRlScore
        F=(ctypes.c_uint8*len(FEATURE_SPECS))*4; O=ctypes.c_int16*4
        for i,x in enumerate(vectors):
            f=F(*( (ctypes.c_uint8*len(FEATURE_SPECS))(*row) for row in x)); out=O(); fn(f,out)
            if not np.array_equal(np.frombuffer(out,dtype=np.int16),expected[i]): raise AssertionError(f"C parity mismatch at {i}")
    error=np.abs(restored-float_scores)
    return {"samples":samples,"integer_python_c_exact":True,"integer_max_error":0,
            "top1_agreement":agreement,"score_mae":float(error.mean()),"max_score_error":float(error.max()),
            "float_tie_rate":float_ties,"quantized_tie_rate":int_ties,
            "table_bytes":sum(v.size for v in q.values())}
