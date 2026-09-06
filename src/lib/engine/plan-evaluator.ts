import type { PlanEvaluationInput, PlanGoal, SaveData } from "./types.ts";

/** AI/player text → structured plan only. Never decides success. */
export function parseSupernaturalPlan(text: string, save: SaveData, hint?: Partial<PlanEvaluationInput>): PlanEvaluationInput {
  const ghosts = save.ghosts ?? [];
  const items = save.items;
  const participants = new Set<string>(hint?.participants ?? []);
  for (const g of ghosts) {
    if (text.includes(g.display_name) || text.includes(g.ghost_id)) participants.add(g.ghost_id);
  }
  for (const it of items) {
    if (text.includes(it.name) || text.includes(it.id)) participants.add(it.id);
  }
  let goal: PlanGoal = hint?.plan_goal ?? "deadlock";
  if (/异类/.test(text) && /死机/.test(text)) goal = "deadlock_then_heteromorph";
  else if (/异类/.test(text)) goal = "heteromorph";
  else if (/死机/.test(text)) goal = "deadlock";
  else if (/平衡/.test(text)) goal = "balance";

  const claimed = hint?.claimed_interactions?.length
    ? hint.claimed_interactions
    : inferInteractions([...participants], text);

  const protSource =
    hint?.claimed_consciousness_protection?.source ??
    items.find((i) => text.includes(i.name) || text.includes(i.id))?.id;

  return {
    plan_goal: goal,
    raw_text: text,
    participants: [...participants],
    claimed_interactions: claimed,
    claimed_consciousness_protection: protSource
      ? {
          source: protSource,
          effect: hint?.claimed_consciousness_protection?.effect ?? "preserve_human_memory",
        }
      : hint?.claimed_consciousness_protection,
    same_core_result: hint?.same_core_result,
    sustained_lock_possible: hint?.sustained_lock_possible,
  };
}

export function parseRestartIntent(text: string): {
  claimed_external_single_target: boolean;
  claimed_self_revival_rewind: boolean;
  claimed_restart_domains: string[];
} {
  return {
    claimed_external_single_target: /只重启|外部单体|只落在/.test(text),
    claimed_self_revival_rewind: /自身复苏|刷新自己的复苏/.test(text),
    claimed_restart_domains: /复苏/.test(text) ? ["revival_state"] : ["body"],
  };
}

function inferInteractions(ids: string[], text: string): PlanEvaluationInput["claimed_interactions"] {
  if (ids.length < 2) return [];
  const effect = /闭锁|卡住|互相|对冲|阻止|无法完成/.test(text) ? "prevents_rule_completion" : "unspecified";
  return [{ source: ids[0]!, target: ids[1]!, claimed_effect: effect }];
}
