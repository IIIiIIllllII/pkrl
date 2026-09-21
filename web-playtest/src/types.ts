export type Player = 'p1' | 'p2'

export interface BattleRequest {
  rqid?: number
  wait?: boolean
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
  boosts?: Record<string, number>
  self?: {boosts?: Record<string, number>}
  effectivenessBucket?: number
  legacyEffectivenessBucket?: number
  legacyType?: string
  legacyBasePower?: number
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
export interface LegalAction {index: number; choice: string; label: string; kind: 'move' | 'switch'}

export interface PolicyAsset {
  asset_version: number
  policy_id: string
  schema_version: string
  checkpoint_decisions: number
  simulator: {format: string; pokemon_showdown_commit: string}
  inference: string
  switch_logits: string
  parameter_count: number
  feature_sizes: Record<string, number>
  pair_specs: [string, string][]
  tables: Record<string, number[] | number[][]>
}

export interface ActionDiagnostic {
  index: number
  label: string
  kind: 'move' | 'switch'
  legal: boolean
  score: number | null
  feature_ids: number[] | null
  feature_categories: Record<string, string> | null
  move_role: string | null
  effectiveness: string | null
}

export interface AIDecision {
  turn: number
  observation: Record<string, unknown>
  legal_action_mask: boolean[]
  candidates: ActionDiagnostic[]
  chosen_action: ActionDiagnostic
  top1_score: number
  top2_score: number | null
  margin: number | null
  resulting_visible_events: string[]
}

export interface BattleResponse {
  battle_id: string
  seed: [number, number, number, number]
  simulator: string
  feature_schema: string
  policy_id: string
  request: BattleRequest | null
  legal_actions: LegalAction[]
  public_log: string[]
  turn: number
  ai_decisions: AIDecision[]
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
  chosen_ai_action: string
  category?: string
  comment?: string
  created_at: string
}

export interface BattleFeedback {strength?: string; irrational?: boolean; cheating?: boolean; comment?: string}
export interface ResearchLog {
  metadata: Record<string, unknown>
  ai_decisions: AIDecision[]
  human_choices: string[]
  flags: TurnFlag[]
  feedback?: BattleFeedback
}
