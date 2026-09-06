export type Visibility = "known" | "partially_known" | "hidden";
export type CharacterType =
  | "player_character"
  | "npc"
  | "hidden_major_npc"
  | "dream_character"
  | "future_locked_character";
export type HazardGrade = "C" | "B" | "A" | "S" | "unknown";
export type EventStatus =
  | "inactive"
  | "active"
  | "contained"
  | "suppressed"
  | "escaped"
  | "resolved"
  | "failed";
export type SourceReality = "real" | "partially_real" | "not_in_reality" | "unknown";
export type ActionType =
  | "observe"
  | "lockdown"
  | "evade"
  | "use_power"
  | "contain"
  | "drive_or_bind"
  | "force_drive"
  | "social"
  | "other"
  | "supernatural_plan"
  | "area_restart"
  | "apply_suppression"
  | "release_suppression"
  | "attach_curse"
  | "break_curse"
  | "use_borrowed_supernatural"
  | "establish_source_contact"
  | "self_restart"
  | "external_restart";
export type DiceVisibility = "public" | "hidden";
export type ResultLevel =
  | "extreme_success"
  | "great_success"
  | "success"
  | "narrow_success"
  | "fail_with_info"
  | "severe_fail"
  | "catastrophe"
  | "extreme_fail";
export type CostLevel = "轻微" | "普通" | "严重" | "致命" | "崩溃";
export type KnowledgeType =
  | "confirmed_rule"
  | "suspected_rule"
  | "false_assumption"
  | "known_npc_fact"
  | "known_item_effect"
  | "known_location_fact"
  | "rumor"
  | "hidden_truth";
export type ItemType =
  | "ordinary"
  | "supernatural"
  | "gold_container"
  | "document"
  | "medium"
  | "unknown";
export type ItemState = "intact" | "damaged" | "sealed" | "unknown";
export type PowerType =
  | "ghost"
  | "ghost_domain"
  | "supernatural_item_effect"
  | "curse"
  | "medium"
  | "body_modification"
  | "other";

export interface StrengthRecord {
  base_strength: number;
  effective_strength: number;
  burst_strength: number;
  stacked_pressure: number;
  tier: number;
  notes: string;
}

export interface StackingProfile {
  can_stack: boolean;
  stacking_efficiency: number;
  stacking_cap: number;
  current_stack_layers: number;
  stacking_sources: string[];
  stacking_conditions: string[];
  stacking_risks: string[];
}

export interface CharacterStats {
  supernatural_strength: number;
  effective_strength: number;
  burst_strength: number;
  revival_degree: number;
  body: number;
  anchor: number;
  control: number;
  analysis_base: number;
}

export interface Relationship {
  target_id: string;
  player_visible_relation: string;
  gm_hidden_relation: string;
  trust: number;
  hostility: number;
  notes: string;
}

export interface Character {
  id: string;
  name: string;
  display_name: string;
  aliases: string[];
  type: CharacterType;
  role: string;
  visibility: Visibility;
  current_status: string;
  appearance: {
    public_description: string;
    hidden_abnormalities: string[];
  };
  personality: {
    visible_traits: string[];
    hidden_traits: string[];
    behavior_rules: string[];
  };
  background: {
    player_known: string;
    gm_hidden: string;
  };
  stats: CharacterStats;
  powers: string[];
  items: string[];
  relationships: Relationship[];
  knowledge: string[];
  unknowns: string[];
  current_goals: string[];
  gm_notes: string;
  common_locations: string[];
  plot_hooks: string[];
  supernatural_transition_state?: TransitionStateKind;
  deadlock_state?: DeadlockStateKind;
  human_memory_exists?: boolean;
  consciousness_overwritten?: boolean;
  borrowed_supernatural_effects?: string[];
  is_ghost_controller?: boolean;
}

