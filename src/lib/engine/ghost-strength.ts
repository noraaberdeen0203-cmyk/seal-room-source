import { clamp } from "../utils.ts";
import { tierOf } from "./strength.ts";
import type { GhostEntity, StrengthProfile, StrengthTier } from "./types";

export function initialCurrent(max: number, policy: StrengthProfile["current_ratio_policy"] = "one_third") {
  if (policy === "one_half") return Math.round(max * 0.5);
  if (policy === "custom") return Math.round(max * 0.4);
  return Math.round(max / 3);
}

export function deriveStrength(params: {
  max_strength: number;
  current_strength: number;
  controllability: number;
  hostControl?: number;
  hostAnchor?: number;
  balancePenalty?: number;
  activity?: number;
  tiers?: StrengthTier[];
}): StrengthProfile {
  const current = clamp(params.current_strength, 0, params.max_strength);
  const ctrl = clamp(
    params.controllability * (0.6 + (params.hostControl ?? 40) / 200 + (params.hostAnchor ?? 50) / 250) -
      (params.balancePenalty ?? 0),
    0.05,
    0.95,
  );
  const activity = clamp(params.activity ?? 0, 0, 100);
  const controlled = Math.round(current * ctrl);
  const uncontrolled = Math.max(0, current - Math.round(controlled * 0.35) + Math.round(activity * 0.4));
  const attack = Math.max(controlled, Math.round(current * (1 - ctrl * 0.4) * (1 + activity / 250)));
  return {
    max_strength: params.max_strength,
    current_strength: current,
    controlled_strength: controlled,
    uncontrolled_strength: uncontrolled,
    attack_strength: attack,
    controllability: Number(ctrl.toFixed(3)),
    current_ratio_policy: "one_third",
    growth_with_revival: "linear",
    strength_tier: tierOf(current, params.tiers).tier_id,
    notes: "current 由复苏决定；activity 只扰动 attack/uncontrolled。",
  };
}

export function applyStrengthGrowth(ghost: GhostEntity, deltaActivity: number, host?: { control: number; anchor: number }) {
  const p = ghost.strength_profile;
  const activity = clamp(ghost.revival_profile.ghost_activity + deltaActivity, 0, 100);
  ghost.revival_profile.ghost_activity = activity;
  ghost.revival_profile.revival_pressure = Math.round(activity * 0.4 + p.current_strength / Math.max(1, p.max_strength) * 40);
  ghost.strength_profile = deriveStrength({
    max_strength: p.max_strength,
    current_strength: p.current_strength,
    controllability: p.controllability,
    hostControl: host?.control,
    hostAnchor: host?.anchor,
    activity,
  });
  return ghost;
}

export function setAttacking(ghost: GhostEntity, targetId: string, intent: GhostEntity["attack_state"]["attack_intent_source"]) {
  ghost.attack_state = {
    is_attacking: true,
    current_attack_target_id: targetId,
    attack_intent_source: intent,
    attack_stage: intent === "player_command" ? "partial" : "preparing",
    can_be_interrupted: intent !== "killing_rule_triggered",
    is_same_target_collision_candidate: true,
  };
  for (const rule of ghost.killing_rules) {
    if (rule.trigger_conditions.length && intent === "killing_rule_triggered") {
      rule.is_triggered = true;
      rule.stage = "attacking";
      rule.target_ids = [targetId];
    }
  }
}
