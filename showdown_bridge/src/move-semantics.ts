export type MoveClass = 'normal-damage' | 'fixed-damage' | 'status'

const FIXED_DAMAGE = new Set([
  'counter', 'dragonrage', 'endeavor', 'mirrorcoat', 'nightshade',
  'psywave', 'seismictoss', 'sonicboom', 'superfang',
])
const VARIABLE_DAMAGE = new Set(['flail', 'frustration', 'hiddenpower', 'lowkick', 'return', 'reversal'])

export function classifyMove(data: any, basePower: number): MoveClass {
  if (FIXED_DAMAGE.has(data.id) || data.damage != null || data.damageCallback) return 'fixed-damage'
  if (basePower > 0 || VARIABLE_DAMAGE.has(data.id) || data.basePowerCallback) return 'normal-damage'
  return 'status'
}

function chartBucket(Dex: any, moveType: string, targetTypes: string[]): number {
  if (!targetTypes.length) return 3
  if (targetTypes.some(type => !Dex.getImmunity(moveType, type))) return 0
  const exponent = targetTypes.reduce((sum, type) => sum + Dex.getEffectiveness(moveType, type), 0)
  return exponent <= -2 ? 1 : exponent === -1 ? 2 : exponent === 0 ? 3 : exponent === 1 ? 4 : 5
}

export function statusApplicable(Dex: any, data: any, moveType: string, targetTypes: string[], targetStatus = ''): boolean {
  const types = new Set(targetTypes.map(value => value.toLowerCase()))
  if (['thunderwave', 'glare'].includes(data.id) && chartBucket(Dex, moveType, targetTypes) === 0) return false
  if (['psn', 'tox'].includes(data.status) && (types.has('poison') || types.has('steel'))) return false
  if (data.status === 'brn' && types.has('fire')) return false
  if (data.id === 'leechseed' && types.has('grass')) return false
  if (data.status && targetStatus) return false
  if (data.id === 'nightmare' && targetStatus !== 'slp') return false
  return true
}

export function resolveMoveSemantics(Dex: any, data: any, moveType: string, basePower: number, targetTypes: string[], targetStatus = '') {
  const moveClass = classifyMove(data, basePower)
  const chart = chartBucket(Dex, moveType, targetTypes)
  const applicable = moveClass === 'status' ? statusApplicable(Dex, data, moveType, targetTypes, targetStatus) : chart !== 0
  const effectivenessBucket = moveClass === 'normal-damage' ? chart : applicable ? 3 : 0
  return {moveClass, applicable, effectivenessBucket}
}