export interface Power {
  id: string;
  name: string;
  type: PowerType;
  owner_id: string | null;
  base_strength: number;
  effective_strength: number;
  mechanism_tags: string[];
  known_effects: string[];
  hidden_effects: string[];
  activation_conditions: string[];
  costs: string[];
  limitations: string[];
  counterplay: string[];
  risks: string[];
  revival_cost: string;
  body_cost: string;
  sanity_cost: string;
  controllability: number;
  stacking: StackingProfile;
  rare_tags?: RareTagId[];
  max_strength?: number;
  current_strength?: number;
  consciousness_function?: ConsciousnessFunction;
  consciousness_protection?: ConsciousnessProtection;
  restart_scope?: RestartScope;
  lookback_window?: string;
  restart_domains?: string[];
  domain_active?: boolean;
  domain_mechanism_factor?: number;
  restart_profile?: RestartProfile;
}

export interface RestartProfile {
  external_single_target_exception: boolean;
  can_rewind_own_source_revival: boolean;
}

export type RareTagId = "lethal" | "suppression" | "curse" | "ghost_domain" | "consciousness" | "idealistic" | "restart";
export type RestartScope = "self" | "single_target" | "area";
export type SourceContactState =
  | "unknown"
  | "suspected"
  | "identified_medium"
  | "contact_window_open"
  | "source_contact_established"
  | "contact_lost";

export type SuppressionScope = "one_power" | "one_killing_rule" | "one_tag" | "whole_ghost";

export interface SuppressionLock {
  source_id: string;
  target_id: string;
  scope: SuppressionScope;
  target_power_id?: string;
  target_rule_id?: string;
  target_tag?: string;
  effective_strength: number;
  applied_at: string;
  release_condition: string;
  active: boolean;
}

export interface CurseLink {
  link_id: string;
  source_id: string;
  target_id: string;
  medium: string;
  attachment_condition: string;
  effect_profile: string[];
  break_condition: string;
  transmissible: boolean;
  active: boolean;
  created_at: string;
}
export type ConsciousnessFunction =
  | "read_fragment"
  | "brief_forget"
  | "bias"
  | "alter_memory"
  | "implant"
  | "copy_fragment"
  | "full_copy"
  | "overwrite_personality"
  | "transfer"
  | "replace"
  | "steal_life"
  | "stable_intellect"
  | "ghost_controls_human"
  | "attack_heteromorph_core"
  | "preserve_human_memory"
  | "fix_personality"
  | "keep_consciousness_continuity"
  | "store_self"
  | "restart_keep_memory";

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  owner_id: string | null;
  visibility: Visibility;
  origin_player_known: string;
  origin_gm_hidden: string;
  known_usage: string;
  hidden_usage: string;
  activation_condition: string;
  cost: string;
  risk: string;
  state: ItemState;
  mechanism_tags: string[];
  gm_notes: string;
  consciousness_protection?: ConsciousnessProtection;
}

export interface EventClockRule {
  condition: string;
  instability_delta: number;
  description: string;
}

export interface RevealCondition {
  condition_id: string;
  trigger_type:
    | "event"
    | "item_use"
    | "npc_dialogue"
    | "location_discovery"
    | "dream_progress"
    | "dice_success"
    | "time";
  requirements: string[];
  revealed_fields: string[];
  revealed?: boolean;
}

export interface GameEvent {
  id: string;
  name: string;
  status: EventStatus;
  visible_description: string;
  hidden_truth: string;
  hazard_grade: HazardGrade;
  source_strength: number | null;
  hazard_strength: number;
  instability: number;
  source_entity_id: string | null;
  source_reality_status: SourceReality;
  known_rules: string[];
  hidden_rules: string[];
  suspected_rules: string[];
  false_assumptions: string[];
  hazard_factors: string[];
  locations: string[];
  involved_characters: string[];
  involved_items: string[];
  event_clock_rules: EventClockRule[];
  containment_requirements: string[];
  failure_modes: string[];
  reveal_conditions: string[];
  known_clues: string[];
  hidden_clues: string[];
  social_exposure: number;
  lockdown_status: string;
  containment_status: string;
  gm_notes: string;
}

