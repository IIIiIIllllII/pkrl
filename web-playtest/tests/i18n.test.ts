import {describe, expect, it} from 'vitest'
import {TEAM_FIXTURES} from '../src/data/teams'
import {battleName, ITEM_KO, MOVE_KO, POKEMON_KO} from '../src/i18n'

describe('Korean presentation localization', () => {
  it('uses official Korean names for every fixture Pokémon and move', () => {
    for (const fixture of TEAM_FIXTURES) for (const member of fixture.team) {
      const species = String(member.species)
      expect(POKEMON_KO[species], `missing Pokémon translation: ${species}`).toBeTruthy()
      for (const move of member.moves as string[]) expect(MOVE_KO[move], `missing move translation: ${move}`).toBeTruthy()
      if (member.item) expect(ITEM_KO[String(member.item)], `missing item translation: ${member.item}`).toBeTruthy()
    }
  })

  it('localizes battle labels without changing canonical English values', () => {
    expect(battleName('Swampert', 'ko')).toBe('대짱이')
    expect(battleName('Hidden Power Bug', 'ko')).toBe('잠재파워 (벌레)')
    expect(battleName('Switch to Metagross', 'ko')).toBe('메타그로스로 교체')
    expect(battleName('Thunderbolt', 'en')).toBe('Thunderbolt')
  })
})
