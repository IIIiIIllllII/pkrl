"""Fail-closed long-run gate; runs bounded real PPO only."""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path
import yaml
from gen3rl.runner import ROOT, commit, metadata, validate_schema_config

REPORT=ROOT/"artifacts/reports/reboot/preflight.json"

def require_preflight(config):
    try: report=json.loads(REPORT.read_text())
    except (OSError,ValueError) as error: raise RuntimeError("NOT READY FOR LONG RUN: run scripts/preflight.sh first") from error
    expected=hashlib.sha256(json.dumps(config,sort_keys=True).encode()).hexdigest()
    dirty=subprocess.check_output(["git","status","--porcelain"],cwd=ROOT,text=True).strip()
    if report.get("verdict")!="READY FOR LONG RUN" or report.get("project_commit")!=commit(ROOT) or report.get("config_hash")!=expected or dirty:
        raise RuntimeError("NOT READY FOR LONG RUN: preflight must pass for this exact clean commit and config")
    from gen3rl.cli import UPSTREAMS
    if any(commit(ROOT/"third_party"/name)!=rev for name,_,rev in UPSTREAMS):
        raise RuntimeError("NOT READY FOR LONG RUN: upstream revision changed")
    actual=metadata(config,int(config["seed"]))
    if any(report.get("environment",{}).get(k)!=actual[k] for k in ("python_version","dependencies","torch_build","node_version","lock_sha256","logical_cpus")):
        raise RuntimeError("NOT READY FOR LONG RUN: runtime changed since preflight")

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--config",default="configs/train_v1_1_100m.yaml")
    args=parser.parse_args(); reasons=[]; checks={}
    config=yaml.safe_load(Path(args.config).read_text())
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    def check(name,cmd,cwd=ROOT):
        result=subprocess.run(cmd,cwd=cwd,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        checks[name]={"returncode":result.returncode,"output":result.stdout[-12000:]}
        print(f"{name}: {'PASS' if result.returncode==0 else 'FAIL'}",flush=True)
        if result.returncode: reasons.append(name+" failed")
    try:
        validate_schema_config(config)
        from gen3rl.cli import UPSTREAMS
        for name,_,revision in UPSTREAMS:
            if commit(ROOT/"third_party"/name)!=revision: reasons.append(name+" revision mismatch")
        if subprocess.run(["git","diff","--quiet","HEAD"],cwd=ROOT/"third_party/pokemon-showdown").returncode:
            reasons.append("Showdown has tracked local modifications")
        if sys.version.split()[0]!=(ROOT/".python-version").read_text().strip(): reasons.append("Python runtime mismatch")
        if subprocess.check_output(["node","--version"],text=True).strip()!="v"+(ROOT/".node-version").read_text().strip(): reasons.append("Node runtime mismatch")
        if subprocess.check_output(["git","status","--porcelain"],cwd=ROOT,text=True).strip(): reasons.append("working tree is dirty")
        check("bridge_build",["node",str(ROOT/"third_party/pokemon-showdown/node_modules/typescript/bin/tsc"),"-p","showdown_bridge/tsconfig.json"])
        check("python_full_suite_including_C_and_privacy",[sys.executable,"-m","pytest","-o","addopts=","-q"])
        check("web_simulator_embed",["node","scripts/embed-simulator.mjs"],ROOT/"web-playtest")
        check("web_server_bundle",["./node_modules/.bin/esbuild","server/simulator.ts","--bundle","--platform=node","--format=cjs","--target=node22","--outfile=server-dist/simulator.cjs"],ROOT/"web-playtest")
        if subprocess.run(["git","diff","--quiet","--","web-playtest/server-dist/simulator.cjs"],cwd=ROOT).returncode:
            reasons.append("committed web server bundle was stale")
        check("typescript_parity_and_web_tests",["node","node_modules/vitest/vitest.mjs","run"],ROOT/"web-playtest")
        check("typescript_build",["node","node_modules/typescript/bin/tsc","-b"],ROOT/"web-playtest")
        check("web_production_build",["node","node_modules/vite/bin/vite.js","build"],ROOT/"web-playtest")
        from gen3rl.eval.reports import collect_states,coverage_report
        from gen3rl.policy.lut import AdditiveLUTPolicy
        from gen3rl.export.lut import export_policy
        from gen3rl.export.parity import verify
        import tempfile
        import torch
        torch.set_num_threads(1); torch.manual_seed(int(config["seed"]))
        policy=AdditiveLUTPolicy()
        states,masks,_,_=collect_states(policy,int(config.get("preflight_states",500)))
        cov=coverage_report(states,masks,REPORT.parent/"feature_coverage.json")
        checks["coverage"]={"visited":cov["visited_entries"],"warnings":cov["warnings"]}
        with tempfile.TemporaryDirectory(prefix="gen3rl-preflight-") as td:
            export_policy(policy,Path(td)); checks["integer_C_parity"]=verify(Path(td))
        from gen3rl.real_benchmark import benchmark_real
        bench=benchmark_real(config,int(config.get("benchmark_decisions",32768)))
        checks["real_ppo"]={k:bench[k] for k in ("steady_decisions_per_second","illegal_actions","parameters_changed","verdict")}
        reasons.extend(bench["reasons"])
    except Exception as error:
        reasons.append(f"{type(error).__name__}: {error}")
    result={"verdict":"NOT READY FOR LONG RUN" if reasons else "READY FOR LONG RUN","reasons":reasons,
        "project_commit":commit(ROOT),"config_hash":hashlib.sha256(json.dumps(config,sort_keys=True).encode()).hexdigest(),"checks":checks,
        "environment":metadata(config,int(config["seed"]))}
    REPORT.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:v for k,v in result.items() if k not in {"checks","environment"}},indent=2))
    return bool(reasons)

if __name__=="__main__": raise SystemExit(main())
