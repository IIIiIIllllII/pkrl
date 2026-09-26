"""Mechanically refresh tracked added-file hunks from canonical sources."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def render():
    path=ROOT/"integration/pokeemerald/gen3rl.patch"
    text=path.read_text(); start=text.index("diff --git a/src/battle_ai_rl.c")
    end=text.index("diff --git a/src/data/battle_ai_rl_lut.h",start)
    source=(ROOT/"integration/pokeemerald/battle_ai_rl.c").read_text()
    hunk="diff --git a/src/battle_ai_rl.c b/src/battle_ai_rl.c\nnew file mode 100644\n--- /dev/null\n+++ b/src/battle_ai_rl.c\n@@ -0,0 +1,%d @@\n"%len(source.splitlines())
    hunk+="".join("+"+line+"\n" for line in source.splitlines())
    text=text[:start]+hunk+text[end:]
    text=text.replace('#define RL_FEATURE_SCHEMA "gen3-lut-v1"','#define RL_FEATURE_SCHEMA "gen3-lut-v1.1"').replace('#define RL_FEATURE_SCHEMA_REVISION 100','#define RL_FEATURE_SCHEMA_REVISION 101')
    # A clean integration template must not ship contaminated trained weights.
    lines=text.splitlines()
    for i,line in enumerate(lines):
        if line.startswith('+const int8_t gBattleAiRlLut'): lines[i]='+const int8_t gBattleAiRlLut[RL_LUT_PARAMETERS] = {0};'
    return "\n".join(lines)+"\n"

if __name__=="__main__":
    (ROOT/"integration/pokeemerald/gen3rl.patch").write_text(render())
