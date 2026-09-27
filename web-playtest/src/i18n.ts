export type Locale = 'en' | 'ko'

export const UI = {
  en: {
    researchTool: 'Gen 3 research tool', title: 'Human vs. clean v1.1', intro: 'Play a real pinned-Showdown battle, flag strange decisions, then export the evidence.',
    yourTeam: 'Your team', aiTeam: 'AI team', blindTest: 'Blind checkpoint test', checkpoint: 'Checkpoint', debugMode: 'Developer/debug mode',
    starting: 'Starting…', startBattle: 'Start battle', downloadArchive: 'Download session archive', simulator: 'Simulator', pinned: 'pinned', format: 'format', schema: 'schema',
    battle: 'Battle', battleComplete: 'Battle complete', turn: 'Turn', newBattle: 'New battle', opponent: 'Opponent', you: 'You', unknown: 'Unknown', hpBucket: 'HP bucket', hp: 'HP', status: 'Status', none: 'none', fainted: 'fainted',
    chooseAction: 'Choose an action', replaying: 'Replaying the deterministic battle…', wrongDecision: '🚩 AI decision looked wrong', whatWrong: 'What looked wrong?', optionalNote: 'Optional note', shortNote: 'Short note', saveFlag: 'Save flag', battleLog: 'Battle log',
    developerView: 'Developer view', policy: 'policy', seed: 'seed', margin: 'margin', mask: 'mask', action: 'Action', legal: 'Legal', score: 'Score', role: 'Role', effect: 'Effect', featureIds: 'Feature IDs', yes: 'Yes', no: 'No',
    result: 'Result', youWon: 'You won', aiWon: 'The AI won', tie: 'Tie', policyRevealed: 'Policy revealed', strengthQuestion: 'How strong did the AI feel?', choose: 'Choose…', irrationalQuestion: 'Any obviously irrational action?', cheatingQuestion: 'Did anything feel like cheating?', optionalComment: 'Optional comment', saveFeedback: 'Save feedback',
    downloadLog: 'Download playtest log', copyJson: 'Copy JSON', downloadAll: 'Download all local battles', downloadAllJsonl: 'Download all as JSONL', language: 'Language', battleRoom: 'Battle room', moves: 'Moves', switchPokemon: 'Switch Pokémon', research: 'Research', partyOverview: 'Your party', active: 'Active', reserve: 'Reserve', partySets: 'Party moves & held items', heldItem: 'Held item', noItem: 'No held item',
    cleanOnly: 'clean gen3-lut-v1.1 checkpoints only — contaminated v1 assets are quarantined', hiddenUntilEnd: 'hidden until the battle ends',
    moveClass: 'Class', applies: 'Applies', resolvedTypes: 'Resolved defender types', intScore: 'int8 score', topContributions: 'Largest LUT contributions for the chosen action',
    battleState: 'Public battle state', weather: 'Weather', clearWeather: 'Clear', turnsLeft: 'turns left', permanent: 'permanent', yourSide: 'Your side', opponentSide: 'Opponent side', noSideEffects: 'no screens or hazards', statStages: 'Stat stages', noStatChanges: 'no stat changes', revealed: 'Revealed',
    trainingDecisions: 'Training decisions', sourceCheckpoint: 'Source checkpoint', quantScale: 'Quantization', blindNote: 'A random checkpoint is chosen for each battle and revealed at the end.', archiveFull: 'Local storage is full — download this battle now so it is not lost',
  },
  ko: {
    researchTool: '3세대 연구 도구', title: '플레이어 vs. 클린 v1.1', intro: '버전이 고정된 Pokémon Showdown으로 실제 배틀을 진행하고, 이상한 판단을 표시한 뒤 데이터를 내보내세요.',
    yourTeam: '내 팀', aiTeam: 'AI 팀', blindTest: '체크포인트 블라인드 테스트', checkpoint: '체크포인트', debugMode: '개발자/디버그 모드',
    starting: '시작 중…', startBattle: '배틀 시작', downloadArchive: '세션 기록 다운로드', simulator: '시뮬레이터', pinned: '버전 고정', format: '포맷', schema: '스키마',
    battle: '배틀', battleComplete: '배틀 종료', turn: '턴', newBattle: '새 배틀', opponent: '상대', you: '나', unknown: '알 수 없음', hpBucket: 'HP 구간', hp: 'HP', status: '상태', none: '없음', fainted: '기절',
    chooseAction: '행동을 선택하세요', replaying: '결정론적 배틀을 재현하는 중…', wrongDecision: '🚩 AI의 판단이 이상해 보임', whatWrong: '어떤 점이 이상했나요?', optionalNote: '선택 메모', shortNote: '짧은 메모', saveFlag: '표시 저장', battleLog: '배틀 로그',
    developerView: '개발자 화면', policy: '정책', seed: '시드', margin: '점수 차', mask: '마스크', action: '행동', legal: '사용 가능', score: '점수', role: '역할', effect: '효과', featureIds: '특징 ID', yes: '예', no: '아니요',
    result: '결과', youWon: '승리했습니다', aiWon: 'AI가 승리했습니다', tie: '무승부', policyRevealed: '공개된 정책', strengthQuestion: 'AI가 얼마나 강하게 느껴졌나요?', choose: '선택…', irrationalQuestion: '명백히 비합리적인 행동이 있었나요?', cheatingQuestion: 'AI가 부정행위를 한다고 느낀 점이 있었나요?', optionalComment: '선택 의견', saveFeedback: '의견 저장',
    downloadLog: '플레이테스트 기록 다운로드', copyJson: 'JSON 복사', downloadAll: '로컬 배틀 전체 다운로드', downloadAllJsonl: 'JSONL로 전체 다운로드', language: '언어', battleRoom: '배틀 룸', moves: '기술', switchPokemon: '포켓몬 교체', research: '연구', partyOverview: '내 파티', active: '배틀 중', reserve: '대기', partySets: '파티 기술 및 지닌물건', heldItem: '지닌물건', noItem: '지닌물건 없음',
    cleanOnly: '클린 gen3-lut-v1.1 체크포인트만 사용 — 오염된 v1 자산은 격리됨', hiddenUntilEnd: '배틀이 끝나면 공개',
    moveClass: '분류', applies: '적용', resolvedTypes: '확인된 상대 타입', intScore: 'int8 점수', topContributions: '선택된 행동의 주요 LUT 기여도',
    battleState: '공개 배틀 상태', weather: '날씨', clearWeather: '맑음', turnsLeft: '턴 남음', permanent: '지속', yourSide: '내 필드', opponentSide: '상대 필드', noSideEffects: '벽/설치기 없음', statStages: '능력 변화', noStatChanges: '능력 변화 없음', revealed: '공개된 포켓몬',
    trainingDecisions: '학습 결정 수', sourceCheckpoint: '원본 체크포인트', quantScale: '양자화', blindNote: '배틀마다 체크포인트가 무작위로 선택되고 종료 시 공개됩니다.', archiveFull: '로컬 저장 공간이 가득 찼습니다 — 기록이 사라지지 않도록 지금 이 배틀을 다운로드하세요',
  },
} as const

