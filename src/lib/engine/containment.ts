import type {
  Character,
  ContainedGhostItem,
  ContainmentResultKind,
  Difficulty,
  GameEvent,
  GhostEntity,
  Item,
  PlayerSuspectedKind,
  ResolutionResult,
  SceneTarget,
  TrueEntityKind,
} from "./types.ts";
import { kindOfTarget, possessedGhosts } from "./ghost.ts";
import { computePlayerCurrentStrength, hostedGhosts } from "./awakening.ts";
import { ghostsHaveStackingMechanism } from "./stacking.ts";
import { createContainedGhostItem } from "./special-inventory.ts";
import { idealisticBlocksContainment } from "./source-contact.ts";

const FAIL_COPY: Record<Difficulty, Partial<Record<TrueEntityKind, string>>> = {
  easy: {
    projection: "人影被隔绝了，但真正的敲门声似乎没有停止。这个目标可能不是源头。",
    medium: "你封住了声音经过的那一侧。别的门还在响。这个目标可能只是媒介。",
    ghost_slave: "那个还在走动的人倒下了。规律没有停。他恐怕不是源头。",
    phenomenon: "异常被压了一下，很快以另一种形式回来。你隔绝的恐怕只是现象。",
    source_entity: "窗口不对，或它还不在现实里。金容器合不上。",
    fragment: "你收起一块碎片。整件事没有因此结束。",
    unknown: "你关住了眼前的东西。规律没有因此结束。",
  },
  standard: {
    projection: "黄金袋收紧，人影塌了下去。楼道安静了三秒。随后，隔壁门外传来了新的敲门声。",
    medium: "门被金箔贴死。贴住的那一侧不再响。下一层的门铃却自己响了起来。",
    ghost_slave: "人倒下去，像被抽走了什么。走廊里的敲击声没有跟着停。",
    phenomenon: "积水被盖上金箔后干了一圈。干痕边缘又渗出新的湿意。",
    source_entity: "金容器贴上去，像贴在一层还没凝固的雾上。它滑开了。",
    fragment: "碎片进了袋子。外面的节奏换了一个位置。",
    unknown: "你完成了关押动作。三秒后，别的地方开始响。",
  },
  hard: {
    projection: "你关上黄金袋。三秒后，另一扇门响了。",
    medium: "金箔贴上。别的地方开始响。",
    ghost_slave: "人停了。声音没有。",
    phenomenon: "你处理完眼前的东西。它换了一种出现方式。",
    source_entity: "金容器合上。里面是空的。",
    fragment: "你收起一块。它还在别处。",
    unknown: "你关了。它还在。",
  },
};

export interface ContainmentEval {
  attempted: boolean;
  success: boolean;
  mode: string;
  notes: string;
  result: ContainmentResultKind;
  side_strength: number;
  source_strength: number;
  hard_block: boolean;
  hard_block_reason: string;
  visible_text: string;
  hidden_text: string;
  item: ContainedGhostItem | null;
  is_true_source_selected: boolean;
  kind: TrueEntityKind;
}

function falseResult(kind: TrueEntityKind): ContainmentResultKind {
  if (kind === "projection") return "projection_dispersed";
  if (kind === "medium") return "medium_removed";
  if (kind === "ghost_slave") return "ghost_slave_destroyed";
  if (kind === "phenomenon") return "phenomenon_suppressed";
  if (kind === "fragment") return "source_transferred";
  return "false_containment";
}

function mechanismApplies(actorTags: string[], targetTags: string[]): boolean {
  if (!actorTags.length || !targetTags.length) return false;
  return actorTags.some((t) => targetTags.includes(t));
}

