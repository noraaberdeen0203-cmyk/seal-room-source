import { nowIso } from "../utils.ts";
import type { GhostEntity, SuppressionLock, SuppressionScope } from "./types.ts";

export function createSuppressionLock(params: {
  source_id: string;
  target: GhostEntity;
  scope: SuppressionScope;
  target_power_id?: string;
  target_rule_id?: string;
  target_tag?: string;
  effective_strength: number;
  mechanism_applies: boolean;
  release_condition: string;
}): { lock: SuppressionLock | null; reason: string } {
  if (!params.mechanism_applies) return { lock: null, reason: "mechanism_mismatch" };
  const lock: SuppressionLock = {
    source_id: params.source_id,
    target_id: params.target.ghost_id,
    scope: params.scope,
    target_power_id: params.target_power_id,
    target_rule_id: params.target_rule_id,
    target_tag: params.target_tag,
    effective_strength: params.effective_strength,
    applied_at: nowIso(),
    release_condition: params.release_condition,
    active: true,
  };
  params.target.suppression_locks = [...(params.target.suppression_locks ?? []), lock];
  return { lock, reason: "applied" };
}

export function powerBlocked(target: GhostEntity, powerId: string): boolean {
  const locks = (target.suppression_locks ?? []).filter((l) => l.active);
  return locks.some((l) => {
    if (l.scope === "whole_ghost") return true;
    if (l.scope === "one_power") return l.target_power_id === powerId;
    return false;
  });
}

export function releaseSuppressionLocks(target: GhostEntity, condition: string) {
  for (const l of target.suppression_locks ?? []) {
    if (l.active && l.release_condition === condition) l.active = false;
  }
}

export function suppressionAsDeadlockCandidate(lock: SuppressionLock | null): { candidate: boolean; auto_deadlock: boolean } {
  return { candidate: !!lock?.active, auto_deadlock: false };
}
