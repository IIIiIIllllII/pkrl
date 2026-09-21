from __future__ import annotations
import hashlib, json, random, subprocess, time, uuid, signal
from pathlib import Path
import numpy as np
import torch
from gen3rl.env.bridge import ShowdownBridge, DEFAULT_TEAM
from gen3rl.features.encoder import encode_request
from gen3rl.features.schema import FEATURE_SPECS, FEATURE_INDEX, PAIR_SPECS, SCHEMA_VERSION
from gen3rl.policy.lut import AdditiveLUTPolicy,NumpyLUTActor,validate_checkpoint_schema
from gen3rl.rl.ppo import PPOTrainer, compute_gae
from gen3rl.export.lut import export_policy
from gen3rl.teams import synthetic_match, cartridge_match

ROOT=Path(__file__).resolve().parents[1]
SCHEMA_ARTIFACTS=ROOT/"artifacts"/SCHEMA_VERSION

def validate_schema_config(config):
    configured=config.get("feature_schema")
    if configured != SCHEMA_VERSION:
        raise ValueError(f"config feature_schema must be {SCHEMA_VERSION}, got {configured!r}")

def configure_torch_threads(config):
    torch.set_num_threads(int(config.get("torch_threads",1)))
    try: torch.set_num_interop_threads(int(config.get("torch_interop_threads",1)))
    except RuntimeError: pass  # process-global setting may already be frozen by an earlier smoke/test

def commit(path):
    try: return subprocess.check_output(["git","-C",str(path),"rev-parse","HEAD"],text=True,stderr=subprocess.DEVNULL).strip()
    except Exception: return "unavailable"

def metadata(config, seed):
    encoded=json.dumps(config,sort_keys=True).encode()
    return {"python_seed":seed,"numpy_seed":seed,"torch_seed":seed,"showdown_seed":[seed,seed+1,seed+2,seed+3],
            "config_hash":hashlib.sha256(encoded).hexdigest(),"feature_schema_version":SCHEMA_VERSION,
            "pokemon_showdown_commit":commit(ROOT/"third_party/pokemon-showdown"),
            "pokeemerald_commit":commit(ROOT/"third_party/pokeemerald"),"project_commit":commit(ROOT)}