export interface Location {
  id: string;
  name: string;
  type: "city" | "district" | "building" | "room" | "supernatural_place" | "road" | "unknown";
  visibility: Visibility;
  player_known_description: string;
  gm_hidden_description: string;
  hazards: string[];
  connected_locations: string[];
  lockdown_status: "none" | "partial" | "full" | "failed" | "unknown";
  special_rules: string[];
}

export interface Organization {
  id: string;
  name: string;
  type: "official" | "folk" | "corporate" | "family" | "unknown";
  visibility: Visibility;
  player_known_description: string;
  gm_hidden_description: string;
  attitude_to_player: "friendly" | "neutral" | "hostile" | "unknown" | "mixed";
  resources: string[];
  members: string[];
  rules: string[];
  plot_hooks: string[];
}

export interface KnowledgeEntry {
  id: string;
  type: KnowledgeType;
  title: string;
  body: string;
  source: string;
  event_id?: string;
  revealed_at?: string;
}

export interface DiceLogEntry {
  id: string;
  turn: number;
  visibility: DiceVisibility;
  action_type: ActionType;
  action_text: string;
  target_value: number;
  roll: number;
  margin: number;
  level: ResultLevel;
  notes: string;
  at: string;
}

export interface TurnLogEntry {
  id: string;
  turn: number;
  actor: "player" | "gm" | "system";
  visible_text: string;
  hidden_text?: string;
  state_changes: string[];
  new_clues: string[];
  visible_risks: string[];
  available_actions: string[];
  at: string;
}

export interface StrengthTier {
  tier_id: number;
  min_strength: number;
  max_strength: number;
  label: string;
  description: string;
}

export type TrueEntityKind =
  | "source_entity"
  | "possessed_ghost"
  | "contained_ghost_source"
  | "ghost_slave"
  | "projection"
  | "medium"
  | "phenomenon"
  | "fragment"
  | "unknown";
export type PlayerSuspectedKind =
  | "source_entity"
  | "medium"
  | "projection"
  | "ghost_slave"
  | "phenomenon"
  | "fragment"
  | "unknown";
export type KillingStage = "inactive" | "warning" | "marked" | "attacking" | "completed";
export type AttackIntent =
  | "player_command"
  | "defensive_reaction"
  | "revival_instinct"
  | "killing_rule_triggered"
  | "external_control"
  | "none";
export type AttackStage = "none" | "preparing" | "partial" | "full" | "completed";
export type DeadlockKind =
  | "none"
  | "local_deadlock"
  | "rule_deadlock"
  | "medium_deadlock"
  | "revival_deadlock"
  | "structural_deadlock"
  | "global_deadlock";
export type BalanceStateKind =
  | "no_balance"
  | "single_ghost_instability"
  | "dual_ghost_deadlock"
  | "partial_deadlock"
  | "stable_deadlock"
  | "multi_puzzle_conflict"
  | "dead_ghost_state"
  | "anchor_state"
  | "heteromorphic_state"
  | "collapse"
  | "partial_balance"
  | "dual_ghost_balance"
  | "stable_balance"
  | "high_quality_balance";

export type DeadlockStateKind =
  | "none"
  | "deadlock_candidate"
  | "rule_deadlock"
  | "revival_deadlock"
  | "global_deadlock"
  | "local_deadlock";

export type TransitionStateKind =
  | "normal_controller"
  | "balanced_controller"
  | "deadlock_candidate"
  | "deadlocked_controller"
  | "heteromorph_candidate"
  | "heteromorphic"
  | "failed_transition"
  | "lost";

export type ConsciousnessProtectionEffect =
  | "preserve_human_memory"
  | "fix_personality"
  | "keep_consciousness_continuity"
  | "store_self"
  | "restart_keep_memory"
  | "read_memory_only"
  | "none";

export interface ConsciousnessProtection {
  effect: ConsciousnessProtectionEffect;
  covers_transition: boolean;
  source_id?: string;
}

export type PlanGoal = "deadlock" | "heteromorph" | "deadlock_then_heteromorph" | "balance";

export interface ClaimedInteraction {
  source: string;
  target: string;
  claimed_effect: string;
  same_core_result?: boolean;
  real_rule_conflict?: boolean;
  core_result?: "revival" | "killing_rule" | "possession" | "state_completion";
}

