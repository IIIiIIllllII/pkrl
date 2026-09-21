#!/usr/bin/env python3
"""Measure v1/v1.1 observation differences on fresh, seeded proxy states.

This intentionally loads the contaminated checkpoint without the normal schema
gate. It never writes to the historical run directory.
"""
from __future__ import annotations
import argparse, json, random, uuid
from collections import Counter
from pathlib import Path

import numpy as np
import torch

from gen3rl.env.bridge import ShowdownBridge
from gen3rl.features.encoder import classify_role, encode_request
from gen3rl.features.schema import FEATURE_INDEX, FEATURE_SPECS, TYPE_NAMES, gen3_damage_class, power_bucket
from gen3rl.policy.lut import AdditiveLUTPolicy, NumpyLUTActor
from gen3rl.teams import synthetic_match

ROOT=Path(__file__).resolve().parents[1]

def legacy_encode(request):
    features,mask=encode_request(request); own=next((p for p in request.get("side",{}).get("pokemon",[]) if p.get("active")),{})
    own_types={str(value).lower() for value in own.get("types",[])}
    for slot,move in enumerate(((request.get("active") or [{}])[0] or {}).get("moves",[])[:4]):
        legacy={**move,"type":move.get("legacyType",move.get("type")),"basePower":move.get("legacyBasePower",move.get("basePower",0))}
        move_type=str(legacy.get("type") or "unknown").lower(); power=int(legacy.get("basePower") or 0)
        features[slot,FEATURE_INDEX["move_role"]]=int(classify_role(legacy))
        features[slot,FEATURE_INDEX["move_type"]]=TYPE_NAMES.index(move_type) if move_type in TYPE_NAMES else 17
        try: features[slot,FEATURE_INDEX["damage_class"]]=int(gen3_damage_class(move_type,power))
        except ValueError: features[slot,FEATURE_INDEX["damage_class"]]=2 if power<=0 else 0
        features[slot,FEATURE_INDEX["power_bucket"]]=power_bucket(power)
        features[slot,FEATURE_INDEX["stab"]]=int(move_type in own_types)
        features[slot,FEATURE_INDEX["effectiveness"]]=int(move.get("legacyEffectivenessBucket",move.get("effectivenessBucket",3)))
    return features,mask

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--run",type=Path,default=ROOT/"20260919-173958")
    parser.add_argument("--states",type=int,default=2000); parser.add_argument("--seed",type=int,default=881100)
    parser.add_argument("--output",type=Path,default=ROOT/"artifacts/audits/v1_contamination_proxy.json"); args=parser.parse_args()
    checkpoint=args.run/"checkpoints/decision_100000000.pt"; state=torch.load(checkpoint,map_location="cpu",weights_only=False)
    if state.get("metadata",{}).get("feature_schema_version")!="gen3-lut-v1": raise ValueError("audit input is not v1")
    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    policy=AdditiveLUTPolicy(); policy.load_state_dict(state["policy"]); actor=NumpyLUTActor(policy)
    counts=Counter(); roles=Counter(); examples=[]; battle_index=0
    with ShowdownBridge() as bridge:
      while counts["states"]<args.states:
        battle_id=f"audit-{battle_index}-{uuid.uuid4().hex[:6]}"; teams=synthetic_match(args.seed+battle_index)
        bridge.send({"cmd":"reset","battle_id":battle_id,"format":"gen3customgame","seed":[(args.seed+battle_index+i)&65535 for i in range(4)],"p1_team":teams[0],"p2_team":teams[1]})
        while counts["states"]<args.states:
          event=bridge.receive(timeout=20)
          if event.get("battle_id")!=battle_id: continue
          if event.get("type")=="end": break
          if event.get("type")!="request" or event.get("request",{}).get("wait") or not event.get("legal_actions"): continue
          legal=event["legal_actions"]
          if event["player"]=="p1":
            new,mask=encode_request(event["request"]); old,_=legacy_encode(event["request"]); counts["states"]+=1
            legal_moves=np.flatnonzero(mask[:4]); counts["legal_move_candidates"]+=len(legal_moves)
            differences=[]
            for index in legal_moves:
              if old[index,FEATURE_INDEX["effectiveness"]]!=new[index,FEATURE_INDEX["effectiveness"]]:
                counts["effectiveness_candidate_differences"]+=1; differences.append(int(index))
                role=FEATURE_SPECS[FEATURE_INDEX["move_role"]].values[new[index,FEATURE_INDEX["move_role"]]]; roles[role]+=1
              if not np.array_equal(old[index],new[index]): counts["any_feature_candidate_differences"]+=1
            if differences: counts["states_with_effectiveness_difference"]+=1
            old_scores=actor.logits(old,mask); new_scores=actor.logits(new,mask); old_action=int(np.argmax(old_scores)); new_action=int(np.argmax(new_scores))
            if old_action in differences: counts["legacy_selected_action_had_effectiveness_difference"]+=1
            if old_action!=new_action: counts["counterfactual_top1_changes"]+=1
            if len(examples)<12 and differences:
              moves=((event["request"].get("active") or [{}])[0] or {}).get("moves",[])
              examples.append({"target":event["request"].get("public",{}).get("target"),"moves":[moves[i].get("move") for i in differences],"old_top1":old_action,"v1_1_top1_with_old_weights":new_action})
            chosen=next(item for item in legal if item["index"]==old_action)
          else:
            moves=((event.get("request") or {}).get("active") or [{}])[0].get("moves",[])
            chosen=max(legal,key=lambda action:-1 if action["index"]>=4 else int(moves[action["index"]].get("basePower") or 0))
          bridge.send({"cmd":"act","battle_id":battle_id,"player":event["player"],"choice":chosen["choice"]})
        bridge.send({"cmd":"close","battle_id":battle_id})
        battle_index+=1
    result={"kind":"seeded fresh-state proxy; historical rollout states were not retained","checkpoint":str(checkpoint),"seed":args.seed,
      "counts":dict(counts),"differences_by_v1_1_move_role":dict(roles),"fractions":{
        "legal_candidates_effectiveness_changed":counts["effectiveness_candidate_differences"]/max(counts["legal_move_candidates"],1),
        "states_with_effectiveness_change":counts["states_with_effectiveness_difference"]/max(counts["states"],1),
        "legacy_selected_action_feature_changed":counts["legacy_selected_action_had_effectiveness_difference"]/max(counts["states"],1),
        "counterfactual_top1_changed_using_old_weights":counts["counterfactual_top1_changes"]/max(counts["states"],1)},"examples":examples}
    args.output.parent.mkdir(parents=True,exist_ok=True); args.output.write_text(json.dumps(result,indent=2)+"\n"); print(json.dumps(result,indent=2))

if __name__=="__main__": main()
