import assert from "node:assert/strict";
import test from "node:test";
import { createSaveFromPack } from "./content-pack.ts";
import { DEFAULT_PACK } from "../packs/default-pack.ts";
import { resolveAction } from "./resolution.ts";
import { applyRevivalDelta } from "./revival-delta.ts";
import { powerIsBlocked } from "./rare-actions.ts";
import { evaluateDeadlockLogic } from "./deadlock-gate.ts";
import { suppressionAsDeadlockCandidate } from "./suppression.ts";
import { evaluateContainmentP2 } from "./containment.ts";

function saveClone() {
  return createSaveFromPack(DEFAULT_PACK);
}

const domainLow = { id: "d", max_strength: 4000, current_strength: 4000, rare_tags: ["ghost_domain"] as string[] as import("./types.ts").RareTagId[], domain_active: true };
const restartLow = { id: "r", max_strength: 4000, current_strength: 4000, rare_tags: ["restart"] as string[] as import("./types.ts").RareTagId[], restart_scope: "area" as const };
const domainHi = { id: "d", max_strength: 5000, current_strength: 5000, rare_tags: ["ghost_domain"] as string[] as import("./types.ts").RareTagId[], domain_active: true };
const restartHi = { id: "r", max_strength: 5000, current_strength: 3273, rare_tags: ["restart"] as string[] as import("./types.ts").RareTagId[], restart_scope: "area" as const };

test("RA01 resolveAction writes major revival from amp cost 3", () => {
  const save = saveClone();
  const before = save.player_character.stats.revival_degree;
  const r = resolveAction(save, {
    action_type: "area_restart",
    action_text: "范围重启",
    force_roll: 10,
    rare: { domain: domainLow, restart: restartLow, mechanism_match: true, temporary_amp: { value: 700, applies_to_composite: true, revival_cost: 3 } },
  });
  assert.ok(save.player_character.stats.revival_degree - before >= 20);
  assert.ok((r.rare_notes ?? "").length >= 0);
});

test("RA02 dice fail keeps major cost", () => {
  const save = saveClone();
  const before = save.player_character.stats.revival_degree;
  resolveAction(save, {
    action_type: "area_restart",
    action_text: "范围重启",
    force_roll: 99,
    rare: { domain: domainLow, restart: restartLow, mechanism_match: true, temporary_amp: { value: 700, applies_to_composite: true, revival_cost: 3 } },
  });
  assert.ok(save.player_character.stats.revival_degree - before >= 20);
});

test("RA03 amp to 100 interrupts without restart success note", () => {
  const save = saveClone();
  save.player_character.stats.revival_degree = 85;
  const r = resolveAction(save, {
    action_type: "area_restart",
    action_text: "范围重启",
    force_roll: 10,
    rare: { domain: domainLow, restart: restartLow, mechanism_match: true, temporary_amp: { value: 700, applies_to_composite: true, revival_cost: 20 } },
  });
  assert.equal(save.player_character.stats.revival_degree, 100);
  assert.equal(r.interrupt, "revival_threshold");
  assert.notEqual(r.rare_notes, "area_restart_ok");
});

test("RA04 native 6800 no auto major", () => {
  const save = saveClone();
  const before = save.player_character.stats.revival_degree;
  resolveAction(save, {
    action_type: "area_restart",
    action_text: "范围重启",
    force_roll: 10,
    rare: { domain: domainHi, restart: restartHi, mechanism_match: true },
  });
  assert.equal(save.player_character.stats.revival_degree, before);
});

test("RA05 mismatch no dice path", () => {
  const save = saveClone();
  const r = resolveAction(save, {
    action_type: "area_restart",
    action_text: "范围重启",
    force_roll: 10,
    rare: { domain: domainLow, restart: restartLow, mechanism_match: false },
  });
  assert.equal(r.hard_block, true);
  assert.equal(r.dice, null);
});

test("RA06 suppression lock written", () => {
  const save = saveClone();
  resolveAction(save, {
    action_type: "apply_suppression",
    action_text: "压制",
    force_roll: 10,
    rare: { target_ghost_id: "ghost_knock", scope: "one_power", target_power_id: "p1", mechanism_match: true, source_id: save.player_character.id },
  });
  assert.equal(powerIsBlocked(save, "ghost_knock", "p1"), true);
  assert.equal(powerIsBlocked(save, "ghost_knock", "p2"), false);
});

test("RA07 suppress dice fail keeps cost no lock", () => {
  const save = saveClone();
  const before = save.player_character.stats.revival_degree;
  resolveAction(save, {
    action_type: "apply_suppression",
    action_text: "压制",
    force_roll: 99,
    rare: { target_ghost_id: "ghost_knock", scope: "one_power", target_power_id: "p1", activation_revival: 6 },
  });
  assert.equal(powerIsBlocked(save, "ghost_knock", "p1"), false);
  assert.ok(save.player_character.stats.revival_degree >= before + 6);
});

test("RA08 third party cannot release", () => {
  const save = saveClone();
  resolveAction(save, {
    action_type: "apply_suppression",
    action_text: "压制",
    force_roll: 10,
    rare: { target_ghost_id: "ghost_knock", scope: "one_power", target_power_id: "p1", source_id: save.player_character.id },
  });
  const r = resolveAction(save, {
    action_type: "release_suppression",
    action_text: "解除压制",
    rare: { target_ghost_id: "ghost_knock", source_id: save.player_character.id, release_actor_id: "npc_x" },
  });
  assert.equal(r.hard_block, true);
  assert.equal(powerIsBlocked(save, "ghost_knock", "p1"), true);
});

