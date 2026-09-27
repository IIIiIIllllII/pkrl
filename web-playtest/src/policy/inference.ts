import type {LutContribution, PolicyAsset, ScoreRanking} from '../types'
import {
  FEATURE_INDEX, FEATURE_NAMES, FEATURE_VALUES, MAX_ACTIONS, MOVE_ACTIONS, PAIR_SPECS,
  PARAMETER_COUNT, SCHEMA_VERSION, SEMANTICS_REVISION, TABLE_OFFSETS, TABLE_ORDER, tableShape,
} from './schema'

/** Policy IDs the human playtest is allowed to run. Contaminated v1 is absent. */
export const CLEAN_POLICY_IDS = ['v1.1-20m', 'v1.1-50m', 'v1.1-100m'] as const
export type CleanPolicyId = (typeof CLEAN_POLICY_IDS)[number]
const EXPECTED_MILESTONE: Record<string, number> = {'v1.1-20m': 20_000_000, 'v1.1-50m': 50_000_000, 'v1.1-100m': 100_000_000}
export const PINNED_SHOWDOWN_COMMIT = '2ddfa0476f8207e12e204b1c69f7c7683b17633c'

function at(table: number[] | number[][], ...indices: number[]): number {
  let value: unknown = table
  for (const index of indices) value = (value as unknown[])[index]
  if (typeof value !== 'number') throw new Error('LUT table index is out of range')
  return value
}

/** Structural validation: only gen3-lut-v1.1 additive LUTs with 349 parameters. */
export function validatePolicy(asset: PolicyAsset, expectedSchema = SCHEMA_VERSION): void {
  if (asset.schema_version !== expectedSchema) throw new Error(`unsupported policy schema ${asset.schema_version}; expected ${expectedSchema}`)
  if (asset.parameter_count !== PARAMETER_COUNT) throw new Error(`expected ${PARAMETER_COUNT} LUT parameters, got ${asset.parameter_count}`)
  let total = 0
  for (const name of TABLE_ORDER) {
    const table = asset.tables[name]
    if (!table) throw new Error(`policy is missing ${name}`)
    const shape = tableShape(name)
    if (shape.length === 1) {
      if (!Array.isArray(table) || table.length !== shape[0]) throw new Error(`${name} has the wrong shape`)
    } else {
      if (!Array.isArray(table) || table.length !== shape[0]) throw new Error(`${name} has the wrong shape`)
      for (const row of table as number[][]) if (!Array.isArray(row) || row.length !== shape[1]) throw new Error(`${name} has the wrong shape`)
    }
    total += shape.reduce((a, b) => a * b, 1)
  }
  if (total !== PARAMETER_COUNT) throw new Error(`LUT tables hold ${total} parameters; expected ${PARAMETER_COUNT}`)
}

/**
 * Everything a frozen clean checkpoint asset must prove before a human plays
 * against it. Contaminated gen3-lut-v1 assets fail on `schema_version` alone,
 * and this also rejects an asset whose declared offsets disagree with the
 * canonical schema layout.
 */
export function assertCleanCheckpointPolicy(asset: PolicyAsset): void {
  validatePolicy(asset)
  if (asset.generation !== 'clean-v1.1') throw new Error(`policy ${asset.policy_id} is not a clean-v1.1 asset`)
  if (asset.contaminated !== false) throw new Error(`policy ${asset.policy_id} is flagged contaminated`)
  if (asset.semantics_revision !== SEMANTICS_REVISION) throw new Error(`policy ${asset.policy_id} predates audited v1.1 semantics`)
  if (!(CLEAN_POLICY_IDS as readonly string[]).includes(asset.policy_id)) throw new Error(`policy ${asset.policy_id} is not a permitted playtest checkpoint`)
  if (asset.simulator.pokemon_showdown_commit !== PINNED_SHOWDOWN_COMMIT) throw new Error(`policy ${asset.policy_id} was not trained against the pinned simulator`)
  const milestone = EXPECTED_MILESTONE[asset.policy_id]
  if (asset.checkpoint?.milestone_decisions !== milestone) throw new Error(`policy ${asset.policy_id} does not come from the ${milestone} decision milestone`)
  if (!(asset.checkpoint_decisions >= milestone)) throw new Error(`policy ${asset.policy_id} reports fewer than ${milestone} training decisions`)
  if (!/^[0-9a-f]{64}$/.test(asset.checkpoint?.sha256 || '')) throw new Error(`policy ${asset.policy_id} has no source checkpoint digest`)
  for (const [name, declared] of Object.entries(asset.table_offsets || {})) {
    const canonical = TABLE_OFFSETS[name]
    if (!canonical) throw new Error(`policy ${asset.policy_id} declares unknown table ${name}`)
    if (canonical.offset !== declared.offset || canonical.shape.join('x') !== declared.shape.join('x')) {
      throw new Error(`policy ${asset.policy_id} table ${name} disagrees with the canonical LUT layout`)
    }
  }
  if (asset.quantization) {
    if (asset.quantization.mode !== 'int8-symmetric-max-abs') throw new Error(`policy ${asset.policy_id} uses an unknown quantization mode`)
    if (!(asset.quantization.scale > 0)) throw new Error(`policy ${asset.policy_id} has a non-positive quantization scale`)
    if (asset.quantization.bytes !== PARAMETER_COUNT) throw new Error(`policy ${asset.policy_id} quantizes to ${asset.quantization.bytes} bytes; expected ${PARAMETER_COUNT}`)
  }
}

