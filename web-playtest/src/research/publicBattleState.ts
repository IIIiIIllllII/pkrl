import type {
  BoostStat, Player, PublicBattleState, PublicPokemonState, PublicRevealedPokemon, PublicSideCondition, PublicSideState,
} from '../types'

/**
 * Public battle-state tracking for display and research logging.
 *
 * State is rebuilt only from protocol lines in one player's own stream, the
 * same lines a Showdown client shows that player, so it cannot contain
 * unrevealed Pokémon, moves, items or abilities. It is never fed to the policy
 * encoder: v1.1 features are unchanged.
 */

export const BOOST_STATS: readonly BoostStat[] = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion']

/** Gen 3 move-set weather lasts five turns; ability weather is permanent through Gen 5. */
const MOVE_WEATHER_TURNS = 5
const TIMED_SIDE_CONDITIONS: Record<string, number> = {Reflect: 5, 'Light Screen': 5, Safeguard: 5, Mist: 5}
const LAYERED_SIDE_CONDITIONS: Record<string, number> = {Spikes: 3}
/** Volatiles Baton Pass carries over in Gen 3 (stat stages are always carried). */
const BATON_PASS_VOLATILES = new Set(['Substitute', 'confusion', 'Leech Seed', 'Focus Energy', 'Curse', 'Ingrain', 'Mean Look', 'Block', 'Spider Web'])
/** Counters that replace their own previous value rather than stacking. */
const COUNTER_VOLATILE = /^(perish|stockpile)\d$/

interface MonTrack {species: string; hp: number; maxhp: number; status: string; fainted: boolean}
interface ConditionTrack {layers: number; startedTurn: number; startedUpkeeps: number}
interface SideTrack {
  name: string
  active: string | null
  mons: Map<string, MonTrack>
  boosts: Partial<Record<BoostStat, number>>
  volatiles: string[]
  conditions: Map<string, ConditionTrack>
}

const effectName = (value = '') => value.replace(/^(move|ability|item): /, '')
const sideOf = (ref = ''): Player | null => (/^(p[12])/.exec(ref)?.[1] as Player | undefined) ?? null
const monKey = (ref = '') => ref.replace(/^p\d[a-z]?: /, '')
const clampStage = (value: number) => Math.max(-6, Math.min(6, value))

function parseHealth(text = ''): {hp: number; maxhp: number; status: string; fainted: boolean} | null {
  if (text.includes('fnt')) return {hp: 0, maxhp: 0, status: '', fainted: true}
  const match = text.match(/^(\d+)\/(\d+)(?:\s+(\w+))?/)
  return match ? {hp: Number(match[1]), maxhp: Number(match[2]), status: match[3] || '', fainted: false} : null
}

function hpPercent(mon: MonTrack): number {
  if (mon.fainted || mon.hp <= 0) return 0
  return mon.maxhp > 0 ? Math.max(1, Math.round(mon.hp / mon.maxhp * 100)) : 100
}

export class PublicBattleTracker {
  private turn = 0
  private upkeeps = 0
  private weather: {name: string; source: 'move' | 'ability'; startedTurn: number; startedUpkeeps: number} | null = null
  private sides: Record<Player, SideTrack> = {p1: this.emptySide(), p2: this.emptySide()}

  constructor(readonly perspective: Player) {}

  private emptySide(): SideTrack {
    return {name: '', active: null, mons: new Map(), boosts: {}, volatiles: [], conditions: new Map()}
  }

  private mon(ref: string): MonTrack | null {
    const side = sideOf(ref)
    return side ? this.sides[side].mons.get(monKey(ref)) ?? null : null
  }

  /** The side's active Pokémon, if the reference names it (boosts/volatiles live on the active slot). */
  private activeSide(ref: string): SideTrack | null {
    const side = sideOf(ref)
    return side && this.sides[side].active === monKey(ref) ? this.sides[side] : null
  }

  private setHealth(ref: string, text: string): void {
    const mon = this.mon(ref); const health = parseHealth(text)
    if (!mon || !health) return
    if (health.fainted) { mon.hp = 0; mon.fainted = true; mon.status = ''; return }
    mon.hp = health.hp; mon.maxhp = health.maxhp; mon.status = health.status; mon.fainted = false
  }

