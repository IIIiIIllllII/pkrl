import {useMemo, useState} from 'react'
import {TEAM_FIXTURES} from './data/teams'
import {POLICY_IDS} from './policy/assets'
import {clearActive, copyJson, createResearchLog, downloadJson, finalizeLog, flagTurn, loadActive, loadArchive, saveActive, saveToArchive} from './research/logging'
import type {BattleApiInput, BattleFeedback, BattleResponse, ResearchLog} from './types'

const FLAG_CATEGORIES = ['Bad attack', 'Missed KO', 'Immunity/resistance mistake', 'Bad recovery', 'Bad setup', 'Bad status move', 'Repetitive behavior', 'Other']
type Session = {input: BattleApiInput; response: BattleResponse; log: ResearchLog; blind: boolean; debug: boolean}

function randomSeed(): [number, number, number, number] {
  const values = new Uint16Array(4); crypto.getRandomValues(values); return [...values] as [number, number, number, number]
}
function randomPolicy(): string { const bytes = new Uint8Array(1); crypto.getRandomValues(bytes); return POLICY_IDS[bytes[0] % POLICY_IDS.length] }

async function battleRequest(input: BattleApiInput): Promise<BattleResponse> {
  const response = await fetch('/api/battle', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(input)})
  const value = await response.json()
  if (!response.ok || value.error) throw new Error(value.error || `battle API returned ${response.status}`)
  return value as BattleResponse
}

function conditionPercent(condition = ''): string {
  if (condition.includes('fnt')) return 'fainted'
  const match = condition.match(/(\d+)\/(\d+)(?:\s+(\w+))?/)
  return match ? `${Math.round(Number(match[1]) / Number(match[2]) * 100)}%${match[3] ? ` · ${match[3]}` : ''}` : condition
}
function readableLine(line: string): string {
  const fields = line.split('|'); const command = fields[1]
  if (command === 'turn') return `Turn ${fields[2]}`
  if (command === 'move') return `${fields[2].replace(/^p\da: /, '')} used ${fields[3]}.`
  if (['switch', 'drag'].includes(command)) return `${fields[2].replace(/^p\da: /, '')} entered the battle (${fields[3]}).`
  if (command === '-damage') return `${fields[2].replace(/^p\da: /, '')}: ${fields[3]}`
  if (command === '-heal') return `${fields[2].replace(/^p\da: /, '')} healed to ${fields[3]}`
  if (command === '-status') return `${fields[2].replace(/^p\da: /, '')} became ${fields[3]}.`
  if (command === 'faint') return `${fields[2].replace(/^p\da: /, '')} fainted.`
  if (command === 'win') return `${fields[2]} won.`
  return ''
}