/**
 * Float32 additive LUT scores, accumulated in the same term order as
 * `gen3rl.policy.lut.NumpyLUTActor.logits`. `Math.fround` reproduces NumPy's
 * float32 rounding at every step, so the browser and Python agree bit-for-bit.
 */
export function policyScores(asset: PolicyAsset, features: number[][], mask: boolean[]): Array<number | null> {
  validatePolicy(asset)
  const scores: Array<number | null> = Array(MAX_ACTIONS).fill(0)
  for (let action = 0; action < MOVE_ACTIONS; action++) {
    let score = at(asset.tables.action_bias, action)
    FEATURE_NAMES.forEach((name, column) => { score = Math.fround(score + at(asset.tables[`feature_${name}`], features[action][column])) })
    PAIR_SPECS.forEach(([a, b]) => { score = Math.fround(score + at(asset.tables[`pair_${a}_${b}`], features[action][FEATURE_INDEX[a]], features[action][FEATURE_INDEX[b]])) })
    scores[action] = score
  }
  return scores.map((score, index) => mask[index] ? score : null)
}

/**
 * Integer scores from the frozen int8 LUT, matching
 * `gen3rl.export.lut.integer_score` and the generated ROM scorer: an int32
 * accumulator saturated into int16.
 */
export function quantizedScores(asset: PolicyAsset, features: number[][], mask: boolean[]): Array<number | null> {
  validatePolicy(asset)
  const tables = asset.quantization?.tables
  if (!tables) throw new Error(`policy ${asset.policy_id} ships no quantized LUT`)
  // Switch actions keep the neutral zero integer logit that the reference and
  // the ROM scorer both use; only move slots come out of the LUT.
  const scores: Array<number | null> = Array(MAX_ACTIONS).fill(0)
  for (let action = 0; action < MOVE_ACTIONS; action++) {
    let score = at(tables.action_bias, action)
    FEATURE_NAMES.forEach((name, column) => { score += at(tables[`feature_${name}`], features[action][column]) })
    PAIR_SPECS.forEach(([a, b]) => { score += at(tables[`pair_${a}_${b}`], features[action][FEATURE_INDEX[a]], features[action][FEATURE_INDEX[b]]) })
    scores[action] = Math.min(32767, Math.max(-32768, score))
  }
  return scores.map((score, index) => mask[index] ? score : null)
}

/** Global LUT parameter indices whose sum is this action's score. */
export function activatedFeatureIds(row: number[], slot: number): number[] {
  const ids = [TABLE_OFFSETS.action_bias.offset + slot]
  FEATURE_NAMES.forEach((name, column) => ids.push(TABLE_OFFSETS[`feature_${name}`].offset + row[column]))
  for (const [a, b] of PAIR_SPECS) {
    const width = FEATURE_VALUES[b].length
    ids.push(TABLE_OFFSETS[`pair_${a}_${b}`].offset + row[FEATURE_INDEX[a]] * width + row[FEATURE_INDEX[b]])
  }
  return ids
}

/** Per-term LUT contributions in accumulation order; they sum to the score. */
export function scoreContributions(asset: PolicyAsset, row: number[], slot: number): LutContribution[] {
  const terms: LutContribution[] = [{
    term: 'action_bias', category: String(slot), value_id: slot,
    global_id: TABLE_OFFSETS.action_bias.offset + slot, weight: at(asset.tables.action_bias, slot),
  }]
  FEATURE_NAMES.forEach((name, column) => {
    const value = row[column]
    terms.push({
      term: `feature_${name}`, category: FEATURE_VALUES[name][value], value_id: value,
      global_id: TABLE_OFFSETS[`feature_${name}`].offset + value,
      weight: at(asset.tables[`feature_${name}`], value),
    })
  })
  for (const [a, b] of PAIR_SPECS) {
    const first = row[FEATURE_INDEX[a]]; const second = row[FEATURE_INDEX[b]]
    const width = FEATURE_VALUES[b].length
    terms.push({
      term: `pair_${a}_${b}`, category: `${FEATURE_VALUES[a][first]}/${FEATURE_VALUES[b][second]}`,
      value_id: first * width + second,
      global_id: TABLE_OFFSETS[`pair_${a}_${b}`].offset + first * width + second,
      weight: at(asset.tables[`pair_${a}_${b}`], first, second),
    })
  }
  return terms
}

/** First-maximum argmax over legal actions, matching NumPy `argmax` on a -inf mask. */
export function selectTop1(scores: Array<number | null>): number {
  let best = -1; let bestScore = -Infinity
  scores.forEach((score, index) => { if (score != null && score > bestScore) { best = index; bestScore = score } })
  if (best < 0) throw new Error('state has no legal action')
  return best
}

/** Top-1/top-2 scores, their indices, and the decision margin. */
export function rankScores(scores: Array<number | null>): ScoreRanking {
  const legal = scores.map((score, index) => ({index, score})).filter((entry): entry is {index: number; score: number} => entry.score != null)
  if (!legal.length) throw new Error('state has no legal action')
  const ordered = [...legal].sort((a, b) => b.score - a.score || a.index - b.index)
  const top1 = ordered[0]; const top2 = ordered[1]
  return {
    top1_index: selectTop1(scores), top1_score: top1.score,
    top2_index: top2 ? top2.index : null, top2_score: top2 ? top2.score : null,
    margin: top2 ? top1.score - top2.score : null, legal_count: legal.length,
  }
}
