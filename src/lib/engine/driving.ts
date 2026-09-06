import type {
  BalanceStateKind,
  Character,
  ContainedGhostItem,
  DrivingEntryType,
  GhostEntity,
  Item,
} from "./types.ts";
import { possessedGhosts } from "./ghost.ts";
import { oppositionForHost } from "./ghost-relations.ts";
import { evaluateSameTargetCollision, applyBalance, emptyBalance } from "./balance.ts";
import { setAttacking } from "./ghost-strength.ts";

/** temporary_tuning_constant — 未来按 balance quality 替换 */
export const DRIVING_BALANCE_RELIEF_DEFAULT = -48;

export const DRIVING_RELIEF_BY_STATE: Partial<Record<BalanceStateKind, number>> = {
  partial_deadlock: -32,
  dual_ghost_deadlock: DRIVING_BALANCE_RELIEF_DEFAULT,
  stable_deadlock: -56,
  single_ghost_instability: -20,
};

const SUCCESS_BALANCE: BalanceStateKind[] = [
  "dual_ghost_deadlock",
  "partial_deadlock",
  "stable_deadlock",
  "single_ghost_instability",
];

export interface DrivingEval {
  attempted: boolean;
  outcome: string;
  notes: string;
  allowed: boolean;
  entry: DrivingEntryType;
  balance_state: BalanceStateKind;
  forced_penalties: string[];
  revival: number;
  body: number;
  anchor: number;
  formed_balance: boolean;
  forced: boolean;
}

export function evaluateDrivingP2(params: {
  actor: Character;
  ghosts: GhostEntity[];
  items: Item[];
  special: ContainedGhostItem[];
  targetGhostId?: string | null;
  containedItemId?: string | null;
  force?: boolean;
  specialSuppression?: boolean;
}): DrivingEval {
  const hosted = possessedGhosts(params.ghosts, params.actor.id);
  const fromItem = params.containedItemId
    ? params.special.find((i) => i.item_id === params.containedItemId)
    : null;
  const incoming = params.ghosts.find((g) => g.ghost_id === (fromItem?.source_ghost_id ?? params.targetGhostId)) ?? null;
  const standardOk = !!(fromItem && fromItem.is_driveable && incoming);
  const force = !!params.force;
  const entry: DrivingEntryType = force
    ? "forced_without_containment"
    : "standard_after_containment";

  const empty = (outcome: string, notes: string, revival = 0): DrivingEval => ({
    attempted: true,
    outcome,
    notes,
    allowed: false,
    entry,
    balance_state: "no_balance",
    forced_penalties: [],
    revival,
    body: 0,
    anchor: 0,
    formed_balance: false,
    forced: force,
  });

  if (!incoming) return empty("没有可驾驭对象", "普通驾驭必须来自 contained_ghost。");
  if (!force && !standardOk) {
    return empty(
      "缺少关押物",
      incoming.attack_state.is_attacking
        ? "对象正在袭击。普通驾驭不可用，需先关押或显式选择强行驾驭。"
        : "普通驾驭必须以成功关押为前提。",
      0,
    );
  }

  const opp = oppositionForHost(hosted, incoming);
  const special = params.specialSuppression || params.items.some((i) => i.mechanism_tags.includes("压制"));
  const penalties: string[] = [];
  let revival = 0;
  let body = -4;
  let anchor = -4;

  if (!force && opp.gap >= 3) {
    return { ...empty("collapse", `位阶差 ${opp.gap}（current vs current-equivalent），普通驾驭不可行。`, 10), body: -10, anchor: -12, forced_penalties: ["gap>=3"], balance_state: "collapse" };
  }
  if (!force && opp.gap >= 2 && !special) {
    return {
      ...empty("multi_puzzle_conflict", `位阶差 ${opp.gap}，无特殊压制/叠加，普通路线不得直接成功。`, 4),
      body: -6,
      anchor: -6,
      forced_penalties: ["gap>=2 no special"],
      balance_state: "multi_puzzle_conflict",
    };
  }

  if (force) {
    penalties.push("强行驾驭结构性惩罚", "anchor/conflict/collapse 权重上升");
    body -= 8;
    anchor -= 10;
  }
  if (opp.gap >= 1) {
    penalties.push("位阶差1，代价提高");
    body -= 2;
    anchor -= 2;
  }

  setAttacking(incoming, params.actor.id, force ? "external_control" : "player_command");
  for (const g of hosted) setAttacking(g, params.actor.id, "defensive_reaction");

  const collision = evaluateSameTargetCollision({
    hostGhosts: hosted,
    incoming,
    hostId: params.actor.id,
    forced: force,
    gap: opp.gap,
  });

  const formed = SUCCESS_BALANCE.includes(collision.state);
  if (formed) {
    incoming.host_character_id = params.actor.id;
    incoming.true_entity_kind = "possessed_ghost";
    incoming.present = false;
    const relief = DRIVING_RELIEF_BY_STATE[collision.state] ?? DRIVING_BALANCE_RELIEF_DEFAULT;
    revival = force ? Math.min(0, Math.round(relief / 8)) : relief;
  } else {
    incoming.host_character_id = collision.state === "collapse" ? null : incoming.host_character_id;
    revival = force ? incoming.driving_profile.forced_driving_penalty : 6;
  }

  return {
    attempted: true,
    outcome: collision.state,
    notes: `${collision.reason} 模型=${opp.model} current位阶差=${opp.gap}`,
    allowed: formed,
    entry,
    balance_state: collision.state,
    forced_penalties: penalties,
    revival,
    body,
    anchor,
    formed_balance: formed,
    forced: force,
  };
}

export function evaluateDriving(params: {
  actor: Character;
  targetPower?: { base_strength?: number };
  event?: unknown;
  hasSuppressor: boolean;
}): { outcome: string; notes: string; allowedRoll: boolean } {
  if (params.actor.stats.revival_degree >= 85) return { outcome: "厉鬼复苏风险", notes: "复苏度过高。", allowedRoll: false };
  return { outcome: "可尝试驾驭", notes: "请走 evaluateDrivingP2。", allowedRoll: true };
}

export { applyBalance, emptyBalance, SUCCESS_BALANCE };
