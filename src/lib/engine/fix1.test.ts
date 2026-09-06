import assert from "node:assert/strict";
import test from "node:test";
import { createSaveFromPack, migrateSave } from "./content-pack.ts";
import { DEFAULT_PACK } from "../packs/default-pack.ts";
import { resolveAction } from "./resolution.ts";
import { settleNaturalRevival, effectiveNaturalMultiplier } from "./natural-revival.ts";
import { makeGhost, freezeContainedGhost } from "./ghost.ts";
import { setAwakeningAnchor } from "./awakening.ts";
import { oppositionForHost } from "./ghost-relations.ts";
import { createContainedGhostItem } from "./special-inventory.ts";
import { emptyBalance } from "./balance.ts";
import { stripHiddenSave, payloadHasHidden, visibleResolution } from "./visibility.ts";

function saveClone() {
  return createSaveFromPack(DEFAULT_PACK);
}

test("FIX01 deadlock label weaker than others does not zero multiplier", () => {
  const save = saveClone();
  const host = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  host.host_character_id = save.player_character.id;
  host.true_entity_kind = "possessed_ghost";
  host.strength_profile.current_strength = 1500;
  const dead = makeGhost({
    ghost_id: "dead",
    display_name: "dead",
    max: 2000,
    true_entity_kind: "possessed_ghost",
    host_character_id: save.player_character.id,
  });
  dead.revival_profile.deadlock_status = "revival_deadlock";
  dead.strength_profile.current_strength = 1200;
  save.ghosts!.push(dead);
  save.balance = { ...emptyBalance(), state: "stable_deadlock" };
  assert.notEqual(effectiveNaturalMultiplier(save), 0);
});

test("FIX02 equal deadlock suppression fails", () => {
  const save = saveClone();
  const host = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  host.host_character_id = save.player_character.id;
  host.true_entity_kind = "possessed_ghost";
  host.strength_profile.current_strength = 1500;
  const dead = makeGhost({
    ghost_id: "dead",
    display_name: "dead",
    max: 2000,
    true_entity_kind: "possessed_ghost",
    host_character_id: save.player_character.id,
  });
  dead.revival_profile.deadlock_status = "revival_deadlock";
  dead.strength_profile.current_strength = 1500;
  save.ghosts!.push(dead);
  assert.notEqual(effectiveNaturalMultiplier(save), 0);
  const r = settleNaturalRevival(save, { kind: "long_time_skip", days: 30 });
  assert.ok(r.delta > 0);
});

test("FIX03 skip 90d from 82 interrupts near day 54", () => {
  const save = saveClone();
  save.player_character.stats.revival_degree = 82;
  const r = settleNaturalRevival(save, { kind: "long_time_skip", days: 90 });
  assert.equal(r.interrupted, true);
  assert.equal(r.interrupt_type, "revival_threshold");
  assert.equal(r.revival_degree, 100);
  assert.ok(Math.abs((r.actual_end_calendar ?? 0) - 54) < 0.2);
  assert.ok(Math.abs((r.remaining_skip_days ?? 0) - 36) < 0.2);
  assert.equal(save.player_character.stats.revival_degree, 100);
  assert.ok((save.world_calendar_day ?? 0) < 90);
});

test("FIX04 segmented deadlock then threshold", () => {
  const save = saveClone();
  save.player_character.stats.revival_degree = 85;
  const r = settleNaturalRevival(save, {
    kind: "long_time_skip",
    segments: [
      { days: 60, deadlockEffective: true },
      { days: 60, deadlockEffective: false, forceMultiplier: 1 },
    ],
  });
  assert.equal(r.interrupted, true);
  assert.ok(Math.abs((r.actual_end_calendar ?? 0) - 105) < 0.2);
  assert.ok(Math.abs((r.remaining_skip_days ?? 0) - 15) < 0.2);
  assert.equal(save.player_character.stats.revival_degree, 100);
});

