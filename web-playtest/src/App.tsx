import {useEffect, useMemo, useState, type CSSProperties} from 'react'
import {TEAM_FIXTURES} from './data/teams'
import {POLICY_IDS} from './policy/assets'
import {randomPolicy, randomSeed} from './policy/selection'
import {battleName, boostLabel, categoryLabel, conditionLabel, debugLabel, effectLabel, FLAG_LABELS, itemName, label, statusLabel, STRENGTH_LABELS, teamLabel, UI, weatherLabel, type Locale} from './i18n'
import {readableLine} from './battleLog'
import {clearActive, copyJson, createResearchLog, downloadJson, downloadJsonl, FEEDBACK_COMMENT_MAX, finalizeLog, FLAG_COMMENT_MAX, flagTurn, loadActive, loadArchive, researchPayload, saveActive} from './research/logging'
import {archiveFinalLog, pendingUploadCount, remoteSubmissionEnabled, setRemoteSubmissionEnabled, uploadPending} from './research/remote'
import type {BattleApiInput, BattleFeedback, BattleResponse, LutContribution, PublicPokemonState, PublicSideState, RemoteSubmission, ResearchLog} from './types'

const FLAG_CATEGORIES = Object.keys(FLAG_LABELS)
/** `remote`/`localSaved` describe the finished battle's archive entry (kept here too in case the local save failed). */
type Session = {input: BattleApiInput; response: BattleResponse; log: ResearchLog; blind: boolean; debug: boolean; remote?: RemoteSubmission; localSaved?: boolean}

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

function StatChips({mon, locale}: {mon: PublicPokemonState | null | undefined; locale: Locale}) {
  if (!mon || mon.fainted) return null
  const t = UI[locale]; const boosts = Object.entries(mon.boosts)
  return <div className="modifiers" aria-label={t.statStages}>
    {boosts.length ? boosts.map(([stat, stages]) => <b key={stat} className={`boostTag ${stages! > 0 ? 'up' : 'down'}`}>{boostLabel(stat, stages!, locale)}</b>)
      : <span className="noModifiers">{t.noStatChanges}</span>}
    {mon.volatiles.map(name => <b key={name} className="volatileTag">{effectLabel(name, locale)}</b>)}
  </div>
}

function SideConditions({side, locale}: {side: PublicSideState; locale: Locale}) {
  const t = UI[locale]
  if (!side.conditions.length) return <span className="noModifiers">{t.noSideEffects}</span>
  return <>{side.conditions.map(condition => <b key={condition.name} className="sideTag">
    {effectLabel(condition.name, locale)}{condition.layers ? ` ×${condition.layers}` : ''}
    {condition.turns_remaining != null && <small> · {condition.turns_remaining} {t.turnsLeft}</small>}
  </b>)}</>
}

/** Where this battle's research data is: always local first, then the optional upload. */
function ResearchStatus({locale, localSaved, remote, remoteEnabled, uploading, onRetry}: {
  locale: Locale; localSaved: boolean; remote?: RemoteSubmission; remoteEnabled: boolean; uploading: boolean; onRetry: () => void
}) {
  const t = UI[locale]
  const uploaded = remote?.status === 'uploaded' && remote.uploaded_revision === remote.revision
  let line
  if (!remote) line = <span className="muted">— {t.notSubmitted}</span>
  else if (uploaded) line = <span className="ok">✓ {t.uploaded}</span>
  else if (remote.status === 'failed') line = <span className="bad">✗ {t.uploadRejected}{remote.last_error ? ` (${remote.last_error})` : ''}</span>
  else if (uploading && remoteEnabled) line = <span className="muted">… {t.uploading}</span>
  else line = <span className="warn">⚠ {remoteEnabled ? t.uploadPending : t.uploadPaused} {remoteEnabled && <button onClick={onRetry}>{t.retryUploads}</button>}</span>
  return <div className="researchStatus" role="status"><strong>{t.researchData}</strong>
    {localSaved ? <span className="ok">✓ {t.savedLocally}</span> : <span className="bad">⚠ {t.notSavedLocally}</span>}
    {line}
  </div>
}

