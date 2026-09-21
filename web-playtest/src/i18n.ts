export type Locale = 'en' | 'ko'

export const UI = {
  en: {
    researchTool: 'Gen 3 research tool', title: 'Human vs. V1 LUT', intro: 'Play a real pinned-Showdown battle, flag strange decisions, then export the evidence.',
    yourTeam: 'Your team', aiTeam: 'AI team', blindTest: 'Blind checkpoint test', checkpoint: 'Checkpoint', debugMode: 'Developer/debug mode',
    starting: 'Starting…', startBattle: 'Start battle', downloadArchive: 'Download session archive', simulator: 'Simulator', pinned: 'pinned', format: 'format', schema: 'schema',
    battle: 'Battle', battleComplete: 'Battle complete', turn: 'Turn', newBattle: 'New battle', opponent: 'Opponent', you: 'You', unknown: 'Unknown', hpBucket: 'HP bucket', hp: 'HP', status: 'Status', none: 'none', fainted: 'fainted',
    chooseAction: 'Choose an action', replaying: 'Replaying the deterministic battle…', wrongDecision: '🚩 AI decision looked wrong', whatWrong: 'What looked wrong?', optionalNote: 'Optional note', shortNote: 'Short note', saveFlag: 'Save flag', battleLog: 'Battle log',
    developerView: 'Developer view', policy: 'policy', seed: 'seed', margin: 'margin', mask: 'mask', action: 'Action', legal: 'Legal', score: 'Score', role: 'Role', effect: 'Effect', featureIds: 'Feature IDs', yes: 'Yes', no: 'No',
    result: 'Result', youWon: 'You won', aiWon: 'V1 LUT won', tie: 'Tie', policyRevealed: 'Policy revealed', strengthQuestion: 'How strong did the AI feel?', choose: 'Choose…', irrationalQuestion: 'Any obviously irrational action?', cheatingQuestion: 'Did anything feel like cheating?', optionalComment: 'Optional comment', saveFeedback: 'Save feedback',
    downloadLog: 'Download playtest log', copyJson: 'Copy JSON', downloadAll: 'Download all local battles', language: 'Language', battleRoom: 'Battle room', moves: 'Moves', switchPokemon: 'Switch Pokémon', research: 'Research', partyOverview: 'Your party', active: 'Active', reserve: 'Reserve', partySets: 'Party moves & held items', heldItem: 'Held item', noItem: 'No held item',
  },
  ko: {
    researchTool: '3세대 연구 도구', title: '플레이어 vs. V1 LUT', intro: '버전이 고정된 Pokémon Showdown으로 실제 배틀을 진행하고, 이상한 판단을 표시한 뒤 데이터를 내보내세요.',
    yourTeam: '내 팀', aiTeam: 'AI 팀', blindTest: '체크포인트 블라인드 테스트', checkpoint: '체크포인트', debugMode: '개발자/디버그 모드',
    starting: '시작 중…', startBattle: '배틀 시작', downloadArchive: '세션 기록 다운로드', simulator: '시뮬레이터', pinned: '버전 고정', format: '포맷', schema: '스키마',
    battle: '배틀', battleComplete: '배틀 종료', turn: '턴', newBattle: '새 배틀', opponent: '상대', you: '나', unknown: '알 수 없음', hpBucket: 'HP 구간', hp: 'HP', status: '상태', none: '없음', fainted: '기절',
    chooseAction: '행동을 선택하세요', replaying: '결정론적 배틀을 재현하는 중…', wrongDecision: '🚩 AI의 판단이 이상해 보임', whatWrong: '어떤 점이 이상했나요?', optionalNote: '선택 메모', shortNote: '짧은 메모', saveFlag: '표시 저장', battleLog: '배틀 로그',
    developerView: '개발자 화면', policy: '정책', seed: '시드', margin: '점수 차', mask: '마스크', action: '행동', legal: '사용 가능', score: '점수', role: '역할', effect: '효과', featureIds: '특징 ID', yes: '예', no: '아니요',
    result: '결과', youWon: '승리했습니다', aiWon: 'V1 LUT가 승리했습니다', tie: '무승부', policyRevealed: '공개된 정책', strengthQuestion: 'AI가 얼마나 강하게 느껴졌나요?', choose: '선택…', irrationalQuestion: '명백히 비합리적인 행동이 있었나요?', cheatingQuestion: 'AI가 부정행위를 한다고 느낀 점이 있었나요?', optionalComment: '선택 의견', saveFeedback: '의견 저장',
    downloadLog: '플레이테스트 기록 다운로드', copyJson: 'JSON 복사', downloadAll: '로컬 배틀 전체 다운로드', language: '언어', battleRoom: '배틀 룸', moves: '기술', switchPokemon: '포켓몬 교체', research: '연구', partyOverview: '내 파티', active: '배틀 중', reserve: '대기', partySets: '파티 기술 및 지닌물건', heldItem: '지닌물건', noItem: '지닌물건 없음',
  },
} as const

