#!/usr/bin/env python3
"""Export frozen clean gen3-lut-v1.1 LUT checkpoints for the web playtest.

Weights are never transcribed by hand: every table is read straight out of the
PyTorch checkpoint through the canonical `gen3rl.export.lut` collector, and the
browser only ever receives the resulting tables plus provenance metadata.

Contaminated gen3-lut-v1 checkpoints are rejected by
`validate_checkpoint_schema`, so they cannot be exported by this script.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from gen3rl.export.lut import collect, integer_score, quantize  # noqa: E402
from gen3rl.features.encoder import encode_request  # noqa: E402
from gen3rl.features.move_semantics import classify_move, effectiveness_feature  # noqa: E402
from gen3rl.features.schema import (  # noqa: E402
    FEATURE_INDEX, FEATURE_SPECS, PAIR_SPECS, SCHEMA_VERSION, SEMANTICS_REVISION,
)
from gen3rl.policy.lut import AdditiveLUTPolicy, NumpyLUTActor, validate_checkpoint_schema  # noqa: E402
from regression_cases import regression_cases  # noqa: E402

MILESTONES = (20_000_000, 50_000_000, 100_000_000)
MOVE_CLASS_NAMES = ("normal-damage", "fixed-damage", "status")
POLICY_DIR = ROOT / "web-playtest/public/policies"
REGRESSION_FIXTURES = ROOT / "web-playtest/tests/fixtures/v1-1-regression-fixtures.json"


def policy_id(decisions: int) -> str:
    return f"v1.1-{decisions // 1_000_000}m"


def find_run() -> Path:
    """Locate the newest completed clean v1.1 run that holds every milestone."""
    candidates = []
    for checkpoint in ROOT.rglob("checkpoints/decision_100000000.pt"):
        run = checkpoint.parent.parent
        metadata_path = run / "source_metadata.json"
        if not metadata_path.is_file():
            continue
        metadata = json.loads(metadata_path.read_text())
        if metadata.get("feature_schema_version") != SCHEMA_VERSION:
            continue
        if metadata.get("semantics_revision") != SEMANTICS_REVISION:
            continue
        if not (run / "metrics.jsonl").is_file() or not (run / "evaluations").is_dir():
            continue
        if not all((run / "checkpoints" / f"decision_{value}.pt").is_file() for value in MILESTONES):
            continue
        candidates.append(run)
    if not candidates:
        raise FileNotFoundError(
            f"no completed {SCHEMA_VERSION} run with 20M/50M/100M checkpoints was found under {ROOT}"
        )
    return max(candidates, key=lambda path: path.stat().st_mtime)


def table_offsets(tables: dict[str, np.ndarray]) -> dict[str, dict]:
    offsets: dict[str, dict] = {}
    cursor = 0
    for name, array in tables.items():
        offsets[name] = {"offset": cursor, "shape": list(array.shape)}
        cursor += int(array.size)
    return offsets


def activated_feature_ids(offsets: dict[str, dict], row: np.ndarray, slot: int) -> list[int]:
    """Global LUT parameter indices that this action's score is the sum of."""
    ids = [offsets["action_bias"]["offset"] + slot]
    for index, spec in enumerate(FEATURE_SPECS):
        ids.append(offsets[f"feature_{spec.name}"]["offset"] + int(row[index]))
    for first, second in PAIR_SPECS:
        width = FEATURE_SPECS[FEATURE_INDEX[second]].size
        ids.append(offsets[f"pair_{first}_{second}"]["offset"]
                   + int(row[FEATURE_INDEX[first]]) * width + int(row[FEATURE_INDEX[second]]))
    return ids


def contributions(tables: dict[str, np.ndarray], offsets: dict[str, dict], row: np.ndarray, slot: int) -> list[dict]:
    """Per-term LUT contributions, in the exact accumulation order of the reference."""
    terms = [{
        "term": "action_bias", "category": str(slot),
        "value_id": slot, "global_id": offsets["action_bias"]["offset"] + slot,
        "weight": float(tables["action_bias"][slot]),
    }]
    for index, spec in enumerate(FEATURE_SPECS):
        value = int(row[index])
        terms.append({
            "term": f"feature_{spec.name}", "category": spec.values[value], "value_id": value,
            "global_id": offsets[f"feature_{spec.name}"]["offset"] + value,
            "weight": float(tables[f"feature_{spec.name}"][value]),
        })
    for first, second in PAIR_SPECS:
        a = int(row[FEATURE_INDEX[first]])
        b = int(row[FEATURE_INDEX[second]])
        width = FEATURE_SPECS[FEATURE_INDEX[second]].size
        terms.append({
            "term": f"pair_{first}_{second}",
            "category": f"{FEATURE_SPECS[FEATURE_INDEX[first]].values[a]}/{FEATURE_SPECS[FEATURE_INDEX[second]].values[b]}",
            "value_id": a * width + b,
            "global_id": offsets[f"pair_{first}_{second}"]["offset"] + a * width + b,
            "weight": float(tables[f"pair_{first}_{second}"][a, b]),
        })
    return terms