export interface PlanEvaluationInput {
  plan_goal: PlanGoal;
  raw_text?: string;
  participants: string[];
  claimed_interactions: ClaimedInteraction[];
  claimed_consciousness_protection?: { source: string; effect: string };
  same_core_result?: boolean;
  sustained_lock_possible?: boolean;
}

export const TRUE_DEADLOCK_STATES: DeadlockStateKind[] = [
  "rule_deadlock",
  "revival_deadlock",
  "global_deadlock",
  "local_deadlock",
];

export const LEGACY_BALANCE_ALIASES: BalanceStateKind[] = [
  "dual_ghost_deadlock",
  "partial_deadlock",
  "stable_deadlock",
];
export type OppositionModel =
  | "single_vs_target"
  | "coalition_1_plus_2_approx_3"
  | "parity_1_approx_2_approx_3"
  | "stacking_1_times_2_approx_3"
  | "dead_ghost_suppression";
export type ContainmentResultKind =
  | "contained"
  | "limited"
  | "failed"
  | "false_containment"
  | "medium_removed"
  | "projection_dispersed"
  | "ghost_slave_destroyed"
  | "phenomenon_suppressed"
  | "source_transferred"
  | "event_escalated"
  | "none";
export type DrivingEntryType =
  | "standard_after_containment"
  | "forced_without_containment"
  | "special_story_condition";
export type Difficulty = "easy" | "standard" | "hard";

export interface GhostVisibility {
  known_to_player: boolean;
  displayed_to_player_as: string;
  player_assessment: {
    suspected_kind: PlayerSuspectedKind | null;
    confidence: number;
    notes: string[];
  };
  revealed_properties: string[];
  hidden_properties: string[];
}

export interface StrengthProfile {
  max_strength: number;
  current_strength: number;
  controlled_strength: number;
  uncontrolled_strength: number;
  attack_strength: number;
  controllability: number;
  current_ratio_policy: "one_third" | "one_half" | "custom";
  growth_with_revival: "linear" | "stepped" | "custom";
  strength_tier: number;
  notes: string;
}

export interface KillingRule {
  rule_id: string;
  visible_clue: string;
  hidden_rule_text: string;
  trigger_conditions: string[];
  is_triggered: boolean;
  triggered_by_actor_id: string | null;
  target_ids: string[];
  stage: KillingStage;
  counterplay_tags: string[];
  wrong_counterplay_results: string[];
}

export interface AttackState {
  is_attacking: boolean;
  current_attack_target_id: string | null;
  attack_intent_source: AttackIntent;
  attack_stage: AttackStage;
  can_be_interrupted: boolean;
  is_same_target_collision_candidate: boolean;
}

export interface RevivalProfile {
  ghost_activity: number;
  revival_behavior: string;
  contributes_to_character_revival: boolean;
  revival_pressure: number;
  deadlock_status: DeadlockKind;
  deadlock_scope: string[];
  deadlock_break_conditions: string[];
  anchor_revival_degree?: number | null;
  anchor_current_strength?: number | null;
}

export interface GhostEntity {
  ghost_id: string;
  display_name: string;
  visible_aliases: string[];
  true_entity_kind: TrueEntityKind;
  visibility: GhostVisibility;
  source_relationship: {
    is_true_source: boolean;
    linked_source_id: string | null;
    parent_puzzle_id: string | null;
    can_end_event_if_contained: boolean;
  };
  strength_profile: StrengthProfile;
  killing_rules: KillingRule[];
  attack_state: AttackState;
  revival_profile: RevivalProfile;
  mechanism_tags: string[];
  rare_tags?: RareTagId[];
  source_contact_state?: SourceContactState;
  suppression_locks?: SuppressionLock[];
  curse_links?: CurseLink[];
  containment_profile: {
    can_be_contained: boolean;
    requires_reality_presence: boolean;
    required_window_tags: string[];
    required_container_tags: string[];
    false_containment_results: string[];
    containment_success_state: "contained" | "suppressed_contained" | "partial_contained";
  };
  driving_profile: {
    is_driveable_after_containment: boolean;
    compatibility_tags: string[];
    conflict_tags: string[];
    assimilation_risk_base: number;
    forced_driving_allowed: boolean;
    forced_driving_penalty: number;
    possible_driving_results: BalanceStateKind[];
  };
  host_character_id: string | null;
  event_id: string | null;
  location_id: string | null;
  in_reality: SourceReality;
  present: boolean;
  runtime_frozen?: boolean;
}

