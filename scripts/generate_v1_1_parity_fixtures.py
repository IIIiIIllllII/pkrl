#!/usr/bin/env python3
"""Generate deterministic Python-reference fixtures for TypeScript parity."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch

from gen3rl.export.lut import collect
from gen3rl.features.encoder import encode_request
from gen3rl.features.schema import FEATURE_SPECS, PAIR_SPECS, SCHEMA_VERSION
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
    fixtures=[]
    for name,species,types,moves in CASES:
        req=request(species,types,moves); features,mask=encode_request(req); scores=actor.logits(features,mask)
        fixtures.append({"name":name,"request":req,"resolved_defender_types":types,"features":features.tolist(),"legal_mask":mask.tolist(),
          "scores":[None if not np.isfinite(x) else float(x) for x in scores],"selected_action":int(np.argmax(scores))})
    output=ROOT/"web-playtest/public/v1-1-parity-fixtures.json"
    output.write_text(json.dumps({"schema_version":SCHEMA_VERSION,"policy":asset,"fixtures":fixtures},indent=2)+"\n")
    print(output)

if __name__ == "__main__": main()
