var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/playtest.ts
var playtest_exports = {};
__export(playtest_exports, {
  MAX_BODY_BYTES: () => MAX_BODY_BYTES,
  createPlaytestHandler: () => createPlaytestHandler,
  createPlaytestHandlerFromEnv: () => createPlaytestHandlerFromEnv,
  memoryStore: () => memoryStore,
  rateLimiter: () => rateLimiter,
  supabaseStore: () => supabaseStore,
  validateSubmission: () => validateSubmission
});
module.exports = __toCommonJS(playtest_exports);

// src/policy/schema.ts
var SCHEMA_VERSION = "gen3-lut-v1.1";
var MOVE_ACTIONS = 4;
var FEATURE_NAMES = [
  "action_slot",
  "move_role",
  "move_type",
  "damage_class",
  "power_bucket",
  "accuracy_bucket",
  "priority_bucket",
  "stab",
  "effectiveness",
  "pp_bucket",
  "user_hp",
  "target_hp",
  "user_status",
  "target_status",
  "speed_relation",
  "can_ko",
  "damage_fraction",
  "first_turn",
  "weather",
  "stage_summary"
];
var FEATURE_VALUES = {
  action_slot: ["0", "1", "2", "3"],
  move_role: ["damage", "status", "setup", "debuff", "recovery", "protect", "weather", "field", "phaze", "pivot", "self_ko", "fixed", "utility"],
  move_type: ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "unknown"],
  damage_class: ["physical", "special", "status"],
  power_bucket: ["zero", "1_40", "41_70", "71_100", "101_plus"],
  accuracy_bucket: ["always", "1_70", "71_85", "86_99", "100"],
  priority_bucket: ["negative", "zero", "positive"],
  stab: ["no", "yes"],
  effectiveness: ["immune", "quarter", "half", "neutral", "double", "quadruple"],
  pp_bucket: ["empty", "1_4", "5_9", "10_19", "20_plus"],
  user_hp: ["fainted", "quarter", "half", "three_quarters", "full"],
  target_hp: ["fainted", "quarter", "half", "three_quarters", "full"],
  user_status: ["none", "brn", "par", "psn", "slp", "frz"],
  target_status: ["none", "brn", "par", "psn", "slp", "frz"],
  speed_relation: ["slower", "tie", "faster"],
  can_ko: ["no", "yes"],
  damage_fraction: ["none", "quarter", "half", "three_quarters", "ko"],
  first_turn: ["no", "yes"],
  weather: ["none", "sun", "rain", "sand", "hail"],
  stage_summary: ["minus2", "minus1", "zero", "plus1", "plus2"]
};
var FEATURE_INDEX = Object.fromEntries(FEATURE_NAMES.map((name, index) => [name, index]));
var PAIR_SPECS = [
  ["effectiveness", "move_role"],
  ["user_hp", "move_role"],
  ["target_hp", "can_ko"],
  ["speed_relation", "can_ko"],
  ["target_status", "move_role"]
];
var TABLE_ORDER = [
  "action_bias",
  ...FEATURE_NAMES.map((name) => `feature_${name}`),
  ...PAIR_SPECS.map(([a, b]) => `pair_${a}_${b}`)
];
function tableShape(name) {
  if (name === "action_bias") return [MOVE_ACTIONS];
  if (name.startsWith("feature_")) return [FEATURE_VALUES[name.slice("feature_".length)].length];
  const pair = PAIR_SPECS.find(([a, b]) => `pair_${a}_${b}` === name);
  if (!pair) throw new Error(`unknown LUT table ${name}`);
  return [FEATURE_VALUES[pair[0]].length, FEATURE_VALUES[pair[1]].length];
}
function tableOffsets() {
  const offsets = {};
  let cursor = 0;
  for (const name of TABLE_ORDER) {
    const shape = tableShape(name);
    offsets[name] = { offset: cursor, shape };
    cursor += shape.reduce((product, value) => product * value, 1);
  }
  return offsets;
}
var TABLE_OFFSETS = tableOffsets();
var TOTAL_PARAMETERS = TABLE_ORDER.reduce((sum, name) => sum + tableShape(name).reduce((a, b) => a * b, 1), 0);

