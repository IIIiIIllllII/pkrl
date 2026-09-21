import {useEffect, useMemo, useState, type CSSProperties} from 'react'
import {TEAM_FIXTURES} from './data/teams'
import {POLICY_IDS} from './policy/assets'
import {battleName, categoryLabel, conditionLabel, debugLabel, FLAG_LABELS, itemName, label, statusLabel, STRENGTH_LABELS, teamLabel, UI, type Locale} from './i18n'
import {clearActive, copyJson, createResearchLog, downloadJson, finalizeLog, flagTurn, loadActive, loadArchive, saveActive, saveToArchive} from './research/logging'
import type {BattleApiInput, BattleFeedback, BattleResponse, ResearchLog} from './types'

const FLAG_CATEGORIES = Object.keys(FLAG_LABELS)
type Session = {input: BattleApiInput; response: BattleResponse; log: ResearchLog; blind: boolean; debug: boolean}

function randomSeed(): [number, number, number, number] {
  const values = new Uint16Array(4); crypto.getRandomValues(values); return [...values] as [number, number, number, number]
}
function randomPolicy(): string { const bytes = new Uint8Array(1); crypto.getRandomValues(bytes); return POLICY_IDS[bytes[0] % POLICY_IDS.length] }

function spriteUrl(species: string, back = false): string {
  const id = species.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return `https://play.pokemonshowdown.com/sprites/${back ? 'gen3-back' : 'gen3'}/${id}.png`
}
function hpPercent(condition = ''): number {
  if (condition.includes('fnt')) return 0
  const match = condition.match(/(\d+)\/(\d+)/)
  return match ? Math.round(Number(match[1]) / Number(match[2]) * 100) : 100
}
function hpStyle(percent: number): CSSProperties { return {'--hp': `${Math.max(0, Math.min(100, percent))}%`} as CSSProperties }

async function battleRequest(input: BattleApiInput): Promise<BattleResponse> {
  const response = await fetch('/api/battle', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(input)})
  const body = await response.text()
  let value: {error?: string} & Partial<BattleResponse>
  try { value = JSON.parse(body) }
  catch { throw new Error(`Battle API returned non-JSON (${response.status}): ${body.slice(0, 180) || 'empty response'}`) }
  if (!response.ok || value.error) throw new Error(value.error || `battle API returned ${response.status}`)
  return value as BattleResponse
}

