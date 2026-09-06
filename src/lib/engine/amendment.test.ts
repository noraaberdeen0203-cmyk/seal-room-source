import assert from "node:assert/strict";
import test from "node:test";
import { createSaveFromPack } from "./content-pack.ts";
import { DEFAULT_PACK } from "../packs/default-pack.ts";
import { resolveAction } from "./resolution.ts";
import { oppositionForHost } from "./ghost-relations.ts";
import { makeGhost, freezeContainedGhost } from "./ghost.ts";
import { currentFromAnchor, setAwakeningAnchor, recomputeGhostCurrents, isDeadlockedGhost } from "./awakening.ts";
import { settleNaturalRevival, NATURAL_REVIVAL_CONFIG } from "./natural-revival.ts";
import { createContainedGhostItem } from "./special-inventory.ts";
import { emptyBalance } from "./balance.ts";
import { evaluateDrivingP2 } from "./driving.ts";

function saveClone() {
  return createSaveFromPack(DEFAULT_PACK);
}

test("AM01 weak host can drive strong ghost at low current window", () => {
  const host = makeGhost({ ghost_id: "h", display_name: "h", max: 900, true_entity_kind: "possessed_ghost", host_character_id: "pc" });
  host.strength_profile.current_strength = 700;
  const incoming = makeGhost({ ghost_id: "i", display_name: "i", max: 2800 });
  incoming.strength_profile.current_strength = 650;
  incoming.runtime_frozen = true;
  const opp = oppositionForHost([host], incoming);
  assert.ok(opp.gap <= 1, `current gap ${opp.gap} should allow attempt`);
  const save = saveClone();
  const hosted = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  hosted.strength_profile.max_strength = 900;
  hosted.strength_profile.current_strength = 700;
  hosted.host_character_id = save.player_character.id;
  hosted.true_entity_kind = "possessed_ghost";
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.strength_profile.max_strength = 2800;
  src.strength_profile.current_strength = 650;
  freezeContainedGhost(src);
  const item = createContainedGhostItem(src);
  save.special_inventory = [item];
  const d = evaluateDrivingP2({
    actor: save.player_character,
    ghosts: save.ghosts!,
    items: [],
    special: [item],
    containedItemId: item.item_id,
    force: false,
  });
  assert.notEqual(d.outcome, "collapse");
  assert.notEqual(d.notes.includes("普通驾驭不可行"), true);
});

test("AM02 qualification uses current not attack", () => {
  const host = makeGhost({ ghost_id: "h", display_name: "h", max: 200, true_entity_kind: "possessed_ghost", host_character_id: "pc" });
  host.strength_profile.current_strength = 80;
  host.strength_profile.attack_strength = 2000;
  const incoming = makeGhost({ ghost_id: "i", display_name: "i", max: 200 });
  incoming.strength_profile.current_strength = 1800;
  incoming.strength_profile.attack_strength = 90;
  const opp = oppositionForHost([host], incoming);
  assert.ok(opp.gap >= 2);
});

test("AM03 contained ghost frozen across 90 day skip", () => {
  const save = saveClone();
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.strength_profile.current_strength = 650;
  src.revival_profile.ghost_activity = 40;
  src.killing_rules = [
    {
      rule_id: "k",
      visible_clue: "应门",
      hidden_rule_text: "应门",
      trigger_conditions: ["应门"],
      is_triggered: false,
      triggered_by_actor_id: null,
      target_ids: [],
      stage: "warning",
      counterplay_tags: [],
      wrong_counterplay_results: [],
    },
  ];
  freezeContainedGhost(src);
  settleNaturalRevival(save, { kind: "long_time_skip", days: 90 });
  resolveAction(save, { action_type: "observe", action_text: "应门" });
  assert.equal(src.strength_profile.current_strength, 650);
  assert.equal(src.revival_profile.ghost_activity, 40);
  assert.equal(src.killing_rules[0]!.stage, "warning");
  assert.equal(src.runtime_frozen, true);
});

test("AM04 driving success keeps frozen current", () => {
  const save = saveClone();
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.strength_profile.max_strength = 2800;
  src.strength_profile.current_strength = 650;
  freezeContainedGhost(src);
  const item = createContainedGhostItem(src);
  save.special_inventory = [item];
  const host = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  host.strength_profile.current_strength = 700;
  host.strength_profile.max_strength = 900;
  const r = resolveAction(save, {
    action_type: "drive_or_bind",
    action_text: "尝试驾驭关押物",
    contained_item_id: item.item_id,
  });
  assert.ok(r.driving.attempted);
  if (r.driving.outcome === "缺少关押物") throw new Error(r.driving.notes);
  assert.equal(src.strength_profile.current_strength, 650);
});

