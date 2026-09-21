import type {MoveRequest} from '../types'

export type MoveClass = 'normal-damage' | 'fixed-damage' | 'status'

const FIXED_DAMAGE = new Set(['counter', 'dragonrage', 'endeavor', 'mirrorcoat', 'nightshade', 'psywave', 'seismictoss', 'sonicboom', 'superfang'])
const VARIABLE_DAMAGE = new Set(['flail', 'frustration', 'hiddenpower', 'lowkick', 'return', 'reversal'])
const CHART: Record<string, Record<string, number | null>> = {
  normal: {rock: -1, ghost: null, steel: -1},
  fire: {fire: -1, water: -1, grass: 1, ice: 1, bug: 1, rock: -1, dragon: -1, steel: 1},
  water: {fire: 1, water: -1, grass: -1, ground: 1, rock: 1, dragon: -1},
  electric: {water: 1, electric: -1, grass: -1, ground: null, flying: 1, dragon: -1},
  grass: {fire: -1, water: 1, grass: -1, poison: -1, ground: 1, flying: -1, bug: -1, rock: 1, dragon: -1, steel: -1},
  ice: {fire: -1, water: -1, grass: 1, ice: -1, ground: 1, flying: 1, dragon: 1, steel: -1},
  fighting: {normal: 1, ice: 1, poison: -1, flying: -1, psychic: -1, bug: -1, rock: 1, ghost: null, dark: 1, steel: 1},
  poison: {grass: 1, poison: -1, ground: -1, rock: -1, ghost: -1, steel: null},
  ground: {fire: 1, electric: 1, grass: -1, poison: 1, flying: null, bug: -1, rock: 1, steel: 1},
  flying: {electric: -1, grass: 1, fighting: 1, bug: 1, rock: -1, steel: -1},
  psychic: {fighting: 1, poison: 1, psychic: -1, dark: null, steel: -1},
  bug: {fire: -1, grass: 1, fighting: -1, poison: -1, flying: -1, psychic: 1, ghost: -1, dark: 1, steel: -1},
  rock: {fire: 1, ice: 1, fighting: -1, ground: -1, flying: 1, bug: 1, steel: -1},
  ghost: {normal: null, psychic: 1, ghost: 1, dark: -1, steel: -1},
  dragon: {dragon: 1, steel: -1},
  dark: {fighting: -1, psychic: 1, ghost: 1, dark: -1, steel: -1},
  steel: {fire: -1, water: -1, electric: -1, ice: 1, rock: 1, steel: -1},
}

const idOf = (move: MoveRequest) => String(move.id || move.move || '').toLowerCase().replaceAll(' ', '')

export function classifyMove(move: MoveRequest): MoveClass {
  const id = idOf(move)
  if (FIXED_DAMAGE.has(id) || move.fixedDamage != null) return 'fixed-damage'
  if ((move.basePower || 0) > 0 || VARIABLE_DAMAGE.has(id) || move.isDamageMove === true) return 'normal-damage'
  return 'status'
}

export function damageEffectiveness(moveType: string, targetTypes: string[]): number {
  const values = targetTypes.map(type => {
    const value = CHART[moveType.toLowerCase()]?.[type.toLowerCase()]
    return value === undefined ? 0 : value
  })
  if (values.some(value => value == null)) return 0
  const exponent = values.reduce<number>((sum, value) => sum + Number(value), 0)
  return exponent <= -2 ? 1 : exponent === -1 ? 2 : exponent === 0 ? 3 : exponent === 1 ? 4 : 5
}

export function statusApplicable(move: MoveRequest, targetTypes: string[], targetStatus = ''): boolean {
  const id = idOf(move); const types = new Set(targetTypes.map(value => value.toLowerCase())); const status = (move.status || '').toLowerCase()
  if (['thunderwave', 'glare'].includes(id) && damageEffectiveness(move.type || 'unknown', targetTypes) === 0) return false
  if (['psn', 'tox'].includes(status) && (types.has('poison') || types.has('steel'))) return false
  if (status === 'brn' && types.has('fire')) return false
  if (id === 'leechseed' && types.has('grass')) return false
  if (status && targetStatus) return false
  if (id === 'nightmare' && targetStatus !== 'slp') return false
  return true
}

export function resolveMoveSemantics(move: MoveRequest, targetTypes: string[], targetStatus = '') {
  const moveClass = classifyMove(move); const chart = damageEffectiveness(move.type || 'unknown', targetTypes)
  const applicable = moveClass === 'status' ? statusApplicable(move, targetTypes, targetStatus) : chart !== 0
  const effectivenessBucket = moveClass === 'normal-damage' ? chart : applicable ? 3 : 0
  return {moveClass, applicable, effectivenessBucket}
}
