import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'
import type {PolicyAsset} from '../src/types'
import {encodeRequest, featureCategories} from '../src/policy/encoder'
import {classifyMove, resolveMoveSemantics} from '../src/policy/moveSemantics'
import {
  activatedFeatureIds, assertCleanCheckpointPolicy, CLEAN_POLICY_IDS, PINNED_SHOWDOWN_COMMIT,
  policyScores, quantizedScores, rankScores, scoreContributions, selectTop1, validatePolicy,
} from '../src/policy/inference'
import {POLICY_IDS, QUARANTINED_POLICY_IDS} from '../src/policy/assets'
import {SCHEMA_VERSION, SEMANTICS_REVISION, TABLE_OFFSETS, TOTAL_PARAMETERS} from '../src/policy/schema'

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const semanticsFixtures = read('./fixtures/v1-1-parity-fixtures.json')
const regression = read('./fixtures/v1-1-regression-fixtures.json')
const policyIndex = read('../public/policies/index.json')
const policies = Object.fromEntries(CLEAN_POLICY_IDS.map(id =>
  [id, read(`../public/policies/${id}.json`) as PolicyAsset])) as Record<string, PolicyAsset>
const quarantined = Object.fromEntries(QUARANTINED_POLICY_IDS.map(id =>
  [id, read(`../quarantine/contaminated-v1/${id}.json`) as PolicyAsset])) as Record<string, PolicyAsset>

const MILESTONES: Record<string, number> = {'v1.1-20m': 20_000_000, 'v1.1-50m': 50_000_000, 'v1.1-100m': 100_000_000}