export interface CharacterBalanceState {
  state: BalanceStateKind;
  stability: number;
  overall_revival_pressure: number;
  possessed_ghost_ids: string[];
  dominant_ghost_id: string | null;
  deadlocked_ghost_ids: string[];
  suppressed_ghost_ids: string[];
  conflicting_ghost_ids: string[];
  anchor_links: {
    source_ghost_id: string;
    anchor_target_id: string;
    anchor_type: "reality_interface" | "medium_binding" | "identity_overlap" | "curse_contract";
    stability: number;
    known_to_player: boolean;
  }[];
  deadlocked_rules: string[];
  failure_modes: string[];
  last_state_transition_reason: string;
}

export interface GhostRelation {
  relation_id: string;
  ghost_a_id: string;
  ghost_b_id: string;
  compatibility_score: number;
  assimilation_risk: number;
  conflict_score: number;
  conflict_type:
    | "mutual_suppression"
    | "mutual_stimulation"
    | "directional_suppression"
    | "rule_collision"
    | "medium_contamination"
    | "identity_overlap"
    | "anchor_competition"
    | "none";
  deadlock_potential: number;
  stacking_potential: number;
  relation_model: OppositionModel;
  known_to_player: boolean;
  revealed_clues: string[];
  hidden_notes: string;
}

export interface ContainedGhostItem {
  item_id: string;
  name: string;
  item_type: "contained_ghost";
  source_ghost_id: string;
  container: {
    container_id: string;
    container_type: "gold" | "custom";
    containment_integrity: number;
    leakage_risk: number;
    damage_risk: number;
  };
  is_tradeable: boolean;
  is_driveable: boolean;
  can_be_used_as_suppression_item: boolean;
  known_properties: string[];
  hidden_properties: string[];
  trade_risk: string[];
  gm_notes: string;
}

export interface SceneTarget {
  id: string;
  visible_name: string;
  location_id: string;
  linked_ghost_id: string;
  present: boolean;
  visibility: Visibility;
  player_visible: {
    appearance: string;
    anomaly: string;
    known_facts: string[];
  };
}

export interface ContentPack {
  pack_id: string;
  pack_name: string;
  version: string;
  description: string;
  characters: Character[];
  powers: Power[];
  items: Item[];
  events: GameEvent[];
  locations: Location[];
  organizations: Organization[];
  plot_hooks: { id: string; text: string; hidden?: string }[];
  reveal_conditions: RevealCondition[];
  strength_tiers: StrengthTier[];
  validation_rules: string[];
  ghosts?: GhostEntity[];
  scene_targets?: SceneTarget[];
}

export interface VisibleContext {
  location_id: string;
  location_name: string;
  location_description: string;
  known_npcs: { id: string; name: string; relation: string; status: string }[];
  self_status: string;
  known_items: { id: string; name: string; usage: string; state: string }[];
  clues: KnowledgeEntry[];
  confirmed_rules: string[];
  suspected_rules: string[];
  visible_anomalies: string[];
}

export interface HiddenContext {
  truths: string[];
  npc_motives: string[];
  event_sources: string[];
  upcoming_clocks: string[];
  hidden_abnormalities: string[];
}

