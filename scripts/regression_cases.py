#!/usr/bin/env python3
"""Required human-playtest regression states for gen3-lut-v1.1.

Every state here must be covered by automated Python and TypeScript parity
tests before human playtesting. Move dictionaries come from the pinned Gen 3
Showdown catalog so the Python reference and the browser see byte-identical
move metadata.
"""
from __future__ import annotations

import json
import subprocess
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Public Gen 3 typings for the exact species named in the playtest brief.
SPECIES_TYPES: dict[str, list[str]] = {
    "Skarmory": ["Steel", "Flying"],
    "Swampert": ["Water", "Ground"],
    "Gengar": ["Ghost", "Poison"],
    "Tyranitar": ["Rock", "Dark"],
    "Metagross": ["Steel", "Psychic"],
    "Salamence": ["Dragon", "Flying"],
    "Scizor": ["Bug", "Steel"],
    "Blissey": ["Normal"],
    "Celebi": ["Grass", "Psychic"],
    "Camerupt": ["Fire", "Ground"],
    "Gyarados": ["Water", "Flying"],
    "Snorlax": ["Normal"],
}


@lru_cache(maxsize=1)
def move_catalog() -> dict[str, dict]:
    """Static pinned-Showdown Gen 3 move data, keyed by move id."""
    raw = subprocess.check_output(["node", str(ROOT / "scripts/export_move_catalog.cjs")], text=True)
    return {entry["id"]: entry for entry in json.loads(raw)}


def move(move_id: str) -> dict:
    catalog = move_catalog()
    if move_id not in catalog:
        raise KeyError(f"{move_id} is not in the pinned Gen 3 move catalog")
    return dict(catalog[move_id])


def build_request(
    *,
    attacker: str,
    defender: str,
    move_ids: list[str],
    attacker_condition: str = "280/300",
    attacker_speed: int = 198,
    defender_status: str = "",
    defender_hp_bucket: int = 4,
    defender_speed: int = 180,
    weather: str = "",
    turn: int = 3,
    bench: tuple[str, ...] = ("Metagross",),
) -> dict:
    """A single player-visible Showdown request, exactly as the web server builds one."""
    pokemon = [{
        "active": True, "details": attacker, "condition": attacker_condition,
        "types": SPECIES_TYPES[attacker], "stats": {"spe": attacker_speed},
    }]
    for name in bench:
        pokemon.append({"active": False, "details": name, "condition": "300/300"})
    return {
        "active": [{"moves": [move(value) for value in move_ids]}],
        "side": {"pokemon": pokemon},
        "public": {
            "target": {
                "species": defender, "hpBucket": defender_hp_bucket, "status": defender_status,
                "types": SPECIES_TYPES[defender], "estimatedSpeed": defender_speed,
            },
            "weather": weather, "turn": turn,
        },
    }


# group, name, attacker, defender, move ids, per-slot expectations.
# Expectations are (move_class, applicable, effectiveness) using the canonical
# gen3-lut-v1.1 category names.
_IMMUNE = ("normal-damage", False, "immune")
_QUAD = ("normal-damage", True, "quadruple")
_NEUTRAL_DAMAGE = ("normal-damage", True, "neutral")
_STATUS_OK = ("status", True, "neutral")
_STATUS_FAILS = ("status", False, "immune")
_FIXED_OK = ("fixed-damage", True, "neutral")
_FIXED_IMMUNE = ("fixed-damage", False, "immune")

