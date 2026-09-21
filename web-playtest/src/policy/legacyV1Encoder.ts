/** Reproduction-only encoder for the contaminated gen3-lut-v1 web assets. */
import type {BattleRequest} from '../types'
import {classifyRole, encodeRequest} from './encoder'
import {FEATURE_VALUES} from './schema'

const PHYSICAL = new Set(['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel'])
const SPECIAL = new Set(['fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark'])

export function encodeLegacyV1Request(request: BattleRequest): {features: number[][]; mask: boolean[]} {
  const encoded = encodeRequest(request)
  const mons = request.side?.pokemon || []; const own = mons.find(mon => mon.active) || mons[0]
  for (const [slot, move] of (request.active?.[0]?.moves || []).slice(0, 4).entries()) {
    const type = (move.legacyType || move.type || 'unknown').toLowerCase(); const power = Number(move.legacyBasePower ?? move.basePower ?? 0)
    const legacyMove = {...move, type, basePower: power}
    encoded.features[slot][1] = classifyRole(legacyMove)
    encoded.features[slot][2] = Math.max(0, FEATURE_VALUES.move_type.indexOf(type))
    encoded.features[slot][3] = power <= 0 ? 2 : PHYSICAL.has(type) ? 0 : SPECIAL.has(type) ? 1 : 0
    encoded.features[slot][4] = power <= 0 ? 0 : power <= 40 ? 1 : power <= 70 ? 2 : power <= 100 ? 3 : 4
    encoded.features[slot][7] = Number((own?.types || []).some(value => value.toLowerCase() === type))
    encoded.features[slot][8] = Number(move.legacyEffectivenessBucket ?? move.effectivenessBucket ?? 3)
  }
  return encoded
}
