from gen3rl.extract.trainers import extract
def test_extract_real_trainers(tmp_path):
    records=extract(tmp_path/"trainers.jsonl")
    assert records and any(m["default_moves"] for r in records for m in r["pokemon"])
    assert any(not m["default_moves"] for r in records for m in r["pokemon"])
    assert all("fixedIV" in r["metadata"]["iv_path"] for r in records)