// src/policy/inference.ts
var CLEAN_POLICY_IDS = ["v1.1-20m", "v1.1-50m", "v1.1-100m"];
var PINNED_SHOWDOWN_COMMIT = "2ddfa0476f8207e12e204b1c69f7c7683b17633c";

// src/policy/assets.ts
var QUARANTINED_POLICY_IDS = ["v1-10m", "v1-50m", "v1-100m"];

// src/data/teams.ts
var TEAM_FIXTURES = [
  {
    id: "adv-balanced",
    name: "ADV Balanced",
    category: "balanced",
    description: "A sturdy mixed team with hazards, status, and offensive pressure.",
    team: [
      { species: "Swampert", level: 50, ability: "Torrent", item: "Leftovers", nature: "Relaxed", moves: ["Surf", "Earthquake", "Ice Beam", "Protect"] },
      { species: "Skarmory", level: 50, ability: "Keen Eye", item: "Leftovers", nature: "Impish", moves: ["Spikes", "Whirlwind", "Drill Peck", "Rest"] },
      { species: "Blissey", level: 50, ability: "Natural Cure", item: "Leftovers", nature: "Bold", moves: ["Soft-Boiled", "Toxic", "Seismic Toss", "Aromatherapy"] },
      { species: "Gengar", level: 50, ability: "Levitate", item: "Leftovers", nature: "Timid", moves: ["Thunderbolt", "Ice Punch", "Will-O-Wisp", "Explosion"] },
      { species: "Tyranitar", level: 50, ability: "Sand Stream", item: "Leftovers", nature: "Adamant", moves: ["Rock Slide", "Earthquake", "Hidden Power Bug", "Dragon Dance"] },
      { species: "Celebi", level: 50, ability: "Natural Cure", item: "Leftovers", nature: "Bold", moves: ["Psychic", "Leech Seed", "Recover", "Baton Pass"] }
    ]
  },
  {
    id: "adv-offense",
    name: "ADV Offense",
    category: "offense",
    description: "Fast attackers and setup sweepers that test KO recognition.",
    team: [
      { species: "Aerodactyl", level: 50, ability: "Rock Head", item: "Choice Band", nature: "Jolly", moves: ["Rock Slide", "Double-Edge", "Earthquake", "Hidden Power Flying"] },
      { species: "Salamence", level: 50, ability: "Intimidate", item: "Leftovers", nature: "Naive", moves: ["Dragon Dance", "Hidden Power Flying", "Earthquake", "Fire Blast"] },
      { species: "Metagross", level: 50, ability: "Clear Body", item: "Choice Band", nature: "Adamant", moves: ["Meteor Mash", "Earthquake", "Rock Slide", "Explosion"] },
      { species: "Starmie", level: 50, ability: "Natural Cure", item: "Leftovers", nature: "Timid", moves: ["Surf", "Thunderbolt", "Ice Beam", "Recover"] },
      { species: "Dugtrio", level: 50, ability: "Arena Trap", item: "Choice Band", nature: "Jolly", moves: ["Earthquake", "Rock Slide", "Aerial Ace", "Hidden Power Bug"] },
      { species: "Snorlax", level: 50, ability: "Immunity", item: "Leftovers", nature: "Adamant", moves: ["Body Slam", "Shadow Ball", "Earthquake", "Self-Destruct"] }
    ]
  },
  {
    id: "adv-bulky-offense",
    name: "ADV Bulky Offense",
    category: "bulky-offense",
    description: "Bulky attackers that can take a hit, then threaten back.",
    team: [
      { species: "Suicune", level: 50, ability: "Pressure", item: "Leftovers", nature: "Bold", moves: ["Calm Mind", "Surf", "Ice Beam", "Roar"] },
      { species: "Metagross", level: 50, ability: "Clear Body", item: "Leftovers", nature: "Adamant", moves: ["Meteor Mash", "Earthquake", "Rock Slide", "Explosion"] },
      { species: "Salamence", level: 50, ability: "Intimidate", item: "Leftovers", nature: "Naughty", moves: ["Dragon Claw", "Earthquake", "Fire Blast", "Rock Slide"] },
      { species: "Snorlax", level: 50, ability: "Thick Fat", item: "Leftovers", nature: "Adamant", moves: ["Body Slam", "Shadow Ball", "Earthquake", "Rest"] },
      { species: "Magneton", level: 50, ability: "Magnet Pull", item: "Leftovers", nature: "Modest", moves: ["Thunderbolt", "Hidden Power Grass", "Thunder Wave", "Protect"] },
      { species: "Celebi", level: 50, ability: "Natural Cure", item: "Leftovers", nature: "Bold", moves: ["Psychic", "Leech Seed", "Recover", "Baton Pass"] }
    ]
  },
  {
    id: "status-stall",
    name: "Status & Stall",
    category: "stall-status",
    description: "Recovery, poison, phazing, and immunities stress status decisions.",
    team: [
      { species: "Milotic", level: 50, ability: "Marvel Scale", item: "Leftovers", nature: "Bold", moves: ["Surf", "Recover", "Toxic", "Refresh"] },
      { species: "Forretress", level: 50, ability: "Sturdy", item: "Leftovers", nature: "Relaxed", moves: ["Spikes", "Rapid Spin", "Earthquake", "Explosion"] },
      { species: "Dusclops", level: 50, ability: "Pressure", item: "Leftovers", nature: "Bold", moves: ["Night Shade", "Will-O-Wisp", "Rest", "Protect"] },
      { species: "Claydol", level: 50, ability: "Levitate", item: "Leftovers", nature: "Bold", moves: ["Earthquake", "Psychic", "Rapid Spin", "Explosion"] },
      { species: "Umbreon", level: 50, ability: "Synchronize", item: "Leftovers", nature: "Careful", moves: ["Toxic", "Wish", "Protect", "Baton Pass"] },
      { species: "Skarmory", level: 50, ability: "Keen Eye", item: "Leftovers", nature: "Impish", moves: ["Spikes", "Whirlwind", "Drill Peck", "Rest"] }
    ]
  },
  {
    id: "setup-immunity",
    name: "Setup & Immunity Traps",
    category: "immunity-trap",
    description: "Ground, Electric, Normal, and Fighting immunities plus setup moves.",
    team: [
      { species: "Gyarados", level: 50, ability: "Intimidate", item: "Leftovers", nature: "Adamant", moves: ["Dragon Dance", "Hidden Power Flying", "Earthquake", "Taunt"] },
      { species: "Jolteon", level: 50, ability: "Volt Absorb", item: "Leftovers", nature: "Timid", moves: ["Thunderbolt", "Hidden Power Grass", "Agility", "Baton Pass"] },
      { species: "Flygon", level: 50, ability: "Levitate", item: "Choice Band", nature: "Jolly", moves: ["Earthquake", "Rock Slide", "Hidden Power Bug", "Fire Blast"] },
      { species: "Gengar", level: 50, ability: "Levitate", item: "Leftovers", nature: "Timid", moves: ["Thunderbolt", "Ice Punch", "Hypnosis", "Explosion"] },
      { species: "Shedinja", level: 50, ability: "Wonder Guard", item: "Lum Berry", nature: "Adamant", moves: ["Shadow Ball", "Silver Wind", "Protect", "Toxic"] },
      { species: "Breloom", level: 50, ability: "Effect Spore", item: "Leftovers", nature: "Jolly", moves: ["Spore", "Focus Punch", "Mach Punch", "Leech Seed"] }
    ]
  },
  {
    id: "setup-heavy",
    name: "Setup Sweepers",
    category: "setup-heavy",
    description: "Six boosting win conditions; use it to test whether the AI punishes free setup.",
    team: [
      { species: "Salamence", level: 50, ability: "Intimidate", item: "Leftovers", nature: "Adamant", moves: ["Dragon Dance", "Dragon Claw", "Earthquake", "Rock Slide"] },
      { species: "Gyarados", level: 50, ability: "Intimidate", item: "Leftovers", nature: "Adamant", moves: ["Dragon Dance", "Hidden Power Flying", "Earthquake", "Taunt"] },
      { species: "Tyranitar", level: 50, ability: "Sand Stream", item: "Leftovers", nature: "Adamant", moves: ["Dragon Dance", "Rock Slide", "Earthquake", "Hidden Power Bug"] },
      { species: "Suicune", level: 50, ability: "Pressure", item: "Leftovers", nature: "Bold", moves: ["Calm Mind", "Surf", "Ice Beam", "Rest"] },
      { species: "Snorlax", level: 50, ability: "Thick Fat", item: "Leftovers", nature: "Careful", moves: ["Curse", "Body Slam", "Earthquake", "Rest"] },
      { species: "Jolteon", level: 50, ability: "Volt Absorb", item: "Leftovers", nature: "Timid", moves: ["Agility", "Thunderbolt", "Hidden Power Grass", "Baton Pass"] }
    ]
  },
  {
    id: "rom-npc",
    name: "ROM-like NPC",
    category: "rom-like",
    description: "A deliberately weaker four-Pok\xE9mon trainer-style team.",
    team: [
      { species: "Mightyena", level: 42, ability: "Intimidate", moves: ["Crunch", "Take Down", "Scary Face", "Sand-Attack"] },
      { species: "Camerupt", level: 43, ability: "Magma Armor", moves: ["Flamethrower", "Rock Slide", "Amnesia", "Take Down"] },
      { species: "Crobat", level: 44, ability: "Inner Focus", moves: ["Aerial Ace", "Bite", "Confuse Ray", "Toxic"] },
      { species: "Walrein", level: 45, ability: "Thick Fat", moves: ["Surf", "Ice Beam", "Body Slam", "Rest"] }
    ]
  }
];
var teamById = (id) => TEAM_FIXTURES.find((fixture) => fixture.id === id);

