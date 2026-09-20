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

// public/policies/v1-10m.json
var v1_10m_default = { asset_version: 1, policy_id: "v1-10m", schema_version: "gen3-lut-v1", checkpoint_decisions: 1e7, simulator: { format: "gen3customgame", pokemon_showdown_commit: "2ddfa0476f8207e12e204b1c69f7c7683b17633c" }, inference: "float32-additive-lut-argmax", switch_logits: "neutral-zero-v1", parameter_count: 349, feature_sizes: { action_slot: 4, move_role: 13, move_type: 18, damage_class: 3, power_bucket: 5, accuracy_bucket: 5, priority_bucket: 3, stab: 2, effectiveness: 6, pp_bucket: 5, user_hp: 5, target_hp: 5, user_status: 6, target_status: 6, speed_relation: 3, can_ko: 2, damage_fraction: 5, first_turn: 2, weather: 5, stage_summary: 5 }, pair_specs: [["effectiveness", "move_role"], ["user_hp", "move_role"], ["target_hp", "can_ko"], ["speed_relation", "can_ko"], ["target_status", "move_role"]], tables: { action_bias: [0.11912938952445984, 0.034014876931905746, 0.04976564645767212, -0.010235287249088287], feature_action_slot: [0.07227519154548645, 0.03332489728927612, 0.060035910457372665, -0.015118747018277645], feature_move_role: [0.3812553584575653, -0.1476133018732071, -0.23564457893371582, -0.2605157196521759, 0.12707580626010895, 0.06628567725419998, -0.688133716583252, 0.2646351158618927, -0.7239018678665161, -0.286207377910614, 0.6334635615348816, 0.28134825825691223, -0.41316452622413635], feature_move_type: [-0.05249066650867462, 0.3996729850769043, 0.9812718629837036, 1.0300263166427612, -0.39503270387649536, -0.26368069648742676, 0.8523960113525391, -0.050092507153749466, -1.3483823537826538, 0.910041332244873, -0.9397238492965698, 0.005705586634576321, 0.6843613386154175, -1.3362250328063965, 0.19452090561389923, -0.6332768797874451, 1.1044107675552368, 0.2015899419784546], feature_damage_class: [0.018244227394461632, 0.6839604377746582, -0.5265188813209534], feature_power_bucket: [-0.5374197959899902, -0.9750441908836365, 1.0136926174163818, 0.9506472945213318, -0.26059332489967346], feature_accuracy_bucket: [-0.4064900279045105, 0.09793142974376678, 0.3914984464645386, 0.5103117823600769, -0.12847541272640228], feature_priority_bucket: [0.15387170016765594, 0.3400229513645172, -0.25375059247016907], feature_stab: [-0.6414179801940918, 0.7511693835258484], feature_effectiveness: [-1.3823422193527222, -0.8961344361305237, -1.1625633239746094, 0.21587330102920532, 1.3261128664016724, 1.7872200012207031], feature_pp_bucket: [-0.09989221394062042, -0.2377602607011795, 0.39538711309432983, 0.16789604723453522, -0.2101394385099411], feature_user_hp: [-0.02190558612346649, 0.5363712906837463, 0.5236328840255737, 0.7363125085830688, -0.3512926995754242], feature_target_hp: [0.01696738600730896, 0.20359565317630768, 0.3139454126358032, 0.45782148838043213, 0.031036376953125], feature_user_status: [0.2944837808609009, 0.21834315359592438, 0.16054484248161316, -0.15581014752388, 0.42100217938423157, 0.11532063037157059], feature_target_status: [0.22793959081172943, 0.6959854960441589, -0.05750438570976257, 0.0032641536090523005, 0.11584220081567764, 0.10021072626113892], feature_speed_relation: [0.4347132742404938, 0.43075522780418396, -0.11562429368495941], feature_can_ko: [0.3556945323944092, 0.0016230909386649728], feature_damage_fraction: [0.3688611388206482, 0.002623017178848386, 0.0020642804447561502, -0.0047552273608744144, -0.0051468550227582455], feature_first_turn: [0.21629774570465088, 0.2896895110607147], feature_weather: [0.3567613661289215, 0.13277599215507507, -0.25060856342315674, -0.07027976214885712, 0.06287363171577454], feature_stage_summary: [-0.006574877072125673, -0.016624297946691513, 0.3280928134918213, -0.005455343518406153, -0.003575335256755352], pair_effectiveness_move_role: [[-1.2565021514892578, -0.05063489079475403, 0.027379319071769714, -0.04752568155527115, 0.3960117995738983, 0.08893045783042908, -0.005641005001962185, -0.0018700252985581756, -0.286763459444046, 0.5947685241699219, -0.8865193128585815, -0.38052523136138916, 0.23211908340454102], [-1.2836341857910156, 0.18595224618911743, 0.3429083228111267, -0.10801713913679123, 0.14104850590229034, -0.004708696156740189, 0.0072138672694563866, 0.0031219276133924723, 0.08711864054203033, -0.1081795021891594, -0.14947260916233063, 0.4731544256210327, 0.4699217975139618], [-1.331861138343811, 0.6097700595855713, -0.055710695683956146, -0.5864514708518982, 0.33286166191101074, 0.13237975537776947, -0.36122405529022217, -0.060626063495874405, 0.015638045966625214, -0.4461965262889862, -1.4141147136688232, 0.3027372360229492, -0.008524008095264435], [0.4687282145023346, -0.4970429837703705, -0.19607460498809814, 0.02628730796277523, 0.10571648180484772, -0.001654183492064476, -0.5078305602073669, -0.2530619502067566, -0.6932926774024963, -0.2001914530992508, 1.2711142301559448, 0.13363663852214813, -0.4877854287624359], [1.8164142370224, -0.2525835633277893, -0.3347432613372803, -0.3111478388309479, -0.5637476444244385, -0.11409987509250641, -0.3431379199028015, 0.5639188885688782, 27308951757731847e-21, -0.015282087959349155, 0.0056548831053078175, 0.38533198833465576, -0.36759570240974426], [2.0363080501556396, 0.04985992610454559, -0.18178820610046387, -0.20794691145420074, 0.021345289424061775, -0.09533902257680893, -0.01951090805232525, 0.07378558069467545, 0.013384898193180561, -0.00448794849216938, -0.0102256890386343, -0.06810300797224045, 0.05202559754252434]], pair_user_hp_move_role: [[0.013454992324113846, 0.018964003771543503, 0.024664511904120445, 0.0013004037318751216, 0.00828567799180746, 0.005840170197188854, -0.005610371474176645, -0.003419991582632065, -0.017189867794513702, -0.0017467697616666555, 0.0069775632582604885, 0.005459117237478495, 0.016415417194366455], [0.12195058912038803, -0.8398770093917847, -0.12534113228321075, -0.5628034472465515, 1.2762961387634277, -0.05898243188858032, -1.6516029834747314, -0.2671964764595032, -0.2860244810581207, -0.21174797415733337, 1.935176968574524, 0.25596168637275696, -0.30459317564964294], [0.8378528952598572, -1.1872085332870483, -0.13699284195899963, -0.5387727618217468, 0.7036125063896179, 0.21577586233615875, -0.5385710597038269, -0.2220335751771927, -0.3349309265613556, 0.011427704244852066, -0.27633365988731384, 0.622148334980011, -0.23316484689712524], [0.35671812295913696, -0.35109975934028625, -0.37778180837631226, -0.5812714099884033, 0.17862607538700104, 0.04599979892373085, -0.28054603934288025, 0.16017863154411316, -0.38475021719932556, -0.1293358951807022, 1.6381347179412842, 0.008526580408215523, -0.21657036244869232], [0.004709272645413876, 0.7565706968307495, 0.02740355394780636, 0.38626977801322937, -0.9913285374641418, -0.03932442143559456, 0.15976783633232117, 0.4252881705760956, -0.4240538477897644, -0.1243712529540062, -0.705724835395813, -0.08735516667366028, -0.21828630566596985]], pair_target_hp_can_ko: [[-0.008495630696415901, -0.0036882644053548574], [0.20616008341312408, 0.016678249463438988], [0.3048836588859558, 5051222979091108e-19], [0.4367101192474365, 0.011971861124038696], [0.027820490300655365, -0.007675062865018845]], pair_speed_relation_can_ko: [[0.4218091666698456, -0.004437711555510759], [0.4399292767047882, 0.010918241925537586], [-0.12001830339431763, 0.00874526146799326]], pair_target_status_move_role: [[0.19313669204711914, 0.6926113963127136, -0.2394087314605713, -0.79411381483078, -0.22492291033267975, -0.18657763302326202, -0.8335066437721252, -0.2770623564720154, -0.6272833943367004, -0.2714994251728058, 1.625398874282837, -0.11218886822462082, -0.4481673240661621], [0.9953028559684753, -1.245896577835083, -0.17006082832813263, -0.0038780728355050087, 0.5070494413375854, 0.39784157276153564, 0.3013893961906433, 0.955473780632019, -0.2845410108566284, -0.012942390516400337, -2.6573915481567383, 0.6387830376625061, 0.06629734486341476], [0.14718328416347504, -0.6904643177986145, -0.10163486748933792, 1.790271520614624, 0.0406055711209774, 0.13288185000419617, -0.06984665244817734, -0.12009046971797943, -0.06418725848197937, -0.14923471212387085, -2.0318596363067627, 0.11356953531503677, 0.10641607642173767], [-0.012929944321513176, -0.7081260681152344, 0.18598337471485138, -0.017989682033658028, 0.6080926656723022, 0.6834584474563599, -0.14180171489715576, 0.2120518833398819, 0.10494431853294373, 0.14555686712265015, -0.4886944591999054, 0.05160508304834366, 0.13776932656764984], [0.3239757716655731, -0.5727919340133667, 0.31260210275650024, 0.051148030906915665, -0.16811856627464294, -0.05190044268965721, 0.2113451063632965, 0.021154029294848442, 0.14565794169902802, 0.3188753128051758, -0.15073922276496887, 0.719448447227478, -0.11281891167163849], [0.05757314711809158, -0.014513467438519001, -0.3583906590938568, -0.07714855670928955, -0.16294977068901062, 0.48449674248695374, 0.13557656109333038, 0.002674381947144866, -0.017152175307273865, -0.010570415295660496, -0.008588135242462158, -0.01779479905962944, -0.0334661528468132]] } };

