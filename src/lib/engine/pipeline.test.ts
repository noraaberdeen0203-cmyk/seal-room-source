import assert from "node:assert/strict";
import test from "node:test";
import { createSaveFromPack, migrateSave } from "./content-pack.ts";
import { DEFAULT_PACK } from "../packs/default-pack.ts";
import { resolveAction } from "./resolution.ts";
import { visibleResolution, stripHiddenSave, payloadHasHidden, publicBalanceLabel } from "./visibility.ts";
import { awakeningFactor } from "./awakening.ts";
import { oppositionForHost } from "./ghost-relations.ts";
import { makeGhost } from "./ghost.ts";
import { createContainedGhostItem } from "./special-inventory.ts";

function saveClone() {
  return createSaveFromPack(DEFAULT_PACK);
}

test("IT01 contain weak side + roll 01 not contained", () => {
  const save = saveClone();
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.in_reality = "real";
  src.true_entity_kind = "source_entity";
  src.source_relationship.is_true_source = true;
  src.strength_profile.current_strength = 4000;
  save.events[0]!.source_reality_status = "real";
  save.events[0]!.known_rules = ["窗口"];
  save.scene_targets = [
    {
      id: "ts",
      visible_name: "源头轮廓",
      location_id: save.current_location_id,
      linked_ghost_id: "ghost_knock",
      present: true,
      visibility: "known",
      player_visible: { appearance: "", anomaly: "", known_facts: [] },
    },
  ];
  const r = resolveAction(save, {
    action_type: "contain",
    action_text: "用黄金关押眼前的轮廓",
    target_id: "ts",
    force_roll: 1,
    event_id: save.events[0]!.id,
  });
  assert.equal(r.containment.success, false);
  assert.notEqual(r.containment.result, "contained");
  assert.notEqual(save.events[0]!.status, "resolved");
});

test("IT02 equal strength limited", () => {
  const save = saveClone();
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.in_reality = "real";
  src.source_relationship.is_true_source = true;
  const hosted = save.ghosts!.filter((g) => g.host_character_id === save.player_character.id);
  const self = hosted.reduce((s, g) => s + g.strength_profile.current_strength, 0);
  src.strength_profile.current_strength = self + 120;
  save.events[0]!.source_reality_status = "real";
  save.events[0]!.known_rules = ["窗口"];
  save.scene_targets = [
    {
      id: "ts",
      visible_name: "源头轮廓",
      location_id: save.current_location_id,
      linked_ghost_id: "ghost_knock",
      present: true,
      visibility: "known",
      player_visible: { appearance: "", anomaly: "", known_facts: [] },
    },
  ];
  const r = resolveAction(save, {
    action_type: "contain",
    action_text: "关押",
    target_id: "ts",
    event_id: save.events[0]!.id,
  });
  assert.equal(r.containment.result, "limited");
});

test("IT03 teammates only direct suppress count", () => {
  const save = saveClone();
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.in_reality = "real";
  src.source_relationship.is_true_source = true;
  src.strength_profile.current_strength = 250;
  save.events[0]!.source_reality_status = "real";
  save.events[0]!.known_rules = ["窗口"];
  save.scene_targets = [
    {
      id: "ts",
      visible_name: "源头轮廓",
      location_id: save.current_location_id,
      linked_ghost_id: "ghost_knock",
      present: true,
      visibility: "known",
      player_visible: { appearance: "", anomaly: "", known_facts: [] },
    },
  ];
  const a = resolveAction(structuredClone(save), {
    action_type: "contain",
    action_text: "关押",
    target_id: "ts",
    teammate_roles: [{ character_id: "npc_lin", role: "evacuate", strength: 900 }],
  });
  const b = resolveAction(structuredClone(save), {
    action_type: "contain",
    action_text: "关押",
    target_id: "ts",
    teammate_roles: [{ character_id: "npc_lin", role: "direct_source_suppression", strength: 900 }],
  });
  assert.ok((a.containment.side_strength ?? 0) + 800 < (b.containment.side_strength ?? 0));
});

test("IT04 driving eligibility uses current_strength", () => {
  const host = makeGhost({ ghost_id: "h", display_name: "h", max: 4000, true_entity_kind: "possessed_ghost", host_character_id: "pc_t" });
  host.strength_profile.current_strength = 80;
  const incoming = makeGhost({ ghost_id: "i", display_name: "i", max: 90, true_entity_kind: "source_entity" });
  incoming.strength_profile.attack_strength = 50;
  incoming.strength_profile.current_strength = 3000;
  const opp = oppositionForHost([host], incoming);
  assert.ok(opp.gap >= 2, `gap=${opp.gap} should use current not attack/max`);
});

