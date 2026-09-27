import {describe, expect, it} from 'vitest'
import {readableLine} from '../src/battleLog'

describe('battle log', () => {
  it('shows exact HP only for the human side and a percentage for the opponent', () => {
    expect(readableLine('|-damage|p1a: Ninjask|247/263 tox|[from] psn', 'en')).toBe('Ninjask: 247/263 tox (psn)')
    expect(readableLine('|-damage|p2a: Blissey|326/651', 'en')).toBe('Blissey: 50%')
    expect(readableLine('|-heal|p2a: Blissey|640/651 par|[from] item: Leftovers', 'en')).toBe('Blissey healed to 98% · par (Leftovers)')
    expect(readableLine('|-sethp|p2a: Blissey|300/651|[from] move: Pain Split', 'en')).toBe('Blissey: 46% (Pain Split)')
    expect(readableLine('|-damage|p2a: Blissey|0 fnt', 'en')).toBe('Blissey: fainted')
    expect(readableLine('|-damage|p2a: Blissey|326/651', 'ko')).toBe('해피너스: 50%')
  })

  it('describes public battle-state modifiers', () => {
    expect(readableLine('|-boost|p1a: Ninjask|atk|2', 'en')).toBe('Ninjask: Atk +2')
    expect(readableLine('|-unboost|p2a: Blissey|def|1', 'en')).toBe('Blissey: Def −1')
    expect(readableLine('|-weather|SunnyDay', 'en')).toBe('Weather: Sun')
    expect(readableLine('|-weather|SunnyDay|[upkeep]', 'en')).toBe('')
    expect(readableLine('|-sidestart|p1: Human|move: Light Screen', 'en')).toBe('Your side: Light Screen started.')
  })
})
