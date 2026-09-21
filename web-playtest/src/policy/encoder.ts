import type {BattleRequest, MoveRequest} from '../types'
import {FEATURE_INDEX, FEATURE_NAMES, FEATURE_VALUES} from './schema'
import {classifyMove, resolveMoveSemantics} from './moveSemantics'

const STATUS_IDS: Record<string, number> = {'': 0, brn: 1, par: 2, psn: 3, tox: 3, slp: 4, frz: 5}
const PHYSICAL = new Set(['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel'])
const SPECIAL = new Set(['fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark'])
const ROLE_IDS = Object.fromEntries(FEATURE_VALUES.move_role.map((name, index) => [name, index]))

export function parseCondition(text = ''): [number, number, string] {
  if (text.includes('fnt')) return [0, 1, '']
  const match = text.match(/(\d+)\/(\d+)(?:\s+(\w+))?/)
  return match ? [Number(match[1]), Number(match[2]), match[3] || ''] : [1, 1, '']
}
export const hpBucket = (hp: number, max: number) => hp <= 0 || max <= 0 ? 0 : hp * 4 <= max ? 1 : hp * 2 <= max ? 2 : hp * 4 <= max * 3 ? 3 : 4
const powerBucket = (v: number) => v <= 0 ? 0 : v <= 40 ? 1 : v <= 70 ? 2 : v <= 100 ? 3 : 4
const accuracyBucket = (v: number | boolean | null | undefined) => v === true || v == null ? 0 : Number(v) <= 70 ? 1 : Number(v) <= 85 ? 2 : Number(v) < 100 ? 3 : 4
const ppBucket = (v: number) => v <= 0 ? 0 : v <= 4 ? 1 : v <= 9 ? 2 : v <= 19 ? 3 : 4

export function classifyRole(move: MoveRequest): number {
  const id = String(move.id || move.move || '').toLowerCase().replaceAll(' ', '')
  if (['protect', 'detect', 'endure'].includes(id)) return ROLE_IDS.protect
  if (['recover', 'softboiled', 'rest', 'synthesis', 'moonlight', 'morningsun', 'slackoff'].includes(id)) return ROLE_IDS.recovery
  if (['sunnyday', 'raindance', 'sandstorm', 'hail'].includes(id)) return ROLE_IDS.weather
  if (id === 'spikes') return ROLE_IDS.field
  if (['roar', 'whirlwind'].includes(id)) return ROLE_IDS.phaze
  if (id === 'batonpass') return ROLE_IDS.pivot
  if (['explosion', 'selfdestruct', 'memento'].includes(id)) return ROLE_IDS.self_ko
  if (['seismictoss', 'nightshade', 'dragonrage', 'sonicboom', 'psywave', 'superfang'].includes(id)) return ROLE_IDS.fixed
  if (classifyMove(move) === 'normal-damage') return ROLE_IDS.damage
  if (move.boosts && Object.values(move.boosts).some(value => value < 0)) return ROLE_IDS.debuff
  if (move.boosts || move.self?.boosts) return ROLE_IDS.setup
  if (move.status) return ROLE_IDS.status
  return ROLE_IDS.utility
}

export function encodeRequest(request: BattleRequest): {features: number[][]; mask: boolean[]} {
  const features = Array.from({length: 9}, () => Array(FEATURE_NAMES.length).fill(0))
  const mask = Array(9).fill(false)
  const mons = request.side?.pokemon || []
  const own = mons.find(mon => mon.active) || mons[0] || {condition: ''}
  const [hp, maxHp, status] = parseCondition(own.condition)
  const target = request.public?.target
  const weatherName = (request.public?.weather || '').toLowerCase()
  const weather = weatherName.includes('sun') ? 1 : weatherName.includes('rain') ? 2 : weatherName.includes('sand') ? 3 : weatherName.includes('hail') ? 4 : 0
  const ownSpeed = own.stats?.spe || 0
  const targetSpeed = target?.estimatedSpeed ?? ownSpeed
  const speed = ownSpeed < targetSpeed ? 0 : ownSpeed > targetSpeed ? 2 : 1
  const forced = Boolean(request.forceSwitch?.[0])
  for (const [slot, move] of (request.active?.[0]?.moves || []).slice(0, 4).entries()) {
    const pp = move.pp
    mask[slot] = !forced && !move.disabled && (pp == null || pp > 0)
    const type = (move.type || 'unknown').toLowerCase()
    const power = Number(move.basePower || 0)
    const row = features[slot]
    row[0] = slot; row[1] = classifyRole(move); row[2] = FEATURE_VALUES.move_type.indexOf(type)
    if (row[2] < 0) row[2] = 17
    const moveClass = classifyMove(move)
    row[3] = moveClass === 'status' ? 2 : PHYSICAL.has(type) ? 0 : SPECIAL.has(type) ? 1 : 0
    row[4] = powerBucket(power); row[5] = accuracyBucket(move.accuracy)
    row[6] = (move.priority || 0) < 0 ? 0 : (move.priority || 0) > 0 ? 2 : 1
    row[7] = Number((own.types || []).some(value => value.toLowerCase() === type))
    row[8] = resolveMoveSemantics(move, target?.types || [], target?.status || '').effectivenessBucket
    row[9] = ppBucket(Number(pp || 0))
    row[10] = hpBucket(hp, maxHp); row[11] = Number(target?.hpBucket ?? 4)
    row[12] = STATUS_IDS[status] || 0; row[13] = STATUS_IDS[target?.status || ''] || 0
    row[14] = speed; row[15] = 0; row[16] = 0; row[17] = Number((request.public?.turn || 0) <= 1)
    row[18] = weather; row[19] = 2
  }
  const switches = mons.filter(mon => !mon.active && !mon.condition.includes('fnt'))
  const trapped = Boolean(request.active?.[0]?.trapped)
  if (forced || !trapped) switches.slice(0, 5).forEach((_, index) => { mask[4 + index] = true })
  return {features, mask}
}

export function featureCategories(row: number[]): Record<string, string> {
  return Object.fromEntries(FEATURE_NAMES.map((name, index) => [name, FEATURE_VALUES[name][row[index]]]))
}