def battle(policy, seed=1, deterministic=False, max_decisions=300, bridge=None, teams=None,
           opponent="damage", profile=None, opponent_policy=None, actor=None, battle_id=None):
    seed4=[seed & 65535,(seed+1)&65535,(seed+2)&65535,(seed+3)&65535]
    traces=[]; started=time.perf_counter(); winner=None; battle_id=battle_id or f"b-{seed}-{uuid.uuid4().hex[:8]}"
    own_bridge=bridge is None; bridge=bridge or ShowdownBridge(); teams=teams or (DEFAULT_TEAM,DEFAULT_TEAM)
    waiting=feature_time=inference_time=worker_time=0.0
    try:
        bridge.send({"cmd":"reset","battle_id":battle_id,"format":"gen3customgame","seed":seed4,
                     "p1_team":teams[0],"p2_team":teams[1]})
        for _ in range(max_decisions*6):
            tick=time.perf_counter(); event=bridge.receive(timeout=20); waiting += time.perf_counter()-tick; typ=event.get("type")
            worker_time += float(event.get("worker_ms",0))/1000
            if typ=="end": winner=event.get("winner"); break
            if typ!="request": continue
            if event.get("request",{}).get("wait"): continue
            player=event["player"]; legal=event["legal_actions"]
            if not legal: continue
            if player=="p1":
                tick=time.perf_counter()
                feat,mask=encode_request(event["request"])
                feature_time += time.perf_counter()-tick; tick=time.perf_counter()
                if actor is not None:
                    idx,logp=actor.act(feat,mask,deterministic)
                else:
                    ft=torch.as_tensor(feat).unsqueeze(0); mt=torch.as_tensor(mask).unsqueeze(0)
                    with torch.no_grad():
                        dist=policy.distribution(ft,mt); action=torch.argmax(dist.logits,dim=-1) if deterministic else dist.sample()
                        logp=dist.log_prob(action)
                    idx=int(action); logp=float(logp)
                inference_time += time.perf_counter()-tick
                selected=next((a for a in legal if a["index"]==idx),None)
                if selected is None:
                    if profile is not None: profile["illegal_actions"]=profile.get("illegal_actions",0)+1
                    raise RuntimeError(f"policy selected masked/unknown action {idx}")
                traces.append((feat,mask,selected["index"],float(logp),0.0))
            else:
                if opponent_policy is not None:
                    feat,mask=encode_request(event["request"]); ft=torch.as_tensor(feat).unsqueeze(0); mt=torch.as_tensor(mask).unsqueeze(0)
                    with torch.no_grad(): idx=int(torch.argmax(opponent_policy(ft,mt),dim=-1))
                    selected=next((a for a in legal if a["index"]==idx),None)
                    if selected is None: raise RuntimeError("snapshot opponent selected illegal action")
                elif opponent=="random": selected=random.Random(seed+len(traces)).choice(legal)
                else:
                    moves=((event.get("request") or {}).get("active") or [{}])[0].get("moves",[])
                    selected=max(legal,key=lambda a: -1 if a["index"]>=4 else int(moves[a["index"]].get("basePower") or 0))
            bridge.send({"cmd":"act","battle_id":battle_id,"player":player,"choice":selected["choice"]})
            if len(traces)>=max_decisions: break
    finally:
        if not own_bridge and bridge.proc.poll() is None:
            bridge.send({"cmd":"close","battle_id":battle_id})
            try: bridge.receive(lambda e:e.get("type")=="close_ack" and e.get("battle_id")==battle_id,timeout=2)
            except Exception: pass
        if own_bridge: bridge.close()
    elapsed=time.perf_counter()-started
    if profile is not None:
        profile["bridge_wait_seconds"]=profile.get("bridge_wait_seconds",0.0)+waiting
        profile["feature_seconds"]=profile.get("feature_seconds",0.0)+feature_time
        profile["inference_seconds"]=profile.get("inference_seconds",0.0)+inference_time
        profile["showdown_worker_seconds"]=profile.get("showdown_worker_seconds",0.0)+worker_time
        profile["battle_wall_seconds"]=profile.get("battle_wall_seconds",0.0)+elapsed
    reward=1.0 if winner=="p1" else -1.0 if winner=="p2" else 0.0
    return traces,reward,winner,elapsed

