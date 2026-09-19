from __future__ import annotations
import json, os, resource, shutil, subprocess, time
from datetime import datetime
from pathlib import Path
import numpy as np
import torch
from gen3rl.features.schema import FEATURE_SPECS
from gen3rl.policy.lut import AdditiveLUTPolicy
from gen3rl.rl.ppo import PPOTrainer
from gen3rl.runner import _batch_episode
from gen3rl.parallel import RolloutPool

ROOT=Path(__file__).resolve().parents[1]

def gpu_sample():
    if not shutil.which("nvidia-smi"): return None
    result=subprocess.run(["nvidia-smi","--query-gpu=name,utilization.gpu,memory.used,memory.total","--format=csv,noheader,nounits"],capture_output=True,text=True)
    if result.returncode or not result.stdout.strip(): return None
    row=result.stdout.strip().splitlines()[0].split(", "); return {"name":row[0],"utilization_percent":float(row[1]),"memory_used_mib":float(row[2]),"memory_total_mib":float(row[3])}

def _memory_sample(pids=()):
    info={}
    try:
        rows={}
        for line in Path("/proc/meminfo").read_text().splitlines():
            key,value=line.split(":",1); rows[key]=int(value.strip().split()[0])
        info={"system_total_mib":rows["MemTotal"]/1024,"system_available_mib":rows["MemAvailable"]/1024}
    except (OSError,KeyError,ValueError): pass
    rss=0; pss=0
    for pid in [os.getpid(),*pids]:
        try:
            for line in Path(f"/proc/{pid}/status").read_text().splitlines():
                if line.startswith("VmRSS:"): rss+=int(line.split()[1])/1024; break
        except (OSError,ValueError): pass
        try:
            for line in Path(f"/proc/{pid}/smaps_rollup").read_text().splitlines():
                if line.startswith("Pss:"): pss+=int(line.split()[1])/1024; break
        except (OSError,ValueError): pass
    info["sampled_process_rss_mib"]=rss
    info["sampled_process_pss_mib"]=pss
    return info

def _cpu_ticks():
    try:
        values=[int(x) for x in Path("/proc/stat").read_text().splitlines()[0].split()[1:]]
        return sum(values),values[3]+values[4]
    except (OSError,ValueError,IndexError): return None

def device_microbenchmark(device, batch_size=2048, iterations=10):
    policy=AdditiveLUTPolicy(); trainer=PPOTrainer(policy,len(FEATURE_SPECS),device=device)
    features=torch.zeros((batch_size,9,len(FEATURE_SPECS)),dtype=torch.long); masks=torch.zeros((batch_size,9),dtype=torch.bool); masks[:,:4]=True
    actions=torch.zeros(batch_size,dtype=torch.long); returns=torch.zeros(batch_size); adv=torch.randn(batch_size)
    with torch.no_grad(): old=policy.distribution(features.to(device),masks.to(device)).log_prob(actions.to(device)).cpu()
    if device=="cuda": torch.cuda.synchronize()
    start=time.perf_counter()
    for _ in range(iterations): trainer.update(features,masks,actions,old,returns,adv)
    if device=="cuda": torch.cuda.synchronize()
    return {"device":device,"batch_size":batch_size,"iterations":iterations,"seconds":time.perf_counter()-start}

