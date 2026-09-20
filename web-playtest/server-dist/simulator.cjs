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

// server/simulator.ts
var simulator_exports = {};
__export(simulator_exports, {
  SIMULATOR_ID: () => SIMULATOR_ID,
  TEAM_FIXTURES: () => TEAM_FIXTURES,
  legalActions: () => legalActions,
  replayBattle: () => replayBattle
});
module.exports = __toCommonJS(simulator_exports);
var import_node_module = require("node:module");

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

// src/policy/schema.ts
var SCHEMA_VERSION = "gen3-lut-v1";
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

// src/policy/encoder.ts
var STATUS_IDS = { "": 0, brn: 1, par: 2, psn: 3, tox: 3, slp: 4, frz: 5 };
var PHYSICAL = /* @__PURE__ */ new Set(["normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel"]);
var SPECIAL = /* @__PURE__ */ new Set(["fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark"]);
var ROLE_IDS = Object.fromEntries(FEATURE_VALUES.move_role.map((name, index) => [name, index]));
function parseCondition(text = "") {
  if (text.includes("fnt")) return [0, 1, ""];
  const match = text.match(/(\d+)\/(\d+)(?:\s+(\w+))?/);
  return match ? [Number(match[1]), Number(match[2]), match[3] || ""] : [1, 1, ""];
}
var hpBucket = (hp, max) => hp <= 0 || max <= 0 ? 0 : hp * 4 <= max ? 1 : hp * 2 <= max ? 2 : hp * 4 <= max * 3 ? 3 : 4;
var powerBucket = (v) => v <= 0 ? 0 : v <= 40 ? 1 : v <= 70 ? 2 : v <= 100 ? 3 : 4;
var accuracyBucket = (v) => v === true || v == null ? 0 : Number(v) <= 70 ? 1 : Number(v) <= 85 ? 2 : Number(v) < 100 ? 3 : 4;
var ppBucket = (v) => v <= 0 ? 0 : v <= 4 ? 1 : v <= 9 ? 2 : v <= 19 ? 3 : 4;
function classifyRole(move) {
  const id = String(move.id || move.move || "").toLowerCase().replaceAll(" ", "");
  if (["protect", "detect", "endure"].includes(id)) return ROLE_IDS.protect;
  if (["recover", "softboiled", "rest", "synthesis", "moonlight", "morningsun", "slackoff"].includes(id)) return ROLE_IDS.recovery;
  if (["sunnyday", "raindance", "sandstorm", "hail"].includes(id)) return ROLE_IDS.weather;
  if (id === "spikes") return ROLE_IDS.field;
  if (["roar", "whirlwind"].includes(id)) return ROLE_IDS.phaze;
  if (id === "batonpass") return ROLE_IDS.pivot;
  if (["explosion", "selfdestruct", "memento"].includes(id)) return ROLE_IDS.self_ko;
  if (["seismictoss", "nightshade", "dragonrage", "sonicboom", "psywave", "superfang"].includes(id)) return ROLE_IDS.fixed;
  if ((move.basePower || 0) > 0) return ROLE_IDS.damage;
  if (move.boosts && Object.values(move.boosts).some((value) => value < 0)) return ROLE_IDS.debuff;
  if (move.boosts || move.self?.boosts) return ROLE_IDS.setup;
  if (move.status) return ROLE_IDS.status;
  return ROLE_IDS.utility;
}
function encodeRequest(request) {
  const features = Array.from({ length: 9 }, () => Array(FEATURE_NAMES.length).fill(0));
  const mask = Array(9).fill(false);
  const mons = request.side?.pokemon || [];
  const own = mons.find((mon) => mon.active) || mons[0] || { condition: "" };
  const [hp, maxHp, status] = parseCondition(own.condition);
  const target = request.public?.target;
  const weatherName = (request.public?.weather || "").toLowerCase();
  const weather = weatherName.includes("sun") ? 1 : weatherName.includes("rain") ? 2 : weatherName.includes("sand") ? 3 : weatherName.includes("hail") ? 4 : 0;
  const ownSpeed = own.stats?.spe || 0;
  const targetSpeed = target?.estimatedSpeed ?? ownSpeed;
  const speed = ownSpeed < targetSpeed ? 0 : ownSpeed > targetSpeed ? 2 : 1;
  const forced = Boolean(request.forceSwitch?.[0]);
  for (const [slot, move] of (request.active?.[0]?.moves || []).slice(0, 4).entries()) {
    const pp = move.pp;
    mask[slot] = !forced && !move.disabled && (pp == null || pp > 0);
    const type = (move.type || "unknown").toLowerCase();
    const power = Number(move.basePower || 0);
    const row = features[slot];
    row[0] = slot;
    row[1] = classifyRole(move);
    row[2] = FEATURE_VALUES.move_type.indexOf(type);
    if (row[2] < 0) row[2] = 17;
    row[3] = power <= 0 ? 2 : PHYSICAL.has(type) ? 0 : SPECIAL.has(type) ? 1 : 0;
    row[4] = powerBucket(power);
    row[5] = accuracyBucket(move.accuracy);
    row[6] = (move.priority || 0) < 0 ? 0 : (move.priority || 0) > 0 ? 2 : 1;
    row[7] = Number((own.types || []).some((value) => value.toLowerCase() === type));
    row[8] = Number(move.effectivenessBucket ?? 3);
    row[9] = ppBucket(Number(pp || 0));
    row[10] = hpBucket(hp, maxHp);
    row[11] = Number(target?.hpBucket ?? 4);
    row[12] = STATUS_IDS[status] || 0;
    row[13] = STATUS_IDS[target?.status || ""] || 0;
    row[14] = speed;
    row[15] = 0;
    row[16] = 0;
    row[17] = Number((request.public?.turn || 0) <= 1);
    row[18] = weather;
    row[19] = 2;
  }
  const switches = mons.filter((mon) => !mon.active && !mon.condition.includes("fnt"));
  const trapped = Boolean(request.active?.[0]?.trapped);
  if (forced || !trapped) switches.slice(0, 5).forEach((_, index) => {
    mask[4 + index] = true;
  });
  return { features, mask };
}
function featureCategories(row) {
  return Object.fromEntries(FEATURE_NAMES.map((name, index) => [name, FEATURE_VALUES[name][row[index]]]));
}

