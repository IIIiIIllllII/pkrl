export interface TeamFixture {
  id: string
  name: string
  category: 'balanced' | 'offense' | 'stall-status' | 'setup-heavy' | 'immunity-trap' | 'rom-like'
  description: string
  team: Array<Record<string, unknown>>
}

export const TEAM_FIXTURES: TeamFixture[] = [
  {
    id: 'adv-balanced', name: 'ADV Balanced', category: 'balanced',
    description: 'A sturdy mixed team with hazards, status, and offensive pressure.',
    team: [
      {species: 'Swampert', level: 50, ability: 'Torrent', item: 'Leftovers', nature: 'Relaxed', moves: ['Surf', 'Earthquake', 'Ice Beam', 'Protect']},
      {species: 'Skarmory', level: 50, ability: 'Keen Eye', item: 'Leftovers', nature: 'Impish', moves: ['Spikes', 'Whirlwind', 'Drill Peck', 'Rest']},
      {species: 'Blissey', level: 50, ability: 'Natural Cure', item: 'Leftovers', nature: 'Bold', moves: ['Soft-Boiled', 'Toxic', 'Seismic Toss', 'Aromatherapy']},
      {species: 'Gengar', level: 50, ability: 'Levitate', item: 'Leftovers', nature: 'Timid', moves: ['Thunderbolt', 'Ice Punch', 'Will-O-Wisp', 'Explosion']},
      {species: 'Tyranitar', level: 50, ability: 'Sand Stream', item: 'Leftovers', nature: 'Adamant', moves: ['Rock Slide', 'Earthquake', 'Hidden Power Bug', 'Dragon Dance']},
      {species: 'Celebi', level: 50, ability: 'Natural Cure', item: 'Leftovers', nature: 'Bold', moves: ['Psychic', 'Leech Seed', 'Recover', 'Baton Pass']},
    ],
  },
  {
    id: 'adv-offense', name: 'ADV Offense', category: 'offense',
    description: 'Fast attackers and setup sweepers that test KO recognition.',
    team: [
      {species: 'Aerodactyl', level: 50, ability: 'Rock Head', item: 'Choice Band', nature: 'Jolly', moves: ['Rock Slide', 'Double-Edge', 'Earthquake', 'Hidden Power Flying']},
      {species: 'Salamence', level: 50, ability: 'Intimidate', item: 'Leftovers', nature: 'Naive', moves: ['Dragon Dance', 'Hidden Power Flying', 'Earthquake', 'Fire Blast']},
      {species: 'Metagross', level: 50, ability: 'Clear Body', item: 'Choice Band', nature: 'Adamant', moves: ['Meteor Mash', 'Earthquake', 'Rock Slide', 'Explosion']},
      {species: 'Starmie', level: 50, ability: 'Natural Cure', item: 'Leftovers', nature: 'Timid', moves: ['Surf', 'Thunderbolt', 'Ice Beam', 'Recover']},
      {species: 'Dugtrio', level: 50, ability: 'Arena Trap', item: 'Choice Band', nature: 'Jolly', moves: ['Earthquake', 'Rock Slide', 'Aerial Ace', 'Hidden Power Bug']},
      {species: 'Snorlax', level: 50, ability: 'Immunity', item: 'Leftovers', nature: 'Adamant', moves: ['Body Slam', 'Shadow Ball', 'Earthquake', 'Self-Destruct']},
    ],
  },
  {
    id: 'status-stall', name: 'Status & Stall', category: 'stall-status',
    description: 'Recovery, poison, phazing, and immunities stress status decisions.',
    team: [
      {species: 'Milotic', level: 50, ability: 'Marvel Scale', item: 'Leftovers', nature: 'Bold', moves: ['Surf', 'Recover', 'Toxic', 'Refresh']},
      {species: 'Forretress', level: 50, ability: 'Sturdy', item: 'Leftovers', nature: 'Relaxed', moves: ['Spikes', 'Rapid Spin', 'Earthquake', 'Explosion']},
      {species: 'Dusclops', level: 50, ability: 'Pressure', item: 'Leftovers', nature: 'Bold', moves: ['Night Shade', 'Will-O-Wisp', 'Rest', 'Protect']},
      {species: 'Claydol', level: 50, ability: 'Levitate', item: 'Leftovers', nature: 'Bold', moves: ['Earthquake', 'Psychic', 'Rapid Spin', 'Explosion']},
      {species: 'Umbreon', level: 50, ability: 'Synchronize', item: 'Leftovers', nature: 'Careful', moves: ['Toxic', 'Wish', 'Protect', 'Baton Pass']},
      {species: 'Skarmory', level: 50, ability: 'Keen Eye', item: 'Leftovers', nature: 'Impish', moves: ['Spikes', 'Whirlwind', 'Drill Peck', 'Rest']},
    ],
  },
  {
    id: 'setup-immunity', name: 'Setup & Immunity Traps', category: 'immunity-trap',
    description: 'Ground, Electric, Normal, and Fighting immunities plus setup moves.',
    team: [
      {species: 'Gyarados', level: 50, ability: 'Intimidate', item: 'Leftovers', nature: 'Adamant', moves: ['Dragon Dance', 'Hidden Power Flying', 'Earthquake', 'Taunt']},
      {species: 'Jolteon', level: 50, ability: 'Volt Absorb', item: 'Leftovers', nature: 'Timid', moves: ['Thunderbolt', 'Hidden Power Grass', 'Agility', 'Baton Pass']},
      {species: 'Flygon', level: 50, ability: 'Levitate', item: 'Choice Band', nature: 'Jolly', moves: ['Earthquake', 'Rock Slide', 'Hidden Power Bug', 'Fire Blast']},
      {species: 'Gengar', level: 50, ability: 'Levitate', item: 'Leftovers', nature: 'Timid', moves: ['Thunderbolt', 'Ice Punch', 'Hypnosis', 'Explosion']},
      {species: 'Shedinja', level: 50, ability: 'Wonder Guard', item: 'Lum Berry', nature: 'Adamant', moves: ['Shadow Ball', 'Silver Wind', 'Protect', 'Toxic']},
      {species: 'Breloom', level: 50, ability: 'Effect Spore', item: 'Leftovers', nature: 'Jolly', moves: ['Spore', 'Focus Punch', 'Mach Punch', 'Leech Seed']},
    ],
  },
  {
    id: 'rom-npc', name: 'ROM-like NPC', category: 'rom-like',
    description: 'A deliberately weaker four-Pokémon trainer-style team.',
    team: [
      {species: 'Mightyena', level: 42, ability: 'Intimidate', moves: ['Crunch', 'Take Down', 'Scary Face', 'Sand-Attack']},
      {species: 'Camerupt', level: 43, ability: 'Magma Armor', moves: ['Flamethrower', 'Rock Slide', 'Amnesia', 'Take Down']},
      {species: 'Crobat', level: 44, ability: 'Inner Focus', moves: ['Aerial Ace', 'Bite', 'Confuse Ray', 'Toxic']},
      {species: 'Walrein', level: 45, ability: 'Thick Fat', moves: ['Surf', 'Ice Beam', 'Body Slam', 'Rest']},
    ],
  },
]

export const teamById = (id: string) => TEAM_FIXTURES.find(fixture => fixture.id === id)
