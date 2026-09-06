import assert from "node:assert/strict";
import test from "node:test";
import { rareTagEligible, reviewPowerRareTags, ghostRareSummary, canMixRareMechanisms, domainEffectiveStrength, consciousnessBand } from "./rare-tags.ts";
import type { RarePowerView } from "./rare-tags.ts";
import { evaluateAreaRestartGate, computeAreaRestartEffective, evaluateSingleRestart, AREA_RESTART_THRESHOLD } from "./area-restart.ts";
import { evaluateLethalVsNormal, evaluateLethalVsHeteromorph } from "./lethal.ts";
import { evaluateConsciousnessAttackGate, consciousnessTagProtectsHeteromorph } from "./consciousness-attack.ts";
import { evaluateHeteromorphLogic } from "./heteromorph-gate.ts";
import { oppositionForHost } from "./ghost-relations.ts";
import { settleNaturalRevival } from "./natural-revival.ts";
import { createSaveFromPack } from "./content-pack.ts";
import { DEFAULT_PACK } from "../packs/default-pack.ts";
import { makeGhost } from "./ghost.ts";
import { resolveAction } from "./resolution.ts";
import { stripHiddenSave, payloadHasHidden, visibleResolution } from "./visibility.ts";

function p(partial: Partial<RarePowerView> & { id: string; max_strength: number; current_strength: number; rare_tags: RarePowerView["rare_tags"] }): RarePowerView {
  return partial;
}

test("RT01 max 1400 lethal reject", () => {
  assert.equal(rareTagEligible(1400, "必死").ok, false);
});

test("RT02 max 1500 lethal pass", () => {
  assert.equal(rareTagEligible(1500, "lethal").ok, true);
});

test("RT03 max 2100 domain reject", () => {
  assert.equal(rareTagEligible(2100, "鬼域").ok, false);
});

test("RT04 max 2200 consciousness low band", () => {
  assert.equal(rareTagEligible(2200, "意识").ok, true);
  assert.equal(consciousnessBand(2200), "low");
});

test("RT05 max 2900 restart reject", () => {
  assert.equal(rareTagEligible(2900, "重启").ok, false);
});

test("RT06 domain bound to current not max", () => {
  const power = p({ id: "d", max_strength: 7000, current_strength: 1500, rare_tags: ["ghost_domain"] });
  assert.equal(domainEffectiveStrength(power), 1500);
  assert.notEqual(domainEffectiveStrength(power), power.max_strength);
});

test("RT07 area restart 6799 blocked", () => {
  const domain = p({ id: "d", max_strength: 5000, current_strength: 5000, rare_tags: ["ghost_domain"], domain_active: true });
  const restart = p({ id: "r", max_strength: 5000, current_strength: 3269, rare_tags: ["restart"], restart_scope: "area" });
  const g = evaluateAreaRestartGate({ domain, restart, mechanism_match: true });
  assert.ok(g.effective < AREA_RESTART_THRESHOLD);
  assert.equal(g.allowed, false);
});

test("RT08 area restart 6800 pass", () => {
  const domain = p({ id: "d", max_strength: 5000, current_strength: 5000, rare_tags: ["ghost_domain"], domain_active: true });
  const restart = p({ id: "r", max_strength: 5000, current_strength: 3273, rare_tags: ["restart"], restart_scope: "area" });
  const g = evaluateAreaRestartGate({ domain, restart, mechanism_match: true });
  assert.ok(g.effective >= AREA_RESTART_THRESHOLD);
  assert.equal(g.allowed, true);
});

test("RT09 temp amp crosses 6800 and costs revival", () => {
  const domain = p({ id: "d", max_strength: 4000, current_strength: 4000, rare_tags: ["ghost_domain"], domain_active: true });
  const restart = p({ id: "r", max_strength: 4000, current_strength: 4000, rare_tags: ["restart"], restart_scope: "area" });
  const native = computeAreaRestartEffective({ domain, restart, mechanism_match: true });
  assert.ok(native.value < AREA_RESTART_THRESHOLD);
  const g = evaluateAreaRestartGate({
    domain,
    restart,
    mechanism_match: true,
    temporary_amp: { value: 700, applies_to_composite: true, revival_cost: 28 },
  });
  assert.equal(g.allowed, true);
  assert.equal(g.revival_cost, 28);
});

test("RT10 unrelated powers cannot sum to area restart", () => {
  const domain = p({ id: "d", max_strength: 4000, current_strength: 4000, rare_tags: ["ghost_domain"], domain_active: true });
  const restart = p({ id: "r", max_strength: 4000, current_strength: 4000, rare_tags: ["restart"] });
  const g = evaluateAreaRestartGate({ domain, restart, mechanism_match: false });
  assert.equal(g.allowed, false);
  assert.equal(g.reason, "mechanism_mismatch");
});

test("RT11 lethal resist +3 tiers", () => {
  const r = evaluateLethalVsNormal({
    attack_strength: 200,
    defender_strength: 2500,
    has_lethal_tag: true,
    rule_triggered: true,
  });
  assert.equal(r.endpoint, "negated");
  assert.equal(r.nonlethal_continues, true);
});

