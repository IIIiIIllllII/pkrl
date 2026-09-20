import type {PolicyAsset} from '../types.ts'
import {FEATURE_INDEX, FEATURE_NAMES, PAIR_SPECS, SCHEMA_VERSION} from './schema.ts'

function at(table: number[] | number[][], ...indices: number[]): number {
  let value: unknown = table
  for (const index of indices) value = (value as unknown[])[index]
  return value as number
}

export function validatePolicy(asset: PolicyAsset): void {
  if (asset.schema_version !== SCHEMA_VERSION) throw new Error(`unsupported policy schema ${asset.schema_version}`)
  if (asset.parameter_count !== 349) throw new Error(`expected 349 LUT parameters, got ${asset.parameter_count}`)
  if (!asset.tables.action_bias) throw new Error('policy is missing action_bias')
}

export function policyScores(asset: PolicyAsset, features: number[][], mask: boolean[]): Array<number | null> {
  validatePolicy(asset)
  const scores: Array<number | null> = Array(9).fill(0)
  for (let action = 0; action < 4; action++) {
    let score = at(asset.tables.action_bias, action)
    FEATURE_NAMES.forEach((name, column) => { score = Math.fround(score + at(asset.tables[`feature_${name}`], features[action][column])) })
    PAIR_SPECS.forEach(([a, b]) => { score = Math.fround(score + at(asset.tables[`pair_${a}_${b}`], features[action][FEATURE_INDEX[a]], features[action][FEATURE_INDEX[b]])) })
    scores[action] = score
  }
  return scores.map((score, index) => mask[index] ? score : null)
}

export function selectTop1(scores: Array<number | null>): number {
  let best = -1; let bestScore = -Infinity
  scores.forEach((score, index) => { if (score != null && score > bestScore) { best = index; bestScore = score } })
  if (best < 0) throw new Error('state has no legal action')
  return best
}