export const FLAG_LABELS: Record<string, [string, string]> = {
  'Bad attack': ['Bad attack', '나쁜 공격 선택'], 'Missed KO': ['Missed KO', 'KO 기회를 놓침'],
  'Immunity/resistance mistake': ['Immunity/resistance mistake', '무효/반감 판단 실수'], 'Bad recovery': ['Bad recovery', '나쁜 회복 선택'],
  'Bad setup': ['Bad setup', '나쁜 랭크업 선택'], 'Bad status move': ['Bad status move', '나쁜 변화기 선택'],
  'Repetitive behavior': ['Repetitive behavior', '반복적인 행동'],
  'Gave free setup': ['Gave free setup', '무료 랭크업을 허용'], 'Switch problem': ['Switch problem', '교체 판단 문제'],
  Other: ['Other', '기타'],
}

export const STRENGTH_LABELS: Record<string, [string, string]> = {
  Weak: ['Weak', '약함'], Normal: ['Normal', '보통'], Strong: ['Strong', '강함'], 'Very strong': ['Very strong', '매우 강함'],
}

const TEAM_LABELS: Record<string, [string, string]> = {
  'adv-balanced': ['ADV Balanced', 'ADV 밸런스'], 'adv-offense': ['ADV Offense', 'ADV 어태커'],
  'adv-bulky-offense': ['ADV Bulky Offense', 'ADV 내구 어태커'], 'setup-heavy': ['Setup Sweepers', '랭크업 스위퍼'],
  'status-stall': ['Status & Stall', '상태이상 & 스톨'], 'setup-immunity': ['Setup & Immunity Traps', '랭크업 & 무효 함정'],
  'rom-npc': ['ROM-like NPC', 'ROM 스타일 NPC'],
}
const CATEGORY_LABELS: Record<string, [string, string]> = {
  balanced: ['balanced', '밸런스'], 'bulky-offense': ['bulky offense', '내구 공격'], offense: ['offense', '공격'], 'stall-status': ['stall/status', '스톨/상태이상'],
  'setup-heavy': ['setup-heavy', '랭크업 중심'], 'immunity-trap': ['immunity trap', '무효 함정'], 'rom-like': ['ROM-like', 'ROM 스타일'],
}

