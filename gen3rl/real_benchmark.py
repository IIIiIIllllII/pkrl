"""Bounded production-path PPO benchmark. Never accepts a resume checkpoint."""
import argparse
import json
import time
from pathlib import Path
import yaml
from gen3rl.runner import ROOT, train_run, metadata
from gen3rl.benchmark import _cpu_ticks

def benchmark_real(config, decisions=32768, output=None):
    if not 4096 <= decisions <= 100000:
        raise ValueError("benchmark budget must be 4096..100000 decisions")
    config=dict(config)
    config.update(max_decisions=decisions,checkpoint_decisions=[],milestone_evaluation_decisions=[],
                  quick_evaluation_interval=0,safety_checkpoint_interval=0)
    start=time.perf_counter(); cpu=_cpu_ticks()
    result=train_run(config)
    wall=time.perf_counter()-start; end_cpu=_cpu_ticks()
    rows=[json.loads(line) for line in (Path(result["run_dir"])/"metrics.jsonl").read_text().splitlines()]
    updates=[r for r in rows if r["event"]=="update"]
    steady=updates[1:]
    steady_decisions=result["decisions"]-updates[0]["decisions"] if steady else 0
    steady_seconds=result["elapsed_seconds"]-updates[0]["elapsed_wall_time"] if steady else 0
    rate=steady_decisions/max(steady_seconds,1e-9)
    reasons=[]
    minimum=float(config.get("benchmark_min_decisions_per_second",4500))
    if rate<minimum: reasons.append(f"steady real PPO throughput {rate:.1f} < required {minimum:.1f} decisions/sec")
    if len(updates)<3: reasons.append("fewer than three real PPO generations")
    if result["illegal_actions"]: reasons.append("illegal actions")
    if result["interrupted"]: reasons.append("training interrupted")
    if not result["lut_parameters_changed"]: reasons.append("policy parameters did not change")
    report={"kind":"real synchronous production PPO","metadata":metadata(config,int(config["seed"])),
        "config":config,"decisions":result["decisions"],"updates":len(updates),"wall_seconds":wall,
        "end_to_end_decisions_per_second":result["decisions"]/wall,
        "training_decisions_per_second":result["decisions"]/result["elapsed_seconds"],
        "steady_decisions_per_second":rate,"minimum_decisions_per_second":minimum,
        "cpu_utilization_percent":None if not cpu or not end_cpu else 100*(1-(end_cpu[1]-cpu[1])/max(1,end_cpu[0]-cpu[0])),
        "illegal_actions":result["illegal_actions"],"parameters_changed":result["lut_parameters_changed"],
        "run_dir":result["run_dir"],"generations":updates,"profile":result["profile"],
        "verdict":"NOT READY FOR LONG RUN" if reasons else "READY FOR LONG RUN","reasons":reasons}
    path=Path(output or ROOT/"artifacts/reports/reboot/real_training.json")
    path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(report,indent=2)+"\n")
    return report

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--config",default="configs/train_v1_1_100m.yaml")
    parser.add_argument("--decisions",type=int,default=32768); parser.add_argument("--output")
    args=parser.parse_args()
    try:
        report=benchmark_real(yaml.safe_load(Path(args.config).read_text()),args.decisions,args.output)
        print(json.dumps({k:v for k,v in report.items() if k not in {"generations","config","metadata"}},indent=2))
        return bool(report["reasons"])
    except Exception as error:
        print(f"NOT READY FOR LONG RUN: {type(error).__name__}: {error}")
        return 1

if __name__=="__main__": raise SystemExit(main())
