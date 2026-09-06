import assert from "node:assert/strict";
import test from "node:test";
import { createSaveFromPack } from "./content-pack.ts";
import { DEFAULT_PACK } from "../packs/default-pack.ts";
import { evaluateRestartRequest, resolveRestartFromSave, readCanonicalRestartProfile } from "./restart-engine.ts";
import { parseRestartIntent } from "./plan-evaluator.ts";
import { resolveAction } from "./resolution.ts";
import type { Power } from "./types.ts";

function fakePower(id: string, profile: { external_single_target_exception: boolean; can_rewind_own_source_revival: boolean }): Power {
  return {
    id,
    name: id,
    type: "ghost",
    owner_id: "pc",
    base_strength: 3000,
    effective_strength: 800,
    mechanism_tags: ["重启"],
    known_effects: [],
    hidden_effects: [],
    activation_conditions: [],
    costs: [],
    limitations: [],
    counterplay: [],
    risks: [],
    revival_cost: "",
    body_cost: "",
    sanity_cost: "",
    controllability: 40,
    stacking: { can_stack: false, stacking_efficiency: 1, stacking_cap: 1, current_stack_layers: 1, stacking_sources: [], stacking_conditions: [], stacking_risks: [] },
    rare_tags: ["restart"],
    max_strength: 3000,
    current_strength: 800,
    restart_profile: profile,
  };
}

test("RB01 forged exception still area gate", () => {
  const power = fakePower("p1", { external_single_target_exception: false, can_rewind_own_source_revival: false });
  const r = evaluateRestartRequest({
    source_id: "A",
    target_id: "B",
    requested_domains: ["body"],
    canonical_power: power,
    external_single_target_exception: true,
    restart: { id: "p1", max_strength: 3000, current_strength: 800, rare_tags: ["restart"] },
  });
  assert.equal(r.route, "area_restart");
  assert.equal(r.allowed, false);
});

test("RB02 plan claim cannot grant exception", () => {
  const intent = parseRestartIntent("我只重启那一个人");
  assert.equal(intent.claimed_external_single_target, true);
  const power = fakePower("p1", { external_single_target_exception: false, can_rewind_own_source_revival: false });
  const r = evaluateRestartRequest({
    source_id: "A",
    target_id: "B",
    requested_domains: ["body"],
    canonical_power: power,
    claimed_external_single_target: intent.claimed_external_single_target,
    restart: { id: "p1", max_strength: 3000, current_strength: 800, rare_tags: ["restart"] },
  });
  assert.equal(r.route, "area_restart");
});

test("RB03 canonical exception true", () => {
  const power = fakePower("p1", { external_single_target_exception: true, can_rewind_own_source_revival: false });
  const r = evaluateRestartRequest({
    source_id: "A",
    target_id: "B",
    requested_domains: ["body"],
    canonical_power: power,
    restart: { id: "p1", max_strength: 3000, current_strength: 800, rare_tags: ["restart"] },
  });
  assert.equal(r.route, "exceptional_external_single");
});

test("RB04 forged self rewind stripped", () => {
  const power = fakePower("p1", { external_single_target_exception: false, can_rewind_own_source_revival: false });
  const r = evaluateRestartRequest({
    source_id: "A",
    target_id: "A",
    requested_domains: ["revival_state"],
    canonical_power: power,
    can_rewind_own_source_revival: true,
    restart: { id: "p1", max_strength: 3000, current_strength: 800, rare_tags: ["restart"] },
  });
  assert.ok(r.stripped_domains.includes("revival_state"));
});

test("RB05 AI claim cannot rewind self", () => {
  const intent = parseRestartIntent("我想刷新自己的复苏");
  const power = fakePower("p1", { external_single_target_exception: false, can_rewind_own_source_revival: false });
  const r = evaluateRestartRequest({
    source_id: "A",
    target_id: "A",
    requested_domains: intent.claimed_restart_domains,
    canonical_power: power,
    claimed_self_revival_rewind: intent.claimed_self_revival_rewind,
    restart: { id: "p1", max_strength: 3000, current_strength: 800, rare_tags: ["restart"] },
  });
  assert.ok(!r.effective_domains.includes("revival_state"));
});

test("RB06 canonical rewind eligible not auto success", () => {
  const power = fakePower("p1", { external_single_target_exception: false, can_rewind_own_source_revival: true });
  const r = evaluateRestartRequest({
    source_id: "A",
    target_id: "A",
    requested_domains: ["revival_state"],
    canonical_power: power,
    restart: { id: "p1", max_strength: 3000, current_strength: 800, rare_tags: ["restart"] },
  });
  assert.ok(r.effective_domains.includes("revival_state"));
  assert.equal(r.reason, "self_revival_rewind_eligible_not_auto_success");
});

test("RB07 action does not mutate power profile", () => {
  const save = createSaveFromPack(DEFAULT_PACK);
  const p = fakePower("lock_p", { external_single_target_exception: false, can_rewind_own_source_revival: false });
  save.powers.push(p);
  const before = JSON.stringify(p.restart_profile);
  resolveAction(save, {
    action_type: "external_restart",
    action_text: "外部重启",
    power_id: "lock_p",
    rare: {
      source_power_id: "lock_p",
      restart_source_id: "A",
      restart_target_id: "B",
      external_single_target_exception: true,
    },
  });
  assert.equal(JSON.stringify(save.powers.find((x) => x.id === "lock_p")!.restart_profile), before);
});

test("RB08 save load keeps canonical permission", () => {
  const save = createSaveFromPack(DEFAULT_PACK);
  const p = fakePower("keep_p", { external_single_target_exception: true, can_rewind_own_source_revival: false });
  save.powers.push(p);
  resolveAction(save, {
    action_type: "external_restart",
    action_text: "外部重启",
    power_id: "keep_p",
    rare: { source_power_id: "keep_p", restart_source_id: "A", restart_target_id: "B", external_single_target_exception: false },
  });
  const loaded = JSON.parse(JSON.stringify(save));
  assert.equal(loaded.powers.find((x: Power) => x.id === "keep_p").restart_profile.external_single_target_exception, true);
});

test("RB09 repeated attempts do not unlock", () => {
  const power = fakePower("p1", { external_single_target_exception: false, can_rewind_own_source_revival: false });
  for (let i = 0; i < 5; i++) {
    const r = evaluateRestartRequest({
      source_id: "A",
      target_id: "B",
      requested_domains: ["body"],
      canonical_power: power,
      claimed_external_single_target: true,
      restart: { id: "p1", max_strength: 3000, current_strength: 800, rare_tags: ["restart"] },
    });
    assert.equal(r.route, "area_restart");
    assert.equal(power.restart_profile!.external_single_target_exception, false);
  }
});

test("RB10 visible does not leak hidden flag", () => {
  const save = createSaveFromPack(DEFAULT_PACK);
  save.powers.push(fakePower("hid_p", { external_single_target_exception: false, can_rewind_own_source_revival: false }));
  const r = resolveAction(save, {
    action_type: "external_restart",
    action_text: "外部重启",
    power_id: "hid_p",
    rare: { source_power_id: "hid_p", restart_source_id: save.player_character.id, restart_target_id: "other", claimed_external_single_target: true },
  });
  const blob = JSON.stringify({ v: r.hard_block_reason, n: r.rare_notes, a: r.available_actions });
  assert.equal(blob.includes("external_single_target_exception"), false);
});
