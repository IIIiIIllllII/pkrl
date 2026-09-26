import itertools
import json
import subprocess
from pathlib import Path
import pytest
from gen3rl.features.move_semantics import damage_effectiveness, classify_move, effectiveness_feature, MoveClass
from gen3rl.features.schema import TYPE_NAMES
from gen3rl.features.encoder import encode_request

ROOT=Path(__file__).resolve().parents[1]

def test_entire_gen3_chart_against_pinned_showdown():
    code="""
const {Dex}=require('./third_party/pokemon-showdown/dist/sim/dex'); const d=Dex.mod('gen3');
const types=d.types.names(); let rows=[];
for(const a of types) for(const b of types) for(const c of types) {
 const ds=b===c?[b]:[b,c]; const e=ds.reduce((s,t)=>s+d.getEffectiveness(a,t),0);
 rows.push([a,ds,ds.some(t=>!d.getImmunity(a,t))?0:e<=-2?1:e===-1?2:e===0?3:e===1?4:5]);
} console.log(JSON.stringify(rows));
"""
    rows=json.loads(subprocess.check_output(["node","-e",code],cwd=ROOT,text=True))
    assert len(rows)==17**3
    for attack,defenders,expected in rows:
        assert damage_effectiveness(attack,defenders)==expected,(attack,defenders)

def test_every_gen3_move_class_agrees_with_bridge():
    code="""
const {Dex}=require('./third_party/pokemon-showdown/dist/sim/dex'); const d=Dex.mod('gen3');
const {resolveMoveSemantics}=require('./showdown_bridge/dist/move-semantics');
const moves=require('./scripts/export_move_catalog.cjs');
console.log(JSON.stringify(moves.map(m=>[m,resolveMoveSemantics(d,d.moves.get(m.id),m.type,m.basePower,['Ghost','Steel'])])));
"""
    rows=json.loads(subprocess.check_output(["node","-e",code],cwd=ROOT,text=True))
    assert len({m["num"] for m,_ in rows})==354
    for move,expected in rows:
        assert ("normal-damage","fixed-damage","status")[classify_move(move)]==expected["moveClass"],move
        assert effectiveness_feature(move,["Ghost","Steel"])==expected["effectivenessBucket"],move

@pytest.mark.parametrize("mid,typ,types,want",[
    ("struggle","Normal",["Ghost"],3),("futuresight","Psychic",["Dark"],3),
    ("doomdesire","Steel",["Water"],3),("fissure","Ground",["Flying"],0),
    ("sheercold","Ice",["Ice"],3),("bide","Normal",["Ghost"],0),
    ("glare","Normal",["Ghost"],0),("confuseray","Ghost",["Normal"],3),
    ("magnitude","Ground",["Flying"],0),("dreameater","Psychic",["Normal"],0),
])
def test_additional_gen3_exceptions(mid,typ,types,want):
    move={"id":mid,"type":typ,"basePower":50 if mid in {"struggle","dreameater"} else 0}
    assert effectiveness_feature(move,types)==want

@pytest.mark.parametrize("field",["trapped","maybeTrapped","wait","teamPreview"])
def test_mask_rejects_unavailable_switches(field):
    req={"active":[{"moves":[]}],"side":{"pokemon":[{"active":False,"condition":"10/10"}]}}
    if field in {"wait","teamPreview"}: req[field]=True
    else: req["active"][0][field]=True
    assert not encode_request(req)[1].any()