def smoke(config):
    validate_schema_config(config)
    configure_torch_threads(config)
    seed=int(config.get("seed",7)); random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    policy=AdditiveLUTPolicy(); ppo=config.get("ppo",{}); trainer=PPOTrainer(policy,len(FEATURE_SPECS),lr=float(config.get("learning_rate",3e-4)),
        clip=float(ppo.get("clip",.2)),entropy_coef=float(ppo.get("entropy",.01)),value_coef=float(ppo.get("value",.5)),gradient_clip=float(ppo.get("gradient_clip",.5)))
    initial=torch.cat([x.detach().flatten() for x in policy.parameters()]).clone(); profile={}
    traces,reward,winner,elapsed=battle(policy,seed,profile=profile)
    if not traces: raise RuntimeError("battle produced no policy decisions")
    features=torch.as_tensor(np.stack([x[0] for x in traces]),dtype=torch.long)
    masks=torch.as_tensor(np.stack([x[1] for x in traces]),dtype=torch.bool)
    actions=torch.tensor([x[2] for x in traces]); old_logp=torch.tensor([x[3] for x in traces])
    values=trainer.value(features[:,:4,:].reshape(len(features),-1).float()).detach(); rewards=torch.zeros(len(traces)); rewards[-1]=reward
    dones=torch.zeros(len(traces)); dones[-1]=1; adv,returns=compute_gae(rewards,values,dones)
    stats=trainer.update(features,masks,actions,old_logp,returns,adv,epochs=int(ppo.get("epochs",1)),minibatch_size=int(ppo.get("minibatch",len(features))))
    final_params=torch.cat([x.detach().flatten() for x in policy.parameters()]); changed=int(torch.count_nonzero(final_params!=initial))
    if not changed: raise RuntimeError("smoke PPO update changed no policy parameters")
    if not np.isfinite(list(stats.__dict__.values())).all() or not torch.isfinite(final_params).all(): raise FloatingPointError("non-finite smoke result")
    out=SCHEMA_ARTIFACTS/"checkpoints"; out.mkdir(parents=True,exist_ok=True); cp=out/"smoke.pt"
    meta=metadata(config,seed); trainer.checkpoint(cp,config,meta)
    loaded=AdditiveLUTPolicy(); roundtrip=PPOTrainer(loaded,len(FEATURE_SPECS)); roundtrip.load(cp)
    for a,b in zip(policy.parameters(),loaded.parameters()):
        if not torch.equal(a,b): raise AssertionError("checkpoint round-trip mismatch")
    manifest,_=export_policy(policy,SCHEMA_ARTIFACTS)
    coverage={"features":{},"pairs":{},"warnings":[]}
    raw=features.numpy()[:,:4,:]
    for i,spec in enumerate(FEATURE_SPECS):
        counts=np.bincount(raw[:,:,i].ravel(),minlength=spec.size).tolist()
        coverage["features"][spec.name]=counts
        if any(x==0 for x in counts): coverage["warnings"].append(f"{spec.name}: unvisited categories")
    for a,b in PAIR_SPECS:
        shape=(FEATURE_SPECS[FEATURE_INDEX[a]].size,FEATURE_SPECS[FEATURE_INDEX[b]].size)
        counts=np.zeros(shape,dtype=np.int64)
        np.add.at(counts,(raw[:,:,FEATURE_INDEX[a]].ravel(),raw[:,:,FEATURE_INDEX[b]].ravel()),1)
        coverage["pairs"][f"{a}_x_{b}"]=counts.tolist()
        if np.mean(counts==0)>.5: coverage["warnings"].append(f"{a} x {b}: over 50% cells unvisited")
    covpath=SCHEMA_ARTIFACTS/"coverage/smoke.json"; covpath.parent.mkdir(parents=True,exist_ok=True)
    covpath.write_text(json.dumps(coverage,indent=2)+"\n")
    from gen3rl.export.parity import verify
    quantization=verify(SCHEMA_ARTIFACTS,samples=5000,seed=seed)
    summary={"battles":1,"environment_steps":len(traces),"ppo_updates":1,"winner":winner,
             "seconds":elapsed,"steps_per_second":len(traces)/elapsed,"checkpoint":str(cp),
             "checkpoint_roundtrip":True,"lut":manifest,"float_lut_bytes":manifest["parameters"]*4,
             "quantization":quantization,"coverage":str(covpath),"illegal_actions":profile.get("illegal_actions",0),
             "policy_parameters_changed":changed,"finite_parameters":True,**stats.__dict__}
    (SCHEMA_ARTIFACTS/"smoke_summary.json").write_text(json.dumps(summary,indent=2)+"\n")
    return summary

def _batch_episode(trainer,traces,reward,gamma=.99,lam=.95):
    f=torch.as_tensor(np.stack([x[0] for x in traces]),dtype=torch.long); m=torch.as_tensor(np.stack([x[1] for x in traces]),dtype=torch.bool)
    a=torch.tensor([x[2] for x in traces]); lp=torch.tensor([x[3] for x in traces])
    with torch.no_grad(): values=trainer.value(f[:,:4,:].reshape(len(f),-1).float().to(trainer.device)).cpu()
    rewards=torch.zeros(len(traces)); rewards[-1]=reward; dones=torch.zeros(len(traces)); dones[-1]=1
    adv,ret=compute_gae(rewards,values,dones,gamma,lam); return f,m,a,lp,ret,adv

def _weighted_choice(rng, weights):
    names=list(weights); values=[float(weights[n]) for n in names]; return rng.choices(names,weights=values,k=1)[0]