test("FIX05 reanchor all non-deadlock after new balance", () => {
  const save = saveClone();
  const a = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  a.host_character_id = save.player_character.id;
  a.true_entity_kind = "possessed_ghost";
  a.strength_profile.current_strength = 1200;
  a.strength_profile.max_strength = 2000;
  setAwakeningAnchor(a, 60, 1200);
  save.player_character.stats.revival_degree = 70;
  const incoming = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  incoming.strength_profile.max_strength = 900;
  incoming.strength_profile.current_strength = 650;
  freezeContainedGhost(incoming);
  const item = createContainedGhostItem(incoming);
  save.special_inventory = [item];
  const beforeA = a.strength_profile.current_strength;
  resolveAction(save, { action_type: "drive_or_bind", action_text: "尝试驾驭关押物", contained_item_id: item.item_id });
  assert.equal(a.revival_profile.anchor_revival_degree, save.player_character.stats.revival_degree);
  assert.equal(a.strength_profile.current_strength, a.revival_profile.anchor_current_strength);
  assert.equal(a.strength_profile.current_strength, beforeA);
});

test("FIX06 new ghost anchor current stays 650", () => {
  const save = saveClone();
  const incoming = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  incoming.strength_profile.max_strength = 2800;
  incoming.strength_profile.current_strength = 650;
  freezeContainedGhost(incoming);
  const item = createContainedGhostItem(incoming);
  save.special_inventory = [item];
  const host = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  host.strength_profile.current_strength = 700;
  host.strength_profile.max_strength = 900;
  resolveAction(save, { action_type: "drive_or_bind", action_text: "尝试驾驭关押物", contained_item_id: item.item_id });
  assert.equal(incoming.strength_profile.current_strength, 650);
  assert.equal(incoming.revival_profile.anchor_current_strength, 650);
});

test("FIX07 21d * 0.7 = 4.9 exact", () => {
  const save = saveClone();
  const extra = makeGhost({
    ghost_id: "g2",
    display_name: "g2",
    max: 200,
    true_entity_kind: "possessed_ghost",
    host_character_id: save.player_character.id,
  });
  save.ghosts!.push(extra);
  save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!.host_character_id = save.player_character.id;
  save.balance = { ...emptyBalance(), state: "stable_deadlock" };
  const before = save.player_character.stats.revival_degree;
  const r = settleNaturalRevival(save, { kind: "long_time_skip", days: 21 });
  assert.equal(r.delta, 4.9);
  assert.equal(save.player_character.stats.revival_degree, before + 4.9);
});

test("FIX08 save/load keeps fractional revival", () => {
  const save = saveClone();
  save.player_character.stats.revival_degree = 22.4;
  const dumped = JSON.parse(JSON.stringify(save));
  const { save: loaded } = migrateSave(dumped);
  assert.equal(loaded.player_character.stats.revival_degree, 22.4);
});

test("REG01 driving still uses current", () => {
  const host = makeGhost({ ghost_id: "h", display_name: "h", max: 4000, true_entity_kind: "possessed_ghost", host_character_id: "pc" });
  host.strength_profile.current_strength = 80;
  const incoming = makeGhost({ ghost_id: "i", display_name: "i", max: 90 });
  incoming.strength_profile.current_strength = 3000;
  incoming.strength_profile.attack_strength = 80;
  assert.ok(oppositionForHost([host], incoming).gap >= 2);
});

test("REG02 scene wait 6h", () => {
  const save = saveClone();
  const before = save.player_character.stats.revival_degree;
  const r = settleNaturalRevival(save, { kind: "scene_wait", hours: 6 });
  assert.equal(r.delta, 0);
  assert.equal(save.player_character.stats.revival_degree, before);
});

test("REG03 containment dice cannot override", () => {
  const save = saveClone();
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.in_reality = "real";
  src.source_relationship.is_true_source = true;
  src.strength_profile.current_strength = 9000;
  save.events[0]!.source_reality_status = "real";
  save.events[0]!.known_rules = ["窗口"];
  save.scene_targets = [
    {
      id: "ts",
      visible_name: "t",
      location_id: save.current_location_id,
      linked_ghost_id: "ghost_knock",
      present: true,
      visibility: "known",
      player_visible: { appearance: "", anomaly: "", known_facts: [] },
    },
  ];
  const r = resolveAction(save, { action_type: "contain", action_text: "关押", target_id: "ts", force_roll: 1 });
  assert.equal(r.containment.success, false);
});

test("REG04 hidden isolation", () => {
  const save = saveClone();
  const r = resolveAction(save, { action_type: "observe", action_text: "观察门" });
  assert.equal(payloadHasHidden({ resolution: visibleResolution(r) }), false);
  assert.equal(JSON.stringify(stripHiddenSave(save)).includes("true_entity_kind"), false);
});