// public/policies/v1-50m.json
var v1_50m_default = { asset_version: 1, policy_id: "v1-50m", schema_version: "gen3-lut-v1", checkpoint_decisions: 5e7, simulator: { format: "gen3customgame", pokemon_showdown_commit: "2ddfa0476f8207e12e204b1c69f7c7683b17633c" }, inference: "float32-additive-lut-argmax", switch_logits: "neutral-zero-v1", parameter_count: 349, feature_sizes: { action_slot: 4, move_role: 13, move_type: 18, damage_class: 3, power_bucket: 5, accuracy_bucket: 5, priority_bucket: 3, stab: 2, effectiveness: 6, pp_bucket: 5, user_hp: 5, target_hp: 5, user_status: 6, target_status: 6, speed_relation: 3, can_ko: 2, damage_fraction: 5, first_turn: 2, weather: 5, stage_summary: 5 }, pair_specs: [["effectiveness", "move_role"], ["user_hp", "move_role"], ["target_hp", "can_ko"], ["speed_relation", "can_ko"], ["target_status", "move_role"]], tables: { action_bias: [0.1713540256023407, -0.006029774900525808, 0.14042554795742035, -0.034870557487010956], feature_action_slot: [0.12450037896633148, -0.006720122881233692, 0.1506972312927246, -0.03975578397512436], feature_move_role: [0.3849896490573883, -0.3888852596282959, -0.7257208228111267, -0.7357970476150513, 0.4059130847454071, 0.41649097204208374, -1.2539154291152954, 0.6470988988876343, -1.6719248294830322, -0.43590620160102844, 1.2757519483566284, 0.8714979290962219, -0.7339237928390503], feature_move_type: [0.25504830479621887, 0.9511334896087646, 1.3456995487213135, 1.747376799583435, -0.41736748814582825, -0.7075324058532715, 1.677507758140564, 0.048677340149879456, -3.0306644439697266, 1.5020160675048828, -1.5117322206497192, 0.393557071685791, 1.0472595691680908, -3.347208023071289, 2.061605930328369, -1.2939577102661133, 2.686723470687866, 0.9476988911628723], feature_damage_class: [-0.24880941212177277, 1.2111023664474487, -0.7038403153419495], feature_power_bucket: [-0.7147408127784729, -1.2728230953216553, 1.507973074913025, 1.570980429649353, -0.9289703369140625], feature_accuracy_bucket: [-0.5311135053634644, 0.5187103748321533, 0.5663331151008606, 0.8748778700828552, -0.42593082785606384], feature_priority_bucket: [1.2375320196151733, 0.20146754384040833, -0.5448318123817444], feature_stab: [-1.2742946147918701, 1.4650120735168457], feature_effectiveness: [-3.4247872829437256, -1.2175953388214111, -1.2886701822280884, 0.2128150761127472, 1.735976219177246, 3.408691883087158], feature_pp_bucket: [-0.11865946650505066, -0.6944136619567871, 0.2851082384586334, 0.3905462920665741, -0.2153719812631607], feature_user_hp: [-0.02190558612346649, 1.3947912454605103, 1.2057231664657593, 1.9050040245056152, -0.8893003463745117], feature_target_hp: [0.01696738600730896, 0.5267454981803894, 0.7864418625831604, 0.7004057168960571, -0.029485192149877548], feature_user_status: [0.1560140699148178, 0.7457111477851868, 0.15396693348884583, -0.5681735873222351, 3.281937599182129, 0.4151456952095032], feature_target_status: [0.3586578369140625, 1.350661277770996, -0.1345517337322235, 0.52248615026474, -0.9517130851745605, 0.3747033476829529], feature_speed_relation: [0.5106448531150818, 0.516150712966919, 0.06722567230463028], feature_can_ko: [0.5549777150154114, 0.0016230909386649728], feature_damage_fraction: [0.5681433081626892, 0.002623017178848386, 0.0020642804447561502, -0.0047552273608744144, -0.0051468550227582455], feature_first_turn: [0.011008105240762234, 1.045514702796936], feature_weather: [0.6473346948623657, -0.032593030482530594, -1.549005150794983, -0.2663560211658478, -0.18084542453289032], feature_stage_summary: [-0.006574877072125673, -0.016624297946691513, 0.5273690223693848, -0.005455343518406153, -0.003575335256755352], pair_effectiveness_move_role: [[-3.331880807876587, -0.9829288125038147, 0.7983090877532959, -0.06934159249067307, 0.671254575252533, 0.0699358582496643, -0.005641005001962185, -0.0018700252985581756, -0.13888542354106903, 1.0956956148147583, -1.8449007272720337, -0.42520612478256226, 0.7324392199516296], [-2.8687474727630615, 0.6764060854911804, 0.28626808524131775, -0.07157332450151443, 0.49766412377357483, -0.1933371126651764, 0.4489181637763977, 0.0031219276133924723, 0.7774585485458374, 0.3282071053981781, -0.05500657856464386, 1.891210675239563, 1.674709439277649], [-2.807907819747925, 0.8943276405334473, -0.39613255858421326, -1.7592971324920654, 2.364185094833374, 1.3615518808364868, -0.48945286870002747, -0.22751551866531372, -0.14401297271251678, -0.13883808255195618, -4.753874778747559, 2.4919614791870117, -0.036064594984054565], [1.2514766454696655, -0.7503920197486877, -0.5321549773216248, -0.14836899936199188, -0.6703929305076599, -0.27007922530174255, -1.0111567974090576, 0.4154353141784668, -1.5884926319122314, -0.3630835711956024, 2.8948793411254883, -0.3729524612426758, -0.6640450954437256], [3.5129494667053223, -0.5938210487365723, -0.9598425626754761, -0.440610408782959, -1.242587924003601, -0.6141106486320496, -0.7631204724311829, 0.6853963136672974, 27308951757731847e-21, -0.015282087959349155, 0.0056548831053078175, 0.5195441246032715, -1.661752462387085], [4.301400661468506, -0.9558373689651489, -0.2233603447675705, -0.32361456751823425, -0.30248215794563293, -0.27678027749061584, 3.2232813835144043, 0.37618693709373474, 0.013384898193180561, -0.00448794849216938, -0.0102256890386343, 0.9717738628387451, -0.957319974899292]], pair_user_hp_move_role: [[0.013454992324113846, 0.018964003771543503, 0.024664511904120445, 0.0013004037318751216, 0.00828567799180746, 0.005840170197188854, -0.005610371474176645, -0.003419991582632065, -0.017189867794513702, -0.0017467697616666555, 0.0069775632582604885, 0.005459117237478495, 0.016415417194366455], [-0.47976231575012207, -1.8270999193191528, -1.1768988370895386, -2.0252792835235596, 1.991111159324646, 1.4437183141708374, -3.6164658069610596, -1.737440824508667, -0.9178939461708069, 0.11726702004671097, 6.122781753540039, 0.7715112566947937, -1.0730208158493042], [0.5483452081680298, -1.834204077720642, -0.5319105982780457, -1.8983056545257568, 2.4455785751342773, 0.5719321966171265, 0.039221685379743576, -0.9252805113792419, -1.039324402809143, 0.47242364287376404, -0.45941099524497986, 0.6102619171142578, -0.27353131771087646], [0.6337162256240845, 0.13537059724330902, -0.7056121826171875, -1.0037603378295898, -0.023867139592766762, 0.24515019357204437, -0.4112441837787628, 0.15617917478084564, -0.9454573392868042, 0.1304420381784439, 1.1116626262664795, 0.4601121246814728, -0.30999305844306946], [0.24131542444229126, 0.7256495952606201, 0.2075936645269394, 0.8650228381156921, -2.3335580825805664, -0.8002111911773682, 0.2874688506126404, 1.71638023853302, -0.8132908344268799, -0.10280373692512512, -0.935814380645752, 0.23462891578674316, -0.2250274121761322]], pair_target_hp_can_ko: [[-0.008495630696415901, -0.0036882644053548574], [0.5293101668357849, 0.016678249463438988], [0.7773789763450623, 5051222979091108e-19], [0.6792945861816406, 0.011971861124038696], [-0.03270118683576584, -0.007675062865018845]], pair_speed_relation_can_ko: [[0.4977424740791321, -0.004437711555510759], [0.5253251791000366, 0.010918241925537586], [0.0628318190574646, 0.00874526146799326]], pair_target_status_move_role: [[0.1137440949678421, 2.2417361736297607, -0.6861361265182495, -2.2588441371917725, -0.031739670783281326, -1.225771427154541, -1.7521556615829468, -0.26540663838386536, -1.386101245880127, -0.4714847803115845, 2.347980499267578, 0.22988958656787872, -0.870908260345459], [0.9897293448448181, -2.871452569961548, 0.1633831113576889, -0.01740473508834839, 0.9722685813903809, 1.3959800004959106, 1.2160992622375488, 1.5364956855773926, 0.04271968454122543, -0.012942390516400337, -5.554874897003174, 0.7988201379776001, -0.6005284190177917], [-0.25992560386657715, -2.6575427055358887, -0.642654538154602, 3.9184982776641846, -0.05851717293262482, 0.2353348433971405, -0.14368607103824615, -0.1434323638677597, -0.1339750438928604, -2.2624595165252686, -0.48735466599464417, 0.3345026969909668, 0.3649730384349823], [0.4381351172924042, -1.920079231262207, 0.3972680866718292, 0.01872064359486103, 0.8139322400093079, 2.348439931869507, -1.343490481376648, 0.00764625845476985, 0.6518653035163879, 0.4241996109485626, -0.9505031704902649, -0.05263266712427139, 0.5379713773727417], [0.8212105631828308, -2.8625190258026123, 0.7896077632904053, 0.0753265991806984, -0.8536520004272461, -0.33245307207107544, 0.28978025913238525, 0.6039310097694397, 0.6432071328163147, 1.9506382942199707, 0.9918038845062256, 3.0966713428497314, -0.010769348591566086], [0.9886324405670166, -0.014513467438519001, -0.6665393710136414, -0.1316724568605423, -1.2372523546218872, 2.3375673294067383, 0.0364578440785408, 0.002674381947144866, -0.04183468967676163, -0.010570415295660496, -0.017826266586780548, -0.01779479905962944, 0.4514084458351135]] } };