SPECIFICATION: list[dict] = [
    # --- damaging-move immunities -------------------------------------------
    {"group": "damaging-immunity", "name": "Earthquake vs Skarmory (Steel/Flying) is 0x",
     "attacker": "Gyarados", "defender": "Skarmory", "moves": ["earthquake", "hiddenpower"],
     "expect": {"earthquake": _IMMUNE}},
    {"group": "damaging-immunity", "name": "Thunderbolt vs Swampert (Water/Ground) is 0x",
     "attacker": "Gengar", "defender": "Swampert", "moves": ["thunderbolt", "icepunch"],
     "expect": {"thunderbolt": _IMMUNE, "icepunch": _NEUTRAL_DAMAGE}},
    {"group": "damaging-immunity", "name": "Cross Chop vs Gengar (Ghost/Poison) is 0x",
     "attacker": "Snorlax", "defender": "Gengar", "moves": ["crosschop", "shadowball"],
     "expect": {"crosschop": _IMMUNE, "shadowball": ("normal-damage", True, "double")}},
    {"group": "damaging-immunity", "name": "Psychic vs Tyranitar (Rock/Dark) is 0x",
     "attacker": "Celebi", "defender": "Tyranitar", "moves": ["psychic", "gigadrain"],
     "expect": {"psychic": _IMMUNE, "gigadrain": ("normal-damage", True, "double")}},
    {"group": "damaging-immunity", "name": "Sludge Bomb vs Metagross (Steel/Psychic) is 0x",
     "attacker": "Gengar", "defender": "Metagross", "moves": ["sludgebomb", "thunderbolt"],
     "expect": {"sludgebomb": _IMMUNE, "thunderbolt": _NEUTRAL_DAMAGE}},
    # --- positive effectiveness --------------------------------------------
    {"group": "damaging-effectiveness", "name": "Ice Beam vs Salamence (Dragon/Flying) is 4x",
     "attacker": "Swampert", "defender": "Salamence", "moves": ["icebeam", "surf"],
     "expect": {"icebeam": _QUAD, "surf": ("normal-damage", True, "half")}},
    {"group": "damaging-effectiveness", "name": "Flamethrower vs Scizor (Bug/Steel) is 4x",
     "attacker": "Camerupt", "defender": "Scizor", "moves": ["flamethrower", "rockslide"],
     "expect": {"flamethrower": _QUAD, "rockslide": _NEUTRAL_DAMAGE}},
    # --- status/self moves must never take generic chart effectiveness -----
    {"group": "status-not-charted", "name": "Dragon Dance vs Skarmory keeps neutral applicability",
     "attacker": "Gyarados", "defender": "Skarmory", "moves": ["dragondance", "earthquake"],
     "expect": {"dragondance": ("status", True, "neutral"), "earthquake": _IMMUNE}},
    {"group": "status-not-charted", "name": "Swords Dance vs Skarmory keeps neutral applicability",
     "attacker": "Gyarados", "defender": "Skarmory", "moves": ["swordsdance", "earthquake"],
     "expect": {"swordsdance": _STATUS_OK, "earthquake": _IMMUNE}},
    {"group": "status-not-charted", "name": "Recover vs Metagross keeps neutral applicability",
     "attacker": "Celebi", "defender": "Metagross", "moves": ["recover", "psychic"],
     "expect": {"recover": _STATUS_OK, "psychic": ("normal-damage", True, "quarter")}},
    {"group": "status-not-charted", "name": "Protect vs Gengar keeps neutral applicability",
     "attacker": "Swampert", "defender": "Gengar", "moves": ["protect", "surf"],
     "expect": {"protect": _STATUS_OK, "surf": _NEUTRAL_DAMAGE}},
    {"group": "status-not-charted", "name": "Growl vs Skarmory keeps neutral applicability",
     "attacker": "Snorlax", "defender": "Skarmory", "moves": ["growl", "bodyslam"],
     "expect": {"growl": _STATUS_OK, "bodyslam": ("normal-damage", True, "half")}},
    {"group": "status-not-charted", "name": "Confuse Ray vs Metagross keeps neutral applicability",
     "attacker": "Gengar", "defender": "Metagross", "moves": ["confuseray", "thunderbolt"],
     "expect": {"confuseray": _STATUS_OK, "thunderbolt": _NEUTRAL_DAMAGE}},
    # --- mechanics-specific status applicability ---------------------------
    {"group": "status-applicability", "name": "Thunder Wave vs Ground (Swampert) fails",
     "attacker": "Gengar", "defender": "Swampert", "moves": ["thunderwave", "icepunch"],
     "expect": {"thunderwave": _STATUS_FAILS}},
    {"group": "status-applicability", "name": "Toxic vs Steel (Metagross) fails",
     "attacker": "Blissey", "defender": "Metagross", "moves": ["toxic", "seismictoss"],
     "expect": {"toxic": _STATUS_FAILS, "seismictoss": _FIXED_OK}},
    {"group": "status-applicability", "name": "Toxic vs Poison (Gengar) fails",
     "attacker": "Blissey", "defender": "Gengar", "moves": ["toxic", "softboiled"],
     "expect": {"toxic": _STATUS_FAILS, "softboiled": _STATUS_OK}},
    {"group": "status-applicability", "name": "Will-O-Wisp vs Fire (Camerupt) fails",
     "attacker": "Gengar", "defender": "Camerupt", "moves": ["willowisp", "icepunch"],
     "expect": {"willowisp": _STATUS_FAILS, "icepunch": _NEUTRAL_DAMAGE}},
    {"group": "status-applicability", "name": "Leech Seed vs Grass (Celebi) fails",
     "attacker": "Celebi", "defender": "Celebi", "moves": ["leechseed", "psychic"],
     "expect": {"leechseed": _STATUS_FAILS}},
    # --- fixed damage ------------------------------------------------------
    {"group": "fixed-damage", "name": "Seismic Toss vs Ghost (Gengar) is immune",
     "attacker": "Blissey", "defender": "Gengar", "moves": ["seismictoss", "softboiled"],
     "expect": {"seismictoss": _FIXED_IMMUNE, "softboiled": _STATUS_OK}},
    {"group": "fixed-damage", "name": "Night Shade vs Normal (Blissey) is immune",
     "attacker": "Gengar", "defender": "Blissey", "moves": ["nightshade", "thunderbolt"],
     "expect": {"nightshade": _FIXED_IMMUNE, "thunderbolt": _NEUTRAL_DAMAGE}},
    # --- the observed human-playtest behavioural regression ----------------
    # Gyarados must never keep clicking Earthquake into Skarmory. Earthquake is
    # encoded 0x; a legal, non-immune damaging alternative is always present.
    {"group": "playtest-regression", "name": "Gyarados vs Skarmory must not prefer immune Earthquake",
     "attacker": "Gyarados", "defender": "Skarmory", "moves": ["earthquake", "doubleedge", "dragondance", "roar"],
     "expect": {"earthquake": _IMMUNE, "doubleedge": ("normal-damage", True, "half")},
     "forbid_top1": ["earthquake"]},
]


def regression_cases() -> list[dict]:
    """Materialize every required case as a fully built request plus expectations."""
    cases = []
    for spec in SPECIFICATION:
        request = build_request(attacker=spec["attacker"], defender=spec["defender"], move_ids=spec["moves"])
        cases.append({
            "name": spec["name"], "group": spec["group"], "request": request,
            "attacker": spec["attacker"], "defender": spec["defender"],
            "resolved_defender_types": SPECIES_TYPES[spec["defender"]],
            "move_ids": spec["moves"],
            "expect": {key: list(value) for key, value in spec["expect"].items()},
            "forbid_top1": spec.get("forbid_top1", []),
        })
    return cases


if __name__ == "__main__":
    print(json.dumps([case["name"] for case in regression_cases()], indent=2))