export function computeSideContainmentStrength(params: {
  actor: Character;
  ghosts: GhostEntity[];
  items: Item[];
  teammates?: { role: string; strength?: number; mechanism_tags?: string[] }[];
  targetGhost?: GhostEntity | null;
}): { final: number; notes: string[]; windowHelp: number; used_stacking: boolean } {
  const notes: string[] = [];
  const hosted = hostedGhosts(params.ghosts, params.actor.id);
  const player = computePlayerCurrentStrength(params.ghosts, params.actor.id);
  const targetTags = params.targetGhost?.mechanism_tags ?? [];
  const hostedTags = hosted.flatMap((g) => g.mechanism_tags);
  const stackingApplies =
    player.used_stacking &&
    ghostsHaveStackingMechanism(hosted) &&
    mechanismApplies(hostedTags, targetTags.length ? targetTags : hostedTags);
  const self = stackingApplies ? player.stacked : player.base;
  notes.push(stackingApplies ? `关押有效结构(含叠加) ${self}` : `关押有效结构 ${self}`);
  const gold = params.items.filter((i) => i.type === "gold_container" && i.state !== "damaged");
  const itemMod = gold.length ? 80 + gold.length * 40 : 0;
  if (itemMod) notes.push(`隔绝物修正 +${itemMod}`);
  let teammate = 0;
  let windowHelp = 0;
  const countRoles = new Set(["contain_source", "direct_source_suppression", "suppress_source"]);
  for (const t of params.teammates ?? []) {
    if (!countRoles.has(t.role)) {
      windowHelp += 1;
      notes.push(`队友负责 ${t.role}，不计入强度`);
      continue;
    }
    const tags = t.mechanism_tags ?? [];
    const ok = !targetTags.length || !tags.length || mechanismApplies(tags, targetTags);
    if (ok) {
      teammate += t.strength ?? 0;
      notes.push(`队友同源头且机制有效 +${t.strength ?? 0}`);
    } else {
      notes.push(`队友压制但机制不匹配，不计全额`);
    }
  }
  return { final: self + itemMod + teammate, notes, windowHelp, used_stacking: stackingApplies };
}

