import type { BalanceStateKind, CharacterBalanceState, GhostEntity } from "./types.ts";

export function emptyBalance(): CharacterBalanceState {
  return {
    state: "no_balance",
    stability: 70,
    overall_revival_pressure: 0,
    possessed_ghost_ids: [],
    dominant_ghost_id: null,
    deadlocked_ghost_ids: [],
    suppressed_ghost_ids: [],
    conflicting_ghost_ids: [],
    anchor_links: [],
    deadlocked_rules: [],
    failure_modes: [],
    last_state_transition_reason: "",
  };
}

export function evaluateSameTargetCollision(params: {
  hostGhosts: GhostEntity[];
  incoming: GhostEntity;
  hostId: string;
  forced?: boolean;
  gap: number;
}): { state: BalanceStateKind; reason: string; stability: number } {
  const { hostGhosts, incoming, hostId, forced, gap } = params;
  const bothAttackSame =
    incoming.attack_state.current_attack_target_id === hostId &&
    hostGhosts.some((g) => g.attack_state.current_attack_target_id === hostId);

  if (forced && gap >= 3) {
    return { state: "collapse", reason: "强行驾驭且位阶差过大，结构崩溃。", stability: 8 };
  }
  if (forced && gap >= 2) {
    return { state: "anchor_state", reason: "强行驾驭使宿主成为现实锚点。", stability: 22 };
  }
  if (gap >= 3) {
    return { state: "multi_puzzle_conflict", reason: "位阶差超过一阶且无特殊压制，倾向冲突/污染。", stability: 18 };
  }
  if (!hostGhosts.length) {
    return { state: "single_ghost_instability", reason: "体内只有一只未对冲的厉鬼。", stability: 40 };
  }
  if (bothAttackSame && gap <= 1) {
    const complete = [...hostGhosts, incoming].some((g) =>
      g.killing_rules.some((r) => r.is_triggered && r.stage === "completed"),
    );
    if (complete) {
      return { state: "multi_puzzle_conflict", reason: "其中一侧完成了杀人规律，对冲失败。", stability: 25 };
    }
    if (gap === 0 && incoming.revival_profile.deadlock_status !== "none") {
      return { state: "stable_deadlock", reason: "等势且死机路径互相卡住。", stability: 62 };
    }
    return {
      state: gap === 0 ? "dual_ghost_deadlock" : "partial_deadlock",
      reason: "两只鬼同时袭击宿主，杀人规律都无法完整走完。",
      stability: gap === 0 ? 55 : 42,
    };
  }
  if (gap === 2) {
    return { state: "anchor_state", reason: "差两阶，缺少特殊压制时宿主被当成接口。", stability: 28 };
  }
  return { state: "partial_deadlock", reason: "形成不稳定对冲。", stability: 36 };
}

export function applyBalance(
  current: CharacterBalanceState | undefined,
  next: { state: BalanceStateKind; reason: string; stability: number },
  possessed: string[],
  deadlocked: string[],
): CharacterBalanceState {
  const base = current ?? emptyBalance();
  return {
    ...base,
    state: next.state,
    stability: next.stability,
    possessed_ghost_ids: possessed,
    deadlocked_ghost_ids: deadlocked,
    dominant_ghost_id: possessed[0] ?? null,
    last_state_transition_reason: next.reason,
    failure_modes:
      next.state === "collapse"
        ? ["意识覆盖", "事件升级"]
        : next.state === "anchor_state"
          ? ["成为现实接口"]
          : base.failure_modes,
  };
}
