import assert from "node:assert/strict";
import test from "node:test";
import { createSaveFromPack } from "./content-pack.ts";
import { DEFAULT_PACK } from "../packs/default-pack.ts";
import { resolveAction } from "./resolution.ts";
import { evaluateDrivingP2 } from "./driving.ts";
import { awakeningFactor, recomputeGhostCurrents } from "./awakening.ts";
import { deriveStrength } from "./ghost-strength.ts";
import { visibleResolution, stripHiddenSave, payloadHasHidden } from "./visibility.ts";
import { createContainedGhostItem } from "./special-inventory.ts";
import { computeSideContainmentStrength } from "./containment.ts";
import { oppositionForHost } from "./ghost-relations.ts";
import { makeGhost } from "./ghost.ts";

function saveClone() {
  return createSaveFromPack(DEFAULT_PACK);
}

function sourceTarget(save: ReturnType<typeof saveClone>, ghostId = "ghost_knock") {
  save.scene_targets = [
    {
      id: "ts",
      visible_name: "源头轮廓",
      location_id: save.current_location_id,
      linked_ghost_id: ghostId,
      present: true,
      visibility: "known",
      player_visible: { appearance: "", anomaly: "", known_facts: [] },
    },
  ];
}

test("FT01 attacking incoming does not auto force standard drive", () => {
  const save = saveClone();
  const incoming = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  incoming.attack_state.is_attacking = true;
  incoming.attack_state.current_attack_target_id = save.player_character.id;
  const r = resolveAction(save, {
    action_type: "drive_or_bind",
    action_text: "尝试驾驭门外的东西",
    target_id: "ghost_knock",
    force_drive: false,
  });
  assert.equal(r.driving.forced, false);
  assert.equal(r.driving.outcome, "缺少关押物");
});

test("FT02 explicit force_drive", () => {
  const save = saveClone();
  const incoming = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  incoming.attack_state.is_attacking = true;
  const r = resolveAction(save, {
    action_type: "force_drive",
    action_text: "强行驾驭",
    target_id: "ghost_knock",
    force_drive: true,
  });
  assert.equal(r.driving.forced, true);
  assert.ok(r.driving.notes.includes("位阶") || r.cost.revival !== 0 || r.driving.outcome !== "缺少关押物");
});

test("FT03 multi ghost rules independent", () => {
  const save = saveClone();
  const a = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  const b = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  a.killing_rules = [
    {
      rule_id: "ra",
      visible_clue: "发冷",
      hidden_rule_text: "碰到低温会死",
      trigger_conditions: ["发冷"],
      is_triggered: false,
      triggered_by_actor_id: null,
      target_ids: [],
      stage: "inactive",
      counterplay_tags: [],
      wrong_counterplay_results: [],
    },
  ];
  b.killing_rules = [
    {
      rule_id: "rb",
      visible_clue: "敲门",
      hidden_rule_text: "应门则死",
      trigger_conditions: ["应门"],
      is_triggered: false,
      triggered_by_actor_id: null,
      target_ids: [],
      stage: "inactive",
      counterplay_tags: [],
      wrong_counterplay_results: [],
    },
  ];
  a.present = true;
  b.present = true;
  resolveAction(save, { action_type: "observe", action_text: "应门并感觉发冷" });
  assert.equal(a.killing_rules[0]!.is_triggered, true);
  assert.equal(b.killing_rules[0]!.is_triggered, true);
  assert.deepEqual(a.killing_rules[0]!.target_ids, [save.player_character.id]);
  assert.deepEqual(b.killing_rules[0]!.target_ids, [save.player_character.id]);
});

test("FT04 aggregation does not retrigger ghost rule", () => {
  const save = saveClone();
  const a = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  a.present = true;
  a.killing_rules = [
    {
      rule_id: "ra",
      visible_clue: "应门",
      hidden_rule_text: "应门则死",
      trigger_conditions: ["应门"],
      is_triggered: false,
      triggered_by_actor_id: null,
      target_ids: [],
      stage: "inactive",
      counterplay_tags: [],
      wrong_counterplay_results: [],
    },
  ];
  resolveAction(save, { action_type: "observe", action_text: "应门" });
  const stage1 = a.killing_rules[0]!.stage;
  resolveAction(save, { action_type: "observe", action_text: "发呆" });
  assert.equal(a.killing_rules[0]!.is_triggered, true);
  assert.equal(a.killing_rules[0]!.stage, stage1);
});

test("FT05 revival 100 current equals max", () => {
  const save = saveClone();
  save.player_character.stats.revival_degree = 100;
  const host = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  host.revival_profile.deadlock_status = "none";
  resolveAction(save, { action_type: "observe", action_text: "观察" });
  assert.equal(awakeningFactor(100), 1);
  assert.equal(host.strength_profile.current_strength, host.strength_profile.max_strength);
});

test("FT06 activity does not change base current", () => {
  const g = makeGhost({ ghost_id: "x", display_name: "x", max: 300 });
  recomputeGhostCurrents([g], 40);
  const current = g.strength_profile.current_strength;
  const atk1 = g.strength_profile.attack_strength;
  g.revival_profile.ghost_activity = 90;
  const next = deriveStrength({
    max_strength: g.strength_profile.max_strength,
    current_strength: current,
    controllability: g.strength_profile.controllability,
    activity: 90,
  });
  assert.equal(next.current_strength, current);
  assert.notEqual(next.attack_strength, atk1);
});