// Official Korean names used by the Pokémon games. Canonical English remains
// in simulator requests and research logs; these mappings are display-only.
export const POKEMON_KO: Record<string, string> = {
  Swampert: '대짱이', Skarmory: '무장조', Blissey: '해피너스', Gengar: '팬텀', Tyranitar: '마기라스', Celebi: '세레비',
  Aerodactyl: '프테라', Salamence: '보만다', Metagross: '메타그로스', Starmie: '아쿠스타', Dugtrio: '닥트리오', Snorlax: '잠만보',
  Milotic: '밀로틱', Forretress: '쏘콘', Dusclops: '미라몽', Claydol: '점토도리', Umbreon: '블래키', Gyarados: '갸라도스',
  Jolteon: '쥬피썬더', Flygon: '플라이곤', Shedinja: '껍질몬', Breloom: '버섯모', Mightyena: '그라에나', Camerupt: '폭타',
  Crobat: '크로뱃', Walrein: '씨카이저', Electrode: '붐볼', Pidgey: '구구', Mewtwo: '뮤츠',
  Suicune: '스이쿤', Magneton: '레어코일', Scizor: '핫삼', Rattata: '꼬렛',
}

export const MOVE_KO: Record<string, string> = {
  Surf: '파도타기', Earthquake: '지진', 'Ice Beam': '냉동빔', Protect: '방어', Spikes: '압정뿌리기', Whirlwind: '날려버리기',
  'Drill Peck': '회전부리', Rest: '잠자기', 'Soft-Boiled': '알낳기', Toxic: '맹독', 'Seismic Toss': '지구던지기', Aromatherapy: '아로마테라피',
  Thunderbolt: '10만볼트', 'Ice Punch': '냉동펀치', 'Will-O-Wisp': '도깨비불', Explosion: '대폭발', 'Rock Slide': '스톤샤워',
  'Hidden Power Bug': '잠재파워 (벌레)', 'Hidden Power Flying': '잠재파워 (비행)', 'Hidden Power Grass': '잠재파워 (풀)', 'Hidden Power': '잠재파워',
  'Dragon Dance': '용의춤', Psychic: '사이코키네시스', 'Leech Seed': '씨뿌리기', Recover: 'HP회복', 'Baton Pass': '바톤터치',
  'Double-Edge': '이판사판태클', 'Fire Blast': '불대문자', 'Meteor Mash': '코멧펀치', 'Aerial Ace': '제비반환', 'Body Slam': '누르기',
  'Shadow Ball': '섀도볼', 'Self-Destruct': '자폭', Refresh: '리프레쉬', 'Rapid Spin': '고속스핀', 'Night Shade': '나이트헤드', Wish: '희망사항',
  Taunt: '도발', Agility: '고속이동', Hypnosis: '최면술', 'Silver Wind': '은빛바람', Spore: '버섯포자', 'Focus Punch': '힘껏펀치',
  'Mach Punch': '마하펀치', Crunch: '깨물어부수기', 'Take Down': '돌진', 'Scary Face': '겁나는얼굴', 'Sand-Attack': '모래뿌리기',
  Flamethrower: '화염방사', Amnesia: '망각술', Bite: '물기', 'Confuse Ray': '이상한빛', Tackle: '몸통박치기',
  'Calm Mind': '명상', Roar: '울부짖기', 'Dragon Claw': '드래곤크루', 'Thunder Wave': '전기자석파', Curse: '저주',
  'Swords Dance': '검무', 'Cross Chop': '크로스촙', 'Sludge Bomb': '오물폭탄', 'Giga Drain': '기가드레인',
  'Light Screen': '빛의장막', 'Hidden Power Rock': '잠재파워 (바위)', 'Hidden Power Ice': '잠재파워 (얼음)', Growl: '울음소리',
}

