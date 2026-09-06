import type { GhostEntity, SceneTarget, TrueEntityKind } from "./types.ts";
import { deriveStrength, initialCurrent } from "./ghost-strength.ts";

export function projectGhostForPlayer(g: GhostEntity) {
  return {
    ghost_id: g.ghost_id,
    displayed_as: g.visibility.displayed_to_player_as,
    aliases: g.visible_aliases,
    known_to_player: g.visibility.known_to_player,
    assessment: g.visibility.player_assessment,
    revealed_properties: g.visibility.revealed_properties,
    present: g.present,
  };
}

export function getGhost(list: GhostEntity[] | undefined, id: string | null | undefined) {
  if (!id || !list) return null;
  return list.find((g) => g.ghost_id === id) ?? null;
}

export function possessedGhosts(list: GhostEntity[] | undefined, characterId: string) {
  return (list ?? []).filter((g) => g.host_character_id === characterId && g.true_entity_kind === "possessed_ghost");
}

export function visibleSceneTargets(targets: SceneTarget[] | undefined, locationId: string) {
  return (targets ?? []).filter((t) => t.present !== false && t.visibility !== "hidden" && t.location_id === locationId);
}

export function kindOfTarget(ghosts: GhostEntity[] | undefined, targets: SceneTarget[] | undefined, targetId?: string | null): {
  ghost: GhostEntity | null;
  kind: TrueEntityKind;
  isSource: boolean;
} {
  const target = (targets ?? []).find((t) => t.id === targetId);
  const ghost = getGhost(ghosts, target?.linked_ghost_id ?? targetId ?? null);
  if (!ghost) return { ghost: null, kind: "unknown", isSource: false };
  return {
    ghost,
    kind: ghost.true_entity_kind,
    isSource: ghost.source_relationship.is_true_source || ghost.true_entity_kind === "source_entity",
  };
}

export function freezeContainedGhost(g: GhostEntity) {
  g.runtime_frozen = true;
  g.true_entity_kind = "contained_ghost_source";
  g.present = false;
  g.host_character_id = null;
  g.attack_state = {
    is_attacking: false,
    current_attack_target_id: null,
    attack_intent_source: "none",
    attack_stage: "none",
    can_be_interrupted: true,
    is_same_target_collision_candidate: false,
  };
}

export function unfreezeGhost(g: GhostEntity) {
  g.runtime_frozen = false;
}

export function tickGhostKillingRules(ghosts: GhostEntity[], actionText: string, actorId: string) {
  const text = actionText;
  for (const g of ghosts) {
    if (g.runtime_frozen) continue;
    if (!g.present && !g.host_character_id) continue;
    for (const rule of g.killing_rules) {
      const hit = rule.trigger_conditions.some((c) => text.includes(c));
      if (hit) {
        rule.is_triggered = true;
        rule.triggered_by_actor_id = actorId;
        rule.target_ids = [actorId];
        rule.stage = rule.stage === "inactive" ? "warning" : rule.stage === "warning" ? "marked" : "attacking";
        g.attack_state = {
          is_attacking: true,
          current_attack_target_id: actorId,
          attack_intent_source: "killing_rule_triggered",
          attack_stage: rule.stage === "attacking" ? "partial" : "preparing",
          can_be_interrupted: rule.stage !== "attacking",
          is_same_target_collision_candidate: true,
        };
      }
    }
  }
}

export function simultaneousCollisionNeeded(ghosts: GhostEntity[], hostId: string): boolean {
  const attackingHost = ghosts.filter((g) => g.attack_state.is_attacking && g.attack_state.current_attack_target_id === hostId);
  return attackingHost.length >= 2;
}

export function makeGhost(partial: Partial<GhostEntity> & { ghost_id: string; display_name: string; max: number }): GhostEntity {
  const max = partial.max;
  const policy = partial.strength_profile?.current_ratio_policy ?? "one_third";
  const current = partial.strength_profile?.current_strength ?? initialCurrent(max, policy);
  const ctrl = partial.strength_profile?.controllability ?? 0.4;
  return {
    ghost_id: partial.ghost_id,
    display_name: partial.display_name,
    visible_aliases: partial.visible_aliases ?? [partial.display_name],
    true_entity_kind: partial.true_entity_kind ?? "unknown",
    visibility: partial.visibility ?? {
      known_to_player: false,
      displayed_to_player_as: partial.display_name,
      player_assessment: { suspected_kind: null, confidence: 0, notes: [] },
      revealed_properties: [],
      hidden_properties: [],
    },
    source_relationship: partial.source_relationship ?? {
      is_true_source: partial.true_entity_kind === "source_entity",
      linked_source_id: null,
      parent_puzzle_id: null,
      can_end_event_if_contained: partial.true_entity_kind === "source_entity",
    },
    strength_profile: deriveStrength({
      max_strength: max,
      current_strength: current,
      controllability: ctrl,
    }),
    killing_rules: partial.killing_rules ?? [],
    attack_state: partial.attack_state ?? {
      is_attacking: false,
      current_attack_target_id: null,
      attack_intent_source: "none",
      attack_stage: "none",
      can_be_interrupted: true,
      is_same_target_collision_candidate: false,
    },
    revival_profile: partial.revival_profile ?? {
      ghost_activity: 20,
      revival_behavior: "随时间与使用缓慢抬头",
      contributes_to_character_revival: true,
      revival_pressure: 8,
      deadlock_status: "none",
      deadlock_scope: [],
      deadlock_break_conditions: [],
    },
    mechanism_tags: partial.mechanism_tags ?? [],
    containment_profile: partial.containment_profile ?? {
      can_be_contained: true,
      requires_reality_presence: true,
      required_window_tags: [],
      required_container_tags: ["gold"],
      false_containment_results: [],
      containment_success_state: "contained",
    },
    driving_profile: partial.driving_profile ?? {
      is_driveable_after_containment: true,
      compatibility_tags: [],
      conflict_tags: [],
      assimilation_risk_base: 35,
      forced_driving_allowed: true,
      forced_driving_penalty: 25,
      possible_driving_results: ["single_ghost_instability", "anchor_state", "collapse"],
    },
    host_character_id: partial.host_character_id ?? null,
    event_id: partial.event_id ?? null,
    location_id: partial.location_id ?? null,
    in_reality: partial.in_reality ?? "real",
    present: partial.present ?? true,
  };
}