describe('clean v1.1 policy assets', () => {
  it('exposes exactly the three clean checkpoints for playtesting', () => {
    expect([...POLICY_IDS]).toEqual(['v1.1-20m', 'v1.1-50m', 'v1.1-100m'])
    expect(policyIndex.generation).toBe('clean-v1.1')
    expect(policyIndex.schema_version).toBe(SCHEMA_VERSION)
    expect(policyIndex.excluded_contaminated_generations).toContain('gen3-lut-v1')
    expect(policyIndex.policies.map((entry: any) => entry.policy_id)).toEqual([...POLICY_IDS])
    expect(policyIndex.run_summary).toMatchObject({illegal_actions: 0, interrupted: false, workers: 24, device: 'cpu'})
  })

  it.each([...POLICY_IDS])('%s carries verifiable clean provenance', id => {
    const asset = policies[id]
    expect(() => assertCleanCheckpointPolicy(asset)).not.toThrow()
    expect(asset.schema_version).toBe(SCHEMA_VERSION)
    expect(asset.semantics_revision).toBe(SEMANTICS_REVISION)
    expect(asset.generation).toBe('clean-v1.1')
    expect(asset.contaminated).toBe(false)
    expect(asset.parameter_count).toBe(349)
    expect(asset.checkpoint?.milestone_decisions).toBe(MILESTONES[id])
    expect(asset.checkpoint_decisions).toBeGreaterThanOrEqual(MILESTONES[id])
    expect(asset.checkpoint?.file).toBe(`checkpoints/decision_${MILESTONES[id]}.pt`)
    expect(asset.checkpoint?.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(asset.checkpoint?.run_id).toBe(policyIndex.run_id)
    expect(asset.simulator).toEqual({format: 'gen3customgame', pokemon_showdown_commit: PINNED_SHOWDOWN_COMMIT})
    expect(asset.source?.project_commit).toMatch(/^[0-9a-f]{40}$/)
    expect(asset.source?.git_dirty).toBe(false)
    expect(asset.training).toMatchObject({illegal_actions: 0, workers: 24, device: 'cpu', run_interrupted: false})
    expect(asset.quantization?.mode).toBe('int8-symmetric-max-abs')
    expect(asset.quantization?.bytes).toBe(349)
    expect(asset.quantization?.scale).toBeGreaterThan(0)
  })

  it('agrees with the canonical 349-parameter LUT layout', () => {
    expect(TOTAL_PARAMETERS).toBe(349)
    for (const asset of Object.values(policies)) {
      expect(asset.table_offsets).toEqual(TABLE_OFFSETS)
      const floats = Object.values(asset.tables).flat(2).length
      const ints = Object.values(asset.quantization!.tables).flat(2).length
      expect(floats).toBe(349); expect(ints).toBe(349)
    }
  })

  it.each([...POLICY_IDS])('%s reports its recorded milestone evaluation', id => {
    const expected: Record<string, [number, number]> = {
      'v1.1-20m': [0.786, 0.616], 'v1.1-50m': [0.782, 0.622], 'v1.1-100m': [0.786, 0.638],
    }
    const evaluation = policies[id].evaluation as any
    expect(evaluation.vs_random.win_rate).toBeCloseTo(expected[id][0], 6)
    expect(evaluation.vs_damage.win_rate).toBeCloseTo(expected[id][1], 6)
    expect(evaluation.vs_random.illegal_actions).toBe(0)
    expect(evaluation.vs_damage.illegal_actions).toBe(0)
  })
})

describe('contaminated gen3-lut-v1 rejection', () => {
  it('keeps the old assets out of the served policy directory', () => {
    for (const id of QUARANTINED_POLICY_IDS) {
      expect(() => read(`../public/policies/${id}.json`)).toThrow()
    }
    expect(() => read('../public/parity-fixtures.json')).toThrow()
  })

  it.each([...QUARANTINED_POLICY_IDS])('refuses to validate quarantined %s', id => {
    const asset = quarantined[id]
    expect(asset.schema_version).toBe('gen3-lut-v1')
    expect(() => validatePolicy(asset)).toThrow(/unsupported policy schema gen3-lut-v1/)
    expect(() => assertCleanCheckpointPolicy(asset)).toThrow(/unsupported policy schema gen3-lut-v1/)
  })

  it('refuses to score with a contaminated asset even if the schema string is forged', () => {
    const forged = {...quarantined['v1-100m'], schema_version: SCHEMA_VERSION} as PolicyAsset
    expect(() => assertCleanCheckpointPolicy(forged)).toThrow(/not a clean-v1\.1 asset/)
  })

  it('never lists a contaminated ID as selectable', () => {
    for (const id of QUARANTINED_POLICY_IDS) expect(POLICY_IDS).not.toContain(id as never)
  })
})

describe('Python reference parity', () => {
  it('matches Python v1.1 features, masks, semantics, float scores and top-1', () => {
    const policy = semanticsFixtures.policy as PolicyAsset
    validatePolicy(policy)
    for (const fixture of semanticsFixtures.fixtures) {
      const encoded = encodeRequest(fixture.request)
      expect(fixture.request.public.target.types).toEqual(fixture.resolved_defender_types)
      expect(encoded.features).toEqual(fixture.features)
      expect(encoded.mask).toEqual(fixture.legal_mask)
      fixture.request.active[0].moves.forEach((move: any, index: number) => {
        expect(resolveMoveSemantics(move, fixture.resolved_defender_types, fixture.request.public.target.status)).toEqual({
          moveClass: fixture.move_semantics[index].move_class,
          applicable: fixture.move_semantics[index].applicable,
          effectivenessBucket: fixture.move_semantics[index].effectiveness_bucket,
        })
      })
      const scores = policyScores(policy, encoded.features, encoded.mask)
      fixture.scores.forEach((expected: number | null, index: number) => expected == null
        ? expect(scores[index]).toBeNull() : expect(scores[index]).toBeCloseTo(expected, 6))
      if (fixture.selected_action == null) expect(() => selectTop1(scores)).toThrow()
      else expect(selectTop1(scores)).toBe(fixture.selected_action)
      for (let slot = 0; slot < 4; slot++) {
        expect(activatedFeatureIds(encoded.features[slot], slot)).toEqual(fixture.activated_feature_ids[slot])
      }
    }
  })

  it('reproduces every real-checkpoint regression fixture exactly', () => {
    expect(regression.schema_version).toBe(SCHEMA_VERSION)
    expect(regression.policy_ids.sort()).toEqual([...POLICY_IDS].sort())
    expect(regression.fixtures.length).toBeGreaterThanOrEqual(21)
    for (const fixture of regression.fixtures) {
      const encoded = encodeRequest(fixture.request)
      expect(encoded.features, fixture.name).toEqual(fixture.features)
      expect(encoded.mask, fixture.name).toEqual(fixture.legal_mask)
      expect(fixture.request.public.target.types).toEqual(fixture.resolved_defender_types)
      for (const [id, policy] of Object.entries(policies)) {
        const expected = fixture.expected[id]
        const scores = policyScores(policy, encoded.features, encoded.mask)
        const integers = quantizedScores(policy, encoded.features, encoded.mask)
        expected.scores.forEach((value: number | null, index: number) => value == null
          ? expect(scores[index]).toBeNull()
          : expect(scores[index], `${fixture.name} ${id} float slot ${index}`).toBeCloseTo(value, 6))
        // Quantized inference is integer arithmetic: it must agree exactly.
        expect(integers, `${fixture.name} ${id} integer scores`).toEqual(expected.integer_scores)
        expect(selectTop1(scores), `${fixture.name} ${id} top1`).toBe(expected.selected_action)
        const ranking = rankScores(scores)
        expect(ranking.top1_score).toBeCloseTo(expected.top1_score, 6)
        if (expected.top2_score == null) expect(ranking.top2_score).toBeNull()
        else expect(ranking.top2_score!).toBeCloseTo(expected.top2_score, 6)
        if (expected.margin == null) expect(ranking.margin).toBeNull()
        else expect(ranking.margin!).toBeCloseTo(expected.margin, 6)
        for (let slot = 0; slot < 4; slot++) {
          expect(activatedFeatureIds(encoded.features[slot], slot), `${fixture.name} ids ${slot}`)
            .toEqual(expected.activated_feature_ids[slot])
          const terms = scoreContributions(policy, encoded.features[slot], slot)
          expect(terms.map(term => [term.term, term.category, term.global_id]))
            .toEqual(expected.contributions[slot].map((term: any) => [term.term, term.category, term.global_id]))
          terms.forEach((term, index) => expect(term.weight).toBeCloseTo(expected.contributions[slot][index].weight, 6))
          // The additive LUT has no hidden terms: contributions reconstruct the score.
          if (encoded.mask[slot]) {
            const total = terms.reduce((sum, term) => Math.fround(sum + term.weight), 0)
            expect(total).toBeCloseTo(scores[slot]!, 5)
          }
        }
      }
    }
  })
})

describe('required regression coverage', () => {
  const byGroup = (group: string) => regression.fixtures.filter((fixture: any) => fixture.group === group)

  it('covers every required case group', () => {
    for (const group of ['damaging-immunity', 'damaging-effectiveness', 'status-not-charted',
      'status-applicability', 'fixed-damage', 'playtest-regression']) {
      expect(byGroup(group).length, group).toBeGreaterThan(0)
    }
  })

  it('reproduces the Python move classification and effectiveness of every fixture move', () => {
    for (const fixture of regression.fixtures) {
      const status = fixture.request.public.target.status
      fixture.request.active[0].moves.forEach((move: any, index: number) => {
        const semantics = fixture.move_semantics[index]
        expect(classifyMove(move), `${fixture.name} ${move.id} class`).toBe(semantics.move_class)
        const actual = resolveMoveSemantics(move, fixture.resolved_defender_types, status)
        expect(actual.effectivenessBucket, `${fixture.name} ${move.id} bucket`).toBe(semantics.effectiveness_bucket)
        expect(actual.applicable, `${fixture.name} ${move.id} applicable`).toBe(semantics.applicable)
        const expectation = fixture.expect[move.id]
        if (expectation) {
          expect([actual.moveClass, actual.applicable, semantics.effectiveness], `${fixture.name} ${move.id}`)
            .toEqual(expectation)
        }
        // The encoded feature row must carry the same effectiveness category.
        const encoded = encodeRequest(fixture.request)
        expect(featureCategories(encoded.features[index]).effectiveness).toBe(semantics.effectiveness)
      })
    }
  })

  it('never lets a status or self move take generic damage-chart effectiveness', () => {
    for (const fixture of byGroup('status-not-charted')) {
      fixture.request.active[0].moves.forEach((move: any, index: number) => {
        if (fixture.move_semantics[index].move_class !== 'status') return
        expect(fixture.move_semantics[index].effectiveness, `${fixture.name} ${move.id}`).toBe('neutral')
      })
    }
  })

  it('treats any single type immunity as 0x on a dual-type defender', () => {
    const cases = byGroup('damaging-immunity')
    expect(cases.length).toBeGreaterThanOrEqual(5)
    for (const fixture of cases) {
      expect(fixture.resolved_defender_types.length).toBe(2)
      const immune = fixture.move_semantics.filter((entry: any) => entry.effectiveness === 'immune')
      expect(immune.length, fixture.name).toBeGreaterThan(0)
    }
  })

  it('applies immunity, but not resistance, to fixed-damage moves', () => {
    for (const fixture of byGroup('fixed-damage')) {
      const fixed = fixture.move_semantics.filter((entry: any) => entry.move_class === 'fixed-damage')
      expect(fixed.length, fixture.name).toBeGreaterThan(0)
      for (const entry of fixed) expect(['immune', 'neutral']).toContain(entry.effectiveness)
    }
  })

  /**
   * The observed human-playtest bug: Gyarados repeatedly using Earthquake into
   * Skarmory. The type logic must stay as it is; if a checkpoint still prefers
   * the immune move, this fails and prints the LUT contributions that caused it.
   */
  it.each([...POLICY_IDS])('%s never prefers an immune move where the fixture forbids it', id => {
    const policy = policies[id]
    for (const fixture of regression.fixtures) {
      if (!fixture.forbid_top1?.length) continue
      const {features, mask} = encodeRequest(fixture.request)
      const moves = fixture.request.active[0].moves
      const scores = policyScores(policy, features, mask)
      const chosen = selectTop1(scores)
      const chosenId = chosen < 4 ? moves[chosen]?.id : `switch-${chosen - 3}`
      for (const forbidden of fixture.forbid_top1) {
        const slot = moves.findIndex((move: any) => move.id === forbidden)
        expect(featureCategories(features[slot]).effectiveness, `${forbidden} must encode as immune`).toBe('immune')
        const detail = JSON.stringify(scoreContributions(policy, features[slot], slot)
          .filter(term => Math.abs(term.weight) > 0.05).map(term => [term.term, term.category, Number(term.weight.toFixed(4))]))
        expect(chosenId, `${id} chose forbidden ${forbidden} in "${fixture.name}"; contributions: ${detail}`).not.toBe(forbidden)
      }
    }
  })
})

describe('masking and inference invariants', () => {
  it('scores no illegal action and refuses a state with no legal action', () => {
    const fixture = regression.fixtures[0]
    const {features} = encodeRequest(fixture.request)
    const empty = Array(9).fill(false)
    expect(policyScores(policies['v1.1-100m'], features, empty)).toEqual(Array(9).fill(null))
    expect(() => selectTop1(policyScores(policies['v1.1-100m'], features, empty))).toThrow(/no legal action/)
    expect(() => rankScores(Array(9).fill(null))).toThrow(/no legal action/)
  })

  it('masks disabled and zero-PP moves', () => {
    const fixture = structuredClone(regression.fixtures[0])
    fixture.request.active[0].moves[0].disabled = true
    fixture.request.active[0].moves[1].pp = 0
    const {mask} = encodeRequest(fixture.request)
    expect(mask[0]).toBe(false); expect(mask[1]).toBe(false)
  })

  it('keeps only switch actions legal on a forced switch', () => {
    const fixture = structuredClone(regression.fixtures[0])
    fixture.request.forceSwitch = [true]
    const {mask} = encodeRequest(fixture.request)
    expect(mask.slice(0, 4)).toEqual([false, false, false, false])
    expect(mask.slice(4).some(Boolean)).toBe(true)
  })

  it('reports int8 scores only for legal actions and saturates into int16', () => {
    const fixture = regression.fixtures[0]
    const {features, mask} = encodeRequest(fixture.request)
    const integers = quantizedScores(policies['v1.1-100m'], features, mask)
    integers.forEach((value, index) => {
      if (!mask[index]) expect(value).toBeNull()
      else { expect(Number.isInteger(value)).toBe(true); expect(value!).toBeGreaterThanOrEqual(-32768); expect(value!).toBeLessThanOrEqual(32767) }
    })
  })
})
