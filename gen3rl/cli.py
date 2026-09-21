from __future__ import annotations
import argparse, json, os, shutil, subprocess, sys, tarfile, tempfile, urllib.request
from pathlib import Path
import yaml
ROOT=Path(__file__).resolve().parents[1]

def schema_artifacts():
    from gen3rl.features.schema import SCHEMA_VERSION
    return ROOT/"artifacts"/SCHEMA_VERSION

def run(cmd,cwd=ROOT,check=True): return subprocess.run(cmd,cwd=cwd,text=True,capture_output=True,check=check)
def load_config(path): return yaml.safe_load(Path(path).read_text())

def bootstrap(_):
    for p in ("artifacts/checkpoints","artifacts/generated","artifacts/teams","artifacts/coverage","docs","integration/pokeemerald"):
        (ROOT/p).mkdir(parents=True,exist_ok=True)
    third=ROOT/"third_party"; third.mkdir(exist_ok=True)
    if not (ROOT/".git").exists(): run(["git","init"])
    repos=(("pokemon-showdown","https://github.com/smogon/pokemon-showdown.git"),("pokeemerald","https://github.com/pret/pokeemerald.git"))
    for name,url in repos:
        if not (third/name/".git").exists(): run(["git","clone",url,str(third/name)])
    npm=shutil.which("npm")
    local_npm=third/"npm/bin/npm-cli.js"
    if not npm and not local_npm.exists():
        with tempfile.TemporaryDirectory(prefix="gen3rl-npm-") as td:
            archive=Path(td)/"npm.tgz"; urllib.request.urlretrieve("https://registry.npmjs.org/npm/-/npm-11.6.0.tgz",archive)
            (third/"npm").mkdir(exist_ok=True); tarfile.open(archive).extractall(third/"npm",filter="data")
            # Registry archives contain package/; retain an invocation-friendly path.
            local_npm=third/"npm/package/bin/npm-cli.js"
    npm_cmd=[npm] if npm else ["node",str(local_npm)]
    if not (third/"pokemon-showdown/dist/sim/battle-stream.js").exists():
        run(npm_cmd+["ci","--omit=optional"],third/"pokemon-showdown"); run(["node","build"],third/"pokemon-showdown")
    tsc=third/"pokemon-showdown/node_modules/typescript/bin/tsc"
    if not (ROOT/"showdown_bridge/dist/worker.js").exists(): run(["node",str(tsc),"-p","showdown_bridge/tsconfig.json"])
    status={"showdown":run(["git","rev-parse","HEAD"],third/"pokemon-showdown").stdout.strip(),
            "pokeemerald":run(["git","rev-parse","HEAD"],third/"pokeemerald").stdout.strip(),
            "bridge_built":(ROOT/"showdown_bridge/dist/worker.js").exists()}
    print(json.dumps(status,indent=2))

def doctor(_):
    import numpy, yaml
    checks={"python":sys.version.split()[0],"numpy":numpy.__version__,"pyyaml":yaml.__version__,
            "node":run(["node","--version"]).stdout.strip(),"npm": "local 11.6.0" if (ROOT/"third_party/npm/bin/npm-cli.js").exists() else "missing",
            "showdown_checkout":(ROOT/"third_party/pokemon-showdown").is_dir(),"showdown_dist":(ROOT/"third_party/pokemon-showdown/dist/sim/battle-stream.js").exists(),
            "bridge":(ROOT/"showdown_bridge/dist/worker.js").exists(),"pokeemerald":(ROOT/"third_party/pokeemerald").is_dir(),
            "host_cc":shutil.which("cc"),"gba_cc":shutil.which("arm-none-eabi-gcc"),"write_access":os.access(ROOT,os.W_OK)}
    try: import torch; checks["torch"]=torch.__version__
    except Exception as e: checks["torch"]=f"missing: {e}"
    from gen3rl.features.schema import SCHEMA_VERSION; checks["feature_schema"]=SCHEMA_VERSION
    from gen3rl.env.bridge import ShowdownBridge
    try:
        with ShowdownBridge() as b: b.send({"cmd":"ping"}); checks["battle_stream_ping"]=b.receive()["type"]=="pong"
    except Exception as e: checks["battle_stream_ping"]=f"failed: {e}"
    print(json.dumps(checks,indent=2)); return 0 if all(v is not False for v in checks.values()) else 1

def extract_trainers(_):
    from gen3rl.extract.trainers import extract; records=extract(); print(json.dumps({"trainers":len(records),"output":"artifacts/teams/pokeemerald_trainers.jsonl"}))
def smoke_cmd(args):
    from gen3rl.runner import smoke; print(json.dumps(smoke(load_config(args.config)),indent=2))