function largestContributions(contributions: LutContribution[] | null, count = 8): LutContribution[] {
  if (!contributions) return []
  return [...contributions].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, count)
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => localStorage.getItem('gen3-lut-locale') === 'ko' ? 'ko' : 'en')
  const [humanTeam, setHumanTeam] = useState('adv-balanced'); const [aiTeam, setAiTeam] = useState('adv-balanced')
  const [blind, setBlind] = useState(true); const [policy, setPolicy] = useState<string>('v1.1-100m'); const [debug, setDebug] = useState(false)
  const [session, setSession] = useState<Session | null>(() => loadActive<Session>())
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [flagOpen, setFlagOpen] = useState(false)
  const [flagCategory, setFlagCategory] = useState(FLAG_CATEGORIES[0]); const [flagComment, setFlagComment] = useState('')
  const [feedback, setFeedback] = useState<BattleFeedback>({}); const [archiveCount, setArchiveCount] = useState(() => loadArchive().length)
  const [remoteEnabled, setRemoteEnabled] = useState(remoteSubmissionEnabled); const [uploading, setUploading] = useState(false)
  const [uploadTick, setUploadTick] = useState(0)
  const t = UI[locale]
  const pendingCount = useMemo(() => pendingUploadCount(), [uploadTick, archiveCount])
  const battleId = session?.input.battle_id
  const archivedRemote = useMemo(() => battleId ? loadArchive().find(item => item.metadata.battle_id === battleId)?.remote_submission : undefined, [battleId, session?.log, uploadTick])

  /** Background upload pass; it never blocks play and failures stay pending locally. */
  function runUploads(force = false, extra: ResearchLog[] = []) {
    setUploading(true)
    void uploadPending({force, extra}).then(() => {
      for (const entry of extra) setSession(current => current && current.input.battle_id === entry.metadata.battle_id ? {...current, remote: entry.remote_submission} : current)
    }).catch(() => { /* uploads are best-effort; state stays pending */ }).finally(() => { setUploading(false); setUploadTick(value => value + 1) })
  }
  useEffect(() => {
    runUploads()
    const retry = () => runUploads()
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])
  function toggleRemote(enabled: boolean) {
    setRemoteSubmissionEnabled(enabled); setRemoteEnabled(enabled)
    if (enabled) runUploads()
  }
  /** Save a finished log locally first, then queue its upload. */
  function archiveFinished(base: Session, log: ResearchLog): Session {
    const stored = archiveFinalLog(log, {remote: remoteEnabled, previous: base.remote})
    if (!stored.saved) setError(`${t.archiveFull} (${stored.error})`)
    setArchiveCount(loadArchive().length)
    runUploads(false, stored.saved ? [] : [stored.entry])
    return {...base, log, remote: stored.entry.remote_submission, localSaved: stored.saved}
  }
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
      const response = await battleRequest(input)
      const next = {input, response, log: createResearchLog(response, humanTeam, aiTeam, [], blind), blind, debug}
      setSession(next); saveActive(next)
    } catch (problem) { setError(problem instanceof Error ? problem.message : String(problem)) }
    finally { setLoading(false) }
  }
  async function act(choice: string) {
    if (!session) return; setLoading(true); setError('')
    try {
      const input = {...session.input, human_choices: [...session.input.human_choices, choice]}; const response = await battleRequest(input)
      const log = {...session.log, human_choices: input.human_choices, human_actions: response.human_actions, ai_decisions: response.ai_decisions, public_log: response.public_log}
      let next: Session = {...session, input, response, log}
      if (response.terminal) next = archiveFinished(next, finalizeLog(log, response))
      setSession(next); saveActive(next)
    } catch (problem) { setError(problem instanceof Error ? problem.message : String(problem)) }
    finally { setLoading(false) }
  }
  function submitFlag() {
    if (!session) return; const decision = session.response.ai_decisions.at(-1); if (!decision) return
    const log = flagTurn(session.log, decision.turn, decision.chosen_action.label, flagCategory, flagComment || undefined)
    const next = session.response.terminal ? archiveFinished(session, log) : {...session, log}
    setSession(next); saveActive(next)
    setFlagOpen(false); setFlagComment('')
  }
  function submitFeedback() {
    if (!session) return
    const next = archiveFinished(session, finalizeLog(session.log, session.response, feedback))
    setSession(next); saveActive(next)
  }
  function reset() { setSession(null); clearActive(); setFeedback({}); setFlagOpen(false) }
  function exportArchive(format: 'json' | 'jsonl') {
    const battles = loadArchive().map(researchPayload)
    if (format === 'jsonl') downloadJsonl('gen3-lut-playtest-session.jsonl', battles)
    else downloadJson('gen3-lut-playtest-session.json', {exported_at: new Date().toISOString(), battles})
  }

  if (!session) return <main className="shell">
    {appChrome}
    <div className="roomTab"><span>●</span> {t.title}</div>
    <section className="lobbyWindow">
      <header className="lobbyHero"><div className="heroBall"><span/></div><div><p className="eyebrow">{t.researchTool}</p><h1>{t.title}</h1><p>{t.intro}</p></div></header>
      <section className="panel setup">
      <label>{t.yourTeam}<select value={humanTeam} onChange={event => setHumanTeam(event.target.value)}>{TEAM_FIXTURES.map(team => <option key={team.id} value={team.id}>{teamLabel(team.id, team.name, locale)} · {categoryLabel(team.category, locale)}</option>)}</select></label>
      <label>{t.aiTeam}<select value={aiTeam} onChange={event => setAiTeam(event.target.value)}>{TEAM_FIXTURES.map(team => <option key={team.id} value={team.id}>{teamLabel(team.id, team.name, locale)} · {categoryLabel(team.category, locale)}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={blind} onChange={event => setBlind(event.target.checked)}/> {t.blindTest}</label>
      {blind ? <p className="note">{t.blindNote}</p>
        : <label>{t.checkpoint}<select value={policy} onChange={event => setPolicy(event.target.value)}>{POLICY_IDS.map(id => <option key={id}>{id}</option>)}</select></label>}
      <label className="check"><input type="checkbox" checked={debug} onChange={event => setDebug(event.target.checked)}/> {t.debugMode}</label>
      <div className="researchNotice">
        <p>{t.remoteNotice}</p>
        <label className="check"><input type="checkbox" checked={remoteEnabled} onChange={event => toggleRemote(event.target.checked)}/> {t.submitForResearch}</label>
        {!remoteEnabled && <p className="note">{t.remoteOffNote}</p>}
        {pendingCount > 0 && <p className="note">{t.uploadsPending}: {pendingCount} <button disabled={uploading || !remoteEnabled} onClick={() => runUploads(true)}>{uploading ? t.uploading : t.retryUploads}</button></p>}
      </div>
      <button className="primary" disabled={loading} onClick={startBattle}>{loading ? t.starting : t.startBattle}</button>
      {archiveCount > 0 && <><button onClick={() => exportArchive('json')}>{t.downloadArchive} ({archiveCount})</button><button onClick={() => exportArchive('jsonl')}>{t.downloadAllJsonl}</button></>}
      {error && <p className="error">{error}</p>}
      </section>
      <p className="note">{t.simulator}: Pokémon Showdown ({t.pinned}) 2ddfa047 · {t.format}: gen3customgame · {t.schema}: gen3-lut-v1.1 · {t.cleanOnly}</p>
    </section>
  </main>

  const {response, log} = session; const own = response.request?.side?.pokemon.find(mon => mon.active); const target = response.request?.public?.target
  const lastDecision = response.ai_decisions.at(-1)
  const revealPolicy = !session.blind || response.terminal
  const provenance = response.policy_provenance
  const ownName = String(own?.details || own?.ident || t.unknown).split(',')[0].replace(/^p\d: /, '')
  const ownHp = hpPercent(own?.condition)
  // Sessions saved before public_state existed fall back to the bucketed target view.
  const battleState = response.public_state; const opponentActive = battleState?.opponent.active; const ownActive = battleState?.self.active
  const targetHp = opponentActive ? opponentActive.hp_percent : target ? [0, 25, 50, 75, 100][target.hpBucket] : 0
  const targetStatus = opponentActive ? opponentActive.status : target?.status
  const moves = response.legal_actions.filter(action => action.kind === 'move'); const switches = response.legal_actions.filter(action => action.kind === 'switch')
  const party = response.request?.side?.pokemon || []
  return <main className="shell battle">
    {appChrome}
    <div className="roomTab battleRoomTab"><span>●</span> {t.battle} {response.battle_id.slice(0, 8)} <button onClick={reset}>×</button></div>
    <header className="battleHeader"><div><p className="eyebrow">[Gen 3] Custom Game</p><h1>{response.terminal ? t.battleComplete : locale === 'ko' ? `${response.turn}턴` : `${t.turn} ${response.turn}`}</h1></div><button onClick={reset}>{t.newBattle}</button></header>
    <div className="battleGrid">
      <section className="panel field">
        <div className="battleStage">
          <article className="pokemonSide opponentSide"><div className="pokemonCard"><span className="playerLabel">{t.opponent}</span><h2>{battleName(target?.species || t.unknown, locale)}</h2><div className="hpTrack"><span className="hpFill" style={hpStyle(targetHp)}/></div><p>{opponentActive ? <>{t.hp}: {opponentActive.fainted ? t.fainted : `${opponentActive.hp_percent}%`}</> : <>{t.hpBucket}: {target ? [t.fainted, '≤25%', '≤50%', '≤75%', '>75%'][target.hpBucket] : '—'}</>} {targetStatus && <b className={`statusTag ${targetStatus}`}>{statusLabel(targetStatus, locale)}</b>}</p><StatChips mon={opponentActive} locale={locale}/></div>{target?.species && <img className="pokemonSprite front" src={spriteUrl(target.species)} alt={battleName(target.species, locale)}/>}</article>
          <div className="battleCenter"><span>{locale === 'ko' ? `${response.turn}턴` : `Turn ${response.turn}`}</span>{battleState?.weather && <span className={`weatherTag ${battleState.weather.name}`}>{weatherLabel(battleState.weather.name, locale)}</span>}</div>
          <article className="pokemonSide ownSide">{ownName !== t.unknown && <img className="pokemonSprite back" src={spriteUrl(ownName, true)} alt={battleName(ownName, locale)}/>}<div className="pokemonCard"><span className="playerLabel">{t.you}</span><h2>{battleName(ownName, locale)}</h2><div className="hpTrack"><span className="hpFill" style={hpStyle(ownHp)}/></div><p>{t.hp}: {conditionLabel(own?.condition || '', locale)}{ownActive?.hp && !ownActive.fainted ? ` (${ownActive.hp[0]}/${ownActive.hp[1]})` : ''}</p><StatChips mon={ownActive} locale={locale}/></div></article>
          <div className="teamPreview ownTeam" aria-label={t.yourTeam}>{response.request?.side?.pokemon.map((mon, index) => <span key={index} className={`teamBall ${mon.condition.includes('fnt') ? 'fainted' : ''} ${mon.active ? 'active' : ''}`} title={battleName(String(mon.details || mon.ident || ''), locale)}/>)}</div>
        </div>
        {battleState && <section className="fieldState" aria-label={t.battleState}>
          <div><span className="fieldLabel">{t.weather}</span>{battleState.weather
            ? <b className={`weatherTag ${battleState.weather.name}`}>{weatherLabel(battleState.weather.name, locale)}<small> · {battleState.weather.turns_remaining == null ? t.permanent : `${battleState.weather.turns_remaining} ${t.turnsLeft}`}</small></b>
            : <span className="noModifiers">{t.clearWeather}</span>}</div>
          <div><span className="fieldLabel">{t.opponentSide}</span><SideConditions side={battleState.opponent} locale={locale}/></div>
          <div><span className="fieldLabel">{t.yourSide}</span><SideConditions side={battleState.self} locale={locale}/></div>
          {battleState.opponent.revealed.length > 0 && <div><span className="fieldLabel">{t.revealed}</span>{battleState.opponent.revealed.map((mon, index) => <b key={`${mon.species}-${index}`} className={`revealedTag ${mon.fainted ? 'fainted' : ''}`}>
            {battleName(mon.species, locale)} {mon.fainted ? t.fainted : `${mon.hp_percent}%`}{mon.status && !mon.fainted ? ` · ${statusLabel(mon.status, locale)}` : ''}</b>)}</div>}
        </section>}
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
          {flagOpen && <div className="flagForm"><label>{t.whatWrong}<select value={flagCategory} onChange={event => setFlagCategory(event.target.value)}>{FLAG_CATEGORIES.map(value => <option key={value} value={value}>{label(FLAG_LABELS[value], locale)}</option>)}</select></label><label>{t.optionalNote}<input value={flagComment} maxLength={FLAG_COMMENT_MAX} onChange={event => setFlagComment(event.target.value)} placeholder={t.shortNote}/></label><button onClick={submitFlag}>{t.saveFlag}</button></div>}</div>}
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
    {session.debug && <section className="panel debug"><h2>{t.developerView}</h2>
      <div className="debugMeta">
        <code>{t.policy} {revealPolicy ? response.policy_id : `— (${t.hiddenUntilEnd})`}</code>
        <code>{t.schema} {response.feature_schema}</code>
        <code>{t.seed} {response.seed.join(',')}</code>
        <code>{t.margin} {lastDecision?.margin?.toFixed(4) ?? '—'}</code>
        <code>{t.mask} {lastDecision?.legal_action_mask.map(Number).join('') || '—'}</code>
        <code>{t.intScore} {lastDecision?.quantized_top1_score ?? '—'}</code>
        <code>{t.resolvedTypes} {lastDecision?.resolved_defender_types.join('/') || '—'}</code>
      </div>
      {lastDecision && <table><thead><tr><th>{t.action}</th><th>{t.legal}</th><th>{t.score}</th><th>{t.intScore}</th><th>{t.role}</th><th>{t.moveClass}</th><th>{t.applies}</th><th>{t.effect}</th><th>{t.featureIds}</th></tr></thead><tbody>
        {lastDecision.candidates.map(action => <tr className={action.index === lastDecision.chosen_action.index ? 'chosen' : ''} key={action.index}>
          <td>{battleName(action.label, locale)}</td><td>{action.legal ? t.yes : t.no}</td>
          <td>{action.score?.toFixed(5) ?? '—'}</td><td>{action.quantized_score ?? '—'}</td>
          <td>{debugLabel(action.move_role, locale) || '—'}</td><td>{action.move_class || '—'}</td>
          <td>{action.applicable == null ? '—' : action.applicable ? t.yes : t.no}</td>
          <td>{debugLabel(action.effectiveness, locale) || '—'}</td>
          <td><code>{action.activated_feature_ids?.join(', ') || '—'}</code></td>
        </tr>)}
      </tbody></table>}
      {lastDecision && <div className="debugContributions"><h3>{t.topContributions}</h3><table><thead><tr><th>{t.featureIds}</th><th>{t.role}</th><th>{t.score}</th></tr></thead><tbody>
        {largestContributions(lastDecision.chosen_action.contributions).map(term => <tr key={term.global_id}>
          <td><code>#{term.global_id} {term.term}</code></td><td>{term.category}</td><td>{term.weight.toFixed(5)}</td>
        </tr>)}
      </tbody></table></div>}
    </section>}
    {response.terminal && <section className="panel finish"><p className="eyebrow">{t.result}</p><h2>{response.winner === 'Human' ? t.youWon : response.winner === 'AI' ? t.aiWon : t.tie}</h2>
      <p>{t.policyRevealed}: <strong>{response.policy_id}</strong></p>
      <p className="note">{t.trainingDecisions}: {provenance.checkpoint_decisions.toLocaleString()} · {t.schema}: {provenance.schema_version} · {t.sourceCheckpoint}: <code>{provenance.checkpoint_sha256?.slice(0, 12)}</code> · {t.quantScale}: {provenance.quantization_mode} ×{provenance.quantization_scale?.toFixed(3)}</p>
      <div className="survey"><label>{t.strengthQuestion}<select value={feedback.strength || ''} onChange={event => setFeedback({...feedback, strength: event.target.value})}><option value="">{t.choose}</option>{Object.keys(STRENGTH_LABELS).map(value => <option key={value} value={value}>{label(STRENGTH_LABELS[value], locale)}</option>)}</select></label>
        <label>{t.irrationalQuestion}<select value={feedback.irrational == null ? '' : String(feedback.irrational)} onChange={event => setFeedback({...feedback, irrational: event.target.value === 'true'})}><option value="">{t.choose}</option><option value="true">{t.yes}</option><option value="false">{t.no}</option></select></label>
        <label>{t.cheatingQuestion}<select value={feedback.cheating == null ? '' : String(feedback.cheating)} onChange={event => setFeedback({...feedback, cheating: event.target.value === 'true'})}><option value="">{t.choose}</option><option value="true">{t.yes}</option><option value="false">{t.no}</option></select></label>
        <label>{t.optionalComment}<textarea value={feedback.comment || ''} maxLength={FEEDBACK_COMMENT_MAX} onChange={event => setFeedback({...feedback, comment: event.target.value})}/></label><button className="primary" onClick={submitFeedback}>{t.saveFeedback}</button></div>
      <ResearchStatus locale={locale} localSaved={Boolean(archivedRemote) || session.localSaved !== false} remote={archivedRemote ?? session.remote}
        remoteEnabled={remoteEnabled} uploading={uploading} onRetry={() => runUploads(true)}/>
      <div className="exports"><button onClick={() => downloadJson(`playtest-${response.battle_id}.json`, log)}>{t.downloadLog}</button><button onClick={() => copyJson(log)}>{t.copyJson}</button><button onClick={() => exportArchive('json')}>{t.downloadAll}</button><button onClick={() => exportArchive('jsonl')}>{t.downloadAllJsonl}</button></div>
    </section>}
  </main>
}
