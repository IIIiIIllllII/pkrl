"""The single source of truth for Python and generated-C categorical IDs."""
from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum

SCHEMA_VERSION = "gen3-lut-v1.1"
MAX_ACTIONS = 9
MOVE_ACTIONS = 4

class DamageClass(IntEnum): PHYSICAL = 0; SPECIAL = 1; STATUS = 2
class Effectiveness(IntEnum): IMMUNE = 0; QUARTER = 1; HALF = 2; NEUTRAL = 3; DOUBLE = 4; QUADRUPLE = 5
class SpeedRelation(IntEnum): SLOWER = 0; TIE = 1; FASTER = 2
class MoveRole(IntEnum):
    DAMAGE = 0; STATUS = 1; SETUP = 2; DEBUFF = 3; RECOVERY = 4; PROTECT = 5
    WEATHER = 6; FIELD = 7; PHAZE = 8; PIVOT = 9; SELF_KO = 10; FIXED = 11; UTILITY = 12

GEN3_PHYSICAL_TYPES = frozenset({"normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel"})
GEN3_SPECIAL_TYPES = frozenset({"fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark"})
TYPE_NAMES = ("normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "unknown")

@dataclass(frozen=True)
class FeatureSpec:
    name: str
    values: tuple[str, ...]
    @property
    def size(self) -> int: return len(self.values)

FEATURE_SPECS = (
    FeatureSpec("action_slot", tuple(map(str, range(4)))),
    FeatureSpec("move_role", tuple(x.name.lower() for x in MoveRole)),
    FeatureSpec("move_type", TYPE_NAMES),
    FeatureSpec("damage_class", ("physical", "special", "status")),
    FeatureSpec("power_bucket", ("zero", "1_40", "41_70", "71_100", "101_plus")),
    FeatureSpec("accuracy_bucket", ("always", "1_70", "71_85", "86_99", "100")),
    FeatureSpec("priority_bucket", ("negative", "zero", "positive")),
    FeatureSpec("stab", ("no", "yes")),
    FeatureSpec("effectiveness", ("immune", "quarter", "half", "neutral", "double", "quadruple")),
    FeatureSpec("pp_bucket", ("empty", "1_4", "5_9", "10_19", "20_plus")),
    FeatureSpec("user_hp", ("fainted", "quarter", "half", "three_quarters", "full")),
    FeatureSpec("target_hp", ("fainted", "quarter", "half", "three_quarters", "full")),
    FeatureSpec("user_status", ("none", "brn", "par", "psn", "slp", "frz")),
    FeatureSpec("target_status", ("none", "brn", "par", "psn", "slp", "frz")),
    FeatureSpec("speed_relation", ("slower", "tie", "faster")),
    FeatureSpec("can_ko", ("no", "yes")),
    FeatureSpec("damage_fraction", ("none", "quarter", "half", "three_quarters", "ko")),
    FeatureSpec("first_turn", ("no", "yes")),
    FeatureSpec("weather", ("none", "sun", "rain", "sand", "hail")),
    FeatureSpec("stage_summary", ("minus2", "minus1", "zero", "plus1", "plus2")),
)
FEATURE_INDEX = {f.name: i for i, f in enumerate(FEATURE_SPECS)}
PAIR_SPECS = (
    ("effectiveness", "move_role"), ("user_hp", "move_role"),
    ("target_hp", "can_ko"), ("speed_relation", "can_ko"),
    ("target_status", "move_role"),
)

def hp_bucket(hp: int, max_hp: int) -> int:
    """Exact integer boundaries: 0, <=25%, <=50%, <=75%, >75%."""
    if hp <= 0 or max_hp <= 0: return 0
    if hp * 4 <= max_hp: return 1
    if hp * 2 <= max_hp: return 2
    if hp * 4 <= max_hp * 3: return 3
    return 4

def power_bucket(power: int) -> int:
    return 0 if power <= 0 else 1 if power <= 40 else 2 if power <= 70 else 3 if power <= 100 else 4

def accuracy_bucket(accuracy: int | bool | None) -> int:
    if accuracy is True or accuracy is None: return 0
    return 1 if accuracy <= 70 else 2 if accuracy <= 85 else 3 if accuracy < 100 else 4

def pp_bucket(pp: int) -> int:
    return 0 if pp <= 0 else 1 if pp <= 4 else 2 if pp <= 9 else 3 if pp <= 19 else 4

def gen3_damage_class(move_type: str, power: int = 0) -> DamageClass:
    if power <= 0: return DamageClass.STATUS
    value = move_type.lower()
    if value in GEN3_PHYSICAL_TYPES: return DamageClass.PHYSICAL
    if value in GEN3_SPECIAL_TYPES: return DamageClass.SPECIAL
    raise ValueError(f"unknown Gen 3 move type: {move_type}")

def parameter_count() -> int:
    total = MOVE_ACTIONS + sum(f.size for f in FEATURE_SPECS)
    total += sum(FEATURE_SPECS[FEATURE_INDEX[a]].size * FEATURE_SPECS[FEATURE_INDEX[b]].size for a, b in PAIR_SPECS)
    return total