def benchmark(minutes=.1, max_battles=None, seed=81000, workers=1, battles_per_worker=None, output=None):
    workers=int(workers)
    if battles_per_worker is not None: max_battles=workers*int(battles_per_worker)
    policy=AdditiveLUTPolicy(); battles=decisions=illegal=0; kept=[]; aggregate_profile={}; per_worker={}
    queue_wait=sync_seconds=rollout_wall=0.0; crashes=0; wall_start=time.perf_counter(); cpu_start=_cpu_ticks()
    deadline=max(0.01,float(minutes)*60); next_index=0
    with RolloutPool(workers,seed,timeout=max(60,deadline+30)) as pool:
        child_pids=[r["pid"] for r in pool.ready]+[r["node_pid"] for r in pool.ready]
        while time.perf_counter()-wall_start<deadline and (max_battles is None or battles<max_battles):
            remaining=None if max_battles is None else max_battles-battles
            chunk=workers*25 if remaining is None else min(remaining,workers*25)
            results,metrics=pool.collect(policy,0,next_index,{"synthetic":1.0},{"damage":1.0},max_battles=chunk,
                deadline_seconds=max(0.01,deadline-(time.perf_counter()-wall_start)))
            if not results: break
            next_index+=len(results); battles+=len(results); decisions+=sum(len(r["traces"]) for r in results)
            illegal+=sum(int(r["illegal_actions"]) for r in results); crashes+=metrics["worker_restarts"]
            queue_wait+=metrics["queue_wait_seconds"]; sync_seconds+=metrics["policy_sync_seconds"]; rollout_wall+=metrics["rollout_wall_seconds"]
            for result in results:
                if sum(len(t) for t,_ in kept)<4096: kept.append((result["traces"],result["reward"]))
                for key,value in result["profile"].items(): aggregate_profile[key]=aggregate_profile.get(key,0)+value
            for wid,row in metrics["per_worker"].items():
                target=per_worker.setdefault(wid,{"battles":0,"decisions":0,"worker_wall_seconds":0.0})
                for key in target: target[key]+=row[key]
        memory=_memory_sample(child_pids); startup=pool.startup_seconds
    simulation_end=time.perf_counter(); ppo_seconds=assembly_seconds=0.0
    if kept:
        trainer=PPOTrainer(AdditiveLUTPolicy(),len(FEATURE_SPECS)); tick=time.perf_counter(); batches=[_batch_episode(trainer,t,r) for t,r in kept if t]
        joined=[torch.cat([b[i] for b in batches]) for i in range(6)]; assembly_seconds=time.perf_counter()-tick
        tick=time.perf_counter(); trainer.update(*joined); ppo_seconds=time.perf_counter()-tick
    wall=time.perf_counter()-wall_start; cpu_end=_cpu_ticks()
    cpu_percent=None
    if cpu_start and cpu_end:
        total=cpu_end[0]-cpu_start[0]; idle=cpu_end[1]-cpu_start[1]; cpu_percent=100*(total-idle)/max(total,1)
    simulation=aggregate_profile.get("showdown_worker_seconds",0); estimated_ipc=max(0,aggregate_profile.get("bridge_wait_seconds",0)-simulation)
    measured=simulation+estimated_ipc+aggregate_profile.get("feature_seconds",0)+aggregate_profile.get("inference_seconds",0)+assembly_seconds+ppo_seconds
    for row in per_worker.values():
        row["battles_per_second"]=row["battles"]/max(row["worker_wall_seconds"],1e-9)
        row["decisions_per_second"]=row["decisions"]/max(row["worker_wall_seconds"],1e-9)
    devices=[device_microbenchmark("cpu")]
    if torch.cuda.is_available(): devices.append(device_microbenchmark("cuda"))
    report={"workers":workers,"active_battles":workers,"battles":battles,"completed_battles":battles,"decisions":decisions,
      "wall_seconds":wall,"battles_per_second":battles/max(wall,1e-9),"decisions_per_second":decisions/max(wall,1e-9),
      "per_worker_battles_per_second":battles/max(wall*workers,1e-9),"per_worker_throughput":per_worker,
      "mean_battle_decisions":decisions/max(battles,1),"node_worker_count":workers,"python_worker_count":workers,
      "worker_startup_seconds":startup,"worker_crash_restart_count":crashes,"illegal_actions":illegal,
      "rollout_queue_wait_seconds":queue_wait,"policy_sync_seconds":sync_seconds,
      "timing_seconds":{"simulation":simulation,"ipc_estimate":estimated_ipc,"feature_extraction":aggregate_profile.get("feature_seconds",0),
        "policy_inference":aggregate_profile.get("inference_seconds",0),"rollout_assembly":assembly_seconds,"ppo_update":ppo_seconds},
      "fractions":{"simulation":simulation/max(measured,1e-9),"ipc_bridge":estimated_ipc/max(measured,1e-9),
        "feature_extraction":aggregate_profile.get("feature_seconds",0)/max(measured,1e-9),
        "policy_inference":aggregate_profile.get("inference_seconds",0)/max(measured,1e-9),
        "rollout_assembly":assembly_seconds/max(measured,1e-9),"ppo":ppo_seconds/max(measured,1e-9)},
      "cpu":{"logical_cpus":os.cpu_count(),"system_utilization_percent":cpu_percent,
        "learner_process_cpu_seconds":resource.getrusage(resource.RUSAGE_SELF).ru_utime+resource.getrusage(resource.RUSAGE_SELF).ru_stime},
      "ram":memory,"gpu":gpu_sample(),"device_microbenchmark":devices}
    if output is None:
        stamp=datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        output=ROOT/"artifacts/reports/scaling"/f"workers_{workers}_{stamp}.json"
    output=Path(output); output.parent.mkdir(parents=True,exist_ok=True); output.write_text(json.dumps(report,indent=2)+"\n")
    return report

def recommend_worker_count(rows, threshold=.97):
    valid=[r for r in rows if r["worker_crash_restart_count"]==0 and r["illegal_actions"]==0]
    if not valid: raise RuntimeError("no stable scaling result")
    maximum=max(r["decisions_per_second"] for r in valid); eligible=[r for r in valid if r["decisions_per_second"]>=threshold*maximum]
    return min(eligible,key=lambda r:r["workers"])["workers"]

def benchmark_scaling(worker_counts, minutes_per_setting=3, battles_per_worker=None, seed=81000):
    rows=[]
    for workers in worker_counts:
        report=benchmark(minutes_per_setting,workers=int(workers),battles_per_worker=battles_per_worker,seed=seed)
        rows.append(report)
    baseline=rows[0]["decisions_per_second"]
    table=[]
    for report in rows:
        speedup=report["decisions_per_second"]/max(baseline,1e-9)
        table.append({"workers":report["workers"],"battles_per_second":report["battles_per_second"],
            "decisions_per_second":report["decisions_per_second"],"cpu_percent":report["cpu"]["system_utilization_percent"],
            "gpu_percent":None if report["gpu"] is None else report["gpu"]["utilization_percent"],
            "speedup":speedup,"parallel_efficiency":speedup/report["workers"],
            "worker_crashes":report["worker_crash_restart_count"],"illegal_actions":report["illegal_actions"]})
    summary={"minutes_per_setting":minutes_per_setting,"selection_rule":"smallest stable worker count within 97% of maximum decisions/sec",
      "recommended_workers":recommend_worker_count(rows),"results":table}
    path=ROOT/"artifacts/reports/scaling_summary.json"; path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(summary,indent=2)+"\n")
    return summary
