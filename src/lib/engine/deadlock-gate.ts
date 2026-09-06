import type { GhostEntity, Item, PlanEvaluationInput } from "./types.ts";
import { LEGACY_BALANCE_ALIASES } from "./types.ts";
import type { BalanceStateKind, DeadlockStateKind } from "./types.ts";

export type DeadlockGateResult = "invalid_logic" | "valid_but_strength_insufficient" | "eligible_for_execution";

export function isTrueDeadlockState(state: DeadlockStateKind | undefined): boolean {
  return state === "rule_deadlock" || state === "revival_deadlock" || state === "global_deadlock" || state === "local_deadlock";
}

export function balanceIsNotDeadlock(balance: BalanceStateKind | undefined): boolean {
  if (!balance) return true;
  return LEGACY_BALANCE_ALIASES.includes(balance) || !String(balance).includes("deadlock") || true;
}

/** Old *deadlock* balance names are ordinary balance, not true deadlock. */
export function legacyBalanceGrantsDeadlock(balance: BalanceStateKind | undefined): boolean {
  if (!balance) return false;
  return LEGACY_BALANCE_ALIASES.includes(balance) ? false : false;
}

export function evaluateDeadlockLogic(params: {
  plan: PlanEvaluationInput;
  ghosts: GhostEntity[];
  items: Item[];
}): { result: DeadlockGateResult; notes: string; hidden_notes: string; two_forces: boolean; same_core: boolean; conflict: boolean; lock: boolean; strength_ok: boolean } {
  const ghosts = params.ghosts.filter((g) => params.plan.participants.includes(g.ghost_id));
  const items = params.items.filter((i) => params.plan.participants.includes(i.id));
  const forces = ghosts.length + items.filter((i) => i.type === "supernatural" || i.mechanism_tags.length).length;
  const two_forces = forces >= 2 || ghosts.length >= 2;

  const interactions = params.plan.claimed_interactions;
  const same_core =
    params.plan.same_core_result === true ||
    interactions.some((i) => i.same_core_result === true) ||
    interactions.some((i) => i.claimed_effect === "prevents_rule_completion");

  const conflict = realRuleConflict(ghosts, interactions, params.plan);

  const lock =
    params.plan.sustained_lock_possible === true ||
    (conflict && interactions.some((i) => /prevents_rule|lock|闭锁/.test(i.claimed_effect)));

  const currents = ghosts.map((g) => g.strength_profile.current_strength);
  const strength_ok = currents.length >= 2 ? Math.min(...currents) > 0 && Math.max(...currents) / Math.max(1, Math.min(...currents)) < 8 : currents[0] != null && currents[0] > 0;

  if (!two_forces || !same_core || !conflict || !lock) {
    return {
      result: "invalid_logic",
      notes: "你预想中的灵异对抗没有形成。",
      hidden_notes: `two=${two_forces} core=${same_core} conflict=${conflict} lock=${lock}`,
      two_forces,
      same_core,
      conflict,
      lock,
      strength_ok,
    };
  }
  if (!strength_ok) {
    return {
      result: "valid_but_strength_insufficient",
      notes: "对抗结构隐约成形，但力量不足以维持。",
      hidden_notes: `currents=${currents.join(",")}`,
      two_forces,
      same_core,
      conflict,
      lock,
      strength_ok,
    };
  }
  return {
    result: "eligible_for_execution",
    notes: "闭锁结构可以尝试执行。",
    hidden_notes: "logic+strength pass",
    two_forces,
    same_core,
    conflict,
    lock,
    strength_ok,
  };
}

function realRuleConflict(ghosts: GhostEntity[], interactions: PlanEvaluationInput["claimed_interactions"], plan: PlanEvaluationInput): boolean {
  if (interactions.some((i) => i.real_rule_conflict === true)) return true;
  if (ghosts.length >= 2) {
    const [a, b] = ghosts;
    const aConflict = a!.driving_profile.conflict_tags.filter((t) => b!.mechanism_tags.includes(t) || b!.driving_profile.compatibility_tags.includes(t));
    const bConflict = b!.driving_profile.conflict_tags.filter((t) => a!.mechanism_tags.includes(t));
    if (aConflict.length || bConflict.length) return true;
    const aRules = a!.killing_rules.map((r) => r.hidden_rule_text + r.visible_clue);
    const bTags = b!.mechanism_tags.join();
    if (aRules.some((t) => bTags && t && b!.driving_profile.conflict_tags.some((c) => t.includes(c)))) return true;
  }
  if (interactions.some((i) => i.claimed_effect === "prevents_rule_completion") && plan.same_core_result === false) return false;
  if (interactions.every((i) => i.claimed_effect === "unspecified") && !interactions.some((i) => i.real_rule_conflict)) return false;
  return false;
}
