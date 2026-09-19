"""Parser for the checked-out pokeemerald generated trainer data.

The extractor preserves symbolic constants and party parameters. Resolution of default
moves is explicitly tied to GiveMonInitialMoveset in src/pokemon.c and level-up learnsets.
"""
from __future__ import annotations
import json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

def _blocks(text, typename):
    pattern=rf"static const struct {typename}\s+(sParty_[A-Za-z0-9_]+)\[\]\s*=\s*\{{(.*?)\n\}};"
    return re.finditer(pattern,text,re.S)

def extract(output=ROOT/"artifacts/teams/pokeemerald_trainers.jsonl"):
    pe=ROOT/"third_party/pokeemerald"; parties=(pe/"src/data/trainer_parties.h").read_text()
    trainers=(pe/"src/data/trainers.h").read_text(); party_map={}
    learnsets=(pe/"src/data/pokemon/level_up_learnsets.h").read_text()
    pointers=(pe/"src/data/pokemon/level_up_learnset_pointers.h").read_text()
    species_to_set=dict(re.findall(r"\[(SPECIES_[A-Z0-9_]+)\]\s*=\s*(s[A-Za-z0-9]+LevelUpLearnset)",pointers))
    set_moves={}
    for lm in re.finditer(r"static const u16 (s[A-Za-z0-9]+LevelUpLearnset)\[\]\s*=\s*\{(.*?)\n\};",learnsets,re.S):
        set_moves[lm.group(1)]=[(int(level),move) for level,move in re.findall(r"LEVEL_UP_MOVE\(\s*(\d+)\s*,\s*(MOVE_[A-Z0-9_]+)\)",lm.group(2))]
    def display(symbol,prefix):
        return symbol.removeprefix(prefix).replace("_", " ").title()
    def default_moves(species,level):
        slots=[]
        for move_level,move in set_moves.get(species_to_set.get(species,""),[]):
            if move_level>level: break
            if move in slots: continue
            if len(slots)==4: slots.pop(0)
            slots.append(move)
        return slots
    kinds=("TrainerMonNoItemDefaultMoves","TrainerMonItemDefaultMoves","TrainerMonNoItemCustomMoves","TrainerMonItemCustomMoves")
    for kind in kinds:
        for block in _blocks(parties,kind):
            mons=[]
            # Entries have one nested brace pair for custom move arrays, so a
            # flat `{.*?}` regex would truncate those records.
            for raw in re.split(r"\n\s{4}\},?", block.group(2)):
                body = raw.strip().lstrip("{").strip()
                if not body or ".species" not in body:
                    continue
                def field(name, default=None):
                    m=re.search(rf"\.{name}\s*=\s*([^,\n]+)",body); return m.group(1).strip() if m else default
                moves=re.search(r"\.moves\s*=\s*\{([^}]+)\}",body,re.S)
                mons.append({"iv":field("iv"),"level":field("lvl"),"species":field("species"),
                             "held_item":field("heldItem","ITEM_NONE"),
                             "moves":[x.strip() for x in moves.group(1).split(",")] if moves else None,
                             "default_moves":moves is None})
            party_map[block.group(1)]={"layout":kind,"pokemon":mons}
    records=[]
    for m in re.finditer(r"\[(TRAINER_[A-Za-z0-9_]+)\]\s*=\s*\{(.*?)\n\s*\},",trainers,re.S):
        tid,body=m.groups(); pm=re.search(r"\.party\s*=\s*[^\n]*?(sParty_[A-Za-z0-9_]+)",body)
        if not pm or pm.group(1) not in party_map: continue
        def field(name,default=None):
            f=re.search(rf"\.{name}\s*=\s*([^,\n]+)",body); return f.group(1).strip() if f else default
        resolved=[]
        for mon in party_map[pm.group(1)]["pokemon"]:
            level=int(mon["level"] or 1); species=mon["species"]
            moves=default_moves(species,level) if mon["default_moves"] else [x for x in (mon["moves"] or []) if x!="MOVE_NONE"]
            mon["fixed_iv"]=int(mon["iv"] or 0)*31//255; mon["resolved_moves"]=moves
            resolved.append({"species":display(species,"SPECIES_"),"level":level,
                             "moves":[display(x,"MOVE_") for x in moves],
                             "item":display(mon["held_item"],"ITEM_") if mon["held_item"]!="ITEM_NONE" else "",
                             "ivs":{k:mon["fixed_iv"] for k in ("hp","atk","def","spa","spd","spe")}})
        rec={"trainer_id":tid,"trainer_name":field("trainerName"),"source":"pret/pokeemerald",
             "battle_type":field("doubleBattle","FALSE"),"ai_flags":field("aiFlags","0"),
             "party_flags":field("partyFlags"),**party_map[pm.group(1)],
             "showdown_team":resolved,
             "metadata":{"party_symbol":pm.group(1),"default_move_path":"CreateMon -> GiveMonInitialMoveset -> GiveBoxMonInitialMoveset -> gLevelUpLearnsets",
                         "iv_path":"CreateNPCTrainerParty: fixedIV = partyData.iv * MAX_PER_STAT_IVS / 255; then CreateMon"}}
        records.append(rec)
    output.parent.mkdir(parents=True,exist_ok=True)
    with output.open("w") as f:
        for rec in records: f.write(json.dumps(rec,separators=(",",":"))+"\n")
    return records
