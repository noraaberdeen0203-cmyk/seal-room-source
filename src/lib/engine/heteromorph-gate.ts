import type { Character, ConsciousnessProtection, DeadlockStateKind, Item, PlanEvaluationInput, Power } from "./types.ts";
import { isTrueDeadlockState } from "./deadlock-gate.ts";
import { isProtectiveConsciousnessFunction } from "./rare-tags.ts";

export type HeteromorphGateResult = "not_eligible" | "heteromorph_candidate" | "eligible_for_execution";

export function protectionFromItem(item: Item | undefined): ConsciousnessProtection | undefined {
  return item?.consciousness_protection;
}

export function evaluateHeteromorphLogic(params: {
  actor: Character;
  deadlock_state: DeadlockStateKind | undefined;
  plan: PlanEvaluationInput;
  items: Item[];
  powers?: Power[];
}): { result: HeteromorphGateResult; notes: string; hidden_notes: string; protection_ok: boolean } {
  if (!isTrueDeadlockState(params.deadlock_state ?? params.actor.deadlock_state)) {
    return {
      result: "not_eligible",
      notes: "转化没有发生。",
      hidden_notes: "heteromorph requires established deadlock",
      protection_ok: false,
    };
  }
  const memory = params.actor.human_memory_exists !== false;
  const overwritten = params.actor.consciousness_overwritten === true;
  if (!memory || overwritten) {
    return {
      result: "not_eligible",
      notes: "自我没有稳住。",
      hidden_notes: `memory=${memory} overwritten=${overwritten}`,
      protection_ok: false,
    };
  }
  const sourceId = params.plan.claimed_consciousness_protection?.source;
  const item = params.items.find((i) => i.id === sourceId);
  const power = params.powers?.find((p) => p.id === sourceId);
  const prot = protectionFromItem(item) ?? power?.consciousness_protection;
  const tagOnly =
    !prot &&
    !isProtectiveConsciousnessFunction(power?.consciousness_function) &&
    !!(item?.mechanism_tags.some((t) => /memory|consciousness|idealistic|restart|意识|唯心|重启/i.test(t)) ||
      power?.rare_tags?.includes("consciousness"));
  const protection_ok =
    (!!prot && isProtectiveConsciousnessFunction(prot.effect) && prot.covers_transition === true) ||
    (!!power && isProtectiveConsciousnessFunction(power.consciousness_function));
  if (tagOnly || !protection_ok) {
    return {
      result: "not_eligible",
      notes: "你试图抓住自己，但没有东西能把你固定住。",
      hidden_notes: tagOnly ? "tag without protection function" : "protection invalid",
      protection_ok: false,
    };
  }
  return {
    result: "eligible_for_execution",
    notes: "意识保护覆盖了关键阶段。",
    hidden_notes: `protection=${prot?.effect ?? power?.consciousness_function}`,
    protection_ok: true,
  };
}