  apply(line: string): void {
    const fields = line.split('|'); const command = fields[1] || ''
    switch (command) {
      case 'player': if (fields[2] === 'p1' || fields[2] === 'p2') this.sides[fields[2]].name = fields[3] || this.sides[fields[2]].name; break
      case 'turn': this.turn = Number(fields[2]) || this.turn; break
      case 'upkeep': this.upkeeps++; break
      case 'switch': case 'drag': case 'replace': {
        const player = sideOf(fields[2]); if (!player) break
        const side = this.sides[player]; const key = monKey(fields[2])
        const batonPass = command === 'switch' && fields.slice(5).some(value => value === '[from] Baton Pass')
        if (!side.mons.has(key)) side.mons.set(key, {species: (fields[3] || key).split(',')[0], hp: 0, maxhp: 0, status: '', fainted: false})
        side.active = key
        if (!batonPass) side.boosts = {}
        side.volatiles = batonPass ? side.volatiles.filter(name => BATON_PASS_VOLATILES.has(name) || COUNTER_VOLATILE.test(name)) : []
        this.setHealth(fields[2], fields[4] || '')
        break
      }
      case 'faint': {
        const mon = this.mon(fields[2]); if (mon) { mon.hp = 0; mon.fainted = true; mon.status = '' }
        const side = this.activeSide(fields[2]); if (side) { side.boosts = {}; side.volatiles = [] }
        break
      }
      case '-damage': case '-heal': case '-sethp': this.setHealth(fields[2], fields[3] || ''); break
      case '-status': { const mon = this.mon(fields[2]); if (mon) mon.status = fields[3] || ''; break }
      case '-curestatus': { const mon = this.mon(fields[2]); if (mon) mon.status = ''; break }
      case '-cureteam': { const player = sideOf(fields[2]); if (player) for (const mon of this.sides[player].mons.values()) mon.status = ''; break }
      case '-boost': case '-unboost': {
        const side = this.activeSide(fields[2]); const stat = fields[3] as BoostStat
        if (!side || !BOOST_STATS.includes(stat)) break
        const delta = Number(fields[4]) || 0
        side.boosts[stat] = clampStage((side.boosts[stat] || 0) + (command === '-boost' ? delta : -delta))
        break
      }
      case '-setboost': {
        const side = this.activeSide(fields[2]); const stat = fields[3] as BoostStat
        if (side && BOOST_STATS.includes(stat)) side.boosts[stat] = clampStage(Number(fields[4]) || 0)
        break
      }
      case '-clearallboost': for (const side of Object.values(this.sides)) side.boosts = {}; break
      case '-clearboost': { const side = this.activeSide(fields[2]); if (side) side.boosts = {}; break }
      case '-clearnegativeboost': {
        const side = this.activeSide(fields[2])
        if (side) for (const stat of BOOST_STATS) if ((side.boosts[stat] || 0) < 0) delete side.boosts[stat]
        break
      }
      // Psych Up: the first Pokémon copies the second's stat stages.
      case '-copyboost': case '-transform': {
        const target = this.activeSide(fields[2]); const source = this.activeSide(fields[3])
        if (target && source) target.boosts = {...source.boosts}
        break
      }
      case '-start': {
        const side = this.activeSide(fields[2]); const name = effectName(fields[3])
        if (!side || !name) break
        if (COUNTER_VOLATILE.test(name)) side.volatiles = side.volatiles.filter(value => !value.startsWith(name.slice(0, -1)))
        if (!side.volatiles.includes(name)) side.volatiles.push(name)
        break
      }
      case '-end': {
        const side = this.activeSide(fields[2]); const name = effectName(fields[3])
        if (side) side.volatiles = side.volatiles.filter(value => value !== name)
        break
      }
      case '-sidestart': {
        const player = sideOf(fields[2]); const name = effectName(fields[3]); if (!player || !name) break
        const existing = this.sides[player].conditions.get(name)
        if (existing && LAYERED_SIDE_CONDITIONS[name]) existing.layers = Math.min(LAYERED_SIDE_CONDITIONS[name], existing.layers + 1)
        else this.sides[player].conditions.set(name, {layers: 1, startedTurn: this.turn, startedUpkeeps: this.upkeeps})
        break
      }
      case '-sideend': { const player = sideOf(fields[2]); if (player) this.sides[player].conditions.delete(effectName(fields[3])); break }
      case '-weather': {
        const name = fields[2] || ''
        if (!name || name === 'none') this.weather = null
        else if (fields.slice(3).includes('[upkeep]') && this.weather?.name === name) break
        else this.weather = {name, source: fields.slice(3).some(value => value.startsWith('[from] ability:')) ? 'ability' : 'move',
          startedTurn: this.turn, startedUpkeeps: this.upkeeps}
        break
      }
    }
  }

  private sideSnapshot(player: Player): PublicSideState {
    const side = this.sides[player]; const self = player === this.perspective
    const activeMon = side.active ? side.mons.get(side.active) : undefined
    let active: PublicPokemonState | null = null
    if (activeMon) {
      active = {species: activeMon.species, hp_percent: hpPercent(activeMon), status: activeMon.status, fainted: activeMon.fainted,
        boosts: Object.fromEntries(BOOST_STATS.filter(stat => side.boosts[stat]).map(stat => [stat, side.boosts[stat]!])),
        volatiles: [...side.volatiles]}
      // Exact HP is only ever the viewer's own; the opponent is reported as a percentage.
      if (self && activeMon.maxhp > 0) active.hp = [activeMon.hp, activeMon.maxhp]
    }
    const conditions: PublicSideCondition[] = [...side.conditions.entries()].map(([name, track]) => ({
      name, layers: LAYERED_SIDE_CONDITIONS[name] ? track.layers : null, started_turn: track.startedTurn,
      turns_remaining: TIMED_SIDE_CONDITIONS[name] ? Math.max(0, TIMED_SIDE_CONDITIONS[name] - (this.upkeeps - track.startedUpkeeps)) : null,
    }))
    const revealed: PublicRevealedPokemon[] = [...side.mons.values()].map(mon => ({
      species: mon.species, hp_percent: hpPercent(mon), status: mon.status, fainted: mon.fainted,
    }))
    return {player, name: side.name, active, conditions, revealed}
  }

  snapshot(): PublicBattleState {
    const opponent: Player = this.perspective === 'p1' ? 'p2' : 'p1'
    const weather = this.weather && {
      name: this.weather.name, source: this.weather.source, started_turn: this.weather.startedTurn,
      turns_remaining: this.weather.source === 'ability' ? null : Math.max(0, MOVE_WEATHER_TURNS - (this.upkeeps - this.weather.startedUpkeeps)),
    }
    return {perspective: this.perspective, turn: this.turn, weather, self: this.sideSnapshot(this.perspective), opponent: this.sideSnapshot(opponent)}
  }
}
