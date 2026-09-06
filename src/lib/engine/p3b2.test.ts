import assert from "node:assert/strict";
import test from "node:test";
import { createSaveFromPack } from "./content-pack.ts";
import { DEFAULT_PACK } from "../packs/default-pack.ts";
import { resolveAction } from "./resolution.ts";
import { evaluateDeadlockLogic, legacyBalanceGrantsDeadlock, isTrueDeadlockState } from "./deadlock-gate.ts";
import { evaluateHeteromorphLogic } from "./heteromorph-gate.ts";
import { resolveSupernaturalPlan, applyBalanceDoesNotSetDeadlock } from "./transition.ts";
import { settleNaturalRevival } from "./natural-revival.ts";
import { visibleResolution, payloadHasHidden, stripHiddenSave } from "./visibility.ts";
import { makeGhost } from "./ghost.ts";
import { emptyBalance } from "./balance.ts";

function saveClone() {
  return createSaveFromPack(DEFAULT_PACK);
}

test("DH01 stable_balance does not set deadlock_state", () => {
  const save = saveClone();
  save.balance = { ...emptyBalance(), state: "stable_deadlock" };
  applyBalanceDoesNotSetDeadlock(save.player_character, "stable_balance");
  assert.equal(legacyBalanceGrantsDeadlock("stable_deadlock"), false);
  assert.equal(legacyBalanceGrantsDeadlock("dual_ghost_deadlock"), false);
  assert.notEqual(save.player_character.deadlock_state === "rule_deadlock", true);
});

test("DH02 equal strength no conflict is invalid_logic", () => {
  const a = makeGhost({ ghost_id: "a", display_name: "a", max: 100 });
  const b = makeGhost({ ghost_id: "b", display_name: "b", max: 100 });
  a.strength_profile.current_strength = 80;
  b.strength_profile.current_strength = 80;
  a.driving_profile.conflict_tags = [];
  b.driving_profile.conflict_tags = [];
  a.mechanism_tags = ["x"];
  b.mechanism_tags = ["y"];
  const r = evaluateDeadlockLogic({
    plan: {
      plan_goal: "deadlock",
      participants: ["a", "b"],
      claimed_interactions: [{ source: "a", target: "b", claimed_effect: "unspecified", same_core_result: false }],
      same_core_result: false,
    },
    ghosts: [a, b],
    items: [],
  });
  assert.equal(r.result, "invalid_logic");
});

test("DH03 real lock and current enough is eligible", () => {
  const a = makeGhost({ ghost_id: "a", display_name: "a", max: 200 });
  const b = makeGhost({ ghost_id: "b", display_name: "b", max: 200 });
  a.strength_profile.current_strength = 90;
  b.strength_profile.current_strength = 80;
  a.mechanism_tags = ["time"];
  b.mechanism_tags = ["medium_attack"];
  a.driving_profile.conflict_tags = ["medium_attack"];
  const r = evaluateDeadlockLogic({
    plan: {
      plan_goal: "deadlock",
      participants: ["a", "b"],
      claimed_interactions: [
        { source: "a", target: "b", claimed_effect: "prevents_rule_completion", same_core_result: true, real_rule_conflict: true, core_result: "killing_rule" },
      ],
      same_core_result: true,
      sustained_lock_possible: true,
    },
    ghosts: [a, b],
    items: [],
  });
  assert.equal(r.result, "eligible_for_execution");
});

test("DH04 invalid_logic plus roll 01 still no deadlock", () => {
  const save = saveClone();
  const r = resolveAction(save, {
    action_type: "supernatural_plan",
    action_text: "让两股完全无关的力量随便碰一下形成死机",
    plan: {
      plan_goal: "deadlock",
      participants: ["ghost_thin_cold"],
      claimed_interactions: [{ source: "ghost_thin_cold", target: "none", claimed_effect: "unspecified" }],
      same_core_result: false,
    },
    force_roll: 1,
  });
  assert.equal(isTrueDeadlockState(save.player_character.deadlock_state), false);
  assert.equal(save.player_character.supernatural_transition_state === "heteromorphic", false);
  assert.ok(r.hard_block);
});

test("DH05 heteromorph without deadlock is not_eligible", () => {
  const save = saveClone();
  const h = evaluateHeteromorphLogic({
    actor: save.player_character,
    deadlock_state: "none",
    plan: { plan_goal: "heteromorph", participants: [], claimed_interactions: [] },
    items: save.items,
  });
  assert.equal(h.result, "not_eligible");
});

test("DH06 memory tag without protection function fails", () => {
  const save = saveClone();
  save.player_character.deadlock_state = "rule_deadlock";
  const item = save.items[0]!;
  item.mechanism_tags = ["memory"];
  item.consciousness_protection = undefined;
  const h = evaluateHeteromorphLogic({
    actor: save.player_character,
    deadlock_state: "rule_deadlock",
    plan: {
      plan_goal: "heteromorph",
      participants: [item.id],
      claimed_interactions: [],
      claimed_consciousness_protection: { source: item.id, effect: "preserve_human_memory" },
    },
    items: save.items,
  });
  assert.equal(h.protection_ok, false);
  assert.equal(h.result, "not_eligible");
});