def train(args):
    from gen3rl.runner import train_run
    config=load_config(args.config)
    if args.workers is not None: config["workers"]=args.workers
    print(json.dumps(train_run(config,resume=args.resume),indent=2))
def export(args):
    import torch
    from gen3rl.policy.lut import AdditiveLUTPolicy, validate_checkpoint_schema
    from gen3rl.export.lut import export_policy
    p=AdditiveLUTPolicy(); state=torch.load(args.checkpoint,map_location="cpu",weights_only=False); validate_checkpoint_schema(state,args.checkpoint); p.load_state_dict(state["policy"])
    manifest,_=export_policy(p,schema_artifacts()); print(json.dumps(manifest,indent=2))
def parity(_):
    from gen3rl.export.parity import verify; print(json.dumps(verify(schema_artifacts()),indent=2))
def evaluate(args):
    import torch
    from gen3rl.policy.lut import AdditiveLUTPolicy, validate_checkpoint_schema
    from gen3rl.runner import evaluate_suites
    from gen3rl.env.bridge import ShowdownBridge
    p=AdditiveLUTPolicy()
    if args.checkpoint:
        state=torch.load(args.checkpoint,map_location="cpu",weights_only=False); validate_checkpoint_schema(state,args.checkpoint); p.load_state_dict(state["policy"])
    with ShowdownBridge() as bridge: results=evaluate_suites(p,bridge,args.games,seed=args.seed)
    output=Path(args.output)
    output.parent.mkdir(parents=True,exist_ok=True); output.write_text(json.dumps(results,indent=2)+"\n")
    print(json.dumps(results,indent=2))

def benchmark_cmd(args):
    from gen3rl.benchmark import benchmark
    report=benchmark(args.minutes,args.battles,workers=args.workers,battles_per_worker=args.battles_per_worker)
    print(json.dumps(report,indent=2))

def benchmark_scaling_cmd(args):
    from gen3rl.benchmark import benchmark_scaling
    counts=[int(x) for x in args.workers.split(",") if x.strip()]
    print(json.dumps(benchmark_scaling(counts,args.minutes_per_setting,args.battles_per_worker),indent=2))

def real_states_cmd(args):
    import torch
    from gen3rl.policy.lut import AdditiveLUTPolicy, validate_checkpoint_schema
    from gen3rl.eval.reports import collect_states,quantization_report,coverage_report,fixed_eval_manifest
    p=AdditiveLUTPolicy()
    if args.checkpoint:
        state=torch.load(args.checkpoint,map_location="cpu",weights_only=False); validate_checkpoint_schema(state,args.checkpoint); p.load_state_dict(state["policy"])
    report_root=schema_artifacts()/"reports"; report_root.mkdir(parents=True,exist_ok=True)
    states,masks,domains,info=collect_states(p,args.states); q=quantization_report(p,states,masks,domains,report_root/"quantization_real_states.json"); q["source_battles"]=info["battles"]
    (report_root/"quantization_real_states.json").write_text(json.dumps(q,indent=2)+"\n")
    coverage=coverage_report(states,masks,report_root/"feature_coverage.json"); fixed_eval_manifest(schema_artifacts()/"eval/fixed_suites.json"); print(json.dumps({"quantization":q,"coverage":{k:coverage[k] for k in ("visited_entries","rare_entries","unvisited_entries","warnings")}},indent=2))

