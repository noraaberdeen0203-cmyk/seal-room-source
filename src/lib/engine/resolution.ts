import { clamp, uid, nowIso } from "../utils.ts";
import type {
  ActionType,
  CostDelta,
  CostLevel,
  GameEvent,
  KnowledgeEntry,
  ResolutionInput,
  ResolutionResult,
  ResultLevel,
  SaveData,
} from "./types.ts";
import { resolveDice, isSuccess } from "./dice.ts";
import { tierGapModifier, tierOf } from "./strength.ts";
import { costShareFactor, applyGhostStacking } from "./stacking.ts";
import { applyClock, recomputeHazard } from "./hazard.ts";
import { aggregateEventRules, matchMechanism } from "./rules.ts";
import { evaluateContainmentP2 } from "./containment.ts";
import { evaluateDrivingP2 } from "./driving.ts";
import { tickGhostsAndRevival } from "./revival.ts";
import { applyBalance, emptyBalance } from "./balance.ts";
import { rebuildVisible, tryReveal } from "./knowledge.ts";
import { tickGhostKillingRules, simultaneousCollisionNeeded, freezeContainedGhost, unfreezeGhost } from "./ghost.ts";
import { evaluateSameTargetCollision } from "./balance.ts";
import { resolveSupernaturalPlan } from "./transition.ts";
import { runRareAction } from "./rare-actions.ts";
import { applyRevivalDelta } from "./revival-delta.ts";
import { recomputeGhostCurrents, computePlayerCurrentStrength, hostedGhosts, setAwakeningAnchor, rebuildHostAnchors } from "./awakening.ts";

export function inferActionType(text: string): ActionType {
  if (/自身重启/.test(text)) return "self_restart";
  if (/外部重启/.test(text)) return "external_restart";
  if (/解除压制/.test(text)) return "release_suppression";
  if (/压制|封锁灵异/.test(text)) return "apply_suppression";
  if (/解开诅咒|斩断诅咒/.test(text)) return "break_curse";
  if (/诅咒|建立诅咒/.test(text)) return "attach_curse";
  if (/借用灵异|借来的力量/.test(text)) return "use_borrowed_supernatural";
  if (/接触源头|建立接触|源接触/.test(text)) return "establish_source_contact";
  if (/死机|异类|闭锁对抗|灵异方案/.test(text)) return "supernatural_plan";
  if (/关押|装进|黄金|封存/.test(text)) return "contain";
  if (/强行驾驭|强行吞/.test(text)) return "force_drive";
  if (/驾驭|绑定|吞|放入体内/.test(text)) return "drive_or_bind";
  if (/能力|鬼域|动用|使用灵异|释放/.test(text)) return "use_power";
  if (/封锁|驱散|清场|切断|封楼/.test(text)) return "lockdown";
  if (/逃|躲|避开|撤离|后退/.test(text)) return "evade";
  if (/问|谈|套话|威胁|交易|联系/.test(text)) return "social";
  if (/观察|看|听|搜查|记录|检查/.test(text)) return "observe";
  return "other";
}

function costFor(level: ResultLevel, action: ActionType, usedPower: boolean): CostDelta {
  const table: Record<ResultLevel, CostLevel> = {
    extreme_success: "轻微",
    great_success: "轻微",
    success: usedPower ? "普通" : "轻微",
    narrow_success: "普通",
    fail_with_info: "普通",
    severe_fail: "严重",
    catastrophe: "致命",
    extreme_fail: "崩溃",
  };
  const lv = action === "observe" && !usedPower ? (table[level] === "轻微" ? "轻微" : "普通") : table[level];
  const map: Record<CostLevel, CostDelta> = {
    轻微: { level: lv, revival: 2, body: 0, anchor: 0, instability: 1 },
    普通: { level: lv, revival: 6, body: -2, anchor: -2, instability: 4 },
    严重: { level: lv, revival: 12, body: -6, anchor: -6, instability: 10 },
    致命: { level: lv, revival: 20, body: -12, anchor: -12, instability: 16 },
    崩溃: { level: lv, revival: 28, body: -18, anchor: -18, instability: 22 },
  };
  const c = { ...map[lv] };
  if (action === "observe" && !usedPower) {
    c.revival = Math.min(c.revival, 3);
    c.body = Math.min(0, c.body + 2);
  }
  if (level === "great_success" || level === "extreme_success") {
    c.revival = Math.max(0, c.revival - 2);
    c.instability = Math.max(-6, c.instability - 8);
  }
  return c;
}