// src/i18n.ts
var FLAG_LABELS = {
  "Bad attack": ["Bad attack", "\uB098\uC05C \uACF5\uACA9 \uC120\uD0DD"],
  "Missed KO": ["Missed KO", "KO \uAE30\uD68C\uB97C \uB193\uCE68"],
  "Immunity/resistance mistake": ["Immunity/resistance mistake", "\uBB34\uD6A8/\uBC18\uAC10 \uD310\uB2E8 \uC2E4\uC218"],
  "Bad recovery": ["Bad recovery", "\uB098\uC05C \uD68C\uBCF5 \uC120\uD0DD"],
  "Bad setup": ["Bad setup", "\uB098\uC05C \uB7AD\uD06C\uC5C5 \uC120\uD0DD"],
  "Bad status move": ["Bad status move", "\uB098\uC05C \uBCC0\uD654\uAE30 \uC120\uD0DD"],
  "Repetitive behavior": ["Repetitive behavior", "\uBC18\uBCF5\uC801\uC778 \uD589\uB3D9"],
  "Gave free setup": ["Gave free setup", "\uBB34\uB8CC \uB7AD\uD06C\uC5C5\uC744 \uD5C8\uC6A9"],
  "Switch problem": ["Switch problem", "\uAD50\uCCB4 \uD310\uB2E8 \uBB38\uC81C"],
  Other: ["Other", "\uAE30\uD0C0"]
};
var STRENGTH_LABELS = {
  Weak: ["Weak", "\uC57D\uD568"],
  Normal: ["Normal", "\uBCF4\uD1B5"],
  Strong: ["Strong", "\uAC15\uD568"],
  "Very strong": ["Very strong", "\uB9E4\uC6B0 \uAC15\uD568"]
};