def evaluate_suites(policy, bridge, games=100, seed=10_000):
    from gen3rl.features.schema import MoveRole
    results={}
    for suite_i,opponent in enumerate(("random","damage")):
        wins=losses=draws=turns=0; actions=[0]*9; roles={}; margins=[]; start=time.perf_counter()
        for i in range(games):
            battle_seed=seed+suite_i*10_000+i; teams=cartridge_match(battle_seed,"validation") if i%2==0 else synthetic_match(battle_seed)
            traces,reward,_,_=battle(policy,battle_seed,True,bridge=bridge,teams=teams,opponent=opponent)
            wins+=reward>0; losses+=reward<0; draws+=reward==0; turns+=len(traces)
            for feat,mask,action,_,_ in traces:
                actions[action]+=1
                if action<4:
                    role=FEATURE_SPECS[FEATURE_INDEX["move_role"]].values[feat[action,FEATURE_INDEX["move_role"]]]; roles[role]=roles.get(role,0)+1
                    with torch.no_grad(): scores=policy(torch.as_tensor(feat).unsqueeze(0),torch.as_tensor(mask).unsqueeze(0))[0]
                    legal=scores[torch.as_tensor(mask)]; top=torch.topk(legal,min(2,len(legal))).values
                    if len(top)>1: margins.append(float(top[0]-top[1]))
        results[opponent]={"games":games,"wins":int(wins),"losses":int(losses),"draws":int(draws),"win_rate":wins/games,
          "mean_decisions":turns/games,"action_distribution":actions,"move_role_distribution":roles,"illegal_actions":0,
          "mean_top1_top2_margin":float(np.mean(margins)) if margins else None,"seconds":time.perf_counter()-start}
    return results