export const ITEM_KO: Record<string, string> = {
  Leftovers: '먹다남은음식', 'Choice Band': '구애머리띠', 'Lum Berry': '리샘열매',
}

const STATUS_KO: Record<string, string> = {brn: '화상', par: '마비', psn: '독', tox: '맹독', slp: '잠듦', frz: '얼음', fnt: '기절', none: '없음'}
const TYPE_KO: Record<string, string> = {Normal: '노말', Fire: '불꽃', Water: '물', Electric: '전기', Grass: '풀', Ice: '얼음', Fighting: '격투', Poison: '독', Ground: '땅', Flying: '비행', Psychic: '에스퍼', Bug: '벌레', Rock: '바위', Ghost: '고스트', Dragon: '드래곤', Dark: '악', Steel: '강철'}
const STAT_LABELS: Record<string, [string, string]> = {
  atk: ['Atk', '공격'], def: ['Def', '방어'], spa: ['SpA', '특공'], spd: ['SpD', '특방'], spe: ['Spe', '스피드'], accuracy: ['Acc', '명중'], evasion: ['Eva', '회피'],
}
const WEATHER_LABELS: Record<string, [string, string]> = {
  SunnyDay: ['Sun', '쾌청'], RainDance: ['Rain', '비'], Sandstorm: ['Sandstorm', '모래바람'], Hail: ['Hail', '싸라기눈'],
}
const EFFECT_LABELS: Record<string, [string, string]> = {
  Reflect: ['Reflect', '리플렉터'], 'Light Screen': ['Light Screen', '빛의장막'], Safeguard: ['Safeguard', '신비의부적'], Mist: ['Mist', '흰안개'],
  Spikes: ['Spikes', '압정뿌리기'], Substitute: ['Substitute', '대타출동'], confusion: ['Confusion', '혼란'], 'Leech Seed': ['Leech Seed', '씨뿌리기'],
  Taunt: ['Taunt', '도발'], Encore: ['Encore', '앵콜'], Disable: ['Disable', '사슬묶기'], Attract: ['Infatuation', '헤롱헤롱'],
  'Focus Energy': ['Focus Energy', '기충전'], Curse: ['Curse', '저주'], Ingrain: ['Ingrain', '뿌리박기'], Yawn: ['Yawn', '하품'],
  Torment: ['Torment', '트집'], Nightmare: ['Nightmare', '악몽'], 'Mean Look': ['Mean Look', '검은눈빛'], Uproar: ['Uproar', '소란'],
  Bide: ['Bide', '참기'], Charge: ['Charge', '충전'], 'Mud Sport': ['Mud Sport', '흙놀이'], 'Water Sport': ['Water Sport', '물놀이'],
  Foresight: ['Foresight', '꿰뚫어보기'], 'Flash Fire': ['Flash Fire', '타오르는불꽃'],
}

