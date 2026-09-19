from __future__ import annotations
import json, subprocess, time
from pathlib import Path
import numpy as np
import torch
from gen3rl.env.bridge import ShowdownBridge
from gen3rl.export.lut import collect, quantize, integer_score
from gen3rl.features.schema import FEATURE_SPECS, FEATURE_INDEX, PAIR_SPECS
from gen3rl.runner import battle
from gen3rl.teams import synthetic_match, cartridge_match, stable_cartridge_splits

ROOT=Path(__file__).resolve().parents[2]

def choose_teams(seed, index, cartridge_fraction=.5):
    if index % 100 < int(cartridge_fraction*100):
        try: return cartridge_match(seed,"validation"),"cartridge-validation"
        except Exception: pass
    return synthetic_match(seed),"synthetic"

def collect_states(policy, target=10_000, seed=700_000, cartridge_fraction=.5, max_battles=5000):
    states=[]; masks=[]; domains=[]; battles=0; torch.manual_seed(seed)
    with ShowdownBridge() as bridge:
        while len(states)<target and battles<max_battles:
            teams,domain=choose_teams(seed+battles,battles,cartridge_fraction)
            try: traces,_,_,_=battle(policy,seed+battles,False,bridge=bridge,teams=teams)
            except RuntimeError:
                battles+=1; continue
            for trace in traces:
                if trace[1][:4].any(): states.append(trace[0]); masks.append(trace[1]); domains.append(domain)
                if len(states)>=target: break
            battles+=1
    if len(states)<target: raise RuntimeError(f"collected only {len(states)} of {target} states")
    return np.stack(states),np.stack(masks),domains,{"battles":battles}

def _float_score(tables, features):
    scores=tables["action_bias"].copy()
    for i,spec in enumerate(FEATURE_SPECS): scores += tables[f"feature_{spec.name}"][features[:4,i]]
    for a,b in PAIR_SPECS: scores += tables[f"pair_{a}_{b}"][features[:4,FEATURE_INDEX[a]],features[:4,FEATURE_INDEX[b]]]
    return scores

def quantization_report(policy, states, masks, domains, output=ROOT/"artifacts/reports/quantization_real_states.json"):
    tables=collect(policy); q,scale=quantize(tables); rows=[]; role_disagreements={}; bucket_disagreements={}
    float_ties=int_ties=ranking_disagreements=0; errors=[]
    for features,mask,domain in zip(states,masks,domains):
        legal=np.flatnonzero(mask[:4]);
        if len(legal)==0: continue
        fs=_float_score(tables,features); qs=integer_score(q,features); errors.extend(np.abs(qs/scale-fs).tolist())
        fbest=legal[np.argmax(fs[legal])]; qbest=legal[np.argmax(qs[legal])]
        ft=np.sum(fs[legal]==fs[legal].max())>1; qt=np.sum(qs[legal]==qs[legal].max())>1
        float_ties+=int(ft); int_ties+=int(qt)
        disagree=int(fbest!=qbest); ranking_disagreements+=disagree
        if disagree:
            role=FEATURE_SPECS[FEATURE_INDEX["move_role"]].values[features[fbest,FEATURE_INDEX["move_role"]]]
            role_disagreements[role]=role_disagreements.get(role,0)+1
            for name in ("user_hp","target_hp","effectiveness","speed_relation","weather","can_ko"):
                value=FEATURE_SPECS[FEATURE_INDEX[name]].values[features[fbest,FEATURE_INDEX[name]]]
                key=f"{name}:{value}"; bucket_disagreements[key]=bucket_disagreements.get(key,0)+1
        rows.append({"agree":not disagree,"domain":domain})
    n=len(rows); report={"real_states":n,"source_battles":None,"top1_agreement":1-ranking_disagreements/max(n,1),
        "action_ranking_disagreements":ranking_disagreements,"score_mae":float(np.mean(errors)),"max_score_error":float(np.max(errors)),
        "float_tie_rate":float_ties/max(n,1),"quantized_tie_rate":int_ties/max(n,1),
        "tie_rate_change":(int_ties-float_ties)/max(n,1),"disagreements_by_move_role":role_disagreements,
        "disagreements_by_feature_bucket":bucket_disagreements,"domains":{d:domains.count(d) for d in sorted(set(domains))}}
    output=Path(output); output.parent.mkdir(parents=True,exist_ok=True); output.write_text(json.dumps(report,indent=2)+"\n"); return report

