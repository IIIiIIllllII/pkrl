export type Player = 'p1' | 'p2'

export interface BattleRequest {
  rqid?: number
  wait?: boolean
  teamPreview?: boolean
  forceSwitch?: boolean[] | null
  active?: Array<{trapped?: boolean; maybeTrapped?: boolean; moves: MoveRequest[]}> | null
  side?: {id?: string; name?: string; pokemon: PokemonRequest[]}
  public?: PublicState
}

export interface MoveRequest {
  move: string
  id?: string
  pp?: number
  disabled?: boolean
  type?: string
  basePower?: number
  accuracy?: number | boolean | null
  priority?: number
  status?: string
  target?: string
  boosts?: Record<string, number>
  self?: {boosts?: Record<string, number>}
  effectivenessBucket?: number
  moveClass?: 'normal-damage' | 'fixed-damage' | 'status'
  applicable?: boolean
  fixedDamage?: number | string
  isDamageMove?: boolean
}

export interface PokemonRequest {
  ident?: string
  details?: string
  condition: string
  active?: boolean
  stats?: {spe?: number}
  moves?: string[]
  item?: string
  types?: string[]
}

export interface PublicTarget {species: string; hpBucket: number; status: string; types?: string[]; estimatedSpeed: number}
export interface PublicState {target: PublicTarget | null; weather: string; turn: number}
export type BoostStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion'

/** Active Pokémon as a Showdown client would show it to the viewing player. */
export interface PublicPokemonState {
  species: string
  hp_percent: number
  /** Exact [current, max] HP; present only for the viewer's own side. */
  hp?: [number, number]
  status: string
  fainted: boolean
  /** Non-zero stat stages only, each in [-6, 6]. */
  boosts: Partial<Record<BoostStat, number>>
  /** Publicly announced volatiles (Substitute, confusion, Leech Seed, …). */
  volatiles: string[]
}

export interface PublicRevealedPokemon {species: string; hp_percent: number; status: string; fainted: boolean}

export interface PublicSideCondition {
  name: string
  /** Spikes layers; null for non-layered conditions. */
  layers: number | null
  started_turn: number
  /** End-of-turn upkeeps left, counting the current turn's; null when not timed. */
  turns_remaining: number | null
}

export interface PublicSideState {
  player: Player
  name: string
  active: PublicPokemonState | null
  conditions: PublicSideCondition[]
  /** Only Pokémon that have appeared in battle. */
  revealed: PublicRevealedPokemon[]
}

export interface PublicWeatherState {
  name: string
  source: 'move' | 'ability'
  started_turn: number
  /** End-of-turn upkeeps left, counting the current turn's; null for permanent (ability) weather. */
  turns_remaining: number | null
}

/**
 * Display/research-only public battle state from one player's perspective. It is
 * rebuilt from that player's protocol stream and never reaches the policy encoder.
 */
export interface PublicBattleState {
  perspective: Player
  turn: number
  weather: PublicWeatherState | null
  self: PublicSideState
  opponent: PublicSideState
}

export interface LegalAction {index: number; choice: string; label: string; kind: 'move' | 'switch'}

export interface PolicyCheckpointRef {
  run_id: string
  run_path?: string
  file: string
  sha256: string
  milestone_decisions: number
  step?: number
}

export interface PolicyQuantization {
  mode: string
  scale: number
  bytes: number
  clip?: [number, number]
  accumulator?: string
  tables: Record<string, number[] | number[][]>
}

export interface PolicyAsset {
  asset_version: number
  policy_id: string
  schema_version: string
  semantics_revision?: string
  generation?: string
  contaminated?: boolean
  checkpoint?: PolicyCheckpointRef
  checkpoint_decisions: number
  training?: Record<string, unknown>
  source?: Record<string, unknown>
  simulator: {format: string; pokemon_showdown_commit: string}
  evaluation?: Record<string, unknown> | null
  inference: string
  switch_logits: string
  parameter_count: number
  feature_sizes: Record<string, number>
  pair_specs: [string, string][]
  table_offsets?: Record<string, {offset: number; shape: number[]}>
  quantization?: PolicyQuantization
  tables: Record<string, number[] | number[][]>
}

