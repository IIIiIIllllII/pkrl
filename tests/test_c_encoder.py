import ctypes as C
import json
import subprocess
from pathlib import Path
import numpy as np
from gen3rl.features.encoder import parse_condition, STATUS_IDS
from gen3rl.features.schema import TYPE_NAMES

ROOT=Path(__file__).resolve().parents[1]
ARRAY_FIELDS=["moves","types","powers","accuracy","priority","pp","disabled"]
SCALARS="hp max_hp target_hp_bucket own_status target_status own_speed estimated_target_speed weather turn switch_count forced_switch trapped wait".split()

class Observation(C.Structure):
    _fields_=[(s,C.c_int32*4) for s in ARRAY_FIELDS]+[(s,C.c_int32*2) for s in ("own_types","target_types")]+[(s,C.c_int32) for s in SCALARS]

def observation(req,ids):
    o=Observation(); own=next(p for p in req["side"]["pokemon"] if p.get("active")); target=req["public"]["target"]
    for i,m in enumerate(req["active"][0]["moves"]):
        o.moves[i]=ids[m["id"]]; o.types[i]=TYPE_NAMES.index(m["type"].lower()) if m["type"].lower() in TYPE_NAMES else 17; o.powers[i]=m.get("basePower",0)
        acc=m.get("accuracy",True); o.accuracy[i]=-1 if acc is True or acc is None else acc
        o.priority[i]=m.get("priority",0); o.pp[i]=m.get("pp",-1); o.disabled[i]=m.get("disabled",False)
    for name,values in (("own_types",own.get("types",[])),("target_types",target.get("types",[]))):
        getattr(o,name)[:]=[TYPE_NAMES.index(x.lower()) for x in values]+[-1]*(2-len(values))
    hp,mx,status=parse_condition(own["condition"]); o.hp=hp; o.max_hp=mx; o.own_status=STATUS_IDS[status]
    o.target_status=STATUS_IDS[target.get("status","")]; o.target_hp_bucket=target["hpBucket"]
    o.own_speed=own["stats"]["spe"]; o.estimated_target_speed=target["estimatedSpeed"]
    o.turn=req["public"]["turn"]; o.switch_count=sum(not p.get("active") and "fnt" not in p["condition"] for p in req["side"]["pokemon"])
    o.forced_switch=bool((req.get("forceSwitch") or [False])[0]); o.trapped=bool(req["active"][0].get("trapped") or req["active"][0].get("maybeTrapped"))
    o.wait=bool(req.get("wait") or req.get("teamPreview"))
    return o

def test_public_c_encoder_matches_all_python_fixtures(tmp_path):
    import torch
    from gen3rl.policy.lut import AdditiveLUTPolicy
    from gen3rl.export.lut import export_policy
    torch.manual_seed(110349); export_policy(AdditiveLUTPolicy(),tmp_path)
    lib=tmp_path/"encoder.so"; src=ROOT/"integration/reference"
    subprocess.run(["cc","-std=c99","-shared","-fPIC","-O2",str(src/"encoder.c"),str(tmp_path/"generated/battle_ai_rl_lut.c"),"-o",str(lib)],check=True)
    dll=C.CDLL(str(lib)); fn=dll.RlEncodePublic
    payload=json.loads((ROOT/"web-playtest/public/v1-1-parity-fixtures.json").read_text())
    catalog=json.loads(subprocess.check_output(["node",str(ROOT/"scripts/export_move_catalog.cjs")],text=True))
    ids={m["id"]:m["num"] for m in catalog}
    for fixture in payload["fixtures"]:
        o=observation(fixture["request"],ids); f=((C.c_uint8*20)*9)(); mask=(C.c_uint8*9)()
        fn(C.byref(o),f,mask)
        assert np.ctypeslib.as_array(f).tolist()==fixture["features"],fixture["name"]
        assert list(map(bool,mask))==fixture["legal_mask"],fixture["name"]
        scores=(C.c_int16*4)(); dll.BattleAiRlScore(f,scores)
        all_scores=list(scores)+[0]*5
        assert [x if mask[i] else None for i,x in enumerate(all_scores)]==fixture["integer_scores"]
        chosen=int(np.argmax(np.where(list(mask),all_scores,-32769))) if any(mask) else None
        assert chosen==fixture["integer_selected_action"]

def test_generated_c_semantics_are_current():
    from scripts.generate_c_reference import render
    assert (ROOT/"integration/reference/semantics.generated.h").read_text()==render()

def test_actual_rom_adapter_against_python_and_hidden_speed(tmp_path):
    from gen3rl.features.encoder import encode_request
    from scripts.generate_v1_1_parity_fixtures import request
    rom=ROOT/"third_party/pokeemerald"
    lib=tmp_path/"adapter.so"
    subprocess.run(["cc","-std=gnu99","-fmax-errors=4","-shared","-fPIC","-O2",
        "-iquote",str(rom/"include"),"-iquote",str(rom/"src"),str(ROOT/"tests/rom_adapter_harness.c"),
        str(rom/"src/battle_ai_rl.c"),str(rom/"src/gen3rl_encoder.c"),"-o",str(lib)],check=True)
    fn=C.CDLL(str(lib)).RunAdapter; fn.restype=C.POINTER(C.c_uint8)
    catalog=json.loads(subprocess.check_output(["node",str(ROOT/"scripts/export_move_catalog.cjs")],text=True))
    for move in catalog:
        move=dict(move,pp=10)
        if move["id"]=="hiddenpower": move.update(type="Dark",basePower=70)
        req=request("fixture",["Ghost","Steel"],[move]); req["public"]["target"]["estimatedSpeed"]=120
        expected,_=encode_request(req)
        for hidden_speed in (1,999):
            actual=np.ctypeslib.as_array(fn(move["num"],hidden_speed),shape=(180,)).reshape(9,20)
            assert actual.tolist()==expected.tolist(),move["id"]