export interface SaveData {
  save_id: string;
  created_at: string;
  updated_at: string;
  pack_id: string;
  current_stage_id: string;
  current_location_id: string;
  turn: number;
  player_character_id: string;
  player_character: Character;
  characters: Character[];
  powers: Power[];
  items: Item[];
  events: GameEvent[];
  locations: Location[];
  organizations: Organization[];
  reveal_conditions: RevealCondition[];
  strength_tiers: StrengthTier[];
  visible_context: VisibleContext;
  hidden_context: HiddenContext;
  knowledge_log: KnowledgeEntry[];
  dice_log: DiceLogEntry[];
  turn_log: TurnLogEntry[];
  gm_mode: boolean;
  difficulty?: Difficulty;
  ghosts?: GhostEntity[];
  ghost_relations?: GhostRelation[];
  balance?: CharacterBalanceState;
  special_inventory?: ContainedGhostItem[];
  scene_targets?: SceneTarget[];
  curse_links?: CurseLink[];
  pending_revival_endpoint?: boolean;
  action_transactions?: ActionTransactionRecord[];
  world_calendar_day?: number;
  natural_revival_anchor_calendar?: number;
  last_containment?: {
    result: ContainmentResultKind;
    visible_result_text: string;
    hidden_result_text: string;
    is_true_source_selected: boolean;
  };
}

export interface ResolutionInput {
  action_type: ActionType;
  action_text: string;
  power_id?: string;
  item_id?: string;
  event_id?: string;
  target_character_id?: string;
  target_id?: string;
  suspected_kind?: PlayerSuspectedKind | null;
  contained_item_id?: string;
  force_drive?: boolean;
  force_hidden_roll?: boolean;
  teammate_roles?: { character_id: string; role: string; strength?: number; mechanism_tags?: string[] }[];
  force_roll?: number;
  plan?: PlanEvaluationInput;
  plan_goal?: PlanGoal;
  rare?: RareActionPayload;
}

export interface RareActionPayload {
  domain?: import("./rare-tags.ts").RarePowerView | {
    id: string;
    max_strength: number;
    current_strength: number;
    rare_tags: RareTagId[];
    domain_active?: boolean;
    restart_scope?: RestartScope;
    domain_mechanism_factor?: number;
  };
  restart?: RareActionPayload["domain"];
  mechanism_match?: boolean;
  temporary_amp?: { value: number; applies_to_composite: boolean; revival_cost: number };
  scope?: SuppressionScope;
  target_ghost_id?: string;
  target_power_id?: string;
  release_actor_id?: string;
  source_id?: string;
  medium?: string;
  true_medium?: string;
  claimed_break?: string;
  true_break?: string;
  curse_link_id?: string;
  borrowed_effect?: string;
  activation_revival?: number;
  restart_source_id?: string;
  restart_target_id?: string;
  requested_domains?: string[];
  external_single_target_exception?: boolean;
  can_rewind_own_source_revival?: boolean;
  claimed_external_single_target?: boolean;
  claimed_self_revival_rewind?: boolean;
  source_power_id?: string;
}

export interface ActionTransactionRecord {
  transaction_id: string;
  status: "open" | "committed" | "interrupted";
  committed_cost_ids: string[];
  interrupt?: string | null;
}

export interface RuleTrigger {
  triggered: boolean;
  rule_text: string;
  lethal: boolean;
  medium: string;
  delayable: boolean;
}

export interface MechanismMatch {
  matched: boolean;
  tags_used: string[];
  notes: string;
}

export interface CostDelta {
  level: CostLevel;
  revival: number;
  body: number;
  anchor: number;
  instability: number;
}

export interface ResolutionResult {
  rule: RuleTrigger;
  mechanism: MechanismMatch;
  dice: DiceLogEntry | null;
  hard_block: boolean;
  hard_block_reason: string;
  containment: {
    attempted: boolean;
    success: boolean;
    mode: string;
    notes: string;
    result?: ContainmentResultKind;
    side_strength?: number;
    source_strength?: number;
  };
  driving: {
    attempted: boolean;
    outcome: string;
    notes: string;
    entry?: DrivingEntryType;
    balance_state?: BalanceStateKind;
    forced?: boolean;
  };
  cost: CostDelta;
  state_changes: string[];
  new_clues: KnowledgeEntry[];
  revealed_fields: string[];
  visible_risks: string[];
  available_actions: string[];
  gm_notes_hidden: string;
  interrupt?: string | null;
  rare_notes?: string;
}