export function evaluateContainmentP2(params: {
  event: GameEvent;
  actor: Character;
  items: Item[];
  ghosts: GhostEntity[];
  targets: SceneTarget[];
  targetId?: string | null;
  assumption?: PlayerSuspectedKind | null;
  difficulty?: Difficulty;
  teammates?: { role: string; strength?: number }[];
  windowReady?: boolean;
}): ContainmentEval {
  const difficulty = params.difficulty ?? "standard";
  const { ghost, kind, isSource } = kindOfTarget(params.ghosts, params.targets, params.targetId);
  const assumptionIgnored = params.assumption ?? null;

  if (!params.targetId && !ghost) {
    return {
      attempted: true,
      success: false,
      mode: "no_target",
      notes: "关押必须选择可见目标。",
      result: "failed",
      side_strength: 0,
      source_strength: 0,
      hard_block: true,
      hard_block_reason: "未选择可见目标。",
      visible_text: "关押需要一个看得见的东西。类型不是目标。",
      hidden_text: `assumption=${assumptionIgnored} ignored`,
      item: null,
      is_true_source_selected: false,
      kind: "unknown",
    };
  }

  if (!isSource || !ghost) {
    const result = falseResult(kind);
    return {
      attempted: true,
      success: false,
      mode: "false_source",
      notes: "对象不是源头，事件不得 resolved。",
      result,
      side_strength: 0,
      source_strength: ghost?.strength_profile.current_strength ?? 0,
      hard_block: true,
      hard_block_reason: "",
      visible_text: FAIL_COPY[difficulty][kind] || FAIL_COPY[difficulty].unknown || "关押没有结束这件事。",
      hidden_text: `true_kind=${kind}; assumption=${assumptionIgnored}; result=${result}`,
      item: null,
      is_true_source_selected: false,
      kind,
    };
  }

  if (idealisticBlocksContainment(ghost)) {
    return {
      attempted: true,
      success: false,
      mode: "no_source_contact",
      notes: "唯心源头尚未建立接触，不能进入真实源头关押。",
      result: "failed",
      side_strength: 0,
      source_strength: ghost.strength_profile.current_strength,
      hard_block: true,
      hard_block_reason: "source_contact_required",
      visible_text: "你碰到的仍是一层表现。真正的源头没有被碰到。",
      hidden_text: `idealistic source_contact_state=${ghost.source_contact_state ?? "unknown"}`,
      item: null,
      is_true_source_selected: true,
      kind,
    };
  }

  const inReality = ghost.in_reality === "real" || params.event.source_reality_status === "real";
  const hasGold = params.items.some((i) => i.type === "gold_container" && i.state !== "damaged");
  const windowReady =
    params.windowReady ??
    (params.event.known_rules.length >= 1 ||
      params.event.known_clues.some((c) => /窗口|金箔碰得|现实/.test(c)));
  const mechanismBlocks = ghost.mechanism_tags.includes("outside_reality") && !inReality;

  if (!inReality || (ghost.containment_profile.requires_reality_presence && ghost.in_reality !== "real")) {
    return {
      attempted: true,
      success: false,
      mode: "not_in_reality",
      notes: "源头不在现实。",
      result: "failed",
      side_strength: 0,
      source_strength: ghost.strength_profile.current_strength,
      hard_block: true,
      hard_block_reason: "",
      visible_text: FAIL_COPY[difficulty].source_entity || "金容器合不上。",
      hidden_text: "source not in reality",
      item: null,
      is_true_source_selected: true,
      kind,
    };
  }
  if (!hasGold) {
    return {
      attempted: true,
      success: false,
      mode: "no_isolation",
      notes: "没有完整隔绝手段。",
      result: "failed",
      side_strength: 0,
      source_strength: ghost.strength_profile.current_strength,
      hard_block: true,
      hard_block_reason: "",
      visible_text: "你手里没有能把那东西隔开的东西。",
      hidden_text: "no gold",
      item: null,
      is_true_source_selected: true,
      kind,
    };
  }
  if (!windowReady) {
    return {
      attempted: true,
      success: false,
      mode: "no_window",
      notes: "没有可操作窗口。",
      result: "limited",
      side_strength: 0,
      source_strength: ghost.strength_profile.current_strength,
      hard_block: false,
      hard_block_reason: "",
      visible_text: "你碰到了它，但它还没有落到你能抓住的位置。",
      hidden_text: "no window",
      item: null,
      is_true_source_selected: true,
      kind,
    };
  }
  if (mechanismBlocks) {
    return {
      attempted: true,
      success: false,
      mode: "mechanism_block",
      notes: "特殊机制阻止普通关押。",
      result: "failed",
      side_strength: 0,
      source_strength: ghost.strength_profile.current_strength,
      hard_block: true,
      hard_block_reason: "",
      visible_text: "隔绝手段从它身上滑开。",
      hidden_text: "mechanism blocks normal containment",
      item: null,
      is_true_source_selected: true,
      kind,
    };
  }

  const side = computeSideContainmentStrength({
    actor: params.actor,
    ghosts: params.ghosts,
    items: params.items,
    teammates: params.teammates,
    targetGhost: ghost,
  });
  const src = ghost.strength_profile.current_strength;
  if (side.final > src) {
    const item = createContainedGhostItem(ghost, "gold");
    return {
      attempted: true,
      success: true,
      mode: "contained",
      notes: `己方关押强度 ${side.final} > 源头当前强度 ${src}。`,
      result: "contained",
      side_strength: side.final,
      source_strength: src,
      hard_block: false,
      hard_block_reason: "",
      visible_text: "金容器合上。里面的东西不再敲外面的门。",
      hidden_text: `contained ${ghost.ghost_id}; ${side.notes.join("; ")}`,
      item,
      is_true_source_selected: true,
      kind,
    };
  }
  return {
    attempted: true,
    success: false,
    mode: "too_weak",
    notes: `己方关押强度 ${side.final} ≤ 源头当前强度 ${src}。只能限制。`,
    result: "limited",
    side_strength: side.final,
    source_strength: src,
    hard_block: false,
    hard_block_reason: "",
    visible_text: "你压住了它一瞬间。它没有进容器。楼道只是安静了一小会儿。",
    hidden_text: `limited; side=${side.final} src=${src}; ${side.notes.join("; ")}`,
    item: null,
    is_true_source_selected: true,
    kind,
  };
}

/** v0.1 兼容入口：无目标时按事件源头处理。 */
export function evaluateContainment(params: {
  event: GameEvent;
  items: Item[];
  claimedSourceId?: string;
}): Pick<ResolutionResult, "containment" | "hard_block" | "hard_block_reason"> {
  const sourceOk = !!params.event.source_entity_id && params.claimedSourceId === params.event.source_entity_id;
  if (!sourceOk) {
    return {
      hard_block: true,
      hard_block_reason: "",
      containment: { attempted: true, success: false, mode: "false_source", notes: "对象不是源头。" },
    };
  }
  return {
    hard_block: false,
    hard_block_reason: "",
    containment: { attempted: true, success: false, mode: "legacy_needs_p2", notes: "请走 evaluateContainmentP2。" },
  };
}
