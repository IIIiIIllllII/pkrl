import type {PolicyAsset, PolicyProvenance} from '../types'
import {assertCleanCheckpointPolicy, CLEAN_POLICY_IDS} from './inference'

/** The only checkpoints normal playtesting may select. */
export const POLICY_IDS = CLEAN_POLICY_IDS
export type PolicyId = (typeof POLICY_IDS)[number]

/** IDs of the contaminated historical generation, kept only to reject them. */
export const QUARANTINED_POLICY_IDS = ['v1-10m', 'v1-50m', 'v1-100m'] as const

const cache = new Map<string, PolicyAsset>()

export function isCleanPolicyId(policyId: string): policyId is PolicyId {
  return (POLICY_IDS as readonly string[]).includes(policyId)
}

export async function loadPolicy(policyId: string): Promise<PolicyAsset> {
  if (cache.has(policyId)) return cache.get(policyId)!
  if ((QUARANTINED_POLICY_IDS as readonly string[]).includes(policyId)) {
    throw new Error(`policy ${policyId} belongs to the contaminated gen3-lut-v1 generation and is quarantined`)
  }
  if (!isCleanPolicyId(policyId)) throw new Error(`unknown policy ${policyId}`)
  const response = await fetch(`/policies/${policyId}.json`)
  if (!response.ok) throw new Error(`could not load policy ${policyId}`)
  const asset = await response.json() as PolicyAsset
  assertCleanCheckpointPolicy(asset)
  if (asset.policy_id !== policyId) throw new Error('policy ID does not match its asset path')
  cache.set(policyId, asset)
  return asset
}

export function policyProvenance(asset: PolicyAsset): PolicyProvenance {
  return {
    policy_id: asset.policy_id,
    schema_version: asset.schema_version,
    semantics_revision: asset.semantics_revision,
    generation: asset.generation,
    checkpoint_decisions: asset.checkpoint_decisions,
    milestone_decisions: asset.checkpoint?.milestone_decisions,
    checkpoint_sha256: asset.checkpoint?.sha256,
    parameter_count: asset.parameter_count,
    quantization_mode: asset.quantization?.mode,
    quantization_scale: asset.quantization?.scale,
    project_commit: asset.source?.project_commit as string | undefined,
    pokemon_showdown_commit: asset.simulator.pokemon_showdown_commit,
    evaluation: asset.evaluation ?? null,
  }
}