test("DH07 deadlock plus valid protection is eligible", () => {
  const save = saveClone();
  save.player_character.deadlock_state = "rule_deadlock";
  save.player_character.human_memory_exists = true;
  const item = save.items[0]!;
  item.consciousness_protection = { effect: "preserve_human_memory", covers_transition: true, source_id: item.id };
  const h = evaluateHeteromorphLogic({
    actor: save.player_character,
    deadlock_state: "rule_deadlock",
    plan: {
      plan_goal: "heteromorph",
      participants: [item.id],
      claimed_interactions: [],
      claimed_consciousness_protection: { source: item.id, effect: "preserve_human_memory" },
    },
    items: save.items,
  });
  assert.equal(h.result, "eligible_for_execution");
});

test("DH08 same plan phase order", () => {
  const save = saveClone();
  const item = save.items[0]!;
  item.consciousness_protection = { effect: "preserve_human_memory", covers_transition: true };
  const thin = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  const knock = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  thin.host_character_id = save.player_character.id;
  const r = resolveSupernaturalPlan(save, "用闭锁对抗做成死机再靠物品保护意识成为异类", {
    plan_goal: "deadlock_then_heteromorph",
    participants: [thin.ghost_id, knock.ghost_id, item.id],
    claimed_interactions: [
      { source: thin.ghost_id, target: knock.ghost_id, claimed_effect: "prevents_rule_completion", same_core_result: true, real_rule_conflict: true },
    ],
    claimed_consciousness_protection: { source: item.id, effect: "preserve_human_memory" },
    same_core_result: true,
    sustained_lock_possible: true,
  });
  assert.deepEqual(r.phases, ["BALANCE", "DEADLOCK", "CONSCIOUSNESS_PRESERVED", "HETEROMORPH"]);
});

test("DH09 deadlock kept if heteromorph fails", () => {
  const save = saveClone();
  const thin = save.ghosts!.find((g) => g.ghost_id === "ghost_thin_cold")!;
  const knock = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  const item = save.items[0]!;
  item.mechanism_tags = ["memory"];
  item.consciousness_protection = { effect: "read_memory_only", covers_transition: false };
  const r = resolveSupernaturalPlan(save, "先死机再异类", {
    plan_goal: "deadlock_then_heteromorph",
    participants: [thin.ghost_id, knock.ghost_id, item.id],
    claimed_interactions: [
      { source: thin.ghost_id, target: knock.ghost_id, claimed_effect: "prevents_rule_completion", same_core_result: true, real_rule_conflict: true },
    ],
    claimed_consciousness_protection: { source: item.id, effect: "read_memory_only" },
    same_core_result: true,
    sustained_lock_possible: true,
  });
  assert.equal(r.deadlock_established, true);
  assert.equal(r.heteromorph_established, false);
  assert.equal(isTrueDeadlockState(save.player_character.deadlock_state), true);
});

test("DH10 revival 100 does not auto heteromorph", () => {
  const save = saveClone();
  save.player_character.stats.revival_degree = 99;
  settleNaturalRevival(save, { kind: "long_time_skip", days: 30 });
  assert.notEqual(save.player_character.supernatural_transition_state, "heteromorphic");
  save.player_character.stats.revival_degree = 100;
  assert.notEqual(save.player_character.supernatural_transition_state, "heteromorphic");
});

test("DH11 player visible does not leak hidden", () => {
  const save = saveClone();
  const r = resolveAction(save, {
    action_type: "supernatural_plan",
    action_text: "尝试用错误机制闭锁对抗做成死机",
    plan: { plan_goal: "deadlock", participants: ["ghost_thin_cold"], claimed_interactions: [] },
  });
  const vis = visibleResolution(r);
  assert.equal(payloadHasHidden({ resolution: vis }), false);
  assert.equal(JSON.stringify(vis).includes("hidden_rule"), false);
  assert.equal(JSON.stringify(stripHiddenSave(save)).includes("true_entity_kind"), false);
});

test("DH12 invalid plan still executes with side effects", () => {
  const save = saveClone();
  const beforeR = save.player_character.stats.revival_degree;
  const beforeB = save.player_character.stats.body;
  const r = resolveAction(save, {
    action_type: "supernatural_plan",
    action_text: "乱来一通想做成死机",
    plan: { plan_goal: "deadlock", participants: [], claimed_interactions: [] },
  });
  assert.equal(r.hard_block, true);
  assert.ok(save.player_character.stats.revival_degree >= beforeR);
  assert.ok(save.player_character.stats.body <= beforeB);
});