test("RT12 pure lethal vs heteromorph ignored", () => {
  const r = evaluateLethalVsHeteromorph({
    attack_strength: 400,
    heteromorph_strength: 400,
    has_lethal_tag: true,
    has_consciousness_mechanism: false,
  });
  assert.equal(r.endpoint, "ignored_vs_heteromorph");
});

test("RT13 non-consciousness lethal +2 incapacitation", () => {
  const r = evaluateLethalVsHeteromorph({
    attack_strength: 2500,
    heteromorph_strength: 400,
    has_lethal_tag: true,
    has_consciousness_mechanism: false,
  });
  assert.equal(r.endpoint, "incapacitation");
});

test("RT14 lethal+consciousness routes attack gate", () => {
  const r = evaluateLethalVsHeteromorph({
    attack_strength: 400,
    heteromorph_strength: 400,
    has_lethal_tag: true,
    has_consciousness_mechanism: true,
  });
  assert.equal(r.endpoint, "consciousness_attack");
  const gate = evaluateConsciousnessAttackGate(
    p({ id: "c", max_strength: 8000, current_strength: 4000, rare_tags: ["consciousness"], consciousness_function: "attack_heteromorph_core" }),
  );
  assert.equal(gate.allowed, true);
});

test("RT15 read-only consciousness cannot protect", () => {
  const power = p({
    id: "c",
    max_strength: 2200,
    current_strength: 800,
    rare_tags: ["consciousness"],
    consciousness_function: "read_fragment",
  });
  assert.equal(consciousnessTagProtectsHeteromorph(power), false);
  const save = createSaveFromPack(DEFAULT_PACK);
  save.player_character.deadlock_state = "rule_deadlock";
  const h = evaluateHeteromorphLogic({
    actor: save.player_character,
    deadlock_state: "rule_deadlock",
    plan: { plan_goal: "heteromorph", participants: ["c"], claimed_interactions: [], claimed_consciousness_protection: { source: "c", effect: "read_fragment" } },
    items: save.items,
    powers: [
      {
        id: "c",
        name: "读忆",
        type: "other",
        owner_id: save.player_character.id,
        base_strength: 2200,
        effective_strength: 800,
        mechanism_tags: ["意识"],
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
        stacking: { can_stack: false, stacking_efficiency: 0, stacking_cap: 1, current_stack_layers: 1, stacking_sources: [], stacking_conditions: [], stacking_risks: [] },
        rare_tags: ["consciousness"],
        consciousness_function: "read_fragment",
      },
    ],
  });
  assert.equal(h.protection_ok, false);
});

test("RT16 single restart without domain allowed", () => {
  const restart = p({ id: "r", max_strength: 3000, current_strength: 1000, rare_tags: ["restart"], restart_scope: "single_target" });
  assert.equal(evaluateSingleRestart(restart).allowed, true);
});

test("RT17 four rare tags exception_review", () => {
  const power = p({
    id: "p",
    max_strength: 4000,
    current_strength: 2000,
    rare_tags: ["lethal", "suppression", "curse", "ghost_domain"],
  });
  const r = reviewPowerRareTags(power, { player_created: true });
  assert.equal(r.exception_review, true);
  assert.equal(r.accepted.length, 4);
});

test("RT18 summary aggregates but cannot mix powers", () => {
  const a = p({ id: "a", max_strength: 3000, current_strength: 1000, rare_tags: ["lethal", "suppression"] });
  const b = p({ id: "b", max_strength: 3000, current_strength: 1000, rare_tags: ["ghost_domain", "restart"] });
  assert.deepEqual(ghostRareSummary([a, b]).sort(), ["ghost_domain", "lethal", "restart", "suppression"].sort());
  assert.equal(canMixRareMechanisms(a, b), false);
});

test("REG driving still current", () => {
  const host = makeGhost({ ghost_id: "h", display_name: "h", max: 4000, true_entity_kind: "possessed_ghost", host_character_id: "pc" });
  host.strength_profile.current_strength = 80;
  const incoming = makeGhost({ ghost_id: "i", display_name: "i", max: 90 });
  incoming.strength_profile.current_strength = 3000;
  assert.ok(oppositionForHost([host], incoming).gap >= 2);
});

test("REG scene wait no natural revival", () => {
  const save = createSaveFromPack(DEFAULT_PACK);
  const r = settleNaturalRevival(save, { kind: "scene_wait", hours: 6 });
  assert.equal(r.delta, 0);
});

test("REG hidden isolation", () => {
  const save = createSaveFromPack(DEFAULT_PACK);
  const r = resolveAction(save, { action_type: "observe", action_text: "观察门" });
  assert.equal(payloadHasHidden({ resolution: visibleResolution(r) }), false);
  assert.equal(JSON.stringify(stripHiddenSave(save)).includes("true_entity_kind"), false);
});