export const FLAG_LABELS: Record<string, [string, string]> = {
  'Bad attack': ['Bad attack', '나쁜 공격 선택'], 'Missed KO': ['Missed KO', 'KO 기회를 놓침'],
  'Immunity/resistance mistake': ['Immunity/resistance mistake', '무효/반감 판단 실수'], 'Bad recovery': ['Bad recovery', '나쁜 회복 선택'],
  'Bad setup': ['Bad setup', '나쁜 랭크업 선택'], 'Bad status move': ['Bad status move', '나쁜 변화기 선택'],
  'Repetitive behavior': ['Repetitive behavior', '반복적인 행동'], Other: ['Other', '기타'],
}

export const STRENGTH_LABELS: Record<string, [string, string]> = {
  Weak: ['Weak', '약함'], Normal: ['Normal', '보통'], Strong: ['Strong', '강함'], 'Very strong': ['Very strong', '매우 강함'],
}

const TEAM_LABELS: Record<string, [string, string]> = {
  'adv-balanced': ['ADV Balanced', 'ADV 밸런스'], 'adv-offense': ['ADV Offense', 'ADV 어태커'],
  'status-stall': ['Status & Stall', '상태이상 & 스톨'], 'setup-immunity': ['Setup & Immunity Traps', '랭크업 & 무효 함정'],
  'rom-npc': ['ROM-like NPC', 'ROM 스타일 NPC'],
}
const CATEGORY_LABELS: Record<string, [string, string]> = {
  balanced: ['balanced', '밸런스'], offense: ['offense', '공격'], 'stall-status': ['stall/status', '스톨/상태이상'],
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
}

export const ITEM_KO: Record<string, string> = {
  Leftovers: '먹다남은음식', 'Choice Band': '구애머리띠', 'Lum Berry': '리샘열매',
}

const STATUS_KO: Record<string, string> = {brn: '화상', par: '마비', psn: '독', tox: '맹독', slp: '잠듦', frz: '얼음', fnt: '기절', none: '없음'}
const DEBUG_KO: Record<string, string> = {
  damage: '공격', status: '변화기', setup: '랭크업', debuff: '능력 저하', recovery: '회복', protect: '방어', weather: '날씨', field: '필드', phaze: '강제 교체', pivot: '교체기', self_ko: '자폭', fixed: '고정 대미지', utility: '보조',
  immune: '무효', quarter: '¼배', half: '½배', neutral: '1배', double: '2배', quadruple: '4배', physical: '물리', special: '특수', legal: '사용 가능', illegal: '사용 불가',
}

export function label(pair: [string, string], locale: Locale): string { return pair[locale === 'ko' ? 1 : 0] }
export function teamLabel(id: string, fallback: string, locale: Locale): string { return label(TEAM_LABELS[id] || [fallback, fallback], locale) }
export function categoryLabel(category: string, locale: Locale): string { return label(CATEGORY_LABELS[category] || [category, category], locale) }
export function statusLabel(status: string, locale: Locale): string { return locale === 'ko' ? STATUS_KO[status] || status : status }
export function debugLabel(value: string | null, locale: Locale): string | null { return locale === 'ko' && value ? DEBUG_KO[value] || value : value }
export function itemName(value: string, locale: Locale): string { return locale === 'ko' ? ITEM_KO[value] || value : value }

export function battleName(value: string, locale: Locale): string {
  if (locale === 'en') return value
  if (value.startsWith('Switch to ')) return `${battleName(value.slice(10), locale)}로 교체`
  if (value.startsWith('Switch option ')) return `교체 선택지 ${value.slice(14)}`
  if (value.startsWith('Move slot ')) return `기술 칸 ${value.slice(10)}`
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
