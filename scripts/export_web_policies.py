#!/usr/bin/env python3
"""Export frozen LUT checkpoints and parity fixtures for the web playtest."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch

from gen3rl.export.lut import collect
from gen3rl.features.encoder import encode_request
from gen3rl.features.schema import FEATURE_SPECS, PAIR_SPECS, SCHEMA_VERSION
from gen3rl.policy.lut import AdditiveLUTPolicy, NumpyLUTActor, validate_checkpoint_schema

ROOT = Path(__file__).resolve().parents[1]


def find_run() -> Path:
    candidates = []
    for checkpoint in ROOT.rglob("checkpoints/decision_100000000.pt"):
        run = checkpoint.parent.parent
        metadata_path=run/"source_metadata.json"
        schema=json.loads(metadata_path.read_text()).get("feature_schema_version") if metadata_path.is_file() else None
        if schema == SCHEMA_VERSION and (run / "metrics.jsonl").is_file() and (run / "evaluations").is_dir():
            candidates.append(run)
    if not candidates:
        raise FileNotFoundError(f"no completed {SCHEMA_VERSION} run with a 100M checkpoint was found")
    return max(candidates, key=lambda path: path.stat().st_mtime)


def policy_asset(checkpoint: Path, decisions: int) -> dict:
    state = torch.load(checkpoint, map_location="cpu", weights_only=False)
    validate_checkpoint_schema(state, str(checkpoint))
    policy = AdditiveLUTPolicy()
    policy.load_state_dict(state["policy"])
    tables = collect(policy)
    metadata = state.get("metadata", {})
    return {
        "asset_version": 1,
        "policy_id": f"v1-{decisions // 1_000_000}m",
        "schema_version": SCHEMA_VERSION,
        "checkpoint_decisions": decisions,
        "simulator": {
            "format": "gen3customgame",
            "pokemon_showdown_commit": metadata.get("pokemon_showdown_commit"),
        },
        "inference": "float32-additive-lut-argmax",
        "switch_logits": "neutral-zero-v1",
        "parameter_count": sum(value.size for value in tables.values()),
        "feature_sizes": {spec.name: spec.size for spec in FEATURE_SPECS},
        "pair_specs": [list(pair) for pair in PAIR_SPECS],
        "tables": {name: np.asarray(value, dtype=np.float32).tolist() for name, value in tables.items()},
    }


FIXTURE_REQUESTS = [
    {
        "name": "healthy neutral attacker",
        "request": {
            "active": [{"moves": [
                {"id": "surf", "move": "Surf", "type": "Water", "basePower": 95, "accuracy": 100, "priority": 0, "pp": 16, "effectivenessBucket": 3},
                {"id": "earthquake", "move": "Earthquake", "type": "Ground", "basePower": 100, "accuracy": 100, "priority": 0, "pp": 16, "effectivenessBucket": 2},
                {"id": "icebeam", "move": "Ice Beam", "type": "Ice", "basePower": 95, "accuracy": 100, "priority": 0, "pp": 8, "effectivenessBucket": 4},
                {"id": "protect", "move": "Protect", "type": "Normal", "basePower": 0, "accuracy": True, "priority": 3, "pp": 10, "effectivenessBucket": 3},
            ]}],
            "side": {"pokemon": [
                {"active": True, "condition": "175/175", "types": ["Water", "Ground"], "stats": {"spe": 80}},
                {"active": False, "condition": "150/150"},
            ]},
            "public": {"target": {"species": "Salamence", "hpBucket": 4, "status": "", "estimatedSpeed": 120}, "weather": "", "turn": 1},
        },
    },
    {
        "name": "low hp recovery and status",
        "request": {
            "active": [{"moves": [
                {"id": "softboiled", "move": "Soft-Boiled", "type": "Normal", "basePower": 0, "accuracy": True, "priority": 0, "pp": 4, "effectivenessBucket": 3},
                {"id": "toxic", "move": "Toxic", "type": "Poison", "basePower": 0, "accuracy": 85, "priority": 0, "pp": 8, "effectivenessBucket": 0},
                {"id": "seismictoss", "move": "Seismic Toss", "type": "Fighting", "basePower": 0, "accuracy": 100, "priority": 0, "pp": 12, "effectivenessBucket": 3},
                {"id": "lightscreen", "move": "Light Screen", "type": "Psychic", "basePower": 0, "accuracy": True, "priority": 0, "pp": 20, "effectivenessBucket": 3},
            ]}],
            "side": {"pokemon": [{"active": True, "condition": "40/300 tox", "types": ["Normal"], "stats": {"spe": 60}}]},
            "public": {"target": {"species": "Gengar", "hpBucket": 2, "status": "psn", "estimatedSpeed": 130}, "weather": "Sandstorm", "turn": 9},
        },
    },
    {
        "name": "disabled move and switches",
        "request": {
            "active": [{"moves": [
                {"id": "thunderbolt", "move": "Thunderbolt", "type": "Electric", "basePower": 95, "accuracy": 100, "priority": 0, "pp": 0, "disabled": True, "effectivenessBucket": 0},
                {"id": "hiddenpower", "move": "Hidden Power", "type": "Grass", "basePower": 70, "accuracy": 100, "priority": 0, "pp": 12, "effectivenessBucket": 4},
                {"id": "toxic", "move": "Toxic", "type": "Poison", "basePower": 0, "accuracy": 85, "priority": 0, "pp": 6, "effectivenessBucket": 3},
                {"id": "agility", "move": "Agility", "type": "Psychic", "basePower": 0, "accuracy": True, "priority": 0, "pp": 18, "self": {"boosts": {"spe": 2}}, "effectivenessBucket": 3},
            ]}],
            "side": {"pokemon": [
                {"active": True, "condition": "60/160 par", "types": ["Electric", "Flying"], "stats": {"spe": 140}},
                {"active": False, "condition": "120/120"},
                {"active": False, "condition": "0 fnt"},
                {"active": False, "condition": "90/120 brn"},
            ]},
            "public": {"target": {"species": "Swampert", "hpBucket": 1, "status": "", "estimatedSpeed": 70}, "weather": "RainDance", "turn": 15},
        },
    },
    {
        "name": "forced switch",
        "request": {
            "forceSwitch": [True],
            "active": None,
            "side": {"pokemon": [
                {"active": True, "condition": "0 fnt", "types": ["Ghost"], "stats": {"spe": 90}},
                {"active": False, "condition": "100/100"},
                {"active": False, "condition": "80/100"},
            ]},
            "public": {"target": {"species": "Tyranitar", "hpBucket": 3, "status": "", "estimatedSpeed": 80}, "weather": "Sandstorm", "turn": 4},
        },
    },
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "web-playtest/public/policies")
    args = parser.parse_args()
    run = (args.run or find_run()).resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    assets = {}
    for decisions in (10_000_000, 50_000_000, 100_000_000):
        checkpoint = run / "checkpoints" / f"decision_{decisions}.pt"
        if checkpoint.exists():
            asset = policy_asset(checkpoint, decisions)
            assets[asset["policy_id"]] = asset
            (args.output / f"{asset['policy_id']}.json").write_text(json.dumps(asset, separators=(",", ":")) + "\n")
    if not assets:
        raise FileNotFoundError(f"no requested milestone checkpoints in {run}")
    fixtures = []
    for source in FIXTURE_REQUESTS:
        features, mask = encode_request(source["request"])
        expected = {}
        for policy_id, asset in assets.items():
            checkpoint = run / "checkpoints" / f"decision_{asset['checkpoint_decisions']}.pt"
            state = torch.load(checkpoint, map_location="cpu", weights_only=False)
            validate_checkpoint_schema(state, str(checkpoint))
            policy = AdditiveLUTPolicy(); policy.load_state_dict(state["policy"])
            scores = NumpyLUTActor(policy).logits(features, mask)
            expected[policy_id] = {
                "scores": [None if not np.isfinite(x) else float(x) for x in scores],
                "selected_action": int(np.argmax(scores)),
            }
        fixtures.append({**source, "features": features.tolist(), "legal_mask": mask.tolist(), "expected": expected})
    fixture_path = args.output.parent / "parity-fixtures.json"
    fixture_path.write_text(json.dumps({"schema_version": SCHEMA_VERSION, "fixtures": fixtures}, indent=2) + "\n")
    print(json.dumps({"run": str(run), "policies": sorted(assets), "fixtures": str(fixture_path)}))


if __name__ == "__main__":
    main()