def milestone_evaluation(run: Path, decisions: int) -> dict | None:
    path = run / "evaluations" / f"milestone_{decisions}.json"
    if not path.is_file():
        return None
    payload = json.loads(path.read_text())
    result: dict = {}
    for opponent in ("random", "damage"):
        block = payload.get(opponent) or {}
        if block:
            result[f"vs_{opponent}"] = {
                "games": block.get("games"), "win_rate": block.get("win_rate"),
                "illegal_actions": block.get("illegal_actions"),
                "mean_top1_top2_margin": block.get("mean_top1_top2_margin"),
            }
    return result or None


def load_checkpoint(path: Path) -> dict:
    state = torch.load(path, map_location="cpu", weights_only=False)
    validate_checkpoint_schema(state, str(path))
    return state


def policy_asset(run: Path, checkpoint: Path, milestone: int, run_summary: dict) -> tuple[dict, AdditiveLUTPolicy]:
    state = load_checkpoint(checkpoint)
    policy = AdditiveLUTPolicy()
    policy.load_state_dict(state["policy"])
    tables = collect(policy)
    quantized, scale = quantize(tables)
    metadata = state.get("metadata", {})
    counters = state.get("counters", {})
    offsets = table_offsets(tables)
    parameters = int(sum(value.size for value in tables.values()))
    asset = {
        "asset_version": 2,
        "policy_id": policy_id(milestone),
        "schema_version": SCHEMA_VERSION,
        "semantics_revision": metadata.get("semantics_revision"),
        "generation": "clean-v1.1",
        "contaminated": False,
        "checkpoint": {
            "run_id": run.name,
            "run_path": str(run.relative_to(ROOT)) if run.is_relative_to(ROOT) else str(run),
            "file": f"checkpoints/{checkpoint.name}",
            "sha256": hashlib.sha256(checkpoint.read_bytes()).hexdigest(),
            "milestone_decisions": milestone,
            "step": int(state.get("step", 0)),
        },
        "checkpoint_decisions": int(counters.get("decisions", milestone)),
        "training": {
            "decisions": counters.get("decisions"), "battles": counters.get("battles"),
            "updates": counters.get("updates"), "policy_version": counters.get("policy_version"),
            "illegal_actions": counters.get("illegal_actions"),
            "elapsed_seconds": counters.get("elapsed_seconds"),
            "workers": metadata.get("workers"), "device": metadata.get("device"),
            "run_interrupted": run_summary.get("interrupted"),
            "run_final_decisions": run_summary.get("decisions"),
        },
        "source": {
            "project_commit": metadata.get("project_commit"),
            "pokemon_showdown_commit": metadata.get("pokemon_showdown_commit"),
            "pokeemerald_commit": metadata.get("pokeemerald_commit"),
            "config_hash": metadata.get("config_hash"),
            "git_dirty": metadata.get("git_dirty"),
            "dependencies": metadata.get("dependencies"),
            "python_version": metadata.get("python_version"),
        },
        "simulator": {
            "format": "gen3customgame",
            "pokemon_showdown_commit": metadata.get("pokemon_showdown_commit"),
        },
        "evaluation": milestone_evaluation(run, milestone),
        "inference": "float32-additive-lut-argmax",
        "switch_logits": "neutral-zero-v1",
        "parameter_count": parameters,
        "feature_sizes": {spec.name: spec.size for spec in FEATURE_SPECS},
        "pair_specs": [list(pair) for pair in PAIR_SPECS],
        "table_offsets": offsets,
        "quantization": {
            "mode": "int8-symmetric-max-abs",
            "scale": scale,
            "bytes": parameters,
            "clip": [-127, 127],
            "accumulator": "int32-saturated-to-int16",
            "tables": {name: np.asarray(value, dtype=np.int8).tolist() for name, value in quantized.items()},
        },
        "tables": {name: np.asarray(value, dtype=np.float32).tolist() for name, value in tables.items()},
    }
    if asset["semantics_revision"] != SEMANTICS_REVISION:
        raise ValueError(f"{checkpoint} predates audited v1.1 semantics")
    if parameters != 349:
        raise ValueError(f"{checkpoint} produced {parameters} parameters; expected 349")
    return asset, policy


