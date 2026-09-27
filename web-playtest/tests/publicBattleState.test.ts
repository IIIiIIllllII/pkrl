import {describe, expect, it} from 'vitest'
import {PublicBattleTracker} from '../src/research/publicBattleState'

/** Feed protocol lines (as captured from the pinned simulator) to a tracker. */
function track(perspective: 'p1' | 'p2', lines: string[]): PublicBattleTracker {
  const tracker = new PublicBattleTracker(perspective)
  for (const line of lines) tracker.apply(line)
  return tracker
}

const START = ['|player|p1|Human||', '|player|p2|AI||', '|start',
  '|switch|p1a: Ninjask|Ninjask, M|263/263', '|switch|p2a: Blissey|Blissey, F|651/651', '|turn|1']

describe('public battle-state tracker', () => {
  it('counts move weather down by end-of-turn upkeeps and keeps ability weather permanent', () => {
    const tracker = track('p1', [...START, '|move|p1a: Ninjask|Sunny Day|p1a: Ninjask', '|-weather|SunnyDay'])
    expect(tracker.snapshot().weather).toEqual({name: 'SunnyDay', source: 'move', started_turn: 1, turns_remaining: 5})
    for (const line of ['|-weather|SunnyDay|[upkeep]', '|upkeep', '|turn|2']) tracker.apply(line)
    expect(tracker.snapshot().weather?.turns_remaining).toBe(4)
    for (const line of ['|-weather|SunnyDay|[upkeep]', '|upkeep', '|turn|3', '|-weather|SunnyDay|[upkeep]', '|upkeep', '|turn|4',
      '|-weather|SunnyDay|[upkeep]', '|upkeep', '|turn|5']) tracker.apply(line)
    expect(tracker.snapshot().weather?.turns_remaining).toBe(1)
    tracker.apply('|-weather|none')
    expect(tracker.snapshot().weather).toBeNull()
    tracker.apply('|-weather|Sandstorm|[from] ability: Sand Stream|[of] p2a: Tyranitar')
    for (const line of ['|-weather|Sandstorm|[upkeep]', '|upkeep', '|turn|6']) tracker.apply(line)
    expect(tracker.snapshot().weather).toEqual({name: 'Sandstorm', source: 'ability', started_turn: 5, turns_remaining: null})
  })

  it('stays correct at a mid-turn forced switch after the end-of-turn upkeep', () => {
    const tracker = track('p1', [...START, '|-weather|RainDance', '|-sidestart|p1: Human|Reflect',
      '|faint|p1a: Ninjask', '|-weather|RainDance|[upkeep]', '|upkeep'])
    // Still turn 1 in the protocol, but one upkeep has already been spent.
    const state = tracker.snapshot()
    expect(state.turn).toBe(1)
    expect(state.weather?.turns_remaining).toBe(4)
    expect(state.self.conditions).toEqual([{name: 'Reflect', layers: null, started_turn: 1, turns_remaining: 4}])
  })

  it('tracks screens to expiry and stacks Spikes layers', () => {
    const tracker = track('p1', [...START, '|-sidestart|p1: Human|Reflect', '|-sidestart|p2: AI|Spikes'])
    for (let turn = 2; turn <= 5; turn++) for (const line of ['|upkeep', `|turn|${turn}`]) tracker.apply(line)
    tracker.apply('|-sidestart|p1: Human|move: Light Screen')
    tracker.apply('|-sidestart|p2: AI|Spikes'); tracker.apply('|-sidestart|p2: AI|Spikes'); tracker.apply('|-sidestart|p2: AI|Spikes')
    const state = tracker.snapshot()
    expect(state.self.conditions).toEqual([
      {name: 'Reflect', layers: null, started_turn: 1, turns_remaining: 1},
      {name: 'Light Screen', layers: null, started_turn: 5, turns_remaining: 5},
    ])
    expect(state.opponent.conditions).toEqual([{name: 'Spikes', layers: 3, started_turn: 1, turns_remaining: null}])
    tracker.apply('|-sideend|p1: Human|Reflect'); tracker.apply('|-sideend|p2: AI|Spikes|[from] move: Rapid Spin|[of] p1a: Ninjask')
    expect(tracker.snapshot().self.conditions.map(condition => condition.name)).toEqual(['Light Screen'])
    expect(tracker.snapshot().opponent.conditions).toEqual([])
  })

  it('tracks stat stages, clamps them, and resets them on switch and Haze', () => {
    const tracker = track('p1', [...START, '|-boost|p1a: Ninjask|atk|2', '|-ability|p1a: Ninjask|Speed Boost|boost',
      '|-boost|p1a: Ninjask|spe|1', '|-unboost|p2a: Blissey|def|1', '|-setboost|p1a: Ninjask|atk|6', '|-boost|p1a: Ninjask|atk|2'])
    let state = tracker.snapshot()
    expect(state.self.active?.boosts).toEqual({atk: 6, spe: 1})
    expect(state.opponent.active?.boosts).toEqual({def: -1})
    tracker.apply('|-clearallboost')
    state = tracker.snapshot()
    expect(state.self.active?.boosts).toEqual({}); expect(state.opponent.active?.boosts).toEqual({})
    for (const line of ['|-unboost|p2a: Blissey|atk|1', '|switch|p2a: Tyranitar|Tyranitar, F|341/341', '|switch|p2a: Blissey|Blissey, F|651/651']) tracker.apply(line)
    expect(tracker.snapshot().opponent.active?.boosts).toEqual({})
  })

  it('passes stat stages and passable volatiles through Baton Pass but not through a drag', () => {
    const tracker = track('p1', [...START, '|-boost|p1a: Ninjask|atk|2', '|-start|p1a: Ninjask|Substitute',
      '|-start|p1a: Ninjask|move: Taunt', '|move|p1a: Ninjask|Baton Pass|p1a: Ninjask',
      '|switch|p1a: Starmie|Starmie|261/261|[from] Baton Pass'])
    expect(tracker.snapshot().self.active).toMatchObject({species: 'Starmie', boosts: {atk: 2}, volatiles: ['Substitute']})
    tracker.apply('|drag|p1a: Ninjask|Ninjask, M|263/263')
    expect(tracker.snapshot().self.active).toMatchObject({species: 'Ninjask', boosts: {}, volatiles: []})
  })

  it('copies stat stages with Psych Up', () => {
    const tracker = track('p1', [...START, '|-boost|p2a: Blissey|def|2', '|-unboost|p1a: Ninjask|spe|1',
      '|-copyboost|p1a: Ninjask|p2a: Blissey|[from] move: Psych Up'])
    expect(tracker.snapshot().self.active?.boosts).toEqual({def: 2})
  })

  it('reports exact HP only for the viewer and tracks status and volatiles', () => {
    const tracker = track('p1', [...START, '|-damage|p1a: Ninjask|247/263 tox|[from] psn', '|-damage|p2a: Blissey|326/651',
      '|-status|p2a: Blissey|par', '|-start|p2a: Blissey|confusion', '|-start|p2a: Blissey|move: Leech Seed',
      '|-end|p2a: Blissey|confusion'])
    const state = tracker.snapshot()
    expect(state.self.active).toMatchObject({species: 'Ninjask', hp_percent: 94, hp: [247, 263], status: 'tox'})
    expect(state.opponent.active).toEqual({species: 'Blissey', hp_percent: 50, status: 'par', fainted: false, boosts: {}, volatiles: ['Leech Seed']})
    tracker.apply('|-curestatus|p2a: Blissey|par|[msg]')
    expect(tracker.snapshot().opponent.active?.status).toBe('')
    // From the AI's perspective the same lines give it exact HP for its own side only.
    const aiView = track('p2', [...START, '|-damage|p1a: Ninjask|247/263 tox|[from] psn', '|-damage|p2a: Blissey|326/651'])
      .snapshot()
    expect(aiView.self.active?.hp).toEqual([326, 651])
    expect(aiView.opponent.active).not.toHaveProperty('hp')
  })

  it('lists only revealed Pokémon and marks faints', () => {
    const tracker = track('p1', [...START, '|-damage|p2a: Blissey|0 fnt', '|faint|p2a: Blissey',
      '|switch|p2a: Tyranitar|Tyranitar, F|341/341'])
    expect(tracker.snapshot().opponent.revealed).toEqual([
      {species: 'Blissey', hp_percent: 0, status: '', fainted: true},
      {species: 'Tyranitar', hp_percent: 100, status: '', fainted: false},
    ])
  })
})
