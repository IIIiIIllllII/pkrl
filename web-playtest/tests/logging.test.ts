import {beforeEach, describe, expect, it, vi} from 'vitest'

/** Minimal in-memory Web Storage so the logger's browser paths run under Node. */
class MemoryStorage {
  private store = new Map<string, string>()
  get length(): number { return this.store.size }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null }
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null }
  setItem(key: string, value: string): void { this.store.set(key, String(value)) }
  removeItem(key: string): void { this.store.delete(key) }
  clear(): void { this.store.clear() }
}
Object.assign(globalThis, {Storage: MemoryStorage, localStorage: new MemoryStorage()})
import {
  createResearchLog, finalizeLog, flagTurn, loadArchive, publishLog, RESEARCH_LOG_VERSION,
  remoteSinkName, saveToArchive, setRemoteSink, toJsonl,
} from '../src/research/logging'
import type {AIDecision, BattleResponse, ResearchLog} from '../src/types'

const provenance = {
  policy_id: 'v1.1-50m', schema_version: 'gen3-lut-v1.1', semantics_revision: '2026-09-27-reboot',
  generation: 'clean-v1.1', checkpoint_decisions: 50_003_950, milestone_decisions: 50_000_000,
  checkpoint_sha256: 'a'.repeat(64), parameter_count: 349,
  quantization_mode: 'int8-symmetric-max-abs', quantization_scale: 14.5,
  project_commit: 'b'.repeat(40), pokemon_showdown_commit: '2ddfa0476f8207e12e204b1c69f7c7683b17633c',
  evaluation: null,
}

const decision: AIDecision = {
  battle_id: 'b-1', policy_id: 'v1.1-50m', turn: 8, observation: {turn: 8},
  legal_actions: [{index: 0, choice: 'move 1', label: 'Surf', kind: 'move'}],
  legal_action_mask: [true, false, false, false, false, false, false, false, false],
  candidates: [], chosen_action: {index: 0, label: 'Surf', kind: 'move', legal: true, score: 1.5,
    quantized_score: 22, feature_ids: [], feature_categories: {}, activated_feature_ids: [],
    contributions: [], move_role: 'damage', move_class: 'normal-damage', applicable: true, effectiveness: 'neutral'},
  resolved_defender_types: ['Steel', 'Flying'], top1_score: 1.5, top2_score: 0.25, top2_index: 1,
  margin: 1.25, quantized_top1_score: 22, quantized_selected_action: 0, resulting_visible_events: ['|move|p2a: X|Surf'],
  answer_availability: {classification: 'no_answer_existed', active_answers: [], bench_answers: [], chosen_was_answer: false},
}

const response: BattleResponse = {
  battle_id: 'b-1', seed: [1, 2, 3, 4], simulator: 'pinned', feature_schema: 'gen3-lut-v1.1',
  policy_id: 'v1.1-50m', policy_provenance: provenance, request: null, legal_actions: [],
  public_log: ['|turn|8', '|move|p2a: X|Surf'], turn: 12, ai_decisions: [decision],
  human_actions: [{turn: 8, choice: 'move 1', label: 'Protect', kind: 'move'}],
  terminal: true, winner: 'Human',
}

describe('research logging', () => {
  beforeEach(() => { setRemoteSink(null); localStorage.clear() })

  it('captures policy provenance, blind mode and the public log', () => {
    const log = createResearchLog(response, 'human-team', 'ai-team', ['move 1'], true)
    expect(log.metadata).toMatchObject({
      battle_id: 'b-1', hidden_policy_id: 'v1.1-50m', blind_checkpoint_test: true,
      feature_schema: 'gen3-lut-v1.1', research_log_version: RESEARCH_LOG_VERSION,
      hidden_debug_state_included: false, human_team_id: 'human-team', ai_team_id: 'ai-team',
    })
    expect(log.metadata.policy_provenance).toEqual(provenance)
    expect(log.public_log).toEqual(response.public_log)
    expect(log.human_actions).toEqual(response.human_actions)
    expect(log.ai_decisions[0].margin).toBe(1.25)
    expect(log.ai_decisions[0].chosen_action.quantized_score).toBe(22)
  })

  it('flags a weird turn with its policy and serializes feedback', () => {
    let log = createResearchLog(response, 'human-team', 'ai-team', ['move 1'])
    log = flagTurn(log, 8, 'Surf', 'Immunity/resistance mistake', 'obvious immunity')
    log = flagTurn(log, 9, 'Protect', 'Repetitive behavior')
    log = finalizeLog(log, response, {strength: 'Weak', irrational: true, cheating: false})
    const roundTrip = JSON.parse(JSON.stringify(log)) as ResearchLog
    expect(roundTrip.flags).toHaveLength(2)
    expect(roundTrip.flags[0]).toMatchObject({battle_id: 'b-1', turn: 8, policy_id: 'v1.1-50m',
      chosen_ai_action: 'Surf', category: 'Immunity/resistance mistake', comment: 'obvious immunity'})
    expect(roundTrip.flags[1].comment).toBeUndefined()
    expect(roundTrip.feedback).toEqual({strength: 'Weak', irrational: true, cheating: false})
    expect(roundTrip.metadata.hidden_debug_state_included).toBe(false)
    expect(roundTrip.metadata.final_winner).toBe('Human')
  })

  it('stores battles locally and exports them as JSON or JSONL', () => {
    const first = createResearchLog(response, 'a', 'b', [])
    const second = createResearchLog({...response, battle_id: 'b-2'}, 'a', 'b', [])
    saveToArchive(first); saveToArchive(second); saveToArchive({...first, human_choices: ['move 1']})
    const archive = loadArchive()
    expect(archive).toHaveLength(2)
    expect(archive[0].human_choices).toEqual(['move 1'])
    const jsonl = toJsonl(archive)
    expect(jsonl.trimEnd().split('\n')).toHaveLength(2)
    expect(jsonl.endsWith('\n')).toBe(true)
    expect(JSON.parse(jsonl.split('\n')[1]).metadata.battle_id).toBe('b-2')
    expect(toJsonl([])).toBe('')
  })

  it('reports rather than swallows a failed local save', () => {
    localStorage.setItem('gen3-lut-playtest-archive-v1', 'not json')
    expect(loadArchive()).toEqual([])
    const log = createResearchLog(response, 'a', 'b', [])
    expect(saveToArchive(log)).toEqual({saved: true})
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(saveToArchive(log)).toEqual({saved: false, error: 'quota'})
    setItem.mockRestore()
  })

  it('forwards finished logs to an installed remote sink without touching battle logic', async () => {
    expect(remoteSinkName()).toBeNull()
    expect(await publishLog(createResearchLog(response, 'a', 'b', []))).toEqual({delivered: false})
    const received: ResearchLog[] = []
    setRemoteSink({name: 'test-sink', submit: async log => { received.push(log) }})
    expect(remoteSinkName()).toBe('test-sink')
    expect(await publishLog(createResearchLog(response, 'a', 'b', []))).toEqual({delivered: true})
    expect(received).toHaveLength(1)
    setRemoteSink({name: 'broken', submit: async () => { throw new Error('offline') }})
    expect(await publishLog(createResearchLog(response, 'a', 'b', []))).toEqual({delivered: false, error: 'offline'})
  })
})