export default function App() {
  const [humanTeam, setHumanTeam] = useState('adv-balanced'); const [aiTeam, setAiTeam] = useState('adv-balanced')
  const [blind, setBlind] = useState(true); const [policy, setPolicy] = useState<string>('v1-100m'); const [debug, setDebug] = useState(false)
  const [session, setSession] = useState<Session | null>(() => loadActive<Session>())
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [flagOpen, setFlagOpen] = useState(false)
  const [flagCategory, setFlagCategory] = useState(FLAG_CATEGORIES[0]); const [flagComment, setFlagComment] = useState('')
  const [feedback, setFeedback] = useState<BattleFeedback>({}); const [archiveCount, setArchiveCount] = useState(() => loadArchive().length)
  const visibleLog = useMemo(() => (session?.response.public_log || []).map(readableLine).filter(Boolean).slice(-24), [session])

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
    <header><p className="eyebrow">Gen 3 research tool</p><h1>Human vs. V1 LUT</h1><p>Play a real pinned-Showdown battle, flag strange decisions, then export the evidence.</p></header>
    <section className="panel setup">
      <label>Your team<select value={humanTeam} onChange={event => setHumanTeam(event.target.value)}>{TEAM_FIXTURES.map(team => <option key={team.id} value={team.id}>{team.name} · {team.category}</option>)}</select></label>
      <label>AI team<select value={aiTeam} onChange={event => setAiTeam(event.target.value)}>{TEAM_FIXTURES.map(team => <option key={team.id} value={team.id}>{team.name} · {team.category}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={blind} onChange={event => setBlind(event.target.checked)}/> Blind checkpoint test</label>
      {!blind && <label>Checkpoint<select value={policy} onChange={event => setPolicy(event.target.value)}>{POLICY_IDS.map(id => <option key={id}>{id}</option>)}</select></label>}
      <label className="check"><input type="checkbox" checked={debug} onChange={event => setDebug(event.target.checked)}/> Developer/debug mode</label>
      <button className="primary" disabled={loading} onClick={startBattle}>{loading ? 'Starting…' : 'Start battle'}</button>
      {archiveCount > 0 && <button onClick={() => downloadJson('gen3-lut-playtest-session.json', {exported_at: new Date().toISOString(), battles: loadArchive()})}>Download session archive ({archiveCount})</button>}
      {error && <p className="error">{error}</p>}
    </section>
    <p className="note">Simulator: pinned Pokémon Showdown commit 2ddfa047 · format: gen3customgame · schema: gen3-lut-v1</p>
  </main>

  const {response, log} = session; const own = response.request?.side?.pokemon.find(mon => mon.active); const target = response.request?.public?.target
  const lastDecision = response.ai_decisions.at(-1)
  return <main className="shell battle">
    <header className="battleHeader"><div><p className="eyebrow">Battle {response.battle_id.slice(0, 8)}</p><h1>{response.terminal ? 'Battle complete' : `Turn ${response.turn}`}</h1></div><button onClick={reset}>New battle</button></header>
    <div className="battleGrid">
      <section className="panel field">
        <div className="combatants">
          <article><span>Opponent</span><h2>{target?.species || 'Unknown'}</h2><p>HP bucket: {target ? ['fainted', '≤25%', '≤50%', '≤75%', '>75%'][target.hpBucket] : '—'}</p><p>Status: {target?.status || 'none'}</p></article>
          <div className="versus">VS</div>
          <article><span>You</span><h2>{String(own?.details || own?.ident || 'Unknown').split(',')[0].replace(/^p\d: /, '')}</h2><p>HP: {conditionPercent(own?.condition)}</p></article>
        </div>
        {!response.terminal && <div className="actions"><h3>Choose an action</h3>{response.legal_actions.map(action => <button disabled={loading} key={action.choice} onClick={() => act(action.choice)}><span>{action.kind === 'switch' ? '↪' : '◆'}</span>{action.label}</button>)}</div>}
        {loading && <p className="working">Replaying the deterministic battle…</p>}
        {error && <p className="error">{error}</p>}
        {lastDecision && <div className="flagArea"><button className="flag" onClick={() => setFlagOpen(value => !value)}>🚩 AI decision looked wrong</button>
          {flagOpen && <div className="flagForm"><label>What looked wrong?<select value={flagCategory} onChange={event => setFlagCategory(event.target.value)}>{FLAG_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label><label>Optional note<input value={flagComment} onChange={event => setFlagComment(event.target.value)} placeholder="Short note"/></label><button onClick={submitFlag}>Save flag</button></div>}</div>}
      </section>
      <aside className="panel log"><h2>Battle log</h2>{visibleLog.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}</aside>
    </div>
    {session.debug && <section className="panel debug"><h2>Developer view</h2><div className="debugMeta"><code>policy {response.policy_id}</code><code>seed {response.seed.join(',')}</code><code>margin {lastDecision?.margin?.toFixed(4) ?? '—'}</code><code>mask {lastDecision?.legal_action_mask.map(Number).join('') || '—'}</code></div>{lastDecision && <table><thead><tr><th>Action</th><th>Legal</th><th>Score</th><th>Role</th><th>Effect</th><th>Feature IDs</th></tr></thead><tbody>{lastDecision.candidates.map(action => <tr className={action.index === lastDecision.chosen_action.index ? 'chosen' : ''} key={action.index}><td>{action.label}</td><td>{action.legal ? 'yes' : 'no'}</td><td>{action.score?.toFixed(5) ?? '—'}</td><td>{action.move_role || '—'}</td><td>{action.effectiveness || '—'}</td><td><code>{action.feature_ids?.join(', ') || '—'}</code></td></tr>)}</tbody></table>}</section>}
    {response.terminal && <section className="panel finish"><p className="eyebrow">Result</p><h2>{response.winner === 'Human' ? 'You won' : response.winner === 'V1 LUT' ? 'V1 LUT won' : 'Tie'}</h2><p>Policy revealed: <strong>{response.policy_id}</strong></p>
      <div className="survey"><label>How strong did the AI feel?<select value={feedback.strength || ''} onChange={event => setFeedback({...feedback, strength: event.target.value})}><option value="">Choose…</option>{['Weak', 'Normal', 'Strong', 'Very strong'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Any obviously irrational action?<select value={feedback.irrational == null ? '' : String(feedback.irrational)} onChange={event => setFeedback({...feedback, irrational: event.target.value === 'true'})}><option value="">Choose…</option><option value="true">Yes</option><option value="false">No</option></select></label>
        <label>Did anything feel like cheating?<select value={feedback.cheating == null ? '' : String(feedback.cheating)} onChange={event => setFeedback({...feedback, cheating: event.target.value === 'true'})}><option value="">Choose…</option><option value="true">Yes</option><option value="false">No</option></select></label>
        <label>Optional comment<textarea value={feedback.comment || ''} onChange={event => setFeedback({...feedback, comment: event.target.value})}/></label><button className="primary" onClick={submitFeedback}>Save feedback</button></div>
      <div className="exports"><button onClick={() => downloadJson(`playtest-${response.battle_id}.json`, log)}>Download playtest log</button><button onClick={() => copyJson(log)}>Copy JSON</button><button onClick={() => downloadJson('gen3-lut-playtest-session.json', {exported_at: new Date().toISOString(), battles: loadArchive()})}>Download all local battles</button></div>
    </section>}
  </main>
}