// public/policies/v1-100m.json
var v1_100m_default = { asset_version: 1, policy_id: "v1-100m", schema_version: "gen3-lut-v1", checkpoint_decisions: 1e8, simulator: { format: "gen3customgame", pokemon_showdown_commit: "2ddfa0476f8207e12e204b1c69f7c7683b17633c" }, inference: "float32-additive-lut-argmax", switch_logits: "neutral-zero-v1", parameter_count: 349, feature_sizes: { action_slot: 4, move_role: 13, move_type: 18, damage_class: 3, power_bucket: 5, accuracy_bucket: 5, priority_bucket: 3, stab: 2, effectiveness: 6, pp_bucket: 5, user_hp: 5, target_hp: 5, user_status: 6, target_status: 6, speed_relation: 3, can_ko: 2, damage_fraction: 5, first_turn: 2, weather: 5, stage_summary: 5 }, pair_specs: [["effectiveness", "move_role"], ["user_hp", "move_role"], ["target_hp", "can_ko"], ["speed_relation", "can_ko"], ["target_status", "move_role"]], tables: { action_bias: [0.17754095792770386, 0.04978908598423004, 0.10321044921875, -0.025979571044445038], feature_action_slot: [0.13068640232086182, 0.04909740015864372, 0.11348044872283936, -0.030869783833622932], feature_move_role: [0.4002712070941925, -0.6427052617073059, -0.9753023982048035, -1.1525821685791016, 0.6734837889671326, 0.7309113144874573, -1.6791499853134155, 0.817319929599762, -2.249279499053955, -0.7804632186889648, 1.698943018913269, 1.1666357517242432, -1.0157406330108643], feature_move_type: [0.5859476923942566, 1.3713655471801758, 1.1664234399795532, 1.9797054529190063, -0.3925446569919586, -1.6221342086791992, 1.7801873683929443, 0.055050820112228394, -4.124271392822266, 1.791339635848999, -1.5820331573486328, 0.2403651475906372, 1.1503413915634155, -4.252599716186523, 3.9443609714508057, -1.4311732053756714, 3.7716715335845947, 1.857556700706482], feature_damage_class: [-0.26346272230148315, 1.3964207172393799, -0.8592237830162048], feature_power_bucket: [-0.8701242804527283, -1.6662120819091797, 2.187875270843506, 1.5754963159561157, -1.0801348686218262], feature_accuracy_bucket: [-0.6003134250640869, 0.9187895059585571, 0.5665502548217773, 1.1762754917144775, -0.6380662322044373], feature_priority_bucket: [1.8603273630142212, 0.014256251975893974, -0.5958872437477112], feature_stab: [-1.6193339824676514, 1.8356846570968628], feature_effectiveness: [-4.598597526550293, -1.113398551940918, -1.4296938180923462, 0.16315028071403503, 2.1857450008392334, 3.860628843307495], feature_pp_bucket: [-0.12856793403625488, -0.8271579742431641, -0.14789675176143646, 0.5580487847328186, -0.09228851646184921], feature_user_hp: [-0.02190558612346649, 2.3265020847320557, 1.9165233373641968, 2.285299062728882, -1.2867507934570312], feature_target_hp: [0.01696738600730896, 0.6230683922767639, 0.7194682955741882, 0.6615052223205566, 0.005959718022495508], feature_user_status: [0.07451312243938446, 1.1918270587921143, 0.1350022852420807, -0.6600607633590698, 4.593545913696289, 0.20153503119945526], feature_target_status: [0.4860801100730896, 1.2412631511688232, 0.03732987493276596, 0.63938307762146, -1.9527500867843628, 1.232764482498169], feature_speed_relation: [0.4067949056625366, 0.2566028833389282, 0.28555506467819214], feature_can_ko: [0.5711500644683838, 0.0016230909386649728], feature_damage_fraction: [0.584315299987793, 0.002623017178848386, 0.0020642804447561502, -0.0047552273608744144, -0.0051468550227582455], feature_first_turn: [0.14645184576511383, 0.8528578877449036], feature_weather: [0.817773163318634, -0.1607966274023056, -3.013944387435913, -1.0185331106185913, -0.554323673248291], feature_stage_summary: [-0.006574877072125673, -0.016624297946691513, 0.5435433387756348, -0.005455343518406153, -0.003575335256755352], pair_effectiveness_move_role: [[-4.278677463531494, -2.3596489429473877, 1.7118195295333862, -0.2671288847923279, 0.7094172835350037, 0.15379659831523895, -0.005641005001962185, -0.0018700252985581756, 0.48612305521965027, 1.1351404190063477, -2.0224905014038086, -0.1427106261253357, 0.7291095852851868], [-4.012463092803955, 0.9973447322845459, 0.46608951687812805, 0.3323530852794647, 0.30429649353027344, -0.4117613136768341, 0.6686204671859741, 0.0031219276133924723, 1.7262773513793945, 0.46177735924720764, -0.23607520759105682, 2.8055508136749268, 2.8796424865722656], [-3.4366278648376465, 0.657885730266571, -0.1389348804950714, -2.443127393722534, 3.276646375656128, 1.9168435335159302, -0.8250811696052551, -2.9309115409851074, -0.44043779373168945, 0.030886700376868248, -6.899886131286621, 2.7232303619384766, 0.01712188683450222], [1.6959254741668701, -0.9797708988189697, -0.7820866703987122, -0.5091851949691772, -1.0386441946029663, -0.34612128138542175, -1.2230168581008911, 0.8359497785568237, -2.224135637283325, -0.5528433918952942, 3.781893253326416, -0.3254215121269226, -1.1621981859207153], [4.406904220581055, -0.2487456500530243, -2.3588943481445312, -0.18411166965961456, -1.0758534669876099, -0.6328510046005249, -1.9771076440811157, 1.3157267570495605, 27308951757731847e-21, -0.015282087959349155, 0.0056548831053078175, 0.32544973492622375, -2.777653217315674], [5.40808629989624, -1.1492010354995728, -0.4812449812889099, -0.06371931731700897, -0.7631221413612366, -0.9700101017951965, 5.795470237731934, -0.21440035104751587, 0.013384898193180561, -0.00448794849216938, -0.0102256890386343, 1.7498339414596558, -1.9040380716323853]], pair_user_hp_move_role: [[0.013454992324113846, 0.018964003771543503, 0.024664511904120445, 0.0013004037318751216, 0.00828567799180746, 0.005840170197188854, -0.005610371474176645, -0.003419991582632065, -0.017189867794513702, -0.0017467697616666555, 0.0069775632582604885, 0.005459117237478495, 0.016415417194366455], [0.17680826783180237, -2.8716814517974854, -1.765248417854309, -3.2577879428863525, 2.088529109954834, 2.7555105686187744, -3.9400203227996826, -7.0475287437438965, -1.8418772220611572, 0.587893545627594, 8.232658386230469, 0.7473909258842468, -2.3165831565856934], [0.6635890603065491, -2.5594265460968018, -0.8021259307861328, -3.1606035232543945, 3.3063135147094727, 0.730048418045044, 0.4165860712528229, -1.5200843811035156, -1.8100230693817139, 0.5619098544120789, -0.15054839849472046, 1.399099588394165, -1.2402485609054565], [-0.24466177821159363, 0.03687075525522232, -0.7175334692001343, -1.4447463750839233, 0.45894572138786316, 0.18573442101478577, 0.0010156482458114624, 0.29325589537620544, -1.4898011684417725, 0.3484233021736145, 0.10758746415376663, 0.8369368314743042, 0.9295154213905334], [0.4187774360179901, 1.1027590036392212, 0.2639801800251007, 1.1891709566116333, -3.232757091522217, -1.3098838329315186, -0.22241497039794922, 2.3866500854492188, -0.5650798082351685, -0.10686306655406952, -0.7212498784065247, 0.015154468826949596, -0.40923798084259033]], pair_target_hp_can_ko: [[-0.008495630696415901, -0.0036882644053548574], [0.6256330609321594, 0.016678249463438988], [0.7104054093360901, 5051222979091108e-19], [0.6403940916061401, 0.011971861124038696], [0.002743862569332123, -0.007675062865018845]], pair_speed_relation_can_ko: [[0.39389103651046753, -0.004437711555510759], [0.2657754421234131, 0.010918241925537586], [0.2811613976955414, 0.00874526146799326]], pair_target_status_move_role: [[-0.22941400110721588, 2.7470755577087402, -0.8677730560302734, -3.2516510486602783, 0.40747347474098206, -1.4198298454284668, -2.052565574645996, -0.6106168627738953, -1.7904448509216309, -0.6198873519897461, 2.632401943206787, 0.5611081123352051, -0.7589726448059082], [1.1830450296401978, -3.4571878910064697, -0.3171294629573822, 0.05827287957072258, 0.842963695526123, 1.7278205156326294, 1.3594837188720703, 2.1351258754730225, 1.600380301475525, -0.012942390516400337, -6.63192892074585, 0.9813371300697327, -0.3533027470111847], [0.19794267416000366, -4.326460838317871, -1.569766640663147, 4.912319183349609, -0.49521565437316895, 0.3373348116874695, -0.47642168402671814, 0.6023557186126709, -0.3598681092262268, -5.090665817260742, 0.537717878818512, 0.8691638112068176, -0.32635971903800964], [0.8162270188331604, -2.3753740787506104, 0.7401971220970154, -0.14874614775180817, 1.2031792402267456, 2.965980291366577, -1.4210838079452515, 0.10004593431949615, 0.9835676550865173, 0.7773482203483582, -1.1724854707717896, -0.5067663192749023, 0.7534645199775696], [1.599754810333252, -4.292534351348877, 1.2394574880599976, -0.01161168236285448, -0.7259389162063599, -0.8872746229171753, -0.8020590543746948, 0.37100622057914734, 1.7743330001831055, 4.0858893394470215, 1.8809020519256592, 3.8642196655273438, -0.9747607111930847], [1.7324525117874146, -0.014513467438519001, -0.732417643070221, -0.16563622653484344, -1.763842225074768, 1.9807664155960083, -0.857376754283905, 0.002674381947144866, -0.042937107384204865, -0.010570415295660496, -0.002432169858366251, -0.01779479905962944, 1.3074061870574951]] } };

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
  ({ BattleStream, getPlayerStreams } = runtime("../vendor/pokemon-showdown/dist/sim/battle-stream"));
  ({ Dex } = runtime("../vendor/pokemon-showdown/dist/sim/dex"));
}
function loadPolicies() {
  return {
    "v1-10m": v1_10m_default,
    "v1-50m": v1_50m_default,
    "v1-100m": v1_100m_default
  };
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
