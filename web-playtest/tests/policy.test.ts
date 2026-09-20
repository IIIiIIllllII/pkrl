import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'
import type {PolicyAsset} from '../src/types'
import {encodeRequest} from '../src/policy/encoder'
import {policyScores, selectTop1, validatePolicy} from '../src/policy/inference'

const fixtures = JSON.parse(readFileSync(new URL('../public/parity-fixtures.json', import.meta.url), 'utf8'))
const policies = Object.fromEntries(['v1-10m', 'v1-50m', 'v1-100m'].map(id => [id, JSON.parse(readFileSync(new URL(`../public/policies/${id}.json`, import.meta.url), 'utf8')) as PolicyAsset]))

describe('frozen LUT parity', () => {
  it('loads all compact policy assets with compatible metadata', () => {
    for (const [id, policy] of Object.entries(policies)) {
      expect(() => validatePolicy(policy)).not.toThrow()
      expect(policy.policy_id).toBe(id); expect(policy.parameter_count).toBe(349)
      expect(policy.simulator.pokemon_showdown_commit).toBe('2ddfa0476f8207e12e204b1c69f7c7683b17633c')
    }
  })

  for (const fixture of fixtures.fixtures) {
    it(`matches Python features, mask, float scores, and top-1: ${fixture.name}`, () => {
      const encoded = encodeRequest(fixture.request)
      expect(encoded.features).toEqual(fixture.features); expect(encoded.mask).toEqual(fixture.legal_mask)
      for (const [id, policy] of Object.entries(policies)) {
        const actual = policyScores(policy, encoded.features, encoded.mask)
        fixture.expected[id].scores.forEach((expected: number | null, index: number) => {
          if (expected == null) expect(actual[index]).toBeNull()
          else expect(actual[index]).toBeCloseTo(expected, 5)
        })
        expect(selectTop1(actual)).toBe(fixture.expected[id].selected_action)
      }
    })
  }

  it('masks disabled moves and preserves forced-switch legality', () => {
    const fixture = fixtures.fixtures.find((value: any) => value.name === 'forced switch')
    const {mask} = encodeRequest(fixture.request)
    expect(mask).toEqual([false, false, false, false, true, true, false, false, false])
    const scores = policyScores(policies['v1-100m'], fixture.features, mask)
    expect(scores.slice(0, 4)).toEqual([null, null, null, null]); expect(selectTop1(scores)).toBe(4)
  })
})