test("IT05-07 standard driving lowers revival and may weaken", () => {
  const save = saveClone();
  const host = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  host.strength_profile.max_strength = 400;
  save.player_character.stats.revival_degree = 80;
  const incoming = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  incoming.strength_profile.max_strength = 100;
  incoming.in_reality = "real";
  const item = createContainedGhostItem(incoming);
  save.special_inventory = [item];
  const beforeRev = save.player_character.stats.revival_degree;
  const beforeStr = Math.round(400 * awakeningFactor(beforeRev));
  const r = resolveAction(save, {
    action_type: "drive_or_bind",
    action_text: "尝试驾驭关押物",
    contained_item_id: item.item_id,
  });
  assert.ok(r.driving.attempted);
  if (r.driving.outcome === "缺少关押物") throw new Error(r.driving.notes);
  assert.ok(save.player_character.stats.revival_degree < beforeRev, `rev ${save.player_character.stats.revival_degree} !< ${beforeRev}`);
});

test("IT08 deadlock current > sum suppresses revival via resolveAction", () => {
  const save = saveClone();
  const a = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  a.revival_profile.deadlock_status = "revival_deadlock";
  a.revival_profile.deadlock_scope = ["ghost_knock"];
  a.strength_profile.current_strength = 1800;
  a.host_character_id = save.player_character.id;
  const b = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  b.host_character_id = save.player_character.id;
  b.true_entity_kind = "possessed_ghost";
  b.strength_profile.current_strength = 100;
  b.revival_profile.deadlock_status = "none";
  const before = save.player_character.stats.revival_degree;
  resolveAction(save, { action_type: "observe", action_text: "观察楼道" });
  assert.equal(save.player_character.stats.revival_degree, before);
});

test("IT09 deadlock equal does not suppress", () => {
  const save = saveClone();
  const a = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  a.revival_profile.deadlock_status = "revival_deadlock";
  a.revival_profile.deadlock_scope = ["ghost_knock"];
  a.strength_profile.current_strength = 200;
  a.host_character_id = save.player_character.id;
  const b = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  b.host_character_id = save.player_character.id;
  b.true_entity_kind = "possessed_ghost";
  b.strength_profile.current_strength = 200;
  b.revival_profile.deadlock_status = "none";
  const before = save.player_character.stats.revival_degree;
  resolveAction(save, { action_type: "observe", action_text: "观察楼道" });
  assert.ok(save.player_character.stats.revival_degree >= before);
});

test("IT10 no stacking without tag", () => {
  const save = saveClone();
  const hosted = save.ghosts!.filter((g) => g.host_character_id === save.player_character.id);
  assert.ok(hosted.every((g) => !g.mechanism_tags.includes("stacking")));
  resolveAction(save, { action_type: "observe", action_text: "观察" });
  const sum = hosted.reduce((s, g) => s + g.strength_profile.current_strength, 0);
  assert.equal(save.player_character.stats.effective_strength, sum);
});

test("IT11 collision path on use_power when two attack host", () => {
  const save = saveClone();
  const host = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  host.attack_state.is_attacking = true;
  host.attack_state.current_attack_target_id = save.player_character.id;
  const incoming = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  incoming.attack_state.is_attacking = true;
  incoming.attack_state.current_attack_target_id = save.player_character.id;
  incoming.host_character_id = null;
  resolveAction(save, { action_type: "use_power", action_text: "动用体内的冷" });
  assert.ok(save.balance && save.balance.state !== "no_balance");
});

test("IT12 askGm visible payload has no hidden keys", () => {
  const save = saveClone();
  const r = resolveAction(save, { action_type: "observe", action_text: "观察门" });
  const payload = { visible_context: save.visible_context, resolution: visibleResolution(r) };
  assert.equal(payloadHasHidden(payload), false);
});

test("IT13 player export strips hidden", () => {
  const save = saveClone();
  const dumped = JSON.stringify(stripHiddenSave(save));
  assert.equal(dumped.includes("true_entity_kind"), false);
  assert.equal(dumped.includes("hidden_truth"), false);
  assert.equal(dumped.includes("gm_notes_hidden"), false);
  assert.ok(dumped.includes("_stripped"));
});

test("IT14 old save migrates P2 fields", () => {
  const raw = { player_character: saveClone().player_character, events: saveClone().events } as never;
  const { save, migrated, rejected } = migrateSave(raw);
  assert.equal(rejected, undefined);
  assert.equal(migrated, true);
  assert.ok(Array.isArray(save.ghosts));
  assert.ok(save.balance);
  assert.ok(Array.isArray(save.special_inventory));
});

test("public balance label is not raw enum", () => {
  assert.notEqual(publicBalanceLabel("dual_ghost_deadlock"), "dual_ghost_deadlock");
});

test("awakening monotonic", () => {
  assert.ok(awakeningFactor(80) > awakeningFactor(20));
  assert.ok(awakeningFactor(20) > 0 && awakeningFactor(20) < 1);
});