def preflight(args):
    reasons=[]; warnings=[]; config=load_config(args.config); workers=int(config.get("workers",1))
    if os.cpu_count() and workers>os.cpu_count(): warnings.append(f"configured {workers} workers but only {os.cpu_count()} logical CPUs are visible")
    try:
        meminfo={line.split(":",1)[0]:int(line.split(":",1)[1].strip().split()[0]) for line in Path("/proc/meminfo").read_text().splitlines()}
        available_gib=meminfo["MemAvailable"]/(1024**2)
        minimum_gib=float(config.get("minimum_available_ram_gib",2))
        if available_gib<minimum_gib: reasons.append(f"only {available_gib:.1f} GiB RAM available; config requires {minimum_gib:.1f} GiB")
    except (ValueError,OSError): warnings.append("could not determine available RAM")
    if str(config.get("device","cpu"))=="cuda":
        try:
            import torch
            if not torch.cuda.is_available(): reasons.append("config requests CUDA but CUDA is unavailable")
        except ImportError: reasons.append("config requests CUDA but PyTorch is unavailable")
    doctor_result=run([str(ROOT/".venv/bin/python"),"-m","gen3rl.cli","doctor"],check=False)
    if doctor_result.returncode: reasons.append("doctor failed")
    test=run([str(ROOT/".venv/bin/python"),"-m","pytest","-q"],check=False)
    if test.returncode: reasons.append("test suite failed")
    try:
        from gen3rl.runner import smoke,evaluate_suites
        from gen3rl.env.bridge import ShowdownBridge
        from gen3rl.benchmark import benchmark
        from gen3rl.eval.reports import collect_states,quantization_report,coverage_report,fixed_eval_manifest
        from gen3rl.policy.lut import AdditiveLUTPolicy
        from gen3rl.parallel import initial_seed_schedule
        schedule=initial_seed_schedule(int(config.get("seed",1)),workers)
        if len({row["worker_seed"] for row in schedule})!=workers or len({row["battle_seed"] for row in schedule})!=workers:
            reasons.append("parallel seed collision")
        summary=smoke(config); policy=AdditiveLUTPolicy(); policy.load_state_dict(__import__("torch").load(summary["checkpoint"],map_location="cpu",weights_only=False)["policy"])
        states,masks,domains,_=collect_states(policy,int(config.get("preflight_states",500)),seed=int(config.get("seed",1))+500)
        report_root=schema_artifacts()/"reports"; report_root.mkdir(parents=True,exist_ok=True)
        q=quantization_report(policy,states,masks,domains,report_root/"preflight_quantization.json")
        cov=coverage_report(states,masks,report_root/"preflight_coverage.json"); fixed_eval_manifest(schema_artifacts()/"eval/fixed_suites.json")
        bench=benchmark(float(config.get("preflight_minutes",.05)),max_battles=max(100,workers),workers=workers)
        with ShowdownBridge() as bridge: evaluation=evaluate_suites(policy,bridge,games=4,seed=99000)
        if not q["top1_agreement"]>=.99: reasons.append("real-state quantization agreement below 99%")
        if bench["battles"]<1: reasons.append("benchmark completed no battles")
        if bench["illegal_actions"]: reasons.append("parallel benchmark selected illegal actions")
        if bench["worker_crash_restart_count"]: reasons.append("parallel rollout worker crashed")
        if len(bench["per_worker_throughput"])!=workers: reasons.append("not every configured worker completed a battle")
        if summary.get("checkpoint_roundtrip") is not True: reasons.append("checkpoint round-trip failed")
    except Exception as e: reasons.append(f"preflight exception: {type(e).__name__}: {e}")
    verdict="READY FOR LONG RUN" if not reasons else "NOT READY"
    print(json.dumps({"verdict":verdict,"reasons":reasons,"warnings":warnings,"workers":workers,"available_ram_gib":locals().get("available_gib"),
        "tests":test.stdout.strip().splitlines()[-1:],"doctor":doctor_result.returncode==0},indent=2)); return 0 if not reasons else 1

def main(argv=None):
    p=argparse.ArgumentParser(prog="python -m gen3rl.cli"); sub=p.add_subparsers(dest="command",required=True)
    for name,func in (("bootstrap",bootstrap),("doctor",doctor),("extract-trainers",extract_trainers),("verify-parity",parity)):
        x=sub.add_parser(name); x.set_defaults(func=func)
    x=sub.add_parser("smoke"); x.add_argument("--config",default=str(ROOT/"configs/smoke.yaml")); x.set_defaults(func=smoke_cmd)
    x=sub.add_parser("train"); x.add_argument("--config",default=str(ROOT/"configs/train.yaml")); x.add_argument("--resume"); x.add_argument("--workers",type=int); x.set_defaults(func=train)
    x=sub.add_parser("evaluate"); x.add_argument("--checkpoint"); x.add_argument("--games",type=int,default=100)
    x.add_argument("--seed",type=int,default=10000); x.add_argument("--output",default=str(ROOT/"artifacts/reports/evaluation.json")); x.set_defaults(func=evaluate)
    x=sub.add_parser("export-lut"); x.add_argument("--checkpoint",required=True); x.set_defaults(func=export)
    x=sub.add_parser("benchmark"); x.add_argument("--minutes",type=float,default=10); x.add_argument("--battles",type=int); x.add_argument("--workers",type=int,default=1); x.add_argument("--battles-per-worker",type=int); x.set_defaults(func=benchmark_cmd)
    x=sub.add_parser("benchmark-scaling"); x.add_argument("--workers",default="1,2,4,8,12,16"); x.add_argument("--minutes-per-setting",type=float,default=3); x.add_argument("--battles-per-worker",type=int); x.set_defaults(func=benchmark_scaling_cmd)
    x=sub.add_parser("analyze-real-states"); x.add_argument("--checkpoint"); x.add_argument("--states",type=int,default=10000); x.set_defaults(func=real_states_cmd)
    x=sub.add_parser("preflight"); x.add_argument("--config",default=str(ROOT/"configs/train_2080ti_24h.yaml")); x.set_defaults(func=preflight)
    args=p.parse_args(argv); result=args.func(args); raise SystemExit(result or 0)
if __name__=="__main__": main()
