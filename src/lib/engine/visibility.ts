import type { ResolutionResult, SaveData } from "./types.ts";

const HIDDEN_KEYS = [
  "gm_notes_hidden",
  "hidden_text",
  "hidden_truth",
  "hidden_rules",
  "hidden_clues",
  "hidden_background",
  "true_entity_kind",
  "gm_hidden",
  "gm_notes",
  "hidden_properties",
  "hidden_result_text",
  "linked_source_id",
];

export function visibleResolution(result: ResolutionResult): Record<string, unknown> {
  return {
    rule: {
      triggered: result.rule.triggered,
      medium: result.rule.medium,
      delayable: result.rule.delayable,
    },
    mechanism: { matched: result.mechanism.matched, notes: result.mechanism.notes },
    dice: result.dice
      ? {
          roll: result.dice.roll,
          target: result.dice.target_value,
          margin: result.dice.margin,
          level: result.dice.level,
          visibility: result.dice.visibility,
        }
      : null,
    hard_block: result.hard_block,
    containment: {
      attempted: result.containment.attempted,
      success: result.containment.success,
      mode: result.containment.mode,
      notes: result.containment.notes,
      result: result.containment.result,
    },
    driving: {
      attempted: result.driving.attempted,
      outcome: publicBalanceLabel(result.driving.balance_state ?? result.driving.outcome),
      notes: result.driving.notes.replace(/ghost_\w+/g, "某物"),
    },
    cost: result.cost,
    state_changes: result.state_changes,
    new_clues: result.new_clues.map((c) => ({ title: c.title, body: c.body, type: c.type })),
    visible_risks: result.visible_risks,
    available_actions: result.available_actions,
  };
}

export function publicBalanceLabel(state?: string): string {
  switch (state) {
    case "dual_ghost_deadlock":
    case "stable_deadlock":
      return "体内两股力量互相卡住，暂时谁也走不完全程。";
    case "partial_deadlock":
      return "体内有东西对上了，但不稳。";
    case "single_ghost_instability":
      return "只有一股力量在身体里抬头。";
    case "anchor_state":
      return "你更像被当成接口，而不是驾驭者。";
    case "multi_puzzle_conflict":
      return "两股规则互相撕咬，身体成了战场。";
    case "collapse":
      return "结构撑不住了。";
    case "heteromorphic_state":
      return "身体开始不像原来的形状。";
    default:
      return state ?? "";
  }
}

export function stripHiddenSave(save: SaveData): Record<string, unknown> {
  return {
    save_id: save.save_id,
    pack_id: save.pack_id,
    turn: save.turn,
    current_location_id: save.current_location_id,
    difficulty: save.difficulty ?? "standard",
    player_character: {
      id: save.player_character.id,
      display_name: save.player_character.display_name,
      current_status: save.player_character.current_status,
      stats: save.player_character.stats,
      appearance: { public_description: save.player_character.appearance.public_description },
      background: { player_known: save.player_character.background.player_known },
    },
    visible_context: save.visible_context,
    knowledge_log: save.knowledge_log.filter((k) => k.type !== "hidden_truth"),
    dice_log: save.dice_log.filter((d) => d.visibility === "public"),
    turn_log: save.turn_log.map((t) => ({
      turn: t.turn,
      actor: t.actor,
      visible_text: t.visible_text,
      state_changes: t.state_changes,
      new_clues: t.new_clues,
      visible_risks: t.visible_risks,
      available_actions: t.available_actions,
    })),
    events: save.events.map((e) => ({
      id: e.id,
      name: e.name,
      status: e.status,
      visible_description: e.visible_description,
      hazard_grade: e.hazard_grade,
      hazard_strength: e.hazard_strength,
      instability: e.instability,
      known_rules: e.known_rules,
      suspected_rules: e.suspected_rules,
      known_clues: e.known_clues,
    })),
    special_inventory: (save.special_inventory ?? []).map((i) => ({
      item_id: i.item_id,
      name: i.name,
      integrity: i.container.containment_integrity,
      leakage_risk: i.container.leakage_risk,
      is_driveable: i.is_driveable,
      is_tradeable: i.is_tradeable,
      known_properties: i.known_properties,
    })),
    ghosts_player_facing: (save.ghosts ?? [])
      .filter((g) => g.visibility.known_to_player || g.host_character_id === save.player_character_id)
      .map((g) => ({
        displayed_as: g.visibility.displayed_to_player_as,
        aliases: g.visible_aliases,
        revealed_properties: g.visibility.revealed_properties,
        assessment: g.visibility.player_assessment,
      })),
    scene_targets: (save.scene_targets ?? []).map((t) => ({
      id: t.id,
      visible_name: t.visible_name,
      appearance: t.player_visible.appearance,
      anomaly: t.player_visible.anomaly,
    })),
    _stripped: true,
    _note: "普通导出已剥离 hidden。GM 导出请用 exportGmSave。",
  };
}

export function payloadHasHidden(obj: unknown): boolean {
  const s = JSON.stringify(obj);
  return HIDDEN_KEYS.some((k) => s.includes(k));
}
