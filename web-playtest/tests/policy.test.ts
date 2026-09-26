import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'
import type {PolicyAsset} from '../src/types'
import {encodeRequest} from '../src/policy/encoder'
import {encodeLegacyV1Request} from '../src/policy/legacyV1Encoder'
import {classifyMove, resolveMoveSemantics} from '../src/policy/moveSemantics'
import {policyScores, selectTop1, validatePolicy} from '../src/policy/inference'

const fixtures = JSON.parse(readFileSync(new URL('../public/parity-fixtures.json', import.meta.url), 'utf8'))
const v11Fixtures = JSON.parse(readFileSync(new URL('../public/v1-1-parity-fixtures.json', import.meta.url), 'utf8'))
const policies = Object.fromEntries(['v1-10m', 'v1-50m', 'v1-100m'].map(id => [id, JSON.parse(readFileSync(new URL(`../public/policies/${id}.json`, import.meta.url), 'utf8')) as PolicyAsset]))

describe('frozen LUT parity', () => {
  it('matches Python v1.1 feature, score, mask, and top-1 fixtures', () => {
    const policy = v11Fixtures.policy as PolicyAsset
    validatePolicy(policy)
    for (const fixture of v11Fixtures.fixtures) {
      const encoded = encodeRequest(fixture.request)
      expect(fixture.request.public.target.types).toEqual(fixture.resolved_defender_types)
      expect(encoded.features).toEqual(fixture.features); expect(encoded.mask).toEqual(fixture.legal_mask)
      fixture.request.active[0].moves.forEach((move: any, i: number) => {
        const actual = resolveMoveSemantics(move, fixture.resolved_defender_types, fixture.request.public.target.status)
        expect(actual).toEqual({moveClass: fixture.move_semantics[i].move_class,
          applicable: fixture.move_semantics[i].applicable, effectivenessBucket: fixture.move_semantics[i].effectiveness_bucket})
      })
      const scores = policyScores(policy, encoded.features, encoded.mask)
      fixture.scores.forEach((expected: number | null, index: number) => expected == null
        ? expect(scores[index]).toBeNull() : expect(scores[index]).toBeCloseTo(expected, 5))
      if (fixture.selected_action == null) expect(() => selectTop1(scores)).toThrow()
      else expect(selectTop1(scores)).toBe(fixture.selected_action)
    }
  })
  it('loads all compact policy assets with compatible metadata', () => {
    for (const [id, policy] of Object.entries(policies)) {
      expect(() => validatePolicy(policy, 'gen3-lut-v1')).not.toThrow()
      expect(() => validatePolicy(policy)).toThrow(/expected gen3-lut-v1.1/)
      expect(policy.policy_id).toBe(id); expect(policy.parameter_count).toBe(349)
      expect(policy.simulator.pokemon_showdown_commit).toBe('2ddfa0476f8207e12e204b1c69f7c7683b17633c')
    }
  })

  for (const fixture of fixtures.fixtures) {
    it(`matches Python features, mask, float scores, and top-1: ${fixture.name}`, () => {
      const encoded = encodeLegacyV1Request(fixture.request)
      expect(encoded.features).toEqual(fixture.features); expect(encoded.mask).toEqual(fixture.legal_mask)
      for (const [id, policy] of Object.entries(policies)) {
        const actual = policyScores(policy, encoded.features, encoded.mask, 'gen3-lut-v1')
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
    const {mask} = encodeLegacyV1Request(fixture.request)
    expect(mask).toEqual([false, false, false, false, true, true, false, false, false])
    const scores = policyScores(policies['v1-100m'], fixture.features, mask, 'gen3-lut-v1')
    expect(scores.slice(0, 4)).toEqual([null, null, null, null]); expect(selectTop1(scores)).toBe(4)
  })

  const damaging: Array<[string, string, string[], number]> = [
    ['Earthquake', 'Ground', ['Steel', 'Flying'], 0],
    ['Thunderbolt', 'Electric', ['Water', 'Ground'], 0],
    ['Ice Beam', 'Ice', ['Dragon', 'Flying'], 5],
    ['Flamethrower', 'Fire', ['Bug', 'Steel'], 5],
    ['Cross Chop', 'Fighting', ['Ghost', 'Poison'], 0],
    ['Psychic', 'Psychic', ['Rock', 'Dark'], 0],
    ['Sludge Bomb', 'Poison', ['Steel', 'Psychic'], 0],
    ['Crunch', 'Dark', ['Steel'], 2],
    ['Shadow Ball', 'Ghost', ['Steel'], 2],
  ]
  it.each(damaging)('resolves Gen 3 damaging effectiveness: %s', (name, type, targetTypes, bucket) => {
    expect(resolveMoveSemantics({id: name.replaceAll(' ', '').toLowerCase(), move: name, type, basePower: 90}, targetTypes).effectivenessBucket).toBe(bucket)
  })

  it.each(['Dragon Dance', 'Swords Dance', 'Recover', 'Protect', 'Growl', 'Confuse Ray'])('%s does not use generic damage effectiveness', name => {
    const move = {id: name.replaceAll(' ', '').toLowerCase(), move: name, type: name === 'Dragon Dance' ? 'Dragon' : 'Normal', basePower: 0}
    expect(classifyMove(move)).toBe('status')
    expect(resolveMoveSemantics(move, ['Ghost', 'Steel']).effectivenessBucket).toBe(3)
  })

  it.each([
    [{id: 'thunderwave', move: 'Thunder Wave', type: 'Electric', status: 'par'}, ['Ground']],
    [{id: 'toxic', move: 'Toxic', type: 'Poison', status: 'tox'}, ['Steel']],
    [{id: 'toxic', move: 'Toxic', type: 'Poison', status: 'tox'}, ['Poison']],
    [{id: 'willowisp', move: 'Will-O-Wisp', type: 'Fire', status: 'brn'}, ['Fire']],
    [{id: 'leechseed', move: 'Leech Seed', type: 'Grass'}, ['Grass']],
  ] as const)('marks mechanics-specific status failure %#', (move, types) => {
    expect(resolveMoveSemantics(move, [...types]).effectivenessBucket).toBe(0)
  })

  it.each([
    [{id: 'seismictoss', move: 'Seismic Toss', type: 'Fighting'}, ['Ghost'], 0],
    [{id: 'seismictoss', move: 'Seismic Toss', type: 'Fighting'}, ['Water'], 3],
    [{id: 'nightshade', move: 'Night Shade', type: 'Ghost'}, ['Normal'], 0],
    [{id: 'nightshade', move: 'Night Shade', type: 'Ghost'}, ['Steel'], 3],
  ] as const)('fixed damage uses immunity only %#', (move, types, bucket) => {
    expect(resolveMoveSemantics(move, [...types]).effectivenessBucket).toBe(bucket)
  })
})