/** Public provenance shown in the UI and copied into every research log. */
export interface PolicyProvenance {
  policy_id: string
  schema_version: string
  semantics_revision?: string
  generation?: string
  checkpoint_decisions: number
  milestone_decisions?: number
  checkpoint_sha256?: string
  parameter_count: number
  quantization_mode?: string
  quantization_scale?: number
  project_commit?: string
  pokemon_showdown_commit: string
  evaluation?: Record<string, unknown> | null
}

export interface LutContribution {
  term: string
  category: string
  value_id: number
  global_id: number
  weight: number
}

export interface ScoreRanking {
  top1_index: number
  top1_score: number
  top2_index: number | null
  top2_score: number | null
  margin: number | null
  legal_count: number
}

export interface ActionDiagnostic {
  index: number
  label: string
  kind: 'move' | 'switch'
  legal: boolean
  score: number | null
  quantized_score: number | null
  feature_ids: number[] | null
  feature_categories: Record<string, string> | null
  activated_feature_ids: number[] | null
  contributions: LutContribution[] | null
  move_role: string | null
  move_class: 'normal-damage' | 'fixed-damage' | 'status' | null
  applicable: boolean | null
  effectiveness: string | null
}

/**
 * Whether the AI had an answer available, so a successful human setup sweep can
 * be attributed to the team rather than automatically to the policy. This is
 * bookkeeping over the AI's own side only; it is never fed to the policy and is
 * withheld until the battle is over.
 */
export interface AnswerAvailability {
  classification: 'answer_used' | 'active_answer_unused' | 'bench_answer_unused' | 'no_answer_existed'
  active_answers: Array<{index: number; label: string; reason: string; effectiveness: string}>
  bench_answers: Array<{index: number; species: string; reason: string; effectiveness: string}>
  chosen_was_answer: boolean
}

export interface AIDecision {
  battle_id: string
  policy_id: string
  turn: number
  observation: Record<string, unknown>
  /** Public battle state from the AI's perspective when it chose; not a policy input. */
  public_state: PublicBattleState
  legal_actions: LegalAction[]
  legal_action_mask: boolean[]
  candidates: ActionDiagnostic[]
  chosen_action: ActionDiagnostic
  resolved_defender_types: string[]
  top1_score: number
  top2_score: number | null
  top2_index: number | null
  margin: number | null
  quantized_top1_score: number | null
  quantized_selected_action: number | null
  resulting_visible_events: string[]
  answer_availability?: AnswerAvailability
}

export interface HumanAction {turn: number; choice: string; label: string; kind: 'move' | 'switch'; public_state: PublicBattleState}

export interface BattleResponse {
  battle_id: string
  seed: [number, number, number, number]
  simulator: string
  feature_schema: string
  policy_id: string
  policy_provenance: PolicyProvenance
  request: BattleRequest | null
  legal_actions: LegalAction[]
  public_log: string[]
  /** Public battle state from the human's perspective. */
  public_state: PublicBattleState
  turn: number
  ai_decisions: AIDecision[]
  human_actions: HumanAction[]
  terminal: boolean
  winner: string | null
  error?: string
}

export interface BattleApiInput {
  battle_id: string
  seed: [number, number, number, number]
  policy_id: string
  human_team_id: string
  ai_team_id: string
  human_choices: string[]
}

export interface TurnFlag {
  battle_id: string
  turn: number
  policy_id: string
  chosen_ai_action: string
  category?: string
  comment?: string
  created_at: string
}

export interface BattleFeedback {strength?: string; irrational?: boolean; cheating?: boolean; comment?: string}

export interface ResearchLog {
  metadata: Record<string, unknown>
  ai_decisions: AIDecision[]
  human_actions: HumanAction[]
  human_choices: string[]
  public_log: string[]
  flags: TurnFlag[]
  feedback?: BattleFeedback
}