const DEBUG_KO: Record<string, string> = {
  damage: '공격', status: '변화기', setup: '랭크업', debuff: '능력 저하', recovery: '회복', protect: '방어', weather: '날씨', field: '필드', phaze: '강제 교체', pivot: '교체기', self_ko: '자폭', fixed: '고정 대미지', utility: '보조',
  immune: '무효', quarter: '¼배', half: '½배', neutral: '1배', double: '2배', quadruple: '4배', physical: '물리', special: '특수', legal: '사용 가능', illegal: '사용 불가',
}

export function label(pair: [string, string], locale: Locale): string { return pair[locale === 'ko' ? 1 : 0] }
export function teamLabel(id: string, fallback: string, locale: Locale): string { return label(TEAM_LABELS[id] || [fallback, fallback], locale) }
export function categoryLabel(category: string, locale: Locale): string { return label(CATEGORY_LABELS[category] || [category, category], locale) }
export function statusLabel(status: string, locale: Locale): string { return locale === 'ko' ? STATUS_KO[status] || status : status }
export function debugLabel(value: string | null, locale: Locale): string | null { return locale === 'ko' && value ? DEBUG_KO[value] || value : value }
export function statLabel(stat: string, locale: Locale): string { return label(STAT_LABELS[stat] || [stat, stat], locale) }
export function boostLabel(stat: string, stages: number, locale: Locale): string { return `${statLabel(stat, locale)} ${stages > 0 ? '+' : '−'}${Math.abs(stages)}` }
export function weatherLabel(name: string, locale: Locale): string { return label(WEATHER_LABELS[name] || [name, name], locale) }
export function effectLabel(name: string, locale: Locale): string {
  const counter = /^(perish|stockpile)(\d)$/.exec(name)
  if (counter) return counter[1] === 'perish' ? (locale === 'ko' ? `멸망의노래 ${counter[2]}` : `Perish ${counter[2]}`) : (locale === 'ko' ? `비축 ${counter[2]}` : `Stockpile ${counter[2]}`)
  return label(EFFECT_LABELS[name] || [name, name], locale)
}
export function itemName(value: string, locale: Locale): string { return locale === 'ko' ? ITEM_KO[value] || value : value }

export function battleName(value: string, locale: Locale): string {
  if (locale === 'en') return value
  if (value.startsWith('Switch to ')) return `${battleName(value.slice(10), locale)}로 교체`
  if (value.startsWith('Switch option ')) return `교체 선택지 ${value.slice(14)}`
  if (value.startsWith('Move slot ')) return `기술 칸 ${value.slice(10)}`
  const hiddenPower = /^Hidden Power ([A-Za-z]+)(?: (\d+))?$/.exec(value)
  if (hiddenPower) return `잠재파워 (${TYPE_KO[hiddenPower[1]] || hiddenPower[1]})${hiddenPower[2] ? ` ${hiddenPower[2]}` : ''}`
  if (MOVE_KO[value]) return MOVE_KO[value]
  if (POKEMON_KO[value]) return POKEMON_KO[value]
  let translated = value
  for (const [english, korean] of Object.entries(POKEMON_KO).sort(([a], [b]) => b.length - a.length)) translated = translated.replaceAll(english, korean)
  return translated
}

export function conditionLabel(condition: string, locale: Locale): string {
  if (condition.includes('fnt')) return locale === 'ko' ? '기절' : 'fainted'
  const match = condition.match(/(\d+)\/(\d+)(?:\s+(\w+))?/)
  return match ? `${Math.round(Number(match[1]) / Number(match[2]) * 100)}%${match[3] ? ` · ${statusLabel(match[3], locale)}` : ''}` : condition
}
