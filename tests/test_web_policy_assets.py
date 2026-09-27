"""The committed web policy assets must be the clean v1.1 checkpoints, exactly."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from gen3rl.export.lut import collect, integer_score, quantize  # noqa: E402
from gen3rl.features.encoder import encode_request  # noqa: E402
from gen3rl.features.move_semantics import classify_move, effectiveness_feature  # noqa: E402
from gen3rl.features.schema import FEATURE_INDEX, FEATURE_SPECS, PAIR_SPECS, SCHEMA_VERSION, SEMANTICS_REVISION  # noqa: E402
from gen3rl.policy.lut import AdditiveLUTPolicy, NumpyLUTActor, validate_checkpoint_schema  # noqa: E402
from regression_cases import regression_cases  # noqa: E402

POLICY_DIR = ROOT / "web-playtest/public/policies"
QUARANTINE = ROOT / "web-playtest/quarantine/contaminated-v1"
REGRESSION = ROOT / "web-playtest/tests/fixtures/v1-1-regression-fixtures.json"
POLICY_IDS = ("v1.1-20m", "v1.1-50m", "v1.1-100m")
MILESTONES = {"v1.1-20m": 20_000_000, "v1.1-50m": 50_000_000, "v1.1-100m": 100_000_000}
MOVE_CLASS_NAMES = ("normal-damage", "fixed-damage", "status")


def load(policy_id: str) -> dict:
    return json.loads((POLICY_DIR / f"{policy_id}.json").read_text())


def float_tables(asset: dict) -> dict[str, np.ndarray]:
    return {name: np.asarray(value, dtype=np.float32) for name, value in asset["tables"].items()}


def int_tables(asset: dict) -> dict[str, np.ndarray]:
    return {name: np.asarray(value, dtype=np.int8) for name, value in asset["quantization"]["tables"].items()}


@pytest.mark.parametrize("policy_id", POLICY_IDS)
def test_clean_assets_declare_audited_v1_1_provenance(policy_id):
    asset = load(policy_id)
    assert asset["schema_version"] == SCHEMA_VERSION
    assert asset["semantics_revision"] == SEMANTICS_REVISION
    assert asset["generation"] == "clean-v1.1"
    assert asset["contaminated"] is False
    assert asset["parameter_count"] == 349
    assert asset["checkpoint"]["milestone_decisions"] == MILESTONES[policy_id]
    assert asset["checkpoint"]["file"] == f"checkpoints/decision_{MILESTONES[policy_id]}.pt"
    assert asset["checkpoint_decisions"] >= MILESTONES[policy_id]
    assert len(asset["checkpoint"]["sha256"]) == 64
    assert asset["training"]["illegal_actions"] == 0
    assert asset["training"]["run_interrupted"] is False
    assert asset["source"]["pokemon_showdown_commit"] == "2ddfa0476f8207e12e204b1c69f7c7683b17633c"
    assert asset["source"]["git_dirty"] is False


@pytest.mark.parametrize("policy_id", POLICY_IDS)
def test_table_layout_matches_the_canonical_lut(policy_id):
    asset = load(policy_id)
    expected_order = ["action_bias"] + [f"feature_{s.name}" for s in FEATURE_SPECS] \
        + [f"pair_{a}_{b}" for a, b in PAIR_SPECS]
    assert list(asset["tables"]) == expected_order
    assert list(asset["quantization"]["tables"]) == expected_order
    cursor = 0
    for name in expected_order:
        declared = asset["table_offsets"][name]
        assert declared["offset"] == cursor
        cursor += int(np.prod(declared["shape"]))
    assert cursor == 349
    assert sum(np.asarray(v).size for v in asset["tables"].values()) == 349


@pytest.mark.parametrize("policy_id", POLICY_IDS)
def test_shipped_quantization_is_reproducible_from_the_shipped_floats(policy_id):
    asset = load(policy_id)
    requantized, scale = quantize(float_tables(asset))
    assert scale == pytest.approx(asset["quantization"]["scale"], rel=0, abs=1e-12)
    for name, table in int_tables(asset).items():
        np.testing.assert_array_equal(table, requantized[name])
        assert table.dtype == np.int8
        assert int(np.max(np.abs(table))) <= 127


@pytest.mark.parametrize("policy_id", POLICY_IDS)
def test_recorded_evaluation_matches_the_run_milestone(policy_id):
    asset = load(policy_id)
    index = json.loads((POLICY_DIR / "index.json").read_text())
    assert index["run_id"] == asset["checkpoint"]["run_id"]
    run = ROOT / asset["checkpoint"]["run_path"]
    if not run.is_dir():
        pytest.skip(f"clean run artifacts are not present at {run}")
    payload = json.loads((run / "evaluations" / f"milestone_{MILESTONES[policy_id]}.json").read_text())
    for opponent in ("random", "damage"):
        assert asset["evaluation"][f"vs_{opponent}"]["win_rate"] == payload[opponent]["win_rate"]
        assert asset["evaluation"][f"vs_{opponent}"]["illegal_actions"] == 0


@pytest.mark.parametrize("policy_id", POLICY_IDS)
def test_asset_weights_come_from_the_named_checkpoint(policy_id):
    import torch
    asset = load(policy_id)
    checkpoint = ROOT / asset["checkpoint"]["run_path"] / asset["checkpoint"]["file"]
    if not checkpoint.is_file():
        pytest.skip(f"source checkpoint is not present at {checkpoint}")
    assert hashlib.sha256(checkpoint.read_bytes()).hexdigest() == asset["checkpoint"]["sha256"]
    state = torch.load(checkpoint, map_location="cpu", weights_only=False)
    validate_checkpoint_schema(state, str(checkpoint))
    policy = AdditiveLUTPolicy()
    policy.load_state_dict(state["policy"])
    for name, table in collect(policy).items():
        np.testing.assert_array_equal(np.asarray(table, dtype=np.float32), float_tables(asset)[name])
    assert state["counters"]["decisions"] == asset["checkpoint_decisions"]
    assert state["counters"]["illegal_actions"] == 0


def test_contaminated_v1_assets_are_quarantined_outside_the_served_directory():
    for policy_id in ("v1-10m", "v1-50m", "v1-100m"):
        assert not (POLICY_DIR / f"{policy_id}.json").exists()
        quarantined = json.loads((QUARANTINE / f"{policy_id}.json").read_text())
        assert quarantined["schema_version"] == "gen3-lut-v1"
    assert not (ROOT / "web-playtest/public/parity-fixtures.json").exists()
    assert (QUARANTINE / "parity-fixtures.json").is_file()
    served = {path.name for path in POLICY_DIR.iterdir()}
    assert served == {"index.json", "v1.1-20m.json", "v1.1-50m.json", "v1.1-100m.json"}


def test_no_source_file_loads_a_contaminated_asset():
    """No shipped module may import, fetch or register a contaminated v1 asset."""
    import re
    loader = re.compile(r"""(?:import\s[^;\n]*?from\s*|require\(\s*|fetch\(\s*)[`'"]([^`'"\s]+)""")
    registration = re.compile(r"""['"](v1-(?:10|50|100)m)['"]\s*:""")
    for directory in ("web-playtest/src", "web-playtest/server", "web-playtest/api"):
        for path in (ROOT / directory).rglob("*"):
            if not path.is_file() or path.suffix not in {".ts", ".tsx", ".mjs", ".js"}:
                continue
            text = path.read_text()
            for target in loader.findall(text):
                assert "quarantine" not in target, f"{path} loads {target} from the quarantine"
                assert "parity-fixtures" not in target, f"{path} loads the parity oracle {target}"
                assert not re.search(r"policies/v1-(10|50|100)m", target), f"{path} loads contaminated {target}"
            assert not registration.search(text), f"{path} registers a contaminated policy id"


def test_required_regression_cases_match_the_python_reference():
    cases = regression_cases()
    groups = {case["group"] for case in cases}
    assert {"damaging-immunity", "damaging-effectiveness", "status-not-charted",
            "status-applicability", "fixed-damage", "playtest-regression"} <= groups
    for case in cases:
        types = case["resolved_defender_types"]
        status = case["request"]["public"]["target"]["status"]
        for move in case["request"]["active"][0]["moves"]:
            expected = case["expect"].get(move["id"])
            if not expected:
                continue
            bucket = int(effectiveness_feature(move, types, status))
            actual = [MOVE_CLASS_NAMES[int(classify_move(move))], bucket != 0,
                      FEATURE_SPECS[FEATURE_INDEX["effectiveness"]].values[bucket]]
            assert actual == expected, f"{case['name']} / {move['id']}"


def test_regression_fixtures_are_self_consistent_with_the_shipped_tables():
    payload = json.loads(REGRESSION.read_text())
    assert payload["schema_version"] == SCHEMA_VERSION
    assert sorted(payload["policy_ids"]) == sorted(POLICY_IDS)
    assert len(payload["fixtures"]) == len(regression_cases())
    assets = {policy_id: load(policy_id) for policy_id in POLICY_IDS}
    for fixture in payload["fixtures"]:
        features, mask = encode_request(fixture["request"])
        assert features.tolist() == fixture["features"]
        assert mask.tolist() == fixture["legal_mask"]
        assert fixture["request"]["public"]["target"]["types"] == fixture["resolved_defender_types"]
        for policy_id, asset in assets.items():
            expected = fixture["expected"][policy_id]
            flat = np.concatenate([np.asarray(v, dtype=np.float32).flatten() for v in asset["tables"].values()])
            integers = integer_score(int_tables(asset), features)
            for slot in range(4):
                if not mask[slot]:
                    continue
                ids = expected["activated_feature_ids"][slot]
                assert len(ids) == 1 + len(FEATURE_SPECS) + len(PAIR_SPECS)
                assert float(sum(flat[i] for i in ids)) == pytest.approx(expected["scores"][slot], abs=1e-5)
                assert sum(term["weight"] for term in expected["contributions"][slot]) == pytest.approx(
                    expected["scores"][slot], abs=1e-5)
                assert int(integers[slot]) == expected["integer_scores"][slot]
            legal = sorted((expected["scores"][i] for i in range(9) if mask[i]), reverse=True)
            assert expected["top1_score"] == pytest.approx(legal[0])
            if len(legal) > 1:
                assert expected["margin"] == pytest.approx(legal[0] - legal[1])


@pytest.mark.parametrize("policy_id", POLICY_IDS)
def test_no_clean_checkpoint_prefers_a_forbidden_immune_move(policy_id):
    """The Gyarados/Skarmory playtest bug, asserted against the real weights."""
    asset = load(policy_id)
    policy = AdditiveLUTPolicy()
    tables = float_tables(asset)
    import torch
    with torch.no_grad():
        policy.action_bias.copy_(torch.from_numpy(tables["action_bias"]))
        for spec, parameter in zip(FEATURE_SPECS, policy.tables):
            parameter.copy_(torch.from_numpy(tables[f"feature_{spec.name}"]))
        for (a, b), parameter in zip(PAIR_SPECS, policy.pairs):
            parameter.copy_(torch.from_numpy(tables[f"pair_{a}_{b}"]))
    actor = NumpyLUTActor(policy)
    for case in regression_cases():
        if not case["forbid_top1"]:
            continue
        features, mask = encode_request(case["request"])
        scores = actor.logits(features, mask)
        chosen = int(np.argmax(scores))
        moves = case["request"]["active"][0]["moves"]
        for forbidden in case["forbid_top1"]:
            slot = next(i for i, move in enumerate(moves) if move["id"] == forbidden)
            assert int(features[slot][FEATURE_INDEX["effectiveness"]]) == 0, f"{forbidden} must encode as immune"
            assert chosen != slot, (
                f"{policy_id} chose immune {forbidden} in {case['name']}; "
                f"scores={[round(float(scores[i]), 4) for i in range(9) if mask[i]]}"
            )


def test_final_web_asset_ships_the_same_349_bytes_as_the_rom_lut():
    """The 100M browser asset and the exported ROM LUT must be the same bytes."""
    provenance = ROOT / "artifacts/gen3-lut-v1.1/clean-run-20260926-160543-1c6977"
    run_tables = json.loads((provenance / "lut_quantized.json").read_text())
    manifest = json.loads((provenance / "lut_manifest.json").read_text())
    asset = load("v1.1-100m")
    assert manifest["schema_version"] == SCHEMA_VERSION
    assert manifest["scale"] == asset["quantization"]["scale"]
    assert manifest["bytes"] == asset["quantization"]["bytes"] == 349
    shipped = int_tables(asset)
    assert sorted(run_tables) == sorted(shipped)
    for name, table in run_tables.items():
        np.testing.assert_array_equal(np.asarray(table, dtype=np.int8), shipped[name])
    header = (provenance / "generated/battle_ai_rl_lut.h").read_text()
    assert f'#define RL_FEATURE_SCHEMA "{SCHEMA_VERSION}"' in header
    assert "#define RL_LUT_PARAMETERS 349" in header