def regression_payload(assets: dict[str, dict], actors: dict[str, NumpyLUTActor]) -> dict:
    fixtures = []
    for case in regression_cases():
        request = case["request"]
        types = case["resolved_defender_types"]
        target_status = request["public"]["target"]["status"]
        features, mask = encode_request(request)
        semantics = []
        for move in request["active"][0]["moves"]:
            bucket = int(effectiveness_feature(move, types, target_status))
            semantics.append({
                "id": move["id"], "move": move["move"],
                "move_class": MOVE_CLASS_NAMES[int(classify_move(move))],
                "applicable": bucket != 0,
                "effectiveness_bucket": bucket,
                "effectiveness": FEATURE_SPECS[FEATURE_INDEX["effectiveness"]].values[bucket],
            })
        expected = {}
        for pid, asset in assets.items():
            tables = {name: np.asarray(value, dtype=np.float32) for name, value in asset["tables"].items()}
            quantized = {name: np.asarray(value, dtype=np.int8) for name, value in asset["quantization"]["tables"].items()}
            offsets = asset["table_offsets"]
            scores = actors[pid].logits(features, mask)
            integers = np.zeros(9, dtype=np.int32)
            integers[:4] = integer_score(quantized, features)
            legal = [float(scores[i]) for i in range(9) if mask[i]]
            legal.sort(reverse=True)
            int_legal = sorted((int(integers[i]) for i in range(9) if mask[i]), reverse=True)
            expected[pid] = {
                "scores": [None if not np.isfinite(value) else float(value) for value in scores],
                "integer_scores": [int(integers[i]) if mask[i] else None for i in range(9)],
                "selected_action": int(np.argmax(scores)),
                "integer_selected_action": int(np.argmax(np.where(mask, integers, -32769))),
                "top1_score": legal[0], "top2_score": legal[1] if len(legal) > 1 else None,
                "margin": (legal[0] - legal[1]) if len(legal) > 1 else None,
                "integer_top1": int_legal[0], "integer_top2": int_legal[1] if len(int_legal) > 1 else None,
                "activated_feature_ids": [activated_feature_ids(offsets, features[slot], slot) for slot in range(4)],
                "contributions": [contributions(tables, offsets, features[slot], slot) for slot in range(4)],
            }
        fixtures.append({
            "name": case["name"], "group": case["group"], "request": request,
            "attacker": case["attacker"], "defender": case["defender"],
            "resolved_defender_types": types, "move_semantics": semantics,
            "expect": case["expect"], "forbid_top1": case["forbid_top1"],
            "features": features.tolist(), "legal_mask": mask.tolist(),
            "expected": expected,
        })
    return {
        "schema_version": SCHEMA_VERSION, "semantics_revision": SEMANTICS_REVISION,
        "generated_by": "scripts/export_web_policies.py",
        "policy_ids": sorted(assets), "fixtures": fixtures,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", type=Path)
    parser.add_argument("--output", type=Path, default=POLICY_DIR)
    args = parser.parse_args()
    run = (args.run or find_run()).resolve()
    run_summary = json.loads((run / "summary.json").read_text()) if (run / "summary.json").is_file() else {}
    args.output.mkdir(parents=True, exist_ok=True)

    assets: dict[str, dict] = {}
    actors: dict[str, NumpyLUTActor] = {}
    for milestone in MILESTONES:
        checkpoint = run / "checkpoints" / f"decision_{milestone}.pt"
        if not checkpoint.is_file():
            raise FileNotFoundError(f"missing required milestone checkpoint {checkpoint}")
        asset, policy = policy_asset(run, checkpoint, milestone, run_summary)
        assets[asset["policy_id"]] = asset
        actors[asset["policy_id"]] = NumpyLUTActor(policy)
        (args.output / f"{asset['policy_id']}.json").write_text(json.dumps(asset, separators=(",", ":")) + "\n")

    index = {
        "schema_version": SCHEMA_VERSION, "semantics_revision": SEMANTICS_REVISION,
        "generation": "clean-v1.1",
        "run_id": run.name,
        "run_summary": {key: run_summary.get(key) for key in
                        ("decisions", "battles", "updates", "illegal_actions", "interrupted", "workers", "device")},
        "policies": [{
            "policy_id": pid,
            "checkpoint_decisions": asset["checkpoint_decisions"],
            "milestone_decisions": asset["checkpoint"]["milestone_decisions"],
            "checkpoint_sha256": asset["checkpoint"]["sha256"],
            "parameter_count": asset["parameter_count"],
            "quantization_scale": asset["quantization"]["scale"],
            "project_commit": asset["source"]["project_commit"],
            "evaluation": asset["evaluation"],
        } for pid, asset in assets.items()],
        "excluded_contaminated_generations": ["gen3-lut-v1"],
    }
    (args.output / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    REGRESSION_FIXTURES.write_text(json.dumps(regression_payload(assets, actors), separators=(",", ":")) + "\n")
    print(json.dumps({
        "run": str(run), "policies": sorted(assets),
        "index": str((args.output / "index.json").relative_to(ROOT)),
        "regression_fixtures": str(REGRESSION_FIXTURES.relative_to(ROOT)),
    }, indent=2))


if __name__ == "__main__":
    main()
