import type { ActionType, GameEvent, GhostEntity, MechanismMatch, Power, RuleTrigger } from "./types.ts";

const ENV_PATTERNS: { keys: string[]; medium: string; lethal: boolean }[] = [
  { keys: ["封锁现场", "封楼", "清场"], medium: "现场秩序", lethal: false },
  { keys: ["直播", "全城录像"], medium: "社会暴露", lethal: false },
];

/** Event aggregation: consume already-written GhostEntity killing_rules, plus environment-only patterns. */
export function aggregateEventRules(
  actionText: string,
  event: GameEvent | undefined,
  ghosts: GhostEntity[] = [],
): RuleTrigger {
  if (!event) {
    return { triggered: false, rule_text: "", lethal: false, medium: "", delayable: true };
  }
  const fromGhosts = ghosts.flatMap((g) =>
    g.killing_rules.filter((r) => r.is_triggered).map((r) => ({ ghost_id: g.ghost_id, rule: r })),
  );
  if (fromGhosts[0]) {
    const hit = fromGhosts[0];
    return {
      triggered: true,
      rule_text: hit.rule.hidden_rule_text || hit.rule.visible_clue,
      lethal: hit.rule.stage === "attacking" || /死|杀/.test(hit.rule.hidden_rule_text),
      medium: hit.rule.trigger_conditions[0] ?? "媒介",
      delayable: hit.rule.stage !== "attacking",
    };
  }
  const env = ENV_PATTERNS.find((p) => p.keys.some((k) => actionText.includes(k)));
  if (!env) {
    return { triggered: false, rule_text: "", lethal: false, medium: "", delayable: true };
  }
  return {
    triggered: true,
    rule_text: `场景规则：${env.medium}`,
    lethal: env.lethal,
    medium: env.medium,
    delayable: true,
  };
}

/** @deprecated use aggregateEventRules after tickGhostKillingRules */
export function detectRuleTrigger(actionText: string, event: GameEvent | undefined, ghosts: GhostEntity[] = []): RuleTrigger {
  return aggregateEventRules(actionText, event, ghosts);
}

export function matchMechanism(
  actionType: ActionType,
  powers: Power[],
  event: GameEvent | undefined,
  actionText: string,
): MechanismMatch {
  if (!event) return { matched: true, tags_used: [], notes: "当前没有需要对抗的规律。" };
  const needed = inferNeededTags(event, actionText);
  const have = powers.flatMap((p) => p.mechanism_tags);
  const overlap = needed.filter((t) => have.includes(t));
  if (actionType === "observe" || actionType === "social") {
    return { matched: true, tags_used: overlap, notes: "观察与交涉不依赖对抗机制，但仍可能触发媒介。" };
  }
  if (needed.length === 0) {
    return { matched: true, tags_used: overlap, notes: "尚未识别需要何种机制。" };
  }
  if (overlap.length === 0) {
    return {
      matched: false,
      tags_used: [],
      notes: `机制不匹配。当前问题更需要「${needed.join(" / ")}」，硬实力不能直接翻盘。`,
    };
  }
  return { matched: true, tags_used: overlap, notes: `机制部分匹配：${overlap.join("、")}` };
}

function inferNeededTags(event: GameEvent, actionText: string): string[] {
  const tags: string[] = [];
  const blob = `${event.hidden_rules.join(" ")} ${event.known_rules.join(" ")} ${event.hazard_factors.join(" ")} ${actionText}`;
  if (blob.includes("鬼域")) tags.push("鬼域");
  if (blob.includes("媒介") || blob.includes("敲门") || blob.includes("声音") || blob.includes("录像")) tags.push("媒介袭击");
  if (blob.includes("必死") || blob.includes("杀")) tags.push("压制");
  if (blob.includes("扩散") || blob.includes("封锁")) tags.push("封锁");
  if (blob.includes("转移") || blob.includes("替死")) tags.push("转移");
  if (blob.includes("不在现实") || blob.includes("脱离")) tags.push("现实脱离");
  if (actionText.includes("关押")) tags.push("封锁");
  return [...new Set(tags)];
}
