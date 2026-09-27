export const SCHEMA_VERSION = 'gen3-lut-v1.1'
export const SEMANTICS_REVISION = '2026-09-27-reboot'
export const PARAMETER_COUNT = 349
export const MOVE_ACTIONS = 4
export const MAX_ACTIONS = 9

export const FEATURE_NAMES = [
  'action_slot', 'move_role', 'move_type', 'damage_class', 'power_bucket', 'accuracy_bucket',
  'priority_bucket', 'stab', 'effectiveness', 'pp_bucket', 'user_hp', 'target_hp', 'user_status',
  'target_status', 'speed_relation', 'can_ko', 'damage_fraction', 'first_turn', 'weather', 'stage_summary',
] as const
export type FeatureName = (typeof FEATURE_NAMES)[number]

export const FEATURE_VALUES: Record<FeatureName, readonly string[]> = {
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

export const FEATURE_INDEX = Object.fromEntries(FEATURE_NAMES.map((name, index) => [name, index])) as Record<FeatureName, number>
export const PAIR_SPECS: [FeatureName, FeatureName][] = [
  ['effectiveness', 'move_role'], ['user_hp', 'move_role'], ['target_hp', 'can_ko'],
  ['speed_relation', 'can_ko'], ['target_status', 'move_role'],
]

/**
 * Table names in the exact order `gen3rl.export.lut.collect` emits them. The
 * order fixes every global LUT parameter index, so the ROM LUT, the Python
 * reference and this module all address the same 349 bytes.
 */
export const TABLE_ORDER: string[] = [
  'action_bias',
  ...FEATURE_NAMES.map(name => `feature_${name}`),
  ...PAIR_SPECS.map(([a, b]) => `pair_${a}_${b}`),
]

export interface TableOffset {offset: number; shape: number[]}

export function tableShape(name: string): number[] {
  if (name === 'action_bias') return [MOVE_ACTIONS]
  if (name.startsWith('feature_')) return [FEATURE_VALUES[name.slice('feature_'.length) as FeatureName].length]
  const pair = PAIR_SPECS.find(([a, b]) => `pair_${a}_${b}` === name)
  if (!pair) throw new Error(`unknown LUT table ${name}`)
  return [FEATURE_VALUES[pair[0]].length, FEATURE_VALUES[pair[1]].length]
}

/** Canonical global offsets, derived from the schema rather than trusted input. */
export function tableOffsets(): Record<string, TableOffset> {
  const offsets: Record<string, TableOffset> = {}
  let cursor = 0
  for (const name of TABLE_ORDER) {
    const shape = tableShape(name)
    offsets[name] = {offset: cursor, shape}
    cursor += shape.reduce((product, value) => product * value, 1)
  }
  return offsets
}

export const TABLE_OFFSETS = tableOffsets()
export const TOTAL_PARAMETERS = TABLE_ORDER.reduce((sum, name) => sum + tableShape(name).reduce((a, b) => a * b, 1), 0)
