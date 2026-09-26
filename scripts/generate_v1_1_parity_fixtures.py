#!/usr/bin/env python3
"""Generate deterministic Python-reference fixtures for TypeScript parity."""
from __future__ import annotations

import json
import subprocess
import copy
from pathlib import Path

import numpy as np
import torch

from gen3rl.export.lut import collect, quantize, integer_score
from gen3rl.features.encoder import encode_request
from gen3rl.features.schema import FEATURE_SPECS, FEATURE_INDEX, PAIR_SPECS, SCHEMA_VERSION
from gen3rl.features.move_semantics import classify_move, effectiveness_feature, MoveClass
from gen3rl.policy.lut import AdditiveLUTPolicy, NumpyLUTActor

ROOT=Path(__file__).resolve().parents[1]

def request(species, types, moves, own="Gyarados"):
    return {"active":[{"moves":moves}],"side":{"pokemon":[
      {"active":True,"details":own,"condition":"280/300","types":["Water","Flying"],"stats":{"spe":198}},
      {"active":False,"details":"Metagross","condition":"300/300"},
    ]},"public":{"target":{"species":species,"hpBucket":4,"status":"","types":types,"estimatedSpeed":180},"weather":"","turn":3}}

CASES = [
  ("Gyarados vs Skarmory", "Skarmory", ["Steel","Flying"], [
    {"id":"earthquake","move":"Earthquake","type":"Ground","basePower":100,"accuracy":100,"pp":16},
    {"id":"hiddenpower","move":"Hidden Power Rock 70","type":"Rock","basePower":70,"accuracy":100,"pp":24},
  ]),
  ("Dragon Dance vs Skarmory", "Skarmory", ["Steel","Flying"], [
    {"id":"dragondance","move":"Dragon Dance","type":"Dragon","basePower":0,"accuracy":True,"pp":32,"self":{"boosts":{"atk":1,"spe":1}}},
    {"id":"earthquake","move":"Earthquake","type":"Ground","basePower":100,"accuracy":100,"pp":16},
  ]),
  ("Toxic vs Steel", "Metagross", ["Steel","Psychic"], [
    {"id":"toxic","move":"Toxic","type":"Poison","basePower":0,"accuracy":85,"pp":16,"status":"tox"},
    {"id":"recover","move":"Recover","type":"Normal","basePower":0,"accuracy":True,"pp":16},
  ]),
  ("Thunder Wave vs Ground", "Swampert", ["Water","Ground"], [
    {"id":"thunderwave","move":"Thunder Wave","type":"Electric","basePower":0,"accuracy":100,"pp":32,"status":"par"},
    {"id":"hiddenpower","move":"Hidden Power Grass 70","type":"Grass","basePower":70,"accuracy":100,"pp":24},
  ]),
  ("Seismic Toss vs Ghost", "Gengar", ["Ghost","Poison"], [
    {"id":"seismictoss","move":"Seismic Toss","type":"Fighting","basePower":0,"accuracy":100,"pp":32,"fixedDamage":"level","isDamageMove":True},
    {"id":"toxic","move":"Toxic","type":"Poison","basePower":0,"accuracy":85,"pp":16,"status":"tox"},
  ]),
  ("Night Shade vs Normal", "Blissey", ["Normal"], [
    {"id":"nightshade","move":"Night Shade","type":"Ghost","basePower":0,"accuracy":100,"pp":24,"fixedDamage":"level","isDamageMove":True},
    {"id":"willowisp","move":"Will-O-Wisp","type":"Fire","basePower":0,"accuracy":75,"pp":24,"status":"brn"},
  ]),
]