function computeTarget(save: SaveData, input: ResolutionInput, event?: GameEvent): number {
  const s = save.player_character.stats;
  let target = 40;
  switch (input.action_type) {
    case "observe":
      target = 35 + Math.round(s.analysis_base * 0.45);
      target += save.knowledge_log.filter((k) => k.type === "confirmed_rule").length * 4;
      break;
    case "lockdown":
      target = 38 + Math.round(s.control * 0.2);
      if (event?.lockdown_status === "partial") target += 8;
      if (event && event.instability > 60) target -= 12;
      break;
    case "evade":
      target = 30 + Math.round(s.body * 0.25) + Math.round(s.control * 0.15);
      break;
    case "use_power":
      target = 28 + Math.round(s.control * 0.4);
      target -= Math.round(s.revival_degree * 0.15);
      break;
    case "contain":
      target = 24 + Math.round(s.control * 0.25) + Math.round(s.analysis_base * 0.15);
      break;
    case "drive_or_bind":
      target = 20 + Math.round(s.control * 0.2) + Math.round((100 - s.revival_degree) * 0.15);
      target += Math.round(s.anchor * 0.1);
      break;
    case "social":
      target = 40 + Math.round(s.anchor * 0.15);
      break;
    default:
      target = 40;
  }
  if (event) {
    target += tierGapModifier(s.effective_strength, event.source_strength ?? 200, save.strength_tiers);
    target -= Math.round(event.instability * 0.12);
  }
  target -= Math.round(s.revival_degree * 0.08);
  return clamp(Math.round(target), 5, 95);
}

