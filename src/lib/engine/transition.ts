import type {
  Character,
  DeadlockStateKind,
  PlanEvaluationInput,
  SaveData,
  TransitionStateKind,
} from "./types.ts";
import { parseSupernaturalPlan } from "./plan-evaluator.ts";
import { evaluateDeadlockLogic, isTrueDeadlockState, legacyBalanceGrantsDeadlock } from "./deadlock-gate.ts";
import { evaluateHeteromorphLogic } from "./heteromorph-gate.ts";

const CORE_PATH: TransitionStateKind[] = [
  "normal_controller",
  "balanced_controller",
  "deadlock_candidate",
  "deadlocked_controller",
  "heteromorph_candidate",
  "heteromorphic",
];

export function canAdvanceTransition(from: TransitionStateKind, to: TransitionStateKind): boolean {
  if (from === to) return true;
  const a = CORE_PATH.indexOf(from);
  const b = CORE_PATH.indexOf(to);
  if (a < 0 || b < 0) return false;
  return b === a + 1;
}

export function applyTransition(actor: Character, to: TransitionStateKind): boolean {
  const from = actor.supernatural_transition_state ?? "normal_controller";
  if (from === "balanced_controller" && to === "heteromorphic") return false;
  if (from === "normal_controller" && to === "heteromorphic") return false;
  if (!canAdvanceTransition(from, to) && to !== from) {
    if (to === "failed_transition" || to === "lost") {
      actor.supernatural_transition_state = to;
      return true;
    }
    return false;
  }
  actor.supernatural_transition_state = to;
  return true;
}

export function applyBalanceDoesNotSetDeadlock(actor: Character, _balanceName: string) {
  if (!actor.deadlock_state) actor.deadlock_state = "none";
  return actor.deadlock_state;
}

export function revival100DoesNotHeteromorph(actor: Character) {
  return actor.supernatural_transition_state !== "heteromorphic";
}

export interface PlanResolution {
  phases: string[];
  deadlock_gate: string;
  heteromorph_gate: string;
  target_success_eligible: boolean;
  deadlock_established: boolean;
  heteromorph_established: boolean;
  visible_text: string;
  hidden_text: string;
  side_effects: { revival: number; body: number; anchor: number };
}

export function resolveSupernaturalPlan(save: SaveData, text: string, hint?: Partial<PlanEvaluationInput>): PlanResolution {
  const actor = save.player_character;
  actor.supernatural_transition_state ??= "normal_controller";
  actor.deadlock_state ??= "none";
  actor.human_memory_exists ??= true;

  const plan = hint && hint.plan_goal ? { ...parseSupernaturalPlan(text, save, hint), ...hint, participants: hint.participants ?? parseSupernaturalPlan(text, save, hint).participants } : parseSupernaturalPlan(text, save, hint);

  const phases: string[] = [];
  phases.push("BALANCE");
  if ((actor.supernatural_transition_state === "normal_controller" || !actor.supernatural_transition_state) && (save.balance?.possessed_ghost_ids?.length ?? 0) >= 1) {
    applyTransition(actor, "balanced_controller");
  } else if (actor.supernatural_transition_state === "normal_controller") {
    applyTransition(actor, "balanced_controller");
  }

  const dl = evaluateDeadlockLogic({ plan, ghosts: save.ghosts ?? [], items: save.items });
  let deadlock_established = isTrueDeadlockState(actor.deadlock_state);
  if (!legacyBalanceGrantsDeadlock(save.balance?.state) && dl.result === "eligible_for_execution") {
    applyTransition(actor, "deadlock_candidate");
    actor.deadlock_state = "rule_deadlock" as DeadlockStateKind;
    applyTransition(actor, "deadlocked_controller");
    deadlock_established = true;
    phases.push("DEADLOCK");
  } else if (deadlock_established) {
    phases.push("DEADLOCK");
  } else {
    phases.push("DEADLOCK");
  }

  const wantsHetero = plan.plan_goal === "heteromorph" || plan.plan_goal === "deadlock_then_heteromorph";
  let hetero: { result: string; notes: string; hidden_notes: string; protection_ok: boolean } = {
    result: "not_eligible",
    notes: "",
    hidden_notes: "",
    protection_ok: false,
  };
  if (wantsHetero) {
    hetero = evaluateHeteromorphLogic({ actor, deadlock_state: actor.deadlock_state, plan, items: save.items });
    if (hetero.protection_ok && deadlock_established) phases.push("CONSCIOUSNESS_PRESERVED");
    else if (wantsHetero) phases.push("CONSCIOUSNESS_PRESERVED");
    if (hetero.result === "eligible_for_execution" && deadlock_established) {
      applyTransition(actor, "heteromorph_candidate");
      applyTransition(actor, "heteromorphic");
      phases.push("HETEROMORPH");
    } else {
      phases.push("HETEROMORPH");
    }
  }

  const target_success_eligible =
    dl.result === "eligible_for_execution" &&
    (!wantsHetero || hetero.result === "eligible_for_execution");

  const side =
    target_success_eligible
      ? { revival: 2, body: -2, anchor: -2 }
      : { revival: 8, body: -6, anchor: -8 };

  return {
    phases: normalizePhases(phases, wantsHetero),
    deadlock_gate: dl.result,
    heteromorph_gate: wantsHetero ? hetero.result : "not_requested",
    target_success_eligible,
    deadlock_established: isTrueDeadlockState(actor.deadlock_state),
    heteromorph_established: actor.supernatural_transition_state === "heteromorphic",
    visible_text: target_success_eligible ? "结构按你的设想压住了。" : dl.notes || hetero.notes || "行动发生了，但没有达成你要的结果。",
    hidden_text: `${dl.hidden_notes}; ${hetero.hidden_notes}`,
    side_effects: side,
  };
}

function normalizePhases(phases: string[], wantsHetero: boolean): string[] {
  const order = ["BALANCE", "DEADLOCK", "CONSCIOUSNESS_PRESERVED", "HETEROMORPH"];
  const out = order.filter((p) => phases.includes(p) || (p === "BALANCE" || p === "DEADLOCK"));
  if (!wantsHetero) return out.filter((p) => p === "BALANCE" || p === "DEADLOCK");
  return order;
}
