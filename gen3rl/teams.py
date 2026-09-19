"""Deterministic cartridge splits and coverage-oriented legal Gen 3 teams."""
from __future__ import annotations
import hashlib, json, random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SYNTHETIC_TEAMS = (
    [{"species":"Charizard","level":50,"moves":["Flamethrower","Sunny Day","Will-O-Wisp","Roar"]},
     {"species":"Forretress","level":50,"moves":["Spikes","Protect","Explosion","Rapid Spin"]}],
    [{"species":"Swampert","level":50,"moves":["Surf","Earthquake","Ice Beam","Protect"]},
     {"species":"Salamence","level":50,"moves":["Dragon Dance","Aerial Ace","Earthquake","Rest"]}],
    [{"species":"Gengar","level":50,"moves":["Shadow Ball","Thunderbolt","Hypnosis","Explosion"]},
     {"species":"Blissey","level":50,"moves":["Soft-Boiled","Toxic","Seismic Toss","Light Screen"]}],
    [{"species":"Skarmory","level":50,"moves":["Spikes","Whirlwind","Rest","Drill Peck"]},
     {"species":"Jolteon","level":50,"moves":["Thunderbolt","Thunder Wave","Baton Pass","Agility"]}],
    [{"species":"Tyranitar","level":50,"moves":["Rock Slide","Crunch","Sandstorm","Roar"]},
     {"species":"Shedinja","level":50,"moves":["Shadow Ball","Protect","Toxic","Baton Pass"]}],
    [{"species":"Ludicolo","level":50,"moves":["Rain Dance","Surf","Giga Drain","Leech Seed"]},
     {"species":"Magneton","level":50,"moves":["Thunderbolt","Metal Sound","Reflect","Explosion"]}],
    [{"species":"Dusclops","level":50,"moves":["Night Shade","Will-O-Wisp","Rest","Protect"]},
     {"species":"Machamp","level":50,"moves":["Cross Chop","Rock Slide","Bulk Up","Seismic Toss"]}],
    [{"species":"Flygon","level":50,"moves":["Earthquake","Rock Slide","Fire Blast","Sandstorm"]},
     {"species":"Articuno","level":50,"moves":["Ice Beam","Reflect","Rest","Hail"]}],
)

def synthetic_match(seed: int):
    rng=random.Random(seed); first=seed%len(SYNTHETIC_TEAMS); second=(first+1+rng.randrange(len(SYNTHETIC_TEAMS)-1))%len(SYNTHETIC_TEAMS)
    return json.loads(json.dumps(SYNTHETIC_TEAMS[first])), json.loads(json.dumps(SYNTHETIC_TEAMS[second]))

def load_cartridge_records(path=ROOT/"artifacts/teams/pokeemerald_trainers.jsonl"):
    path=Path(path)
    if not path.exists(): return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]

def stable_cartridge_splits(records=None, seed=20260919, output=ROOT/"artifacts/eval"):
    records=records or load_cartridge_records(); buckets={"train":[],"validation":[],"held_out":[]}
    for record in records:
        digest=hashlib.sha256(f"{seed}:{record['trainer_id']}".encode()).digest()[0]
        split="train" if digest<179 else "validation" if digest<218 else "held_out"
        buckets[split].append(record["trainer_id"])
    output=Path(output); output.mkdir(parents=True,exist_ok=True)
    manifest={"seed":seed,"algorithm":"sha256 first byte; 70/15/15","counts":{k:len(v) for k,v in buckets.items()},"splits":buckets}
    (output/"cartridge_splits.json").write_text(json.dumps(manifest,indent=2)+"\n")
    return manifest

def cartridge_match(seed: int, split="train"):
    records=load_cartridge_records(); manifest=stable_cartridge_splits(records)
    wanted=set(manifest["splits"][split]); choices=[r for r in records if r["trainer_id"] in wanted and r["showdown_team"] and r["battle_type"]=="FALSE"]
    if len(choices)<2: return synthetic_match(seed)
    rng=random.Random(seed); a,b=rng.sample(choices,2)
    return a["showdown_team"],b["showdown_team"]

