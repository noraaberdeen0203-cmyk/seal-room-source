import { uid } from "../utils.ts";
import type { GhostEntity, GhostRelation, OppositionModel, StrengthTier } from "./types.ts";
import { tierOf } from "./strength.ts";
import { cooperativeOpposition, ghostsHaveStackingMechanism } from "./stacking.ts";

export function tierGap(a: number, b: number, tiers?: StrengthTier[]) {
  return Math.abs(tierOf(a, tiers).tier_id - tierOf(b, tiers).tier_id);
}

export function currentEquivalent(hostGhosts: GhostEntity[]): { value: number; model: OppositionModel } {
  if (!hostGhosts.length) return { value: 0, model: "single_vs_target" };
  if (hostGhosts.length === 1) {
    return { value: hostGhosts[0]!.strength_profile.current_strength, model: "single_vs_target" };
  }
  if (hostGhosts.some((g) => g.revival_profile.deadlock_status !== "none")) {
    const dead = hostGhosts.find((g) => g.revival_profile.deadlock_status !== "none")!;
    return { value: dead.strength_profile.current_strength, model: "dead_ghost_suppression" };
  }
  if (ghostsHaveStackingMechanism(hostGhosts)) {
    return {
      value: cooperativeOpposition(hostGhosts.map((g) => g.strength_profile.current_strength)),
      model: "stacking_1_times_2_approx_3",
    };
  }
  const currents = hostGhosts.map((g) => g.strength_profile.current_strength);
  const hi = Math.max(...currents);
  const lo = Math.min(...currents);
  if (hi / Math.max(1, lo) < 1.35) {
    return { value: Math.round(currents.reduce((s, n) => s + n, 0) / currents.length), model: "parity_1_approx_2_approx_3" };
  }
  return { value: cooperativeOpposition(currents), model: "coalition_1_plus_2_approx_3" };
}

/** @deprecated use currentEquivalent — max is future risk only */
export function maxEquivalent(hostGhosts: GhostEntity[]): { value: number; model: OppositionModel } {
  return currentEquivalent(hostGhosts);
}

export function scoreRelation(a: GhostEntity, b: GhostEntity, tiers?: StrengthTier[]): GhostRelation {
  const overlap = a.mechanism_tags.filter((t) => b.mechanism_tags.includes(t));
  const conflictTags = a.driving_profile.conflict_tags.filter(
    (t) => b.mechanism_tags.includes(t) || b.driving_profile.compatibility_tags.includes(t),
  );
  const compatible = a.driving_profile.compatibility_tags.filter((t) => b.mechanism_tags.includes(t));
  const gap = tierGap(a.strength_profile.current_strength, b.strength_profile.current_strength, tiers);
  const deadlock = clamp01(55 - gap * 18 + overlap.length * 8 - conflictTags.length * 10);
  const stackingAllowed = ghostsHaveStackingMechanism([a, b]);
  let model: OppositionModel = "single_vs_target";
  if (a.revival_profile.deadlock_status !== "none" || b.revival_profile.deadlock_status !== "none") {
    model = "dead_ghost_suppression";
  } else if (stackingAllowed) {
    model = "stacking_1_times_2_approx_3";
  } else if (gap === 0 && deadlock >= 50) {
    model = "parity_1_approx_2_approx_3";
  } else if (compatible.length) {
    model = "coalition_1_plus_2_approx_3";
  }
  return {
    relation_id: uid("rel"),
    ghost_a_id: a.ghost_id,
    ghost_b_id: b.ghost_id,
    compatibility_score: clamp01(40 + compatible.length * 15 - conflictTags.length * 12),
    assimilation_risk: clamp01((a.driving_profile.assimilation_risk_base + b.driving_profile.assimilation_risk_base) / 2 + gap * 8),
    conflict_score: clamp01(30 + conflictTags.length * 18 + gap * 10),
    conflict_type: conflictTags.length ? "rule_collision" : gap >= 2 ? "directional_suppression" : "mutual_suppression",
    deadlock_potential: deadlock,
    stacking_potential: stackingAllowed ? 70 : 8,
    relation_model: model,
    known_to_player: false,
    revealed_clues: [],
    hidden_notes: `model=${model}; current_gap=${gap}`,
  };
}

export function oppositionForHost(hostGhosts: GhostEntity[], incoming: GhostEntity, tiers?: StrengthTier[]): {
  model: OppositionModel;
  effectiveOpposition: number;
  gap: number;
  relation: GhostRelation | null;
} {
  if (!hostGhosts.length) {
    return { model: "single_vs_target", effectiveOpposition: 0, gap: 99, relation: null };
  }
  const eq = currentEquivalent(hostGhosts);
  const gap = tierGap(eq.value, incoming.strength_profile.current_strength, tiers);
  const rel = hostGhosts[0] ? scoreRelation(hostGhosts[0], incoming, tiers) : null;
  return {
    model: eq.model,
    effectiveOpposition: eq.value,
    gap,
    relation: rel,
  };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