// src/policy/inference.ts
function at(table, ...indices) {
  let value = table;
  for (const index of indices) value = value[index];
  return value;
}
function validatePolicy(asset) {
  if (asset.schema_version !== SCHEMA_VERSION) throw new Error(`unsupported policy schema ${asset.schema_version}`);
  if (asset.parameter_count !== 349) throw new Error(`expected 349 LUT parameters, got ${asset.parameter_count}`);
  if (!asset.tables.action_bias) throw new Error("policy is missing action_bias");
}
function policyScores(asset, features, mask) {
  validatePolicy(asset);
  const scores = Array(9).fill(0);
  for (let action = 0; action < 4; action++) {
    let score = at(asset.tables.action_bias, action);
    FEATURE_NAMES.forEach((name, column) => {
      score = Math.fround(score + at(asset.tables[`feature_${name}`], features[action][column]));
    });
    PAIR_SPECS.forEach(([a, b]) => {
      score = Math.fround(score + at(asset.tables[`pair_${a}_${b}`], features[action][FEATURE_INDEX[a]], features[action][FEATURE_INDEX[b]]));
    });
    scores[action] = score;
  }
  return scores.map((score, index) => mask[index] ? score : null);
}
function selectTop1(scores) {
  let best = -1;
  let bestScore = -Infinity;
  scores.forEach((score, index) => {
    if (score != null && score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  if (best < 0) throw new Error("state has no legal action");
  return best;
}

// server/simulator.ts
var runtimeRequire = null;
function getRuntimeRequire() {
  runtimeRequire ||= (0, import_node_module.createRequire)(`${process.cwd()}/api/battle.js`);
  return runtimeRequire;
}
var BattleStream;
var getPlayerStreams;
var Dex;
function loadPinnedSimulator() {
  if (BattleStream && getPlayerStreams && Dex) return;
  const runtime = getRuntimeRequire();
  runtime("ts-chacha20");
  ({ BattleStream, getPlayerStreams } = runtime("../vendor/pokemon-showdown/dist/sim/battle-stream"));
  ({ Dex } = runtime("../vendor/pokemon-showdown/dist/sim/dex"));
}
var POLICIES = null;
function loadPolicies() {
  if (POLICIES) return POLICIES;
  const runtime = getRuntimeRequire();
  POLICIES = {
    "v1-10m": runtime("../public/policies/v1-10m.json"),
    "v1-50m": runtime("../public/policies/v1-50m.json"),
    "v1-100m": runtime("../public/policies/v1-100m.json")
  };
  return POLICIES;
}
var SIMULATOR_ID = "pokemon-showdown@2ddfa0476f8207e12e204b1c69f7c7683b17633c/gen3customgame";
function initialPublic() {
  return { target: null, weather: "", turn: 0 };
}
function hpBucket2(condition) {
  if (condition.includes("fnt")) return 0;
  const match = condition.match(/(\d+)\/(\d+)/);
  if (!match) return 4;
  const hp = Number(match[1]);
  const max = Number(match[2]);
  return hp <= 0 ? 0 : hp * 4 <= max ? 1 : hp * 2 <= max ? 2 : hp * 4 <= max * 3 ? 3 : 4;
}
function updatePublic(player, state, line) {
  const fields = line.split("|");
  const command = fields[1] || "";
  const opponent = player === "p1" ? "p2" : "p1";
  if (["switch", "drag", "replace"].includes(command) && fields[2]?.startsWith(opponent)) {
    const species = (fields[3] || "").split(",")[0];
    const data = Dex.species.get(species);
    const level = Number((fields[3] || "").match(/L(\d+)/)?.[1] || 100);
    state.target = { species, hpBucket: hpBucket2(fields[4] || "100/100"), status: "", types: data.types || [], estimatedSpeed: Math.floor((2 * data.baseStats.spe + 31) * level / 100) + 5 };
  } else if (["-damage", "-heal"].includes(command) && fields[2]?.startsWith(opponent) && state.target) {
    state.target.hpBucket = hpBucket2(fields[3] || "");
    const status = (fields[3] || "").split(" ")[1];
    if (status) state.target.status = status;
  } else if (command === "-status" && fields[2]?.startsWith(opponent) && state.target) state.target.status = fields[3] || "";
  else if (command === "-curestatus" && fields[2]?.startsWith(opponent) && state.target) state.target.status = "";
  else if (command === "faint" && fields[2]?.startsWith(opponent) && state.target) state.target.hpBucket = 0;
  else if (command === "-weather") state.weather = fields[2] || "";
  else if (command === "turn") state.turn = Number(fields[2]) || state.turn;
}
function safeRequest(raw, visible) {
  const result = {
    rqid: raw.rqid,
    wait: Boolean(raw.wait),
    forceSwitch: raw.forceSwitch || null,
    active: raw.active?.map((active) => ({ ...active, moves: (active.moves || []).map((move) => {
      const data = Dex.moves.get(move.id || move.move);
      let effectivenessBucket = 3;
      if (visible.target?.types?.length) {
        const immune = visible.target.types.every((type) => !Dex.getImmunity(data.type, type));
        if (immune) effectivenessBucket = 0;
        else {
          const exponent = visible.target.types.reduce((sum, type) => sum + Dex.getEffectiveness(data.type, type), 0);
          effectivenessBucket = exponent <= -2 ? 1 : exponent === -1 ? 2 : exponent === 0 ? 3 : exponent === 1 ? 4 : 5;
        }
      }
      return {
        ...move,
        id: data.id,
        type: data.type,
        basePower: data.basePower,
        accuracy: data.accuracy,
        priority: data.priority,
        status: data.status,
        boosts: data.boosts,
        self: data.self,
        effectivenessBucket
      };
    }) })) || null,
    side: raw.side ? { id: raw.side.id, name: raw.side.name, pokemon: raw.side.pokemon.map((mon) => ({
      ident: mon.ident,
      details: mon.details,
      condition: mon.condition,
      active: Boolean(mon.active),
      stats: mon.stats,
      moves: mon.moves || [],
      types: Dex.species.get(String(mon.details || "").split(",")[0]).types
    })) } : void 0,
    public: structuredClone(visible)
  };
  return result;
}
function legalActions(request, revealSwitches = true) {
  if (!request || request.wait) return [];
  const result = [];
  const mons = request.side?.pokemon || [];
  const switches = mons.map((mon, index) => ({ mon, slot: index + 1 })).filter(({ mon }) => !mon.active && !mon.condition.includes("fnt"));
  if (request.forceSwitch?.[0]) {
    switches.slice(0, 5).forEach(({ mon, slot }, index) => result.push({ index: 4 + index, choice: `switch ${slot}`, label: revealSwitches ? `Switch to ${String(mon.details || mon.ident || `slot ${slot}`).split(",")[0].replace(/^p\d: /, "")}` : `Switch option ${index + 1}`, kind: "switch" }));
    return result;
  }
  request.active?.[0]?.moves.forEach((move, index) => {
    if (!move.disabled && (move.pp == null || move.pp > 0)) result.push({ index, choice: `move ${index + 1}`, label: move.move, kind: "move" });
  });
  if (!request.active?.[0]?.trapped && !request.active?.[0]?.maybeTrapped) {
    switches.slice(0, 5).forEach(({ mon, slot }, index) => result.push({ index: 4 + index, choice: `switch ${slot}`, label: revealSwitches ? `Switch to ${String(mon.details || mon.ident || `slot ${slot}`).split(",")[0].replace(/^p\d: /, "")}` : `Switch option ${index + 1}`, kind: "switch" }));
  }
  return result;
}
function publicLines(chunks) {
  const ignored = /* @__PURE__ */ new Set(["request", "t:", "upkeep", "split"]);
  return chunks.flatMap((chunk) => chunk.split("\n")).filter((line) => line.startsWith("|") && !ignored.has(line.split("|")[1]));
}
async function nextView(stream, player, publicState) {
  const chunks = [];
  for (let reads = 0; reads < 20; reads++) {
    const chunk = await stream.read();
    if (chunk == null) return { request: null, chunks, terminal: true, winner: null };
    chunks.push(chunk);
    let request = null;
    let terminal = false;
    let winner = null;
    for (const line of chunk.split("\n")) {
      updatePublic(player, publicState, line);
      if (line.startsWith("|request|")) request = JSON.parse(line.slice("|request|".length));
      else if (line.startsWith("|win|")) {
        terminal = true;
        winner = line.slice(5);
      } else if (line === "|tie") terminal = true;
    }
    if (terminal || request) return { request, chunks, terminal, winner };
  }
  throw new Error("simulator did not produce a request");
}
function diagnostics(asset, request) {
  const { features, mask } = encodeRequest(request);
  const scores = policyScores(asset, features, mask);
  const chosen = selectTop1(scores);
  const actions = legalActions(request, false);
  const byIndex = new Map(actions.map((action) => [action.index, action]));
  const candidates = Array.from({ length: 9 }, (_, index) => {
    const action = byIndex.get(index);
    const row = index < 4 ? features[index] : null;
    const categories = row ? featureCategories(row) : null;
    return {
      index,
      label: action?.label || (index < 4 ? `Move slot ${index + 1}` : `Switch option ${index - 3}`),
      kind: index < 4 ? "move" : "switch",
      legal: mask[index],
      score: scores[index],
      feature_ids: row,
      feature_categories: categories,
      move_role: categories?.move_role || null,
      effectiveness: categories?.effectiveness || null
    };
  });
  const legalScores = scores.filter((score) => score != null).sort((a, b) => b - a);
  const selected = byIndex.get(chosen);
  if (!selected) throw new Error(`policy selected illegal action ${chosen}`);
  const own = request.side?.pokemon.find((mon) => mon.active);
  const observation = {
    turn: request.public?.turn || 0,
    own_active: own ? { condition: own.condition, types: own.types, speed: own.stats?.spe } : null,
    target: request.public?.target || null,
    weather: request.public?.weather || "",
    moves: request.active?.[0]?.moves.map((move) => ({ id: move.id, move: move.move, pp: move.pp, disabled: Boolean(move.disabled) })) || [],
    available_switch_count: mask.slice(4).filter(Boolean).length
  };
  return { choice: selected.choice, decision: {
    turn: request.public?.turn || 0,
    observation,
    legal_action_mask: mask,
    candidates,
    chosen_action: candidates[chosen],
    top1_score: legalScores[0],
    top2_score: legalScores[1] ?? null,
    margin: legalScores[1] == null ? null : legalScores[0] - legalScores[1],
    resulting_visible_events: []
  } };
}
function validateInput(input) {
  if (!/^[-a-zA-Z0-9]{1,80}$/.test(input.battle_id)) throw new Error("invalid battle ID");
  if (!Array.isArray(input.seed) || input.seed.length !== 4 || input.seed.some((value) => !Number.isInteger(value) || value < 0 || value > 65535)) throw new Error("seed must contain four uint16 values");
  if (!loadPolicies()[input.policy_id]) throw new Error("unknown policy ID");
  if (!teamById(input.human_team_id) || !teamById(input.ai_team_id)) throw new Error("unknown team fixture");
  if (!Array.isArray(input.human_choices) || input.human_choices.length > 500 || input.human_choices.some((choice) => !/^(move|switch) [1-6]$/.test(choice))) throw new Error("invalid choice history");
}
async function replayBattle(input, testTeams) {
  loadPinnedSimulator();
  validateInput(input);
  const asset = loadPolicies()[input.policy_id];
  validatePolicy(asset);
  const humanTeam = teamById(input.human_team_id);
  const aiTeam = teamById(input.ai_team_id);
  const battle = new BattleStream({ keepAlive: true });
  const streams = getPlayerStreams(battle);
  const publicState = { p1: initialPublic(), p2: initialPublic() };
  const allHumanChunks = [];
  const aiDecisions = [];
  let consumed = 0;
  try {
    battle.write(`>start ${JSON.stringify({ formatid: "gen3customgame", seed: input.seed })}
>player p1 ${JSON.stringify({ name: "Human", team: testTeams?.human || humanTeam.team })}
>player p2 ${JSON.stringify({ name: "V1 LUT", team: testTeams?.ai || aiTeam.team })}`);
    let [human, ai] = await Promise.all([nextView(streams.p1, "p1", publicState.p1), nextView(streams.p2, "p2", publicState.p2)]);
    allHumanChunks.push(...human.chunks);
    for (let cycle = 0; cycle < 1e3; cycle++) {
      if (human.terminal || ai.terminal) {
        if (consumed !== input.human_choices.length) throw new Error("choice history continues after battle end");
        return response(input, null, [], allHumanChunks, aiDecisions, true, human.winner || ai.winner, publicState.p1.turn);
      }
      const humanLegal = human.request ? legalActions(human.request, true) : [];
      const needsHuman = Boolean(human.request && !human.request.wait && humanLegal.length);
      if (needsHuman && consumed >= input.human_choices.length) {
        return response(input, safeRequest(human.request, publicState.p1), humanLegal, allHumanChunks, aiDecisions, false, null, publicState.p1.turn);
      }
      const writes = [];
      if (needsHuman) {
        const choice = input.human_choices[consumed++];
        if (!humanLegal.some((action) => action.choice === choice)) throw new Error(`illegal human action at choice ${consumed}: ${choice}`);
        writes.push(`>p1 ${choice}`);
      }
      if (ai.request && !ai.request.wait) {
        const safe = safeRequest(ai.request, publicState.p2);
        const result = diagnostics(asset, safe);
        aiDecisions.push(result.decision);
        writes.push(`>p2 ${result.choice}`);
      }
      if (!writes.length) throw new Error("battle reached a state with no actionable request");
      battle.write(writes.join("\n"));
      const previousLineCount = publicLines(allHumanChunks).length;
      [human, ai] = await Promise.all([nextView(streams.p1, "p1", publicState.p1), nextView(streams.p2, "p2", publicState.p2)]);
      allHumanChunks.push(...human.chunks);
      if (aiDecisions.length) aiDecisions.at(-1).resulting_visible_events = publicLines(allHumanChunks).slice(previousLineCount);
    }
    throw new Error("battle exceeded safety cycle limit");
  } finally {
    battle.destroy();
  }
}
function response(input, request, legal, chunks, decisions, terminal, winner, turn) {
  return {
    battle_id: input.battle_id,
    seed: input.seed,
    simulator: SIMULATOR_ID,
    feature_schema: SCHEMA_VERSION,
    policy_id: input.policy_id,
    request,
    legal_actions: legal,
    public_log: publicLines(chunks),
    turn,
    ai_decisions: decisions,
    terminal,
    winner
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SIMULATOR_ID,
  TEAM_FIXTURES,
  legalActions,
  replayBattle
});