def train_run(config, resume=None):
    from contextlib import ExitStack
    from gen3rl.parallel import RolloutPool, validate_policy_versions
    validate_schema_config(config)
    configure_torch_threads(config)
    seed=int(config.get("seed",31173)); random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    workers=int(config.get("workers",1))
    device=str(config.get("device","cpu")); device="cuda" if device=="auto" and torch.cuda.is_available() else "cpu" if device=="auto" else device
    policy=AdditiveLUTPolicy(); ppo=config.get("ppo",{}); trainer=PPOTrainer(policy,len(FEATURE_SPECS),lr=float(config.get("learning_rate",3e-4)),
        clip=float(ppo.get("clip",.2)),entropy_coef=float(ppo.get("entropy",.01)),value_coef=float(ppo.get("value",.5)),
        gradient_clip=float(ppo.get("gradient_clip",.5)),device=device)
    stamp=time.strftime("%Y%m%d-%H%M%S"); run_dir=ROOT/"artifacts/runs"/SCHEMA_VERSION/stamp
    counters={"decisions":0,"battles":0,"updates":0,"policy_version":0,"illegal_actions":0,"elapsed_seconds":0.0}; opponent_paths=[]
    if resume:
        state=trainer.load(resume); counters.update(state.get("counters",{})); opponent_paths=state.get("opponent_pool",[])
        counters["policy_version"]=int(counters.get("policy_version",counters["updates"]))
        run_dir=Path(resume).resolve().parents[1]
    run_dir.mkdir(parents=True,exist_ok=True); (run_dir/"checkpoints").mkdir(exist_ok=True); (run_dir/"evaluations").mkdir(exist_ok=True)
    (run_dir/"resolved_config.json").write_text(json.dumps(config,indent=2,sort_keys=True)+"\n"); (run_dir/"source_metadata.json").write_text(json.dumps(metadata(config,seed),indent=2)+"\n")
    metrics_path=run_dir/"metrics.jsonl"; rng=random.Random(seed+counters["battles"]); profile={}; start=time.perf_counter()
    max_decisions=int(config.get("max_decisions",100_000)); rollout_size=int(config.get("rollout_size",2048))
    checkpoints=sorted(int(x) for x in config.get("checkpoint_decisions",[50_000,100_000,250_000,500_000,1_000_000,2_000_000,5_000_000]))
    milestone_evaluations=sorted(int(x) for x in config.get("milestone_evaluation_decisions",config.get("evaluation_decisions",checkpoints)))
    evaluation_games=int(config.get("milestone_evaluation_games",config.get("evaluation_games",100)))
    quick_interval=int(config.get("quick_evaluation_interval",0)); quick_games=int(config.get("quick_evaluation_games",25))
    safety_interval=int(config.get("safety_checkpoint_interval",0)); safety_keep=int(config.get("safety_checkpoint_keep",2))
    domain_weights=config.get("team_distribution",{"cartridge":.5,"synthetic":.3,"generalization":.2})
    opponent_weights=config.get("opponent_mixture",config.get("self_play",{"random":.2,"damage":.5,"historical":.3}))
    initial=torch.cat([x.detach().cpu().flatten() for x in policy.parameters()]).clone(); interrupted=False; failure=None
    safety=config.get("early_stop",{}); empty_battles=0; rate_ema=None; battle_rate_ema=None
    try:
      with ExitStack() as stack:
       eval_bridge=stack.enter_context(ShowdownBridge())
       pool=stack.enter_context(RolloutPool(workers,seed,timeout=float(config.get("worker_timeout",60)))) if workers>1 else None
       while counters["decisions"]<max_decisions:
        batches=[]; returns=[]; rollout_steps=0; rollout_start=time.perf_counter(); generation_metrics={}
        if pool is not None:
            results,generation_metrics=pool.collect(policy,counters["policy_version"],counters["battles"],domain_weights,opponent_weights,
                opponent_paths,target_decisions=min(rollout_size,max_decisions-counters["decisions"]))
            expected=counters["policy_version"]
            validate_policy_versions(results,expected)
            for result in sorted(results,key=lambda item:item["battle_index"]):
                traces=result["traces"]; reward=result["reward"]
                counters["battles"]+=1
                if not traces:
                    empty_battles+=1
                    if empty_battles>=int(safety.get("max_consecutive_empty_battles",10)): raise RuntimeError("early-stop: repeated empty battles")
                    continue
                empty_battles=0; batches.append(_batch_episode(trainer,traces,reward,float(ppo.get("gamma",.99)),float(ppo.get("gae_lambda",.95)))
                ); returns.append(reward); rollout_steps+=len(traces); counters["decisions"]+=len(traces)
                for key,value in result["profile"].items(): profile[key]=profile.get(key,0)+value
                counters["illegal_actions"]+=int(result.get("illegal_actions",0))
        else:
            actor=NumpyLUTActor(policy)
            while rollout_steps<rollout_size and counters["decisions"]<max_decisions:
                domain=_weighted_choice(rng,domain_weights); battle_seed=seed+counters["battles"]
                teams=cartridge_match(battle_seed,"train") if domain=="cartridge" else synthetic_match(battle_seed)
                opp=_weighted_choice(rng,opponent_weights); opponent_policy=None
                if opp=="historical" and opponent_paths:
                    snapshot_path=rng.choice(opponent_paths); snap=torch.load(snapshot_path,map_location="cpu",weights_only=False)
                    validate_checkpoint_schema(snap,snapshot_path); opponent_policy=AdditiveLUTPolicy(); opponent_policy.load_state_dict(snap["policy"]); opponent_policy.eval()
                else: opp="random" if opp=="random" else "damage"
                traces,reward,_,_=battle(policy,battle_seed,False,bridge=eval_bridge,teams=teams,opponent=opp,opponent_policy=opponent_policy,profile=profile,actor=actor)
                if not traces:
                    empty_battles+=1
                    if empty_battles>=int(safety.get("max_consecutive_empty_battles",10)): raise RuntimeError("early-stop: repeated empty battles")
                    continue
                empty_battles=0; batches.append(_batch_episode(trainer,traces,reward,float(ppo.get("gamma",.99)),float(ppo.get("gae_lambda",.95)))
                ); returns.append(reward); rollout_steps+=len(traces); counters["decisions"]+=len(traces); counters["battles"]+=1
            generation_metrics={"policy_version":counters["policy_version"],"policy_sync_seconds":0.0,
                "rollout_wall_seconds":time.perf_counter()-rollout_start,"queue_wait_seconds":profile.get("bridge_wait_seconds",0),
                "battles":len(batches),"decisions":rollout_steps,"per_worker":{"0":{"battles":len(batches),"decisions":rollout_steps}},
                "worker_restarts":0,"worker_startup_seconds":0.0}
        if not batches: raise RuntimeError("no battles completed during rollout")
        assembly_start=time.perf_counter(); joined=[torch.cat([b[i] for b in batches]) for i in range(6)]; aggregation_seconds=time.perf_counter()-assembly_start
        profile["assembly_seconds"]=profile.get("assembly_seconds",0)+aggregation_seconds
        update_start=time.perf_counter(); stats=trainer.update(*joined,epochs=int(ppo.get("epochs",1)),minibatch_size=int(ppo.get("minibatch",len(joined[0])))); profile["ppo_seconds"]=profile.get("ppo_seconds",0)+time.perf_counter()-update_start
        counters["updates"]+=1; counters["policy_version"]+=1; counters["elapsed_seconds"]+=time.perf_counter()-rollout_start
        params=torch.cat([x.detach().cpu().flatten() for x in policy.parameters()]); changed=int(torch.count_nonzero(params!=initial)); entropy=stats.entropy
        if counters["illegal_actions"]: raise RuntimeError(f"early-stop: {counters['illegal_actions']} illegal actions")
        if not np.isfinite(list(stats.__dict__.values())).all(): raise FloatingPointError("non-finite training metric")
        if counters["updates"]>5 and entropy<.01: raise RuntimeError("early-stop: policy entropy collapsed")
        coverage_ratio=float(sum(p.grad is not None and torch.any(p.grad!=0) for p in policy.parameters())/len(list(policy.parameters())))
        if coverage_ratio == 0: raise RuntimeError("early-stop: no LUT table received a gradient")
        measured_rate=counters["decisions"]/max(counters["elapsed_seconds"],1e-9); generation_rate=rollout_steps/max(time.perf_counter()-rollout_start,1e-9)
        rate_ema=generation_rate if rate_ema is None else .2*generation_rate+.8*rate_ema
        generation_bps=len(batches)/max(time.perf_counter()-rollout_start,1e-9)
        battle_rate_ema=generation_bps if battle_rate_ema is None else .2*generation_bps+.8*battle_rate_ema
        minimum_rate=float(safety.get("minimum_decisions_per_second",0))
        if counters["updates"]>5 and minimum_rate and measured_rate<minimum_rate: raise RuntimeError(f"early-stop: throughput {measured_rate:.1f} decisions/s below {minimum_rate:.1f}")
        elapsed=max(time.perf_counter()-start,1e-9); next_points=[x for x in checkpoints if x>counters["decisions"]]; next_checkpoint=next_points[0] if next_points else max_decisions
        rollout_wall=max(float(generation_metrics.get("rollout_wall_seconds",0)),1e-9)
        worker_busy=sum(row.get("worker_wall_seconds",rollout_wall) for row in generation_metrics.get("per_worker",{}).values())
        row={"event":"update","decisions":counters["decisions"],"target_decisions":max_decisions,"battles":counters["battles"],"updates":counters["updates"],
          "policy_version":counters["policy_version"],"workers":workers,"worker_restarts":generation_metrics.get("worker_restarts",0),
          "elapsed_wall_time":counters["elapsed_seconds"],"battles_per_second":counters["battles"]/max(counters["elapsed_seconds"],1e-9),
          "decisions_per_second":measured_rate,"decisions_per_second_ema":rate_ema,"battles_per_second_ema":battle_rate_ema,"mean_return":float(np.mean(returns)),
          "lut_parameters_changed":changed,"gradient_table_ratio":coverage_ratio,"device":device,
          "per_worker_throughput":generation_metrics.get("per_worker",{}),"rollout_queue_wait_seconds":generation_metrics.get("queue_wait_seconds",0),
          "learner_idle_fraction":generation_metrics.get("queue_wait_seconds",0)/rollout_wall,
          "worker_idle_fraction":max(0.0,1-worker_busy/max(workers*rollout_wall,1e-9)),
          "policy_sync_seconds":generation_metrics.get("policy_sync_seconds",0),"rollout_aggregation_seconds":aggregation_seconds,
          "eta_next_checkpoint_seconds":max(0,next_checkpoint-counters["decisions"])/max(rate_ema,1e-9),
          "eta_final_seconds":max(0,max_decisions-counters["decisions"])/max(rate_ema,1e-9),**stats.__dict__}
        with metrics_path.open("a") as f: f.write(json.dumps(row)+"\n")
        print(json.dumps({k:row[k] for k in ("decisions","target_decisions","battles","workers","policy_version","decisions_per_second_ema","battles_per_second_ema","elapsed_wall_time","eta_next_checkpoint_seconds","eta_final_seconds")}),flush=True)
        due=[x for x in checkpoints if counters["decisions"]>=x and not (run_dir/"checkpoints"/f"decision_{x}.pt").exists()]
        for threshold in due:
            snapshot=run_dir/"checkpoints"/f"opponent_{threshold}.pt"
            torch.save({"policy":policy.state_dict(),"schema":SCHEMA_VERSION,"metadata":metadata(config,seed)},snapshot); opponent_paths.append(str(snapshot))
            cp=run_dir/"checkpoints"/f"decision_{threshold}.pt"; trainer.checkpoint(cp,config,metadata(config,seed),counters,opponent_paths)
        if safety_interval:
            safety_step=(counters["decisions"]//safety_interval)*safety_interval; safety_path=run_dir/"checkpoints"/f"safety_{safety_step}.pt"
            if safety_step and not safety_path.exists(): trainer.checkpoint(safety_path,config,metadata(config,seed),counters,opponent_paths)
            safety_files=sorted((run_dir/"checkpoints").glob("safety_*.pt"),key=lambda p:int(p.stem.split("_")[1]))
            for stale in safety_files[:-safety_keep]: stale.unlink()
        quick_step=(counters["decisions"]//quick_interval)*quick_interval if quick_interval else 0
        eval_jobs=[]
        quick_path=run_dir/"evaluations"/f"quick_{quick_step}.json"
        milestone_at_quick=quick_step in milestone_evaluations
        if quick_step and not milestone_at_quick and not quick_path.exists(): eval_jobs.append(("quick",quick_step,quick_games,int(config.get("quick_evaluation_seed",10000)),quick_path))
        for threshold in milestone_evaluations:
            path=run_dir/"evaluations"/f"milestone_{threshold}.json"
            if counters["decisions"]>=threshold and not path.exists(): eval_jobs.append(("milestone",threshold,evaluation_games,int(config.get("milestone_evaluation_seed",10000)),path))
        for level,threshold,games,eval_seed,path in eval_jobs:
            tick=time.perf_counter(); result=evaluate_suites(policy,eval_bridge,games,seed=eval_seed); profile["evaluation_seconds"]=profile.get("evaluation_seconds",0)+time.perf_counter()-tick
            path.write_text(json.dumps(result,indent=2)+"\n")
            eval_row={"event":"evaluation","level":level,"decisions":counters["decisions"],"scheduled_decision":threshold,
              "elapsed_wall_time":counters["elapsed_seconds"],"evaluation_random_win_rate":result["random"]["win_rate"],
              "evaluation_damage_win_rate":result["damage"]["win_rate"],"evaluation_random_games":result["random"]["games"],
              "evaluation_damage_games":result["damage"]["games"]}
            with metrics_path.open("a") as f: f.write(json.dumps(eval_row)+"\n")
            collapse=float(safety.get("evaluation_collapse_win_rate",0))
            if collapse and max(result["random"]["win_rate"],result["damage"]["win_rate"])<collapse: raise RuntimeError("early-stop: fixed-baseline collapse")
    except KeyboardInterrupt:
      interrupted=True
    except BaseException as error:
      interrupted=True; failure=error
    final=run_dir/"checkpoints"/("emergency.pt" if interrupted else "final.pt"); trainer.checkpoint(final,config,metadata(config,seed),counters,opponent_paths)
    manifest,_=export_policy(policy,run_dir); params=torch.cat([x.detach().cpu().flatten() for x in policy.parameters()])
    report={**counters,"run_dir":str(run_dir),"checkpoint":str(final),"interrupted":interrupted,"device":device,"workers":workers,
      "historical_pool":len(opponent_paths),"lut_parameters_changed":int(torch.count_nonzero(params!=initial)),"lut_l2_change":float(torch.linalg.vector_norm(params-initial)),
      "profile":profile,"lut":manifest}
    (run_dir/"summary.json").write_text(json.dumps(report,indent=2)+"\n")
    if failure is not None: raise RuntimeError(f"training failed; recovery checkpoint saved at {final}: {failure}") from failure
    return report