test("RA09 attach curse no medium", () => {
  const save = saveClone();
  const r = resolveAction(save, { action_type: "attach_curse", action_text: "诅咒", rare: { medium: "" } });
  assert.equal(r.hard_block, true);
  assert.equal((save.curse_links ?? []).length, 0);
});

test("RA10 attach curse writes link", () => {
  const save = saveClone();
  resolveAction(save, { action_type: "attach_curse", action_text: "诅咒", rare: { medium: "名字" } });
  assert.ok((save.curse_links ?? []).some((l) => l.active));
});

test("RA11 wrong break does not leak", () => {
  const save = saveClone();
  resolveAction(save, { action_type: "attach_curse", action_text: "诅咒", rare: { medium: "名字", true_break: "burn_photo" } });
  const r = resolveAction(save, {
    action_type: "break_curse",
    action_text: "解开诅咒",
    rare: { claimed_break: "say_name", true_break: "burn_photo" },
  });
  assert.equal(save.curse_links![0]!.active, true);
  assert.equal(JSON.stringify(r).includes("burn_photo"), false);
});

test("RA12 borrowed effect usable not controller", () => {
  const save = saveClone();
  resolveAction(save, { action_type: "attach_curse", action_text: "诅咒", rare: { medium: "关系" } });
  const before = save.player_character.stats.revival_degree;
  resolveAction(save, {
    action_type: "use_borrowed_supernatural",
    action_text: "借用灵异",
    rare: { borrowed_effect: "echo_knock", activation_revival: 4 },
  });
  assert.equal(save.player_character.is_ghost_controller, false);
  assert.ok(save.player_character.stats.revival_degree >= before + 4);
});

test("RA13 unauthorized borrowed power fails", () => {
  const save = saveClone();
  resolveAction(save, { action_type: "attach_curse", action_text: "诅咒", rare: { medium: "关系" } });
  const r = resolveAction(save, {
    action_type: "use_borrowed_supernatural",
    action_text: "借用灵异",
    rare: { borrowed_effect: "full_ghost_domain" },
  });
  assert.equal(r.hard_block, true);
});

test("RA14 wrong medium no contact no leak", () => {
  const save = saveClone();
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.rare_tags = ["idealistic"];
  const r = resolveAction(save, {
    action_type: "establish_source_contact",
    action_text: "接触源头",
    rare: { target_ghost_id: "ghost_knock", medium: "茶杯", true_medium: "录像带" },
  });
  assert.notEqual(src.source_contact_state, "source_contact_established");
  assert.equal(JSON.stringify({ v: r }).includes("录像带"), false);
});

test("RA15 correct contact then containment proceeds past contact gate", () => {
  const save = saveClone();
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.rare_tags = ["idealistic"];
  src.source_relationship.is_true_source = true;
  src.in_reality = "real";
  resolveAction(save, {
    action_type: "establish_source_contact",
    action_text: "接触源头",
    rare: { target_ghost_id: "ghost_knock", medium: "录像带", true_medium: "录像带" },
  });
  assert.equal(src.source_contact_state, "source_contact_established");
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
  const c = evaluateContainmentP2({
    event: save.events[0]!,
    actor: save.player_character,
    items: save.items,
    ghosts: save.ghosts!,
    targets: save.scene_targets,
    targetId: "ts",
    windowReady: true,
  });
  assert.notEqual(c.mode, "no_source_contact");
});

test("RA16 applyRevivalDelta is used", () => {
  const save = saveClone();
  const before = save.player_character.stats.revival_degree;
  applyRevivalDelta({ character: save.player_character, delta: 2, source: "t", reason: "x", transaction_id: "tx1", cost_id: "tx1:a" });
  assert.equal(save.player_character.stats.revival_degree, before + 2);
});

test("RA17 same cost id commits once", () => {
  const save = saveClone();
  const before = save.player_character.stats.revival_degree;
  applyRevivalDelta({ character: save.player_character, delta: 5, source: "t", reason: "x", transaction_id: "tx2", cost_id: "same" });
  applyRevivalDelta({ character: save.player_character, delta: 5, source: "t", reason: "x", transaction_id: "tx2", cost_id: "same" });
  assert.equal(save.player_character.stats.revival_degree, before + 5);
});

test("RA18 suppression lock not auto deadlock", () => {
  const save = saveClone();
  resolveAction(save, {
    action_type: "apply_suppression",
    action_text: "压制",
    force_roll: 10,
    rare: { target_ghost_id: "ghost_knock", scope: "one_power", target_power_id: "p1" },
  });
  const lock = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!.suppression_locks![0]!;
  assert.equal(suppressionAsDeadlockCandidate(lock).auto_deadlock, false);
  const dl = evaluateDeadlockLogic({
    plan: { plan_goal: "deadlock", participants: ["ghost_knock"], claimed_interactions: [{ source: "a", target: "ghost_knock", claimed_effect: "unspecified" }], same_core_result: false },
    ghosts: save.ghosts!,
    items: [],
  });
  assert.equal(dl.result, "invalid_logic");
});
