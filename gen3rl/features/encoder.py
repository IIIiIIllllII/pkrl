from __future__ import annotations
import re
import numpy as np
from .schema import FEATURE_SPECS, TYPE_NAMES, MoveRole, gen3_damage_class, hp_bucket, power_bucket, accuracy_bucket, pp_bucket
from .move_semantics import MoveClass, VARIABLE_DAMAGE_MOVES, classify_move, effectiveness_feature

STATUS_IDS = {"": 0, "brn": 1, "par": 2, "psn": 3, "tox": 3, "slp": 4, "frz": 5}

def parse_condition(text: str) -> tuple[int, int, str]:
    if "fnt" in text: return 0, 1, ""
    match = re.match(r"(\d+)/(\d+)(?:\s+(\w+))?", text or "")
    if not match: return 1, 1, ""
    return int(match.group(1)), int(match.group(2)), match.group(3) or ""

def classify_role(move: dict) -> int:
    mid = str(move.get("id") or move.get("move") or "").lower().replace(" ", "")
    if mid in {"protect", "detect", "endure"}: return MoveRole.PROTECT
    if mid in {"recover", "softboiled", "rest", "synthesis", "moonlight", "morningsun", "slackoff"}: return MoveRole.RECOVERY
    if mid in {"sunnyday", "raindance", "sandstorm", "hail"}: return MoveRole.WEATHER
    if mid in {"spikes"}: return MoveRole.FIELD
    if mid in {"roar", "whirlwind"}: return MoveRole.PHAZE
    if mid in {"batonpass"}: return MoveRole.PIVOT
    if mid in {"explosion", "selfdestruct", "memento"}: return MoveRole.SELF_KO
    if classify_move(move) == MoveClass.FIXED_DAMAGE: return MoveRole.FIXED
    if classify_move(move) == MoveClass.NORMAL_DAMAGE: return MoveRole.DAMAGE
    boosts=move.get("boosts") or {}
    if boosts and any(int(v)<0 for v in boosts.values()): return MoveRole.DEBUFF
    if boosts or move.get("self", {}).get("boosts"): return MoveRole.SETUP
    if move.get("status"): return MoveRole.STATUS
    return MoveRole.UTILITY

def encode_request(request: dict) -> tuple[np.ndarray, np.ndarray]:
    """Encode move candidates using only a player-specific Showdown request."""
    out = np.zeros((9, len(FEATURE_SPECS)), dtype=np.int64)
    mask = np.zeros(9, dtype=bool)
    side = request.get("side") or {}
    mons = side.get("pokemon") or []
    own = next((p for p in mons if p.get("active")), mons[0] if mons else {})
    hp, max_hp, status = parse_condition(own.get("condition", ""))
    public = request.get("public") or {}
    target = public.get("target") or {}
    target_status = target.get("status") or ""
    weather_name = str(public.get("weather", "")).lower()
    weather = 1 if "sun" in weather_name else 2 if "rain" in weather_name else 3 if "sand" in weather_name else 4 if "hail" in weather_name else 0
    own_speed=int((own.get("stats") or {}).get("spe",0)); target_speed=int(target.get("estimatedSpeed",own_speed))
    speed_relation=0 if own_speed<target_speed else 2 if own_speed>target_speed else 1
    moves = ((request.get("active") or [{}])[0] or {}).get("moves", [])
    forced_switch = bool((request.get("forceSwitch") or [False])[0])
    for slot, move in enumerate(moves[:4]):
        move_pp=move.get("pp")
        legal = not forced_switch and not move.get("disabled", False) and (move_pp is None or move_pp > 0)
        mask[slot] = legal
        mtype = str(move.get("type", "unknown")).lower()
        power = int(move.get("basePower", move.get("basePowerCallback", 0)) or 0)
        row = out[slot]
        row[0] = slot; row[1] = int(classify_role(move)); row[2] = TYPE_NAMES.index(mtype) if mtype in TYPE_NAMES else 17
        move_class = classify_move(move)
        try: row[3] = int(gen3_damage_class(mtype, power if move_class == MoveClass.STATUS else max(power, 1)))
        except ValueError: row[3] = 2 if power <= 0 else 0
        row[4] = power_bucket(power); row[5] = accuracy_bucket(move.get("accuracy", True))
        priority = int(move.get("priority", 0)); row[6] = 0 if priority < 0 else 2 if priority > 0 else 1
        row[7] = int(mtype in {str(t).lower() for t in own.get("types", [])})
        row[8] = int(effectiveness_feature(move, target.get("types") or [], target_status))
        row[9] = pp_bucket(int(move_pp or 0))
        row[10] = hp_bucket(hp, max_hp); row[11] = int(target.get("hpBucket", 4)); row[12] = STATUS_IDS.get(status, 0)
        row[13] = STATUS_IDS.get(target_status, 0); row[14] = speed_relation; row[15] = 0; row[16] = 0
        row[17] = int(int(public.get("turn", 0)) <= 1); row[18] = weather; row[19] = 2
    # Switch action indices are universal and stay logically separate from the ROM move policy.
    switches = [p for p in mons if not p.get("active") and "fnt" not in p.get("condition", "")]
    active = (request.get("active") or [{}])[0] or {}
    trapped = bool(active.get("trapped") or active.get("maybeTrapped"))
    if forced_switch or not trapped:
        mask[4:4 + min(5, len(switches))] = True
    if request.get("wait") or request.get("teamPreview"): mask[:] = False
    return out, mask
