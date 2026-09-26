"""Gen 3 move applicability and damage-effectiveness semantics.

This module is deliberately independent of Showdown internals.  The training
encoder recomputes the categorical value from the player-visible request so a
bridge-side regression cannot silently change the policy observation again.
"""
from __future__ import annotations

from enum import IntEnum

from .schema import Effectiveness


class MoveClass(IntEnum):
    NORMAL_DAMAGE = 0
    FIXED_DAMAGE = 1
    STATUS = 2


FIXED_DAMAGE_MOVES = frozenset({
    "counter", "dragonrage", "endeavor", "mirrorcoat", "nightshade",
    "psywave", "seismictoss", "sonicboom", "superfang", "bide",
    "fissure", "guillotine", "horndrill", "sheercold", "futuresight", "doomdesire",
})

# Gen 3 variable-power attacks whose resolved request metadata can have zero
# base power.  They still use the ordinary type chart.
VARIABLE_DAMAGE_MOVES = frozenset({
    "flail", "frustration", "hiddenpower", "lowkick", "return", "reversal", "magnitude", "present", "spitup",
})

# Non-neutral Gen 3 type-chart exponents. -1 means 1/2, +1 means 2x; None is
# immunity. Omitted pairs are neutral.
_TYPE_CHART: dict[str, dict[str, int | None]] = {
    "normal": {"rock": -1, "ghost": None, "steel": -1},
    "fire": {"fire": -1, "water": -1, "grass": 1, "ice": 1, "bug": 1, "rock": -1, "dragon": -1, "steel": 1},
    "water": {"fire": 1, "water": -1, "grass": -1, "ground": 1, "rock": 1, "dragon": -1},
    "electric": {"water": 1, "electric": -1, "grass": -1, "ground": None, "flying": 1, "dragon": -1},
    "grass": {"fire": -1, "water": 1, "grass": -1, "poison": -1, "ground": 1, "flying": -1, "bug": -1, "rock": 1, "dragon": -1, "steel": -1},
    "ice": {"fire": -1, "water": -1, "grass": 1, "ice": -1, "ground": 1, "flying": 1, "dragon": 1, "steel": -1},
    "fighting": {"normal": 1, "ice": 1, "poison": -1, "flying": -1, "psychic": -1, "bug": -1, "rock": 1, "ghost": None, "dark": 1, "steel": 1},
    "poison": {"grass": 1, "poison": -1, "ground": -1, "rock": -1, "ghost": -1, "steel": None},
    "ground": {"fire": 1, "electric": 1, "grass": -1, "poison": 1, "flying": None, "bug": -1, "rock": 1, "steel": 1},
    "flying": {"electric": -1, "grass": 1, "fighting": 1, "bug": 1, "rock": -1, "steel": -1},
    "psychic": {"fighting": 1, "poison": 1, "psychic": -1, "dark": None, "steel": -1},
    "bug": {"fire": -1, "grass": 1, "fighting": -1, "poison": -1, "flying": -1, "psychic": 1, "ghost": -1, "dark": 1, "steel": -1},
    "rock": {"fire": 1, "ice": 1, "fighting": -1, "ground": -1, "flying": 1, "bug": 1, "steel": -1},
    "ghost": {"normal": None, "psychic": 1, "ghost": 1, "dark": -1, "steel": -1},
    "dragon": {"dragon": 1, "steel": -1},
    "dark": {"fighting": -1, "psychic": 1, "ghost": 1, "dark": -1, "steel": -1},
    "steel": {"fire": -1, "water": -1, "electric": -1, "ice": 1, "rock": 1, "steel": -1},
}


def move_id(move: dict) -> str:
    return str(move.get("id") or move.get("move") or "").lower().replace(" ", "")


def classify_move(move: dict) -> MoveClass:
    mid = move_id(move)
    if mid in FIXED_DAMAGE_MOVES or move.get("fixedDamage") is not None:
        return MoveClass.FIXED_DAMAGE
    if int(move.get("basePower") or 0) > 0 or mid in VARIABLE_DAMAGE_MOVES or move.get("isDamageMove") is True:
        return MoveClass.NORMAL_DAMAGE
    return MoveClass.STATUS


def damage_effectiveness(move_type: str, defender_types: list[str] | tuple[str, ...]) -> Effectiveness:
    chart = _TYPE_CHART.get(move_type.lower(), {})
    factors = [chart.get(str(defender).lower(), 0) for defender in defender_types]
    if any(factor is None for factor in factors):
        return Effectiveness.IMMUNE
    exponent = sum(int(factor) for factor in factors)
    return (Effectiveness.QUARTER if exponent <= -2 else Effectiveness.HALF if exponent == -1
            else Effectiveness.NEUTRAL if exponent == 0 else Effectiveness.DOUBLE if exponent == 1
            else Effectiveness.QUADRUPLE)


def status_applicable(move: dict, defender_types: list[str] | tuple[str, ...], target_status: str = "") -> bool:
    """Publicly knowable Gen 3 status applicability represented by v1.1.

    Substitute, abilities, items, volatile state, and unrevealed information are
    intentionally absent. The simulator remains authoritative at execution.
    """
    mid = move_id(move)
    types = {str(value).lower() for value in defender_types}
    status = str(move.get("status") or "").lower()
    if move.get("target") in {"self", "allySide", "allyTeam", "all"}:
        return True
    if mid in {"thunderwave", "glare"}:
        # These two status moves explicitly do not ignore type immunity in the
        # pinned Gen 3 Showdown data.
        if damage_effectiveness(str(move.get("type") or "unknown"), tuple(types)) == Effectiveness.IMMUNE:
            return False
    if status in {"psn", "tox"} and types & {"poison", "steel"}:
        return False
    if status == "brn" and "fire" in types:
        return False
    if mid == "leechseed" and "grass" in types:
        return False
    if status and target_status:
        return False
    if mid == "nightmare" and target_status != "slp":
        return False
    return True


def effectiveness_feature(move: dict, defender_types: list[str] | tuple[str, ...], target_status: str = "") -> Effectiveness:
    """Return the v1.1 applicability/effectiveness category.

    Normal damage uses the full chart. Fixed damage uses only chart immunity.
    Status/support uses only explicit mechanics-specific failure (immune) or
    applicability (neutral), never resistance or weakness.
    """
    move_class = classify_move(move)
    if move_id(move) in {"struggle", "futuresight", "doomdesire"}:
        return Effectiveness.NEUTRAL
    if move_id(move) == "dreameater" and target_status != "slp":
        return Effectiveness.IMMUNE
    effectiveness = damage_effectiveness(str(move.get("type") or "unknown"), defender_types)
    if move_class == MoveClass.NORMAL_DAMAGE:
        return effectiveness
    if move_class == MoveClass.FIXED_DAMAGE:
        return Effectiveness.IMMUNE if effectiveness == Effectiveness.IMMUNE else Effectiveness.NEUTRAL
    return Effectiveness.NEUTRAL if status_applicable(move, defender_types, target_status) else Effectiveness.IMMUNE