def coverage_report(states, masks, output=ROOT/"artifacts/reports/feature_coverage.json"):
    legal_rows=np.concatenate([s[:4][m[:4]] for s,m in zip(states,masks)])
    tables={}; total_visited=rare=never=frequent=0
    # These classes are intentionally exhaustive: every parameter is either
    # well sampled, sampled but still rare, or never observed.
    rare_mask=lambda counts: (counts>0)&(counts<100)
    action_counts=np.bincount(legal_rows[:,FEATURE_INDEX["action_slot"]],minlength=4)
    tables["action_bias"]={"counts":action_counts.tolist(),"frequent":int(np.sum(action_counts>=100)),"rare":int(np.sum(rare_mask(action_counts))),"never":int(np.sum(action_counts==0))}
    total_visited+=int(np.sum(action_counts>0)); rare+=int(np.sum(rare_mask(action_counts))); never+=int(np.sum(action_counts==0)); frequent+=int(np.sum(action_counts>=100))
    for i,spec in enumerate(FEATURE_SPECS):
        counts=np.bincount(legal_rows[:,i],minlength=spec.size); labels={v:int(counts[j]) for j,v in enumerate(spec.values)}
        tables[f"feature_{spec.name}"]={"counts":labels,"frequent":int(np.sum(counts>=100)),"rare":int(np.sum(rare_mask(counts))),"never":int(np.sum(counts==0))}
        total_visited+=int(np.sum(counts>0)); rare+=int(np.sum(rare_mask(counts))); never+=int(np.sum(counts==0)); frequent+=int(np.sum(counts>=100))
    for a,b in PAIR_SPECS:
        shape=(FEATURE_SPECS[FEATURE_INDEX[a]].size,FEATURE_SPECS[FEATURE_INDEX[b]].size); counts=np.zeros(shape,dtype=np.int64)
        np.add.at(counts,(legal_rows[:,FEATURE_INDEX[a]],legal_rows[:,FEATURE_INDEX[b]]),1)
        tables[f"pair_{a}_{b}"]={"counts":counts.tolist(),"frequent":int(np.sum(counts>=100)),"rare":int(np.sum(rare_mask(counts))),"never":int(np.sum(counts==0))}
        total_visited+=int(np.sum(counts>0)); rare+=int(np.sum(rare_mask(counts))); never+=int(np.sum(counts==0)); frequent+=int(np.sum(counts>=100))
    checks={
      "4x_effectiveness":tables["feature_effectiveness"]["counts"]["quadruple"],"quarter_effectiveness":tables["feature_effectiveness"]["counts"]["quarter"],
      "immunity":tables["feature_effectiveness"]["counts"]["immune"],"low_hp_recovery":0,"low_hp_self_ko":0,"speed_ties":tables["feature_speed_relation"]["counts"]["tie"],
      "status_on_statused_target":0,"weather":sum(v for k,v in tables["feature_weather"]["counts"].items() if k!="none"),
      "setup":tables["feature_move_role"]["counts"]["setup"],"phazing":tables["feature_move_role"]["counts"]["phaze"],
      "fixed_damage":tables["feature_move_role"]["counts"]["fixed"],"self_ko":tables["feature_move_role"]["counts"]["self_ko"],
      "reflect_state":None,"light_screen_state":None,"spikes_state":None}
    role=FEATURE_INDEX["move_role"]; hp=FEATURE_INDEX["user_hp"]; ts=FEATURE_INDEX["target_status"]
    checks["low_hp_recovery"]=int(np.sum((legal_rows[:,hp]==1)&(legal_rows[:,role]==4)))
    checks["low_hp_self_ko"]=int(np.sum((legal_rows[:,hp]==1)&(legal_rows[:,role]==10)))
    checks["status_on_statused_target"]=int(np.sum((legal_rows[:,ts]!=0)&(legal_rows[:,role]==1)))
    report={"states":len(states),"legal_move_candidates":len(legal_rows),"thresholds":{"frequent":">=100","rare":"1-99","never":"0"},
            "visited_entries":total_visited,"frequent_entries":frequent,"rare_entries":rare,"unvisited_entries":never,
            "critical_state_counts":checks,"schema_gaps":[k for k,v in checks.items() if v is None],"tables":tables,
            "warnings":[k for k,v in checks.items() if v==0 or v is None]}
    output=Path(output); output.parent.mkdir(parents=True,exist_ok=True); output.write_text(json.dumps(report,indent=2)+"\n")
    summary=output.with_suffix(".md"); summary.write_text("# Feature coverage\n\n"+f"States: {len(states)}; visited entries: {total_visited}; rare: {rare}; never: {never}.\n\n"+"Missing critical states: "+(", ".join(report["warnings"]) or "none")+".\n")
    return report

def fixed_eval_manifest(output=ROOT/"artifacts/eval/fixed_suites.json"):
    stable_cartridge_splits(); suites={name:{"enabled":True,"seeds":list(range(base,base+200)),"teams":"fixed cartridge-validation/synthetic alternation"}
        for name,base in (("random_legal",10000),("damage_heuristic",20000))}
    suites["vanilla_inspired"]={"enabled":False,"reason":"current implementation is only an alias of damage_heuristic"}
    data={"version":1,"suites":suites}; output=Path(output); output.parent.mkdir(parents=True,exist_ok=True); output.write_text(json.dumps(data,indent=2)+"\n"); return data
