import json
from pathlib import Path

import numpy as np

from gen3rl.features.encoder import encode_request
from gen3rl.features.schema import SCHEMA_VERSION

ROOT=Path(__file__).resolve().parents[1]

def test_committed_typescript_parity_fixtures_match_python_reference():
    payload=json.loads((ROOT/"web-playtest/public/v1-1-parity-fixtures.json").read_text())
    assert payload["schema_version"] == SCHEMA_VERSION
    for fixture in payload["fixtures"]:
        features,mask=encode_request(fixture["request"])
        assert features.tolist() == fixture["features"]
        assert mask.tolist() == fixture["legal_mask"]
        assert fixture["request"]["public"]["target"]["types"] == fixture["resolved_defender_types"]
        assert np.isfinite(features).all()