function readableLine(line: string, locale: Locale): string {
  const fields = line.split('|'); const command = fields[1]
  const subject = battleName((fields[2] || '').replace(/^p\da: /, ''), locale)
  if (command === 'turn') return locale === 'ko' ? `${fields[2]}턴` : `Turn ${fields[2]}`
  if (command === 'move') return locale === 'ko' ? `${subject}의 ${battleName(fields[3], locale)}!` : `${subject} used ${fields[3]}.`
  if (['switch', 'drag'].includes(command)) return locale === 'ko' ? `${subject}이(가) 배틀에 나왔다. (${battleName(fields[3], locale)})` : `${subject} entered the battle (${fields[3]}).`
  if (command === '-damage') return `${subject}: ${locale === 'ko' ? conditionLabel(fields[3], locale) : fields[3]}`
  if (command === '-heal') return locale === 'ko' ? `${subject}의 HP가 ${conditionLabel(fields[3], locale)}까지 회복되었다.` : `${subject} healed to ${fields[3]}`
  if (command === '-status') return locale === 'ko' ? `${subject}은(는) ${statusLabel(fields[3], locale)} 상태가 되었다.` : `${subject} became ${fields[3]}.`
  if (command === 'faint') return locale === 'ko' ? `${subject}은(는) 쓰러졌다.` : `${subject} fainted.`
  if (command === 'win') return locale === 'ko' ? `${subject === 'Human' ? '플레이어' : subject}의 승리!` : `${fields[2]} won.`
  return ''
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => localStorage.getItem('gen3-lut-locale') === 'ko' ? 'ko' : 'en')
  const [humanTeam, setHumanTeam] = useState('adv-balanced'); const [aiTeam, setAiTeam] = useState('adv-balanced')
  const [blind, setBlind] = useState(true); const [policy, setPolicy] = useState<string>('v1-100m'); const [debug, setDebug] = useState(false)
  const [session, setSession] = useState<Session | null>(() => loadActive<Session>())
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [flagOpen, setFlagOpen] = useState(false)
  const [flagCategory, setFlagCategory] = useState(FLAG_CATEGORIES[0]); const [flagComment, setFlagComment] = useState('')
  const [feedback, setFeedback] = useState<BattleFeedback>({}); const [archiveCount, setArchiveCount] = useState(() => loadArchive().length)
  const t = UI[locale]
  const visibleLog = useMemo(() => (session?.response.public_log || []).map(line => readableLine(line, locale)).filter(Boolean).slice(-24), [session, locale])
  useEffect(() => { localStorage.setItem('gen3-lut-locale', locale); document.documentElement.lang = locale }, [locale])

  const appChrome = <div className="appChrome"><div className="brand"><span className="brandBall"/>PKRL <strong>Showdown</strong></div><div className="appTabs"><span className="appTab active">{t.battleRoom}</span><span className="appTab">{t.research}</span></div><nav className="languageTabs" aria-label={t.language}>
    <button className={locale === 'en' ? 'active' : ''} aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
    <button className={locale === 'ko' ? 'active' : ''} aria-pressed={locale === 'ko'} onClick={() => setLocale('ko')}>한국어</button>
  </nav></div>

  async function startBattle() {
    setLoading(true); setError('')
    try {
      const selectedPolicy = blind ? randomPolicy() : policy
      const input: BattleApiInput = {battle_id: crypto.randomUUID(), seed: randomSeed(), policy_id: selectedPolicy, human_team_id: humanTeam, ai_team_id: aiTeam, human_choices: []}
      const response = await battleRequest(input); const next = {input, response, log: createResearchLog(response, humanTeam, aiTeam, []), blind, debug}
      setSession(next); saveActive(next)
    } catch (problem) { setError(problem instanceof Error ? problem.message : String(problem)) }
    finally { setLoading(false) }
  }
  async function act(choice: string) {
    if (!session) return; setLoading(true); setError('')
    try {
      const input = {...session.input, human_choices: [...session.input.human_choices, choice]}; const response = await battleRequest(input)
      let log = {...session.log, human_choices: input.human_choices, ai_decisions: response.ai_decisions}
      if (response.terminal) { log = finalizeLog(log, response); saveToArchive(log); setArchiveCount(loadArchive().length) }
      const next = {...session, input, response, log}; setSession(next); saveActive(next)
    } catch (problem) { setError(problem instanceof Error ? problem.message : String(problem)) }
    finally { setLoading(false) }
  }
  function submitFlag() {
    if (!session) return; const decision = session.response.ai_decisions.at(-1); if (!decision) return
    const log = flagTurn(session.log, decision.turn, decision.chosen_action.label, flagCategory, flagComment || undefined)
    const next = {...session, log}; setSession(next); saveActive(next); if (session.response.terminal) saveToArchive(log)
    setFlagOpen(false); setFlagComment('')
  }
  function submitFeedback() {
    if (!session) return; const log = finalizeLog(session.log, session.response, feedback); saveToArchive(log)
    const next = {...session, log}; setSession(next); saveActive(next); setArchiveCount(loadArchive().length)
  }
  function reset() { setSession(null); clearActive(); setFeedback({}); setFlagOpen(false) }

  if (!session) return <main className="shell">
    {appChrome}
    <div className="roomTab"><span>●</span> {t.title}</div>
    <section className="lobbyWindow">
      <header className="lobbyHero"><div className="heroBall"><span/></div><div><p className="eyebrow">{t.researchTool}</p><h1>{t.title}</h1><p>{t.intro}</p></div></header>
      <section className="panel setup">
      <label>{t.yourTeam}<select value={humanTeam} onChange={event => setHumanTeam(event.target.value)}>{TEAM_FIXTURES.map(team => <option key={team.id} value={team.id}>{teamLabel(team.id, team.name, locale)} · {categoryLabel(team.category, locale)}</option>)}</select></label>
      <label>{t.aiTeam}<select value={aiTeam} onChange={event => setAiTeam(event.target.value)}>{TEAM_FIXTURES.map(team => <option key={team.id} value={team.id}>{teamLabel(team.id, team.name, locale)} · {categoryLabel(team.category, locale)}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={blind} onChange={event => setBlind(event.target.checked)}/> {t.blindTest}</label>
      {!blind && <label>{t.checkpoint}<select value={policy} onChange={event => setPolicy(event.target.value)}>{POLICY_IDS.map(id => <option key={id}>{id}</option>)}</select></label>}
      <label className="check"><input type="checkbox" checked={debug} onChange={event => setDebug(event.target.checked)}/> {t.debugMode}</label>
      <button className="primary" disabled={loading} onClick={startBattle}>{loading ? t.starting : t.startBattle}</button>
      {archiveCount > 0 && <button onClick={() => downloadJson('gen3-lut-playtest-session.json', {exported_at: new Date().toISOString(), battles: loadArchive()})}>{t.downloadArchive} ({archiveCount})</button>}
      {error && <p className="error">{error}</p>}
      </section>
      <p className="note">{t.simulator}: Pokémon Showdown ({t.pinned}) 2ddfa047 · {t.format}: gen3customgame · {t.schema}: gen3-lut-v1</p>
    </section>
  </main>

  const {response, log} = session; const own = response.request?.side?.pokemon.find(mon => mon.active); const target = response.request?.public?.target
  const lastDecision = response.ai_decisions.at(-1)
  const ownName = String(own?.details || own?.ident || t.unknown).split(',')[0].replace(/^p\d: /, '')
  const ownHp = hpPercent(own?.condition); const targetHp = target ? [0, 25, 50, 75, 100][target.hpBucket] : 0
  const moves = response.legal_actions.filter(action => action.kind === 'move'); const switches = response.legal_actions.filter(action => action.kind === 'switch')
  const party = response.request?.side?.pokemon || []
  return <main className="shell battle">
    {appChrome}
    <div className="roomTab battleRoomTab"><span>●</span> {t.battle} {response.battle_id.slice(0, 8)} <button onClick={reset}>×</button></div>
    <header className="battleHeader"><div><p className="eyebrow">[Gen 3] Custom Game</p><h1>{response.terminal ? t.battleComplete : locale === 'ko' ? `${response.turn}턴` : `${t.turn} ${response.turn}`}</h1></div><button onClick={reset}>{t.newBattle}</button></header>
    <div className="battleGrid">
      <section className="panel field">
        <div className="battleStage">
          <article className="pokemonSide opponentSide"><div className="pokemonCard"><span className="playerLabel">{t.opponent}</span><h2>{battleName(target?.species || t.unknown, locale)}</h2><div className="hpTrack"><span className="hpFill" style={hpStyle(targetHp)}/></div><p>{t.hpBucket}: {target ? [t.fainted, '≤25%', '≤50%', '≤75%', '>75%'][target.hpBucket] : '—'} {target?.status && <b className={`statusTag ${target.status}`}>{statusLabel(target.status, locale)}</b>}</p></div>{target?.species && <img className="pokemonSprite front" src={spriteUrl(target.species)} alt={battleName(target.species, locale)}/>}</article>
          <div className="battleCenter"><span>{locale === 'ko' ? `${response.turn}턴` : `Turn ${response.turn}`}</span></div>
          <article className="pokemonSide ownSide">{ownName !== t.unknown && <img className="pokemonSprite back" src={spriteUrl(ownName, true)} alt={battleName(ownName, locale)}/>}<div className="pokemonCard"><span className="playerLabel">{t.you}</span><h2>{battleName(ownName, locale)}</h2><div className="hpTrack"><span className="hpFill" style={hpStyle(ownHp)}/></div><p>{t.hp}: {conditionLabel(own?.condition || '', locale)}</p></div></article>
          <div className="teamPreview ownTeam" aria-label={t.yourTeam}>{response.request?.side?.pokemon.map((mon, index) => <span key={index} className={`teamBall ${mon.condition.includes('fnt') ? 'fainted' : ''} ${mon.active ? 'active' : ''}`} title={battleName(String(mon.details || mon.ident || ''), locale)}/>)}</div>
        </div>
        <section className="partyOverview" aria-label={t.partyOverview}><h3>{t.partyOverview}</h3><div className="partyGrid">{party.map((mon, index) => {
          const name = String(mon.details || mon.ident || t.unknown).split(',')[0].replace(/^p\d: /, '')
          const percent = hpPercent(mon.condition); const fainted = mon.condition.includes('fnt')
          return <article className={`partyMember ${mon.active ? 'active' : ''} ${fainted ? 'fainted' : ''}`} key={`${name}-${index}`}>
            <img src={spriteUrl(name)} alt=""/><div className="partyInfo"><strong>{battleName(name, locale)}</strong><span>{fainted ? t.fainted : mon.active ? t.active : t.reserve}</span><div className="miniHp"><i style={hpStyle(percent)}/></div><small>{conditionLabel(mon.condition, locale)}</small></div>
          </article>
        })}</div></section>
        {!response.terminal && <div className="choicePanel"><h3>{t.chooseAction}</h3>{moves.length > 0 && <div className="actionGroup"><span className="groupLabel">{t.moves}</span><div className="moveGrid">{moves.map(action => <button className="moveButton" disabled={loading} key={action.choice} onClick={() => act(action.choice)}><span>◆</span>{battleName(action.label, locale)}<small>PP {response.request?.active?.[0]?.moves[action.index]?.pp ?? '—'}</small></button>)}</div></div>}{switches.length > 0 && <div className="actionGroup switchGroup"><span className="groupLabel">{t.switchPokemon}</span><div className="switchGrid">{switches.map(action => <button disabled={loading} key={action.choice} onClick={() => act(action.choice)}><span>●</span>{battleName(action.label, locale)}</button>)}</div></div>}</div>}
        {loading && <p className="working">{t.replaying}</p>}
        {error && <p className="error">{error}</p>}
        {lastDecision && <div className="flagArea"><button className="flag" onClick={() => setFlagOpen(value => !value)}>{t.wrongDecision}</button>
          {flagOpen && <div className="flagForm"><label>{t.whatWrong}<select value={flagCategory} onChange={event => setFlagCategory(event.target.value)}>{FLAG_CATEGORIES.map(value => <option key={value} value={value}>{label(FLAG_LABELS[value], locale)}</option>)}</select></label><label>{t.optionalNote}<input value={flagComment} onChange={event => setFlagComment(event.target.value)} placeholder={t.shortNote}/></label><button onClick={submitFlag}>{t.saveFlag}</button></div>}</div>}
      </section>
      <aside className="panel log"><h2>{t.battleLog}</h2>{visibleLog.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}</aside>
    </div>
    <section className="panel partySets"><h2>{t.partySets}</h2><div className="setGrid">{party.map((mon, index) => {
      const name = String(mon.details || mon.ident || t.unknown).split(',')[0].replace(/^p\d: /, '')
      return <article className={`setCard ${mon.active ? 'active' : ''} ${mon.condition.includes('fnt') ? 'fainted' : ''}`} key={`set-${name}-${index}`}>
        <header><img src={spriteUrl(name)} alt=""/><div><h3>{battleName(name, locale)}</h3><span>{mon.active ? t.active : mon.condition.includes('fnt') ? t.fainted : t.reserve}</span></div></header>
        <p className="heldItem"><b>{t.heldItem}:</b> {mon.item ? itemName(mon.item, locale) : t.noItem}</p>
        <ul>{(mon.moves || []).map(move => <li key={move}>{battleName(move, locale)}</li>)}</ul>
      </article>
    })}</div></section>
    {session.debug && <section className="panel debug"><h2>{t.developerView}</h2><div className="debugMeta"><code>{t.policy} {response.policy_id}</code><code>{t.seed} {response.seed.join(',')}</code><code>{t.margin} {lastDecision?.margin?.toFixed(4) ?? '—'}</code><code>{t.mask} {lastDecision?.legal_action_mask.map(Number).join('') || '—'}</code></div>{lastDecision && <table><thead><tr><th>{t.action}</th><th>{t.legal}</th><th>{t.score}</th><th>{t.role}</th><th>{t.effect}</th><th>{t.featureIds}</th></tr></thead><tbody>{lastDecision.candidates.map(action => <tr className={action.index === lastDecision.chosen_action.index ? 'chosen' : ''} key={action.index}><td>{battleName(action.label, locale)}</td><td>{action.legal ? t.yes : t.no}</td><td>{action.score?.toFixed(5) ?? '—'}</td><td>{debugLabel(action.move_role, locale) || '—'}</td><td>{debugLabel(action.effectiveness, locale) || '—'}</td><td><code>{action.feature_ids?.join(', ') || '—'}</code></td></tr>)}</tbody></table>}</section>}
    {response.terminal && <section className="panel finish"><p className="eyebrow">{t.result}</p><h2>{response.winner === 'Human' ? t.youWon : response.winner === 'V1 LUT' ? t.aiWon : t.tie}</h2><p>{t.policyRevealed}: <strong>{response.policy_id}</strong></p>
      <div className="survey"><label>{t.strengthQuestion}<select value={feedback.strength || ''} onChange={event => setFeedback({...feedback, strength: event.target.value})}><option value="">{t.choose}</option>{Object.keys(STRENGTH_LABELS).map(value => <option key={value} value={value}>{label(STRENGTH_LABELS[value], locale)}</option>)}</select></label>
        <label>{t.irrationalQuestion}<select value={feedback.irrational == null ? '' : String(feedback.irrational)} onChange={event => setFeedback({...feedback, irrational: event.target.value === 'true'})}><option value="">{t.choose}</option><option value="true">{t.yes}</option><option value="false">{t.no}</option></select></label>
        <label>{t.cheatingQuestion}<select value={feedback.cheating == null ? '' : String(feedback.cheating)} onChange={event => setFeedback({...feedback, cheating: event.target.value === 'true'})}><option value="">{t.choose}</option><option value="true">{t.yes}</option><option value="false">{t.no}</option></select></label>
        <label>{t.optionalComment}<textarea value={feedback.comment || ''} onChange={event => setFeedback({...feedback, comment: event.target.value})}/></label><button className="primary" onClick={submitFeedback}>{t.saveFeedback}</button></div>
      <div className="exports"><button onClick={() => downloadJson(`playtest-${response.battle_id}.json`, log)}>{t.downloadLog}</button><button onClick={() => copyJson(log)}>{t.copyJson}</button><button onClick={() => downloadJson('gen3-lut-playtest-session.json', {exported_at: new Date().toISOString(), battles: loadArchive()})}>{t.downloadAll}</button></div>
    </section>}
  </main>
}
