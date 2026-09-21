from pathlib import Path
import numpy as np
from gen3rl.policy.lut import AdditiveLUTPolicy
from gen3rl.export.lut import export_policy, integer_score
from gen3rl.features.schema import FEATURE_SPECS, SCHEMA_VERSION

def test_export_integer_bounds(tmp_path: Path):
    _,q=export_policy(AdditiveLUTPolicy(),tmp_path)
    x=np.zeros((9,len(FEATURE_SPECS)),dtype=np.int64); s=integer_score(q,x)
    assert s.dtype==np.int16 and len(s)==4

def test_integer_sum_extremes_and_ties(tmp_path: Path):
    import torch
    p=AdditiveLUTPolicy()
    x=np.zeros((9,len(FEATURE_SPECS)),dtype=np.int64)
    for value,sign in ((127,1),(-127,-1),(0,0)):
        with torch.no_grad():
            for parameter in p.parameters(): parameter.fill_(float(sign))
        _,q=export_policy(p,tmp_path)
        if sign: q={k:np.full_like(v,value) for k,v in q.items()}
        score=integer_score(q,x)
        assert np.all(score==value*(1+len(FEATURE_SPECS)+5))
        assert len(set(score.tolist()))==1

def test_generated_c_uses_wide_accumulator_and_explicit_saturation(tmp_path: Path):
    export_policy(AdditiveLUTPolicy(),tmp_path)
    source=(tmp_path/'generated/battle_ai_rl_lut.c').read_text()
    assert 'int32_t s=' in source and 'if(s>32767)' in source and 'if(s<-32768)' in source
    assert f'#define RL_FEATURE_SCHEMA "{SCHEMA_VERSION}"' in (tmp_path/'generated/battle_ai_rl_lut.h').read_text()
    assert '#define RL_FEATURE_SCHEMA_REVISION 101' in (tmp_path/'generated/battle_ai_rl_lut.h').read_text()

def test_pokeemerald_wrapper_clamps_before_narrowing():
    root=Path(__file__).resolve().parents[1]
    source=(root/'third_party/pokeemerald/src/battle_ai_rl.c').read_text()
    assert 's32 value;' in source
    assert 'moveScores[slot] = (s8)value;' in source

def test_pokeemerald_v1_1_encoder_has_class_specific_effectiveness():
    root=Path(__file__).resolve().parents[1]
    source=(root/'third_party/pokeemerald/src/battle_ai_rl.c').read_text()
    assert 'if (moveClass == 0) return chart;' in source
    assert 'if (moveClass == 1) return chart == 0 ? 0 : 3;' in source
    assert 'StatusMoveApplicable(move, moveType, target) ? 3 : 0' in source
    assert 'MOVE_THUNDER_WAVE' in source and 'MOVE_LEECH_SEED' in source
    assert 'RL_FEATURE_SCHEMA_REVISION != 101' in source