def main():
    torch.manual_seed(110349)
    policy=AdditiveLUTPolicy(); actor=NumpyLUTActor(policy); tables=collect(policy)
    asset={"asset_version":1,"policy_id":"v1.1-parity-synthetic","schema_version":SCHEMA_VERSION,
      "checkpoint_decisions":0,"simulator":{"format":"gen3customgame","pokemon_showdown_commit":"2ddfa0476f8207e12e204b1c69f7c7683b17633c"},
      "inference":"float32-additive-lut-argmax","switch_logits":"neutral-zero-v1","parameter_count":sum(v.size for v in tables.values()),
      "feature_sizes":{s.name:s.size for s in FEATURE_SPECS},"pair_specs":[list(x) for x in PAIR_SPECS],
      "tables":{k:np.asarray(v,dtype=np.float32).tolist() for k,v in tables.items()}}
    fixtures=[]; quantized,scale=quantize(tables)
    offsets={}; offset=0
    for key,table in tables.items(): offsets[key]=offset; offset+=table.size
    catalog=json.loads(subprocess.check_output(["node",str(ROOT/"scripts/export_move_catalog.cjs")],text=True))
    cases=list(CASES)
    for move in catalog:
        for types in (["Normal"],["Ghost","Steel"],["Water","Ground"]):
            cases.append((move["id"]+" vs "+"/".join(types),"fixture",types,[move]))
    def append(name,req):
        types=req["public"]["target"]["types"]; moves=req["active"][0]["moves"]
        features,mask=encode_request(req); scores=actor.logits(features,mask) if mask.any() else np.full(9,-np.inf)
        ints=np.zeros(9,dtype=np.int32); ints[:4]=integer_score(quantized,features)
        activated=[]
        for i,row in enumerate(features[:4]):
            ids=[i]+[offsets["feature_"+s.name]+int(row[j]) for j,s in enumerate(FEATURE_SPECS)]
            ids += [offsets[f"pair_{a}_{b}"]+int(row[FEATURE_INDEX[a]])*FEATURE_SPECS[FEATURE_INDEX[b]].size+int(row[FEATURE_INDEX[b]]) for a,b in PAIR_SPECS]
            activated.append(ids)
        fixtures.append({"name":name,"request":req,"resolved_defender_types":types,"features":features.tolist(),"legal_mask":mask.tolist(),
          "activated_feature_ids":activated,
          "move_semantics":[{"move_class":("normal-damage","fixed-damage","status")[int(classify_move(m))],
            "applicable":effectiveness_feature(m,types,req["public"]["target"]["status"])!=0,
            "effectiveness_bucket":int(effectiveness_feature(m,types,req["public"]["target"]["status"]))} for m in moves],
          "integer_scores":[int(x) if mask[i] else None for i,x in enumerate(ints)],
          "integer_selected_action":int(np.argmax(np.where(mask,ints,-32769))) if mask.any() else None,
          "scores":[None if not np.isfinite(x) else float(x) for x in scores],"selected_action":int(np.argmax(scores)) if mask.any() else None})
    for name,species,types,moves in cases: append(name,request(species,types,moves))
    base=request("fixture",["Ghost","Steel"],[next(m for m in catalog if m["id"]==mid) for mid in ("toxic","dreameater","nightmare","protect")])
    for hp in (0,1,25,26,50,51,75,76,100):
        req=copy.deepcopy(base); req["side"]["pokemon"][0]["condition"]=f"{hp}/100"
        append(f"hp boundary {hp}",req)
    for status in ("brn","par","psn","tox","slp","frz"):
        req=copy.deepcopy(base); req["public"]["target"]["status"]=status
        append(f"target status {status}",req)
    for mode in ("forced","trapped","maybeTrapped","disabled","empty_pp","wait","teamPreview"):
        req=copy.deepcopy(base)
        if mode=="forced": req["forceSwitch"]=[True]
        elif mode in {"trapped","maybeTrapped"}: req["active"][0][mode]=True
        elif mode in {"wait","teamPreview"}: req[mode]=True
        else:
            for m in req["active"][0]["moves"]: m["disabled" if mode=="disabled" else "pp"]=True if mode=="disabled" else 0
        append(mode,req)
    output=ROOT/"web-playtest/public/v1-1-parity-fixtures.json"
    output.write_text('{"schema_version":'+json.dumps(SCHEMA_VERSION)+',"quantization_scale":'+str(scale)+',"policy":'+json.dumps(asset,separators=(",",":"))+',"fixtures":[\n'+",\n".join(json.dumps(f,separators=(",",":")) for f in fixtures)+"]}\n")
    print(output)

if __name__ == "__main__": main()