test("FT07 containment uses stacking when applicable", () => {
  const save = saveClone();
  const host = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  const extra = makeGhost({
    ghost_id: "ghost_stack_b",
    display_name: "叠",
    max: 240,
    true_entity_kind: "possessed_ghost",
    host_character_id: save.player_character.id,
    mechanism_tags: ["stacking", "媒介袭击"],
  });
  host.host_character_id = save.player_character.id;
  host.true_entity_kind = "possessed_ghost";
  host.mechanism_tags = ["stacking", "媒介袭击"];
  save.ghosts!.push(extra);
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.mechanism_tags = ["媒介袭击", "stacking"];
  src.in_reality = "real";
  const side = computeSideContainmentStrength({
    actor: save.player_character,
    ghosts: save.ghosts!,
    items: save.items.filter((i) => save.player_character.items.includes(i.id)),
    targetGhost: src,
  });
  assert.equal(side.used_stacking, true);
});

test("FT08 unrelated stacking not full containment bonus", () => {
  const save = saveClone();
  const host = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  const extra = makeGhost({
    ghost_id: "ghost_stack_c",
    display_name: "叠",
    max: 240,
    true_entity_kind: "possessed_ghost",
    host_character_id: save.player_character.id,
    mechanism_tags: ["stacking", "记忆"],
  });
  host.host_character_id = save.player_character.id;
  host.true_entity_kind = "possessed_ghost";
  host.mechanism_tags = ["stacking", "记忆"];
  save.ghosts!.push(extra);
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.mechanism_tags = ["敲门", "声音"];
  const side = computeSideContainmentStrength({
    actor: save.player_character,
    ghosts: save.ghosts!,
    items: [],
    targetGhost: src,
  });
  assert.equal(side.used_stacking, false);
});

test("FT09 teammate mechanism filter via resolveAction", () => {
  const save = saveClone();
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.in_reality = "real";
  src.source_relationship.is_true_source = true;
  src.mechanism_tags = ["媒介袭击"];
  src.strength_profile.current_strength = 200;
  save.events[0]!.source_reality_status = "real";
  save.events[0]!.known_rules = ["窗口"];
  sourceTarget(save);
  const a = resolveAction(structuredClone(save), {
    action_type: "contain",
    action_text: "关押",
    target_id: "ts",
    teammate_roles: [
      { character_id: "npc_lin", role: "direct_source_suppression", strength: 400, mechanism_tags: ["媒介袭击"] },
      { character_id: "npc_b", role: "direct_source_suppression", strength: 400, mechanism_tags: ["记忆"] },
    ],
  });
  const b = resolveAction(structuredClone(save), {
    action_type: "contain",
    action_text: "关押",
    target_id: "ts",
    teammate_roles: [
      { character_id: "npc_lin", role: "direct_source_suppression", strength: 400, mechanism_tags: ["媒介袭击"] },
      { character_id: "npc_b", role: "direct_source_suppression", strength: 400, mechanism_tags: ["媒介袭击"] },
    ],
  });
  assert.ok((a.containment.side_strength ?? 0) < (b.containment.side_strength ?? 0));
});

test("FT10 dice cannot beat containment gate", () => {
  const save = saveClone();
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.in_reality = "real";
  src.source_relationship.is_true_source = true;
  src.strength_profile.current_strength = 9000;
  save.events[0]!.source_reality_status = "real";
  save.events[0]!.known_rules = ["窗口"];
  sourceTarget(save);
  const r = resolveAction(save, {
    action_type: "contain",
    action_text: "关押",
    target_id: "ts",
    force_roll: 1,
  });
  assert.equal(r.containment.success, false);
});

test("FT11 driving uses max not attack", () => {
  const host = makeGhost({ ghost_id: "h", display_name: "h", max: 80, true_entity_kind: "possessed_ghost", host_character_id: "pc" });
  const incoming = makeGhost({ ghost_id: "i", display_name: "i", max: 3000 });
  incoming.strength_profile.attack_strength = 70;
  const save = saveClone();
  incoming.ghost_id = "ghost_knock";
  Object.assign(save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!, incoming);
  save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!.strength_profile.max_strength = 3000;
  save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!.strength_profile.attack_strength = 70;
  const item = createContainedGhostItem(save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!);
  save.special_inventory = [item];
  const r = resolveAction(save, {
    action_type: "drive_or_bind",
    action_text: "尝试驾驭关押物",
    contained_item_id: item.item_id,
  });
  assert.notEqual(r.driving.outcome, "dual_ghost_deadlock");
  const opp = oppositionForHost([host], incoming);
  assert.ok(opp.gap >= 2);
});

test("FT12 hidden isolation regression", () => {
  const save = saveClone();
  const r = resolveAction(save, { action_type: "observe", action_text: "观察门" });
  assert.equal(payloadHasHidden({ resolution: visibleResolution(r), visible_context: save.visible_context }), false);
  const dumped = JSON.stringify(stripHiddenSave(save));
  assert.equal(dumped.includes("true_entity_kind"), false);
  assert.equal(dumped.includes("gm_notes_hidden"), false);
});
