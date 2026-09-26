from __future__ import annotations
import argparse, json, os, shutil, subprocess, sys, tarfile, tempfile, urllib.request
from pathlib import Path
import yaml
ROOT=Path(__file__).resolve().parents[1]
UPSTREAMS=(
    ("pokemon-showdown","https://github.com/smogon/pokemon-showdown.git","2ddfa0476f8207e12e204b1c69f7c7683b17633c"),
    ("pokeemerald","https://github.com/pret/pokeemerald.git","5eff78649e7170a877b961ef0b3da13b81a16038"),
)

def schema_artifacts():
    from gen3rl.features.schema import SCHEMA_VERSION
    return ROOT/"artifacts"/SCHEMA_VERSION

def run(cmd,cwd=ROOT,check=True): return subprocess.run(cmd,cwd=cwd,text=True,capture_output=True,check=check)
def load_config(path): return yaml.safe_load(Path(path).read_text())

def install_pokeemerald_integration(checkout: Path):
    patch=ROOT/"integration/pokeemerald/gen3rl.patch"
    reverse=run(["git","apply","--reverse","--check",str(patch)],checkout,check=False)
    if reverse.returncode==0:
        install_reference_encoder(checkout)
        return "already applied"
    applicable=run(["git","apply","--check",str(patch)],checkout,check=False)
    if applicable.returncode:
        # Migrate only the exact previously committed patch, never arbitrary
        # local ROM edits. Both reverse and new apply remain checked by git.
        old=run(["git","show","1a86b48:integration/pokeemerald/gen3rl.patch"]).stdout
        with tempfile.NamedTemporaryFile(mode="w",suffix=".patch") as f:
            f.write(old); f.flush()
            check=run(["git","apply","--reverse","--check",f.name],checkout,check=False)
            if check.returncode==0:
                run(["git","apply","--reverse",f.name],checkout)
                run(["git","apply",str(patch)],checkout)
                install_reference_encoder(checkout)
                return "upgraded exact historical integration"
        detail=(applicable.stderr or applicable.stdout).strip()
        raise RuntimeError(f"pokeemerald integration patch does not apply: {detail}")
    run(["git","apply",str(patch)],checkout)
    install_reference_encoder(checkout)
    return "applied"

def install_reference_encoder(checkout):
    target=checkout/"src/data/gen3rl"; target.mkdir(parents=True,exist_ok=True)
    for name in ("encoder.h","encoder.c","semantics.generated.h"):
        shutil.copyfile(ROOT/"integration/reference"/name,target/name)
    # The pokeemerald makefile compiles top-level src C files.
    (checkout/"src/gen3rl_encoder.c").write_text('#include "data/gen3rl/encoder.c"\n')
    (checkout/"src/gen3rl_lut.c").write_text('#include "data/battle_ai_rl_lut.c"\n')

def bootstrap(_):
    for p in ("artifacts/checkpoints","artifacts/generated","artifacts/teams","artifacts/coverage","docs","integration/pokeemerald"):
        (ROOT/p).mkdir(parents=True,exist_ok=True)
    third=ROOT/"third_party"; third.mkdir(exist_ok=True)
    if not (ROOT/".git").exists(): run(["git","init"])
    revisions={}
    for name,url,revision in UPSTREAMS:
        if not (third/name/".git").exists(): run(["git","clone",url,str(third/name)])
        checkout=third/name
        current=run(["git","rev-parse","HEAD"],checkout).stdout.strip()
        if current!=revision:
            dirty=run(["git","status","--porcelain"],checkout).stdout.strip()
            if dirty:
                raise RuntimeError(f"{name} has local changes and is not at pinned revision {revision}")
            run(["git","checkout","--detach",revision],checkout)
        if name=="pokemon-showdown" and run(["git","diff","--quiet","HEAD"],checkout,check=False).returncode:
            raise RuntimeError("pinned Showdown has tracked local modifications; preserve them in Git before bootstrap")
        revisions[name]=revision
    patch_status=install_pokeemerald_integration(third/"pokeemerald")
    # Host adapter tests include global.h, which requires this generated map
    # header even without a ROM build. Build only the upstream host utility.
    run(["make","-C","tools/mapjson"],third/"pokeemerald")
    run(["tools/mapjson/mapjson","groups","emerald","data/maps/map_groups.json","data/maps","include/constants"],third/"pokeemerald")
    npm=shutil.which("npm")
    if npm and run([npm,"--version"]).stdout.strip()!="11.6.0": npm=None
    local_npm=third/"npm/bin/npm-cli.js"
    if not local_npm.exists(): local_npm=third/"npm/package/bin/npm-cli.js"
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
    run(["node",str(tsc),"-p","showdown_bridge/tsconfig.json"])
    status={"showdown":revisions["pokemon-showdown"],
            "pokeemerald":revisions["pokeemerald"],"pokeemerald_integration":patch_status,
            "bridge_built":(ROOT/"showdown_bridge/dist/worker.js").exists()}
    print(json.dumps(status,indent=2))

def doctor(_):
    import numpy, yaml
    npm=shutil.which("npm")
    npm_cmd=[npm] if npm else next((["node",str(path)] for path in (ROOT/"third_party/npm/bin/npm-cli.js",ROOT/"third_party/npm/package/bin/npm-cli.js") if path.exists()),None)
    checks={"python":sys.version.split()[0],"numpy":numpy.__version__,"pyyaml":yaml.__version__,
            "node":run(["node","--version"]).stdout.strip(),"npm":run(npm_cmd+["--version"]).stdout.strip() if npm_cmd else "missing",
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
    required=("showdown_checkout","showdown_dist","bridge","pokeemerald","host_cc","write_access","battle_stream_ping")
    ok=all(bool(checks[k]) for k in required) and checks["battle_stream_ping"] is True and checks["npm"]!="missing" and not checks["torch"].startswith("missing")
    print(json.dumps(checks,indent=2)); return 0 if ok else 1

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
    # One authoritative gate; the earlier rollout-only preflight is retired.
    from gen3rl.preflight import main as gate
    previous=sys.argv
    try:
        sys.argv=[previous[0],"--config",args.config]
        return gate()
    finally: sys.argv=previous

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