export function resolveAction(save: SaveData, raw: ResolutionInput): ResolutionResult {
  const input: ResolutionInput = {
    ...raw,
    action_type: raw.action_type === "other" ? inferActionType(raw.action_text) : raw.action_type,
  };
  const event =
    save.events.find((e) => e.id === input.event_id) ??
    save.events.find((e) => e.status === "active") ??
    save.events[0];

  const ownedPowers = save.powers.filter((p) => save.player_character.powers.includes(p.id));
  const usedPower = Boolean(input.power_id) || input.action_type === "use_power";
  const power = ownedPowers.find((p) => p.id === input.power_id) ?? ownedPowers[0];

  tickGhostKillingRules(save.ghosts ?? [], input.action_text, save.player_character.id);
  const rule = aggregateEventRules(input.action_text, event, save.ghosts ?? []);
  const mechanism = matchMechanism(input.action_type, ownedPowers, event, input.action_text);
  if (simultaneousCollisionNeeded(save.ghosts ?? [], save.player_character.id) && input.action_type === "use_power") {
    const hostedNow = hostedGhosts(save.ghosts, save.player_character.id);
    const incomingAtk = (save.ghosts ?? []).find(
      (g) => g.attack_state.is_attacking && g.attack_state.current_attack_target_id === save.player_character.id && !g.host_character_id,
    );
    if (incomingAtk && hostedNow[0]) {
      const col = evaluateSameTargetCollision({
        hostGhosts: hostedNow,
        incoming: incomingAtk,
        hostId: save.player_character.id,
        gap: 0,
      });
      save.balance = applyBalance(save.balance, col, hostedNow.map((g) => g.ghost_id), []);
    }
  }

  let hard_block = false;
  let hard_block_reason = "";
  let containment: ResolutionResult["containment"] = { attempted: false, success: false, mode: "none", notes: "" };
  let driving: ResolutionResult["driving"] = { attempted: false, outcome: "none", notes: "" };
  let driveCost: { revival: number; body: number; anchor: number } | null = null;
  let continuityGhostId: string | null = null;
  let continuityCurrent: number | null = null;
  let planCost: { revival: number; body: number; anchor: number } | null = null;
  if (input.action_type === "supernatural_plan") {
    const planRes = resolveSupernaturalPlan(save, input.action_text, input.plan);
    if (!planRes.target_success_eligible) {
      hard_block = true;
      hard_block_reason = planRes.visible_text;
    }
    planCost = planRes.side_effects;
  }
  let rareSkipDice = false;
  let rareInterrupt: string | null = null;
  const rareRes = runRareAction(save, input);
  if (rareRes.handled) {
    if (rareRes.hard_block) {
      hard_block = true;
      hard_block_reason = rareRes.hard_block_reason || rareRes.visible;
    }
    rareSkipDice = rareRes.skip_dice;
    rareInterrupt = rareRes.interrupt;
    planCost = planCost ?? { revival: 0, body: 0, anchor: 0 };
  }

  if (input.action_type === "contain" && event) {
    const c = evaluateContainmentP2({
      event,
      actor: save.player_character,
      items: save.items.filter((i) => save.player_character.items.includes(i.id)),
      ghosts: save.ghosts ?? [],
      targets: save.scene_targets ?? [],
      targetId: input.target_id ?? input.target_character_id,
      assumption: input.suspected_kind ?? null,
      difficulty: save.difficulty ?? "standard",
      teammates: input.teammate_roles,
    });
    hard_block = c.hard_block;
    hard_block_reason = c.hard_block_reason;
    containment = {
      attempted: c.attempted,
      success: c.success,
      mode: c.mode,
      notes: c.notes,
      result: c.result,
      side_strength: c.side_strength,
      source_strength: c.source_strength,
    };
    if (c.item) {
      save.special_inventory = [...(save.special_inventory ?? []), c.item];
      const g = (save.ghosts ?? []).find((x) => x.ghost_id === c.item!.source_ghost_id);
      if (g) freezeContainedGhost(g);
    }
    save.last_containment = {
      result: c.result,
      visible_result_text: c.visible_text,
      hidden_result_text: c.hidden_text,
      is_true_source_selected: c.is_true_source_selected,
    };
    if (input.target_id && input.suspected_kind) {
      const tgt = (save.scene_targets ?? []).find((t) => t.id === input.target_id);
      const g = (save.ghosts ?? []).find((x) => x.ghost_id === tgt?.linked_ghost_id);
      if (g) g.visibility.player_assessment.suspected_kind = input.suspected_kind;
    }
  }

  if (input.action_type === "drive_or_bind" || input.action_type === "force_drive") {
    const force = input.action_type === "force_drive" || input.force_drive === true;
    const incomingId =
      save.special_inventory?.find((i) => i.item_id === (input.contained_item_id ?? input.item_id))?.source_ghost_id ??
      input.target_id;
    const incomingBefore = (save.ghosts ?? []).find((g) => g.ghost_id === incomingId);
    const frozenCurrent = incomingBefore?.strength_profile.current_strength;
    const d = evaluateDrivingP2({
      actor: save.player_character,
      ghosts: save.ghosts ?? [],
      items: save.items.filter((i) => save.player_character.items.includes(i.id)),
      special: save.special_inventory ?? [],
      targetGhostId: input.target_id,
      containedItemId: input.contained_item_id ?? input.item_id,
      force,
    });
    driving = {
      attempted: d.attempted,
      outcome: d.outcome,
      notes: d.notes,
      entry: d.entry,
      balance_state: d.balance_state,
      forced: d.forced,
    };
    save.balance = applyBalance(
      save.balance ?? emptyBalance(),
      { state: d.balance_state, reason: d.notes, stability: d.allowed ? 50 : 15 },
      (save.ghosts ?? []).filter((g) => g.host_character_id === save.player_character.id).map((g) => g.ghost_id),
      (save.ghosts ?? [])
        .filter((g) => g.revival_profile.deadlock_status !== "none")
        .map((g) => g.ghost_id),
    );
    if (!d.allowed && d.entry === "standard_after_containment" && d.outcome === "缺少关押物") {
      hard_block = true;
      hard_block_reason = d.notes;
    }
    if (d.formed_balance && incomingBefore && frozenCurrent != null) {
      unfreezeGhost(incomingBefore);
      incomingBefore.strength_profile.current_strength = frozenCurrent;
      incomingBefore.runtime_frozen = false;
      continuityGhostId = incomingBefore.ghost_id;
      continuityCurrent = frozenCurrent;
    }
    driveCost = { revival: d.revival, body: d.body, anchor: d.anchor };
  }

  // Lethal rule that already formed cannot be cancelled by a high roll.
  if (rule.triggered && rule.lethal && !mechanism.matched) {
    hard_block = true;
    hard_block_reason = `规律已成立（${rule.medium}）。机制不匹配，骰子不能取消这条规律，只能争取延缓或换取线索。`;
  }

  const visibility = input.force_hidden_roll ? "hidden" : "public";
  let dice = null as ResolutionResult["dice"];
  if (!hard_block || (input.action_type !== "contain" && !rareSkipDice)) {
    if (!rareSkipDice) {
    const target = computeTarget(save, input, event);
    // Mismatch caps the best result: still roll, but success becomes delay-only.
    dice = resolveDice({
      target: mechanism.matched ? target : Math.min(target, 35),
      visibility,
      action_type: input.action_type,
      action_text: input.action_text,
      turn: save.turn,
      forced_roll: input.force_roll,
    });
    }
  }

  const level: ResultLevel = dice?.level ?? "severe_fail";
  let cost = costFor(level, input.action_type, usedPower);
  if (rareRes.handled) {
    cost = { ...cost, revival: 0 };
  }
  if (power?.stacking) {
    const share = costShareFactor(power.stacking);
    cost = {
      ...cost,
      revival: Math.round(cost.revival * share),
      body: Math.round(cost.body * share),
      anchor: Math.round(cost.anchor * share),
    };
  }
  if (usedPower && cost.revival < 1) cost.revival = 1;
  if (driveCost) {
    cost = {
      ...cost,
      revival: driveCost.revival,
      body: cost.body + driveCost.body,
      anchor: cost.anchor + driveCost.anchor,
      level: driveCost.revival >= 20 ? "致命" : cost.level,
    };
  }
  if (planCost) {
    cost = {
      ...cost,
      revival: cost.revival + planCost.revival,
      body: cost.body + planCost.body,
      anchor: cost.anchor + planCost.anchor,
    };
  }

  const tick = tickGhostsAndRevival({
    actor: save.player_character,
    ghosts: save.ghosts ?? [],
    balance: save.balance,
    usedPower,
    ruleTriggered: rule.triggered,
  });
  if (rareRes.handled) {
    /* revival already committed via applyRevivalDelta */
  } else if (input.action_type !== "drive_or_bind" && input.action_type !== "force_drive") {
    if (tick.suppressedByDeadGhost) {
      cost = { ...cost, revival: 0 };
    } else {
      cost = { ...cost, revival: Math.max(cost.revival, tick.revivalDelta) };
    }
  } else if (tick.suppressedByDeadGhost && cost.revival > 0) {
    cost = { ...cost, revival: 0 };
  }

  const pc = save.player_character;
  if (!rareRes.handled && cost.revival) {
    const dlt = applyRevivalDelta({
      character: pc,
      delta: cost.revival,
      source: input.action_type,
      reason: "resolution_cost",
      transaction_id: `turn-${save.turn}`,
      cost_id: `turn-${save.turn}:${input.action_type}:revival`,
      save,
    });
    if (dlt.interrupt) {
      rareInterrupt = dlt.interrupt;
      save.pending_revival_endpoint = true;
    }
  }
  pc.stats.body = clamp(pc.stats.body + cost.body, 0, 100);
  pc.stats.anchor = clamp(pc.stats.anchor + cost.anchor, 0, 100);
  recomputeGhostCurrents(hostedGhosts(save.ghosts, pc.id), pc.stats.revival_degree, {
    control: pc.stats.control,
    anchor: pc.stats.anchor,
  });
  if (continuityGhostId && continuityCurrent != null) {
    const g = (save.ghosts ?? []).find((x) => x.ghost_id === continuityGhostId);
    if (g) {
      g.strength_profile.current_strength = continuityCurrent;
      setAwakeningAnchor(g, pc.stats.revival_degree, continuityCurrent);
    }
    rebuildHostAnchors(save.ghosts ?? [], pc.id, pc.stats.revival_degree);
  }
  const strength = computePlayerCurrentStrength(save.ghosts ?? [], pc.id);
  const stacked = applyGhostStacking(strength.base, hostedGhosts(save.ghosts, pc.id));
  pc.stats.effective_strength = stacked.value;
  pc.stats.supernatural_strength = strength.base;

  const state_changes: string[] = [];
  state_changes.push(`复苏度 ${cost.revival >= 0 ? "+" : ""}${cost.revival}`);
  if (cost.body) state_changes.push(`身体 ${cost.body}`);
  if (cost.anchor) state_changes.push(`意识锚点 ${cost.anchor}`);
  state_changes.push(`代价等级：${cost.level}`);

  if (event) {
    let reason = "行动";
    if (input.action_type === "lockdown" && dice && isSuccess(dice.level) && mechanism.matched) {
      reason = "封锁成功";
      event.lockdown_status = event.lockdown_status === "none" ? "partial" : "full";
      state_changes.push(`封锁状态 → ${event.lockdown_status}`);
    }
    if (input.action_type === "lockdown" && dice && !isSuccess(dice.level)) {
      reason = "封锁失败";
      event.lockdown_status = "failed";
      event.social_exposure = clamp(event.social_exposure + 12, 0, 100);
    }
    if (rule.triggered) reason = "触发媒介";
    if (containment.mode === "false_source") {
      reason = "关押媒介";
      event.status = "escaped";
      state_changes.push("关押没有结束这件事。");
    }
    if (containment.result && containment.result !== "contained" && containment.result !== "none") {
      event.status = containment.result === "limited" ? "suppressed" : "escaped";
      event.containment_status = containment.result;
    }
    if (containment.success && containment.result === "contained") {
      event.status = "contained";
      event.containment_status = "contained";
      event.instability = clamp(event.instability - 40, 0, 100);
      state_changes.push("源头被隔绝，进入特殊物品栏。");
    }
    if (save.last_containment?.visible_result_text) {
      state_changes.push(save.last_containment.visible_result_text);
    }
    const before = event.hazard_grade;
    const next = applyClock(event, reason);
    Object.assign(event, next);
    if (cost.instability && reason !== "封锁成功") {
      event.instability = clamp(event.instability + Math.max(0, cost.instability - 4), 0, 100);
      Object.assign(event, recomputeHazard(event));
    }
    state_changes.push(`事件失控度 ${event.instability}`);
    if (event.hazard_grade !== before) state_changes.push(`危害等级 ${before} → ${event.hazard_grade}`);
  }

  if (pc.stats.revival_degree >= 90) {
    pc.current_status = "复苏临界：意识与规律开始抢夺身体。";
    state_changes.push("进入复苏临界。");
  } else if (pc.stats.body <= 20) {
    pc.current_status = "身体更像容器。普通人医疗已经没有意义。";
  } else if (pc.stats.anchor <= 25) {
    pc.current_status = "记忆边缘发糊，有什么东西在用你的口吻思考。";
  }

  const new_clues: KnowledgeEntry[] = [];
  if (dice && (dice.level === "fail_with_info" || dice.level === "great_success" || dice.level === "extreme_success" || input.action_type === "observe")) {
    const extra = tryReveal(
      save,
      isSuccess(dice.level) ? "dice_success" : input.action_text,
      [rule.medium, input.action_text],
    );
    new_clues.push(...extra);
    if (event && extra.length === 0 && (input.action_type === "observe" || dice.level === "fail_with_info")) {
      const suspect = event.hidden_rules[0];
      if (suspect && !event.suspected_rules.includes(suspect) && !event.known_rules.includes(suspect)) {
        const clipped = "现场留下一种不完整的印象：" + suspect.slice(0, 18) + "……";
        event.suspected_rules = [...event.suspected_rules, clipped];
        new_clues.push({
          id: uid("clue"),
          type: "suspected_rule",
          title: `疑似规律 · ${event.name}`,
          body: clipped,
          source: "observe",
          event_id: event.id,
          revealed_at: nowIso(),
        } as const);
      }
    }
  }

  save.knowledge_log = [...save.knowledge_log, ...new_clues];
  if (dice) save.dice_log = [...save.dice_log, dice];
  save.turn += 1;
  save.updated_at = nowIso();
  rebuildVisible(save);

  const visible_risks: string[] = [];
  if (rule.triggered) visible_risks.push(`你可能已经碰上了与「${rule.medium}」有关的媒介。`);
  if (event && event.instability >= 60) visible_risks.push("事件正在向外渗。再拖会变成社会事件。");
  if (pc.stats.revival_degree >= 70) visible_risks.push("体内的东西比刚才更近。");
  if (!mechanism.matched) visible_risks.push("你手里的手段和眼前的问题不是同一类规则。");

  const available_actions = suggestActions(input.action_type, event, mechanism.matched, containment.mode);

  const gm_notes_hidden = [
    event ? `源头=${event.source_entity_id} 现实=${event.source_reality_status} 强度=${event.source_strength}` : "",
    rule.triggered ? `隐藏规律：${rule.rule_text}` : "",
    hard_block ? hard_block_reason : "",
    driving.attempted ? driving.notes : "",
    `阶位 ${tierOf(pc.stats.effective_strength, save.strength_tiers).label}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    rule,
    mechanism,
    dice,
    hard_block,
    hard_block_reason,
    containment,
    driving,
    cost,
    state_changes,
    new_clues,
    revealed_fields: new_clues.map((c) => c.title),
    visible_risks,
    available_actions,
    gm_notes_hidden,
    interrupt: rareInterrupt,
    rare_notes: rareRes.handled ? rareRes.notes : undefined,
  };
}

function suggestActions(
  last: ActionType,
  event: GameEvent | undefined,
  matched: boolean,
  containMode: string,
): string[] {
  const actions = ["继续观察现场，不触碰任何异常。", "把普通人隔开，切断拍摄和围观。"];
  if (event && event.known_rules.length === 0) actions.push("记录所有媒介：门、声音、名字、影像。");
  if (!matched) actions.push("不要硬碰。先找能对上机制的手段。");
  if (containMode === "false_source") actions.push("重新确认源头，而不是再关一次同样的东西。");
  if (containMode === "not_in_reality") actions.push("限制媒介，或设法把源头逼回现实。");
  if (last === "observe") actions.push("向仍清醒的目击者做有限询问。");
  actions.push("撤离到临时据点，整理线索板。");
  return actions.slice(0, 5);
}