// src/research/logging.ts
var RESEARCH_LOG_VERSION = 4;
var FLAG_COMMENT_MAX = 500;
var FEEDBACK_COMMENT_MAX = 2e3;

// server/playtest.ts
var MAX_BODY_BYTES = 15e5;
var MAX_DECISIONS = 1e3;
var MAX_LOG_LINES = 2e4;
var MAX_LINE_LENGTH = 2e3;
var MAX_FLAGS = 200;
var CHOICE = /^(move|switch) [1-6]$/;
var BATTLE_ID = /^[-a-zA-Z0-9]{1,80}$/;
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var ANONYMOUS_SWITCH = /^Switch option \d$/;
var Invalid = class extends Error {
  constructor(code = "invalid_submission") {
    super(code);
    this.code = code;
  }
  code;
};
var isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function object(value, allowed, required = []) {
  if (!isObject(value)) throw new Invalid();
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Invalid();
  for (const key of required) if (!(key in value)) throw new Invalid();
  return value;
}
function array(value, max) {
  if (!Array.isArray(value) || value.length > max) throw new Invalid();
  return value;
}
function string(value, max, pattern) {
  if (typeof value !== "string" || value.length > max || pattern && !pattern.test(value)) throw new Invalid();
  return value;
}
function optionalString(value, max) {
  if (value !== void 0 && value !== null) string(value, max);
}
function integer(value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Invalid();
  return value;
}
function bool(value) {
  if (typeof value !== "boolean") throw new Invalid();
  return value;
}
function timestamp(value) {
  const text = string(value, 40);
  if (Number.isNaN(Date.parse(text))) throw new Invalid();
  return new Date(text).toISOString();
}
var METADATA_KEYS = [
  "battle_id",
  "timestamp",
  "random_seed",
  "simulator_version",
  "feature_schema",
  "hidden_policy_id",
  "policy_provenance",
  "blind_checkpoint_test",
  "human_team_id",
  "ai_team_id",
  "final_winner",
  "turn_count",
  "research_log_version",
  "hidden_debug_state_included",
  "battle_complete"
];
var PROVENANCE_KEYS = [
  "policy_id",
  "schema_version",
  "semantics_revision",
  "generation",
  "checkpoint_decisions",
  "milestone_decisions",
  "checkpoint_sha256",
  "parameter_count",
  "quantization_mode",
  "quantization_scale",
  "project_commit",
  "pokemon_showdown_commit",
  "evaluation"
];
var DECISION_KEYS = [
  "battle_id",
  "policy_id",
  "turn",
  "observation",
  "public_state",
  "legal_actions",
  "legal_action_mask",
  "candidates",
  "chosen_action",
  "resolved_defender_types",
  "top1_score",
  "top2_score",
  "top2_index",
  "margin",
  "quantized_top1_score",
  "quantized_selected_action",
  "resulting_visible_events",
  "answer_availability"
];
var OBSERVATION_KEYS = ["turn", "own_active", "target", "weather", "moves", "available_switch_count"];
var TARGET_KEYS = ["species", "hpBucket", "status", "types", "estimatedSpeed"];
var CANDIDATE_KEYS = [
  "index",
  "label",
  "kind",
  "legal",
  "score",
  "quantized_score",
  "feature_ids",
  "feature_categories",
  "activated_feature_ids",
  "contributions",
  "move_role",
  "move_class",
  "applicable",
  "effectiveness"
];
var PUBLIC_STATE_KEYS = ["perspective", "turn", "weather", "self", "opponent"];
var SIDE_KEYS = ["player", "name", "active", "conditions", "revealed"];
var ACTIVE_KEYS = ["species", "hp_percent", "hp", "status", "fainted", "boosts", "volatiles"];
var HUMAN_ACTION_KEYS = ["turn", "choice", "label", "kind", "public_state"];
var FLAG_KEYS = ["battle_id", "turn", "policy_id", "chosen_ai_action", "category", "comment", "created_at"];
var FEEDBACK_KEYS = ["strength", "irrational", "cheating", "comment"];
function checkPublicState(value, perspective) {
  const state = object(value, PUBLIC_STATE_KEYS, PUBLIC_STATE_KEYS);
  if (state.perspective !== perspective) throw new Invalid();
  for (const key of ["self", "opponent"]) {
    const side = object(state[key], SIDE_KEYS, SIDE_KEYS);
    if (side.active !== null) {
      const active = object(side.active, ACTIVE_KEYS);
      if (key === "opponent" && "hp" in active) throw new Invalid();
    }
    array(side.conditions, 20);
    array(side.revealed, 6);
  }
}
function checkAction(value, requireAnonymousSwitch) {
  const action = object(value, ["index", "choice", "label", "kind"], ["index", "label", "kind"]);
  const label = string(action.label, 100);
  if (requireAnonymousSwitch && action.kind === "switch" && !ANONYMOUS_SWITCH.test(label)) throw new Invalid();
}
function checkDecision(value, battleId, policyId) {
  const decision = object(value, DECISION_KEYS, ["battle_id", "policy_id", "turn", "observation", "legal_actions", "candidates", "chosen_action"]);
  if (decision.battle_id !== battleId || decision.policy_id !== policyId) throw new Invalid();
  integer(decision.turn, 0, 1e3);
  const observation = object(decision.observation, OBSERVATION_KEYS);
  if (observation.target !== null && observation.target !== void 0) object(observation.target, TARGET_KEYS);
  if (decision.public_state !== void 0) checkPublicState(decision.public_state, "p2");
  for (const action of array(decision.legal_actions, 9)) checkAction(action, true);
  for (const candidate of [...array(decision.candidates, 9), decision.chosen_action]) {
    const checked = object(candidate, CANDIDATE_KEYS, ["index", "label", "kind"]);
    checkAction({ index: checked.index, label: checked.label, kind: checked.kind }, true);
  }
  for (const line of array(decision.resulting_visible_events ?? [], MAX_LOG_LINES)) string(line, MAX_LINE_LENGTH);
}
function validateSubmission(body, appCommit) {
  const submission = object(body, ["submission_id", "revision", "log"], ["submission_id", "revision", "log"]);
  const submissionId = string(submission.submission_id, 36, UUID).toLowerCase();
  const revision = integer(submission.revision, 1, 1e4);
  const log = object(
    submission.log,
    ["metadata", "ai_decisions", "human_actions", "human_choices", "public_log", "flags", "feedback"],
    ["metadata", "ai_decisions", "human_actions", "human_choices", "public_log", "flags"]
  );
  const metadata = object(log.metadata, METADATA_KEYS, METADATA_KEYS.filter((key) => key !== "final_winner"));
  const policyId = string(metadata.hidden_policy_id, 40);
  if (QUARANTINED_POLICY_IDS.includes(policyId)) throw new Invalid("contaminated_policy");
  if (!CLEAN_POLICY_IDS.includes(policyId)) throw new Invalid("unknown_policy");
  const provenance = object(metadata.policy_provenance, PROVENANCE_KEYS, ["policy_id", "schema_version", "pokemon_showdown_commit"]);
  if (provenance.policy_id !== policyId || provenance.schema_version !== SCHEMA_VERSION || provenance.pokemon_showdown_commit !== PINNED_SHOWDOWN_COMMIT || provenance.generation !== void 0 && provenance.generation !== "clean-v1.1") throw new Invalid();
  const battleId = string(metadata.battle_id, 80, BATTLE_ID);
  const createdAt = timestamp(metadata.timestamp);
  const seed = array(metadata.random_seed, 4);
  if (seed.length !== 4) throw new Invalid();
  seed.forEach((value) => integer(value, 0, 65535));
  if (!string(metadata.simulator_version, 200).startsWith(`pokemon-showdown@${PINNED_SHOWDOWN_COMMIT}/`)) throw new Invalid();
  if (metadata.feature_schema !== SCHEMA_VERSION) throw new Invalid();
  if (metadata.research_log_version !== RESEARCH_LOG_VERSION) throw new Invalid();
  if (metadata.hidden_debug_state_included !== false || metadata.battle_complete !== true) throw new Invalid();
  bool(metadata.blind_checkpoint_test);
  if (!teamById(string(metadata.human_team_id, 60)) || !teamById(string(metadata.ai_team_id, 60))) throw new Invalid();
  const winner = metadata.final_winner ?? null;
  if (winner !== null && winner !== "Human" && winner !== "AI") throw new Invalid();
  const turnCount = integer(metadata.turn_count, 0, 1e3);
  for (const decision of array(log.ai_decisions, MAX_DECISIONS)) checkDecision(decision, battleId, policyId);
  for (const value of array(log.human_actions, MAX_DECISIONS)) {
    const action = object(value, HUMAN_ACTION_KEYS, ["turn", "choice", "label", "kind"]);
    integer(action.turn, 0, 1e3);
    string(action.choice, 10, CHOICE);
    string(action.label, 100);
    if (action.public_state !== void 0) checkPublicState(action.public_state, "p1");
  }
  for (const choice of array(log.human_choices, 500)) string(choice, 10, CHOICE);
  for (const line of array(log.public_log, MAX_LOG_LINES)) {
    if (!string(line, MAX_LINE_LENGTH).startsWith("|")) throw new Invalid();
  }
  const flaggedTurns = /* @__PURE__ */ new Set();
  for (const value of array(log.flags, MAX_FLAGS)) {
    const flag = object(value, FLAG_KEYS, ["battle_id", "turn", "policy_id", "chosen_ai_action", "created_at"]);
    if (flag.battle_id !== battleId || flag.policy_id !== policyId) throw new Invalid();
    flaggedTurns.add(integer(flag.turn, 0, 1e3));
    string(flag.chosen_ai_action, 100);
    timestamp(flag.created_at);
    if (flag.category !== void 0 && flag.category !== null && !Object.hasOwn(FLAG_LABELS, string(flag.category, 60))) throw new Invalid();
    optionalString(flag.comment, FLAG_COMMENT_MAX);
  }
  let hasFeedback = false;
  if (log.feedback !== void 0 && log.feedback !== null) {
    const feedback = object(log.feedback, FEEDBACK_KEYS);
    if (feedback.strength !== void 0 && !Object.hasOwn(STRENGTH_LABELS, string(feedback.strength, 40))) throw new Invalid();
    if (feedback.irrational !== void 0) bool(feedback.irrational);
    if (feedback.cheating !== void 0) bool(feedback.cheating);
    optionalString(feedback.comment, FEEDBACK_COMMENT_MAX);
    hasFeedback = Object.values(feedback).some((value) => value !== void 0 && value !== "");
  }
  return {
    submission_id: submissionId,
    revision,
    battle_id: battleId,
    created_at: createdAt,
    policy_id: policyId,
    schema_version: SCHEMA_VERSION,
    research_log_version: RESEARCH_LOG_VERSION,
    result: winner === "Human" ? "human_win" : winner === "AI" ? "ai_win" : "tie",
    turn_count: turnCount,
    flagged_turn_count: flaggedTurns.size,
    has_feedback: hasFeedback,
    app_commit: appCommit,
    payload: log
  };
}
function supabaseStore(url, key, fetcher = fetch) {
  const endpoint = `${url.replace(/\/+$/, "")}/rest/v1/rpc/submit_playtest`;
  const headers = { "content-type": "application/json", apikey: key };
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
  return {
    async submit(record) {
      const response = await fetcher(endpoint, { method: "POST", headers, body: JSON.stringify({
        p_submission_id: record.submission_id,
        p_revision: record.revision,
        p_battle_id: record.battle_id,
        p_created_at: record.created_at,
        p_policy_id: record.policy_id,
        p_schema_version: record.schema_version,
        p_research_log_version: record.research_log_version,
        p_result: record.result,
        p_turn_count: record.turn_count,
        p_flagged_turn_count: record.flagged_turn_count,
        p_has_feedback: record.has_feedback,
        p_app_commit: record.app_commit,
        p_payload: record.payload
      }) });
      if (!response.ok) throw new Error(`storage responded ${response.status}`);
      const result = await response.json();
      if (!["inserted", "updated", "duplicate", "conflict"].includes(result)) throw new Error("unexpected storage result");
      return result;
    }
  };
}
function memoryStore() {
  const records = /* @__PURE__ */ new Map();
  return {
    records,
    async submit(record) {
      const existing = records.get(record.submission_id);
      if (!existing) {
        records.set(record.submission_id, structuredClone(record));
        return "inserted";
      }
      if (existing.battle_id !== record.battle_id) return "conflict";
      if (existing.revision >= record.revision) return "duplicate";
      records.set(record.submission_id, structuredClone(record));
      return "updated";
    }
  };
}
function rateLimiter(limit = 30, windowMs = 6e4, now = Date.now) {
  const hits = /* @__PURE__ */ new Map();
  return (client) => {
    const time = now();
    if (hits.size > 1e4) {
      for (const [key, value] of hits) if (time - value.start >= windowMs) hits.delete(key);
    }
    const entry = hits.get(client);
    if (!entry || time - entry.start >= windowMs) {
      hits.set(client, { start: time, count: 1 });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  };
}
var RESPONSE_HEADERS = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" };
var reply = (status, body) => new Response(JSON.stringify(body), { status, headers: RESPONSE_HEADERS });
var failure = (status, error) => reply(status, { ok: false, error });
function sameOrigin(request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (request.headers.get("host") || new URL(request.url).host);
  } catch {
    return false;
  }
}
function createPlaytestHandler(options) {
  const allow = options.allow ?? rateLimiter();
  const appCommit = options.appCommit ?? null;
  return async (request) => {
    if (request.method !== "POST") return failure(405, "method_not_allowed");
    if (!sameOrigin(request)) return failure(403, "forbidden_origin");
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return failure(415, "unsupported_media_type");
    if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) return failure(413, "payload_too_large");
    const client = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
    if (!allow(client)) return failure(429, "rate_limited");
    if (!options.store) return failure(503, "collector_unavailable");
    let text;
    try {
      text = await request.text();
    } catch {
      return failure(400, "invalid_json");
    }
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return failure(413, "payload_too_large");
    if (text.includes("\\u0000")) return failure(400, "invalid_submission");
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return failure(400, "invalid_json");
    }
    let record;
    try {
      record = validateSubmission(body, appCommit);
    } catch (problem) {
      return failure(400, problem instanceof Invalid ? problem.code : "invalid_submission");
    }
    let result;
    try {
      result = await options.store.submit(record);
    } catch {
      console.error("[playtest] storage request failed");
      return failure(502, "storage_error");
    }
    if (result === "conflict") return failure(409, "submission_conflict");
    if (result === "inserted") return reply(201, { ok: true, submission_id: record.submission_id, duplicate: false });
    return reply(200, { ok: true, submission_id: record.submission_id, duplicate: result === "duplicate", updated: result === "updated" });
  };
}
function createPlaytestHandlerFromEnv(env, fallback = null) {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const store = url && key ? supabaseStore(url, key) : fallback;
  return createPlaytestHandler({ store, appCommit: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 40) || null });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MAX_BODY_BYTES,
  createPlaytestHandler,
  createPlaytestHandlerFromEnv,
  memoryStore,
  rateLimiter,
  supabaseStore,
  validateSubmission
});
