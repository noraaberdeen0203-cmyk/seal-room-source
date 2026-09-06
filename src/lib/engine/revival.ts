import { clamp } from "../utils.ts";
import type { Character, CharacterBalanceState, GhostEntity } from "./types.ts";
import { applyStrengthGrowth } from "./ghost-strength.ts";

export interface RevivalTickResult {
  revivalDelta: number;
  suppressedByDeadGhost: boolean;
  notes: string;
}

export function relatedGhostsForDeadlock(dead: GhostEntity, all: GhostEntity[]): GhostEntity[] {
  const scope = dead.revival_profile.deadlock_scope;
  if (dead.revival_profile.deadlock_status === "global_deadlock" || scope.includes("*")) {
    return all.filter((g) => g.ghost_id !== dead.ghost_id);
  }
  if (!scope.length) {
    return all.filter((g) => g.ghost_id !== dead.ghost_id && g.host_character_id === dead.host_character_id);
  }
  return all.filter((g) => scope.includes(g.ghost_id) || g.killing_rules.some((r) => scope.includes(r.rule_id)));
}

export function deadGhostSuppressesRevival(possessed: GhostEntity[]): { suppressed: boolean; note: string } {
  const deads = possessed.filter((g) => g.revival_profile.deadlock_status !== "none");
  if (!deads.length) return { suppressed: false, note: "无死机鬼，按正常复苏。" };
  for (const dead of deads) {
    const related = relatedGhostsForDeadlock(dead, possessed);
    const sum = related.reduce((s, g) => s + g.strength_profile.current_strength, 0);
    if (dead.strength_profile.current_strength > sum) {
      return {
        suppressed: true,
        note: `死机鬼 ${dead.ghost_id} 当前强度 ${dead.strength_profile.current_strength} > 相关其余鬼之和 ${sum}，本轮角色复苏度不增加。`,
      };
    }
  }
  return { suppressed: false, note: "其余鬼强度和已超过死机鬼，恢复正常复苏判定。" };
}

export function tickGhostsAndRevival(params: {
  actor: Character;
  ghosts: GhostEntity[];
  balance?: CharacterBalanceState;
  usedPower?: boolean;
  ruleTriggered?: boolean;
  externalStimulus?: number;
}): RevivalTickResult {
  const possessed = params.ghosts.filter((g) => g.host_character_id === params.actor.id);
  const activityDelta =
    (params.usedPower ? 8 : 2) + (params.ruleTriggered ? 10 : 0) + (params.externalStimulus ?? 0);
  for (const g of params.ghosts) {
    if (g.runtime_frozen) continue;
    const hosted = g.host_character_id === params.actor.id;
    applyStrengthGrowth(g, hosted ? activityDelta : Math.max(1, Math.round(activityDelta / 3)), {
      control: params.actor.stats.control,
      anchor: params.actor.stats.anchor,
    });
  }
  const check = deadGhostSuppressesRevival(possessed);
  if (check.suppressed) {
    return { revivalDelta: 0, suppressedByDeadGhost: true, notes: check.note };
  }
  const pressure = possessed.reduce((s, g) => s + g.revival_profile.revival_pressure, 0);
  const base = params.usedPower ? 6 : 2;
  const extra = Math.round(pressure / 40);
  return {
    revivalDelta: clamp(base + extra, 0, 20),
    suppressedByDeadGhost: false,
    notes: check.note,
  };
}
