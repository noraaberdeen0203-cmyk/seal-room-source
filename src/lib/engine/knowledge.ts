import type { GameEvent, KnowledgeEntry, RevealCondition, SaveData } from "./types.ts";
import { uid, nowIso } from "../utils.ts";

export function playerSafeEvent(event: GameEvent) {
  return {
    id: event.id,
    name: event.name,
    status: event.status,
    visible_description: event.visible_description,
    hazard_grade: event.hazard_grade,
    hazard_strength: event.hazard_strength,
    source_strength_known: event.source_strength,
    instability: event.instability,
    known_rules: event.known_rules,
    suspected_rules: event.suspected_rules,
    false_assumptions: event.false_assumptions,
    known_clues: event.known_clues,
    locations: event.locations,
    lockdown_status: event.lockdown_status,
    containment_status: event.containment_status,
    source_reality_status: event.source_reality_status === "unknown" ? "unknown" : "unknown",
    hazard_factors_visible: event.hazard_factors.filter((f) =>
      ["社会暴露", "扩散快", "可封锁", "固定不动"].includes(f),
    ),
  };
}

export function tryReveal(save: SaveData, trigger: string, extra: string[] = []): KnowledgeEntry[] {
  const newly: KnowledgeEntry[] = [];
  for (const cond of save.reveal_conditions) {
    if (cond.revealed) continue;
    const hit =
      cond.trigger_type === "dice_success" && trigger === "dice_success" ||
      cond.requirements.some((r) => trigger.includes(r) || extra.some((e) => e.includes(r)));
    if (!hit) continue;
    cond.revealed = true;
    for (const field of cond.revealed_fields) {
      const ev = save.events.find((e) => field.startsWith(e.id) || field.includes(e.id));
      if (ev && field.includes("hidden_rules")) {
        const text = ev.hidden_rules[0];
        if (text && !ev.known_rules.includes(text)) {
          ev.known_rules = [...ev.known_rules, text];
          newly.push({
            id: uid("clue"),
            type: "confirmed_rule",
            title: `规律确认 · ${ev.name}`,
            body: text,
            source: cond.condition_id,
            event_id: ev.id,
            revealed_at: nowIso(),
          });
        }
      }
      if (ev && field.includes("hidden_clues")) {
        const text = ev.hidden_clues.find((c) => !ev.known_clues.includes(c));
        if (text) {
          ev.known_clues = [...ev.known_clues, text];
          newly.push({
            id: uid("clue"),
            type: "rumor",
            title: `线索 · ${ev.name}`,
            body: text,
            source: cond.condition_id,
            event_id: ev.id,
            revealed_at: nowIso(),
          });
        }
      }
      if (ev && field.includes("hidden_truth")) {
        newly.push({
          id: uid("clue"),
          type: "hidden_truth",
          title: `部分真相 · ${ev.name}`,
          body: ev.hidden_truth.slice(0, 80) + "……",
          source: cond.condition_id,
          event_id: ev.id,
          revealed_at: nowIso(),
        });
        ev.known_clues = [...ev.known_clues, "你摸到了事件源头的一角，但仍不能确认完整规律。"];
      }
    }
  }
  return newly;
}

export function rebuildVisible(save: SaveData) {
  const loc = save.locations.find((l) => l.id === save.current_location_id);
  const player = save.player_character;
  save.visible_context = {
    location_id: loc?.id ?? save.current_location_id,
    location_name: loc?.name ?? "未知地点",
    location_description: loc?.player_known_description ?? "",
    known_npcs: save.characters
      .filter((c) => c.type !== "player_character" && c.visibility !== "hidden")
      .map((c) => ({
        id: c.id,
        name: c.display_name || c.name,
        relation:
          player.relationships.find((r) => r.target_id === c.id)?.player_visible_relation ?? "未知",
        status: c.current_status,
      })),
    self_status: player.current_status,
    known_items: save.items
      .filter((i) => i.visibility !== "hidden" && (i.owner_id === player.id || !i.owner_id))
      .map((i) => ({
        id: i.id,
        name: i.name,
        usage: i.known_usage,
        state: i.state,
      })),
    clues: save.knowledge_log.filter((k) => k.type !== "hidden_truth"),
    confirmed_rules: save.events.flatMap((e) => e.known_rules),
    suspected_rules: save.events.flatMap((e) => e.suspected_rules),
    visible_anomalies: save.events
      .filter((e) => e.status === "active")
      .map((e) => e.visible_description),
  };

  save.hidden_context = {
    truths: save.events.map((e) => `${e.name}：${e.hidden_truth}`),
    npc_motives: save.characters
      .filter((c) => c.type !== "player_character")
      .map((c) => `${c.name}：${c.background.gm_hidden}`),
    event_sources: save.events.map(
      (e) => `${e.name} 源头=${e.source_entity_id} 现实状态=${e.source_reality_status} 强度=${e.source_strength}`,
    ),
    upcoming_clocks: save.events.flatMap((e) =>
      e.event_clock_rules.map((r) => `${e.name} / ${r.condition} → 失控${r.instability_delta}`),
    ),
    hidden_abnormalities: save.characters.flatMap((c) =>
      c.appearance.hidden_abnormalities.map((a) => `${c.name}：${a}`),
    ),
  };
}
