import type {PolicyAsset} from '../types'
import {validatePolicy} from './inference'

export const POLICY_IDS = ['v1-10m', 'v1-50m', 'v1-100m'] as const
const cache = new Map<string, PolicyAsset>()

export async function loadPolicy(policyId: string): Promise<PolicyAsset> {
  if (cache.has(policyId)) return cache.get(policyId)!
  if (!(POLICY_IDS as readonly string[]).includes(policyId)) throw new Error(`unknown policy ${policyId}`)
  const response = await fetch(`/policies/${policyId}.json`)
  if (!response.ok) throw new Error(`could not load policy ${policyId}`)
  const asset = await response.json() as PolicyAsset
  validatePolicy(asset)
  if (asset.policy_id !== policyId) throw new Error('policy ID does not match its asset path')
  cache.set(policyId, asset)
  return asset
}
