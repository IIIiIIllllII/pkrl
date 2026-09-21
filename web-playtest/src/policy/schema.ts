export const SCHEMA_VERSION = 'gen3-lut-v1.1'
export const FEATURE_NAMES = [
  'action_slot', 'move_role', 'move_type', 'damage_class', 'power_bucket', 'accuracy_bucket',
  'priority_bucket', 'stab', 'effectiveness', 'pp_bucket', 'user_hp', 'target_hp', 'user_status',
  'target_status', 'speed_relation', 'can_ko', 'damage_fraction', 'first_turn', 'weather', 'stage_summary',
] as const

export const FEATURE_VALUES: Record<(typeof FEATURE_NAMES)[number], readonly string[]> = {
  action_slot: ['0', '1', '2', '3'],
  move_role: ['damage', 'status', 'setup', 'debuff', 'recovery', 'protect', 'weather', 'field', 'phaze', 'pivot', 'self_ko', 'fixed', 'utility'],
  move_type: ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'unknown'],
  damage_class: ['physical', 'special', 'status'], power_bucket: ['zero', '1_40', '41_70', '71_100', '101_plus'],
  accuracy_bucket: ['always', '1_70', '71_85', '86_99', '100'], priority_bucket: ['negative', 'zero', 'positive'],
  stab: ['no', 'yes'], effectiveness: ['immune', 'quarter', 'half', 'neutral', 'double', 'quadruple'],
  pp_bucket: ['empty', '1_4', '5_9', '10_19', '20_plus'],
  user_hp: ['fainted', 'quarter', 'half', 'three_quarters', 'full'], target_hp: ['fainted', 'quarter', 'half', 'three_quarters', 'full'],
  user_status: ['none', 'brn', 'par', 'psn', 'slp', 'frz'], target_status: ['none', 'brn', 'par', 'psn', 'slp', 'frz'],
  speed_relation: ['slower', 'tie', 'faster'], can_ko: ['no', 'yes'],
  damage_fraction: ['none', 'quarter', 'half', 'three_quarters', 'ko'], first_turn: ['no', 'yes'],
  weather: ['none', 'sun', 'rain', 'sand', 'hail'], stage_summary: ['minus2', 'minus1', 'zero', 'plus1', 'plus2'],
}

export const FEATURE_INDEX = Object.fromEntries(FEATURE_NAMES.map((name, index) => [name, index])) as Record<(typeof FEATURE_NAMES)[number], number>
export const PAIR_SPECS: [keyof typeof FEATURE_VALUES, keyof typeof FEATURE_VALUES][] = [
  ['effectiveness', 'move_role'], ['user_hp', 'move_role'], ['target_hp', 'can_ko'],
  ['speed_relation', 'can_ko'], ['target_status', 'move_role'],
]