test("AM05 awakening anchor interpolates to max at 100", () => {
  const g = makeGhost({ ghost_id: "b", display_name: "b", max: 2800 });
  setAwakeningAnchor(g, 30, 650);
  assert.ok(currentFromAnchor(g, 50) > 650 && currentFromAnchor(g, 50) < 2800);
  assert.equal(currentFromAnchor(g, 100), 2800);
  recomputeGhostCurrents([g], 100);
  assert.equal(g.strength_profile.current_strength, 2800);
});

test("AM06 deadlock skips awakening anchor", () => {
  const g = makeGhost({ ghost_id: "d", display_name: "d", max: 2000 });
  g.revival_profile.deadlock_status = "revival_deadlock";
  g.strength_profile.current_strength = 400;
  setAwakeningAnchor(g, 10, 100);
  recomputeGhostCurrents([g], 80);
  assert.equal(g.strength_profile.current_strength, 400);
  assert.equal(isDeadlockedGhost(g), true);
});

test("P3T01 single ghost +10 / 30d", () => {
  const save = saveClone();
  const r = settleNaturalRevival(save, { kind: "long_time_skip", days: 30 });
  assert.equal(r.delta, 10);
});

test("P3T02 single ghost +30 / 90d", () => {
  const save = saveClone();
  const r = settleNaturalRevival(save, { kind: "long_time_skip", days: 90 });
  assert.equal(r.delta, 30);
});

test("P3T03 stable_deadlock 0.7 * 10", () => {
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
  const r = settleNaturalRevival(save, { kind: "long_time_skip", days: 30 });
  assert.equal(r.delta, 7);
});

test("P3T04 multi_puzzle_conflict no slowdown", () => {
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
  save.balance = { ...emptyBalance(), state: "multi_puzzle_conflict" };
  const r = settleNaturalRevival(save, { kind: "long_time_skip", days: 30 });
  assert.equal(r.delta, 10);
});

test("P3T05 revival deadlock 60d +0 no backfill", () => {
  const save = saveClone();
  const extra = makeGhost({
    ghost_id: "g2",
    display_name: "g2",
    max: 200,
    true_entity_kind: "possessed_ghost",
    host_character_id: save.player_character.id,
  });
  extra.revival_profile.deadlock_status = "revival_deadlock";
  extra.strength_profile.current_strength = 800;
  save.ghosts!.push(extra);
  const host = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  host.host_character_id = save.player_character.id;
  host.strength_profile.current_strength = 100;
  const r = settleNaturalRevival(save, { kind: "long_time_skip", days: 60 });
  assert.equal(r.delta, 0);
  const r2 = settleNaturalRevival(save, { kind: "long_time_skip", days: 0 });
  assert.equal(r2.delta, 0);
});

test("P3T06 scene wait 6h no natural revival", () => {
  const save = saveClone();
  const before = save.player_character.stats.revival_degree;
  const r = settleNaturalRevival(save, { kind: "scene_wait", hours: 6 });
  assert.equal(r.delta, 0);
  assert.equal(save.player_character.stats.revival_degree, before);
});

test("P3T07 anchor calendar prevents double count", () => {
  const save = saveClone();
  settleNaturalRevival(save, { kind: "long_time_skip", days: 30 });
  assert.equal(save.natural_revival_anchor_calendar, save.world_calendar_day);
  const again = settleNaturalRevival(save, { kind: "long_time_skip", days: 0 });
  assert.equal(again.delta, 0);
  const next = settleNaturalRevival(save, { kind: "long_time_skip", days: 30 });
  assert.equal(next.delta, 10);
});

test("NATURAL_REVIVAL_CONFIG concentrated", () => {
  assert.equal(NATURAL_REVIVAL_CONFIG.per_30_days, 10);
  assert.ok(NATURAL_REVIVAL_CONFIG.multipliers.stable_deadlock < 1);
  assert.equal(NATURAL_REVIVAL_CONFIG.multipliers.multi_puzzle_conflict, 1);
});
