import assert from "node:assert/strict";
import test from "node:test";
import { AREA_RESTART_THRESHOLD, MAJOR_REVIVAL_COST_MIN, computeAreaRestartEffective, evaluateAreaRestartGate, isHighOrderDomain } from "./area-restart.ts";
import type { RarePowerView } from "./rare-tags.ts";
import { evaluateContainmentP2 } from "./containment.ts";
import { createSaveFromPack } from "./content-pack.ts";
import { DEFAULT_PACK } from "../packs/default-pack.ts";
import { establishSourceContact, loseSourceContact } from "./source-contact.ts";
import { createSuppressionLock, powerBlocked, releaseSuppressionLocks, suppressionAsDeadlockCandidate } from "./suppression.ts";
import { createCurseLink, curseRemainsWhenDistant, spreadCurse, applyBorrowedEffects } from "./curse-link.ts";
import { evaluateDeadlockLogic } from "./deadlock-gate.ts";
import { makeGhost } from "./ghost.ts";

function p(partial: Partial<RarePowerView> & { id: string; max_strength: number; current_strength: number; rare_tags: RarePowerView["rare_tags"] }): RarePowerView {
  return partial;
}

test("RR01 area restart 6799 fail", () => {
  const domain = p({ id: "d", max_strength: 5000, current_strength: 5000, rare_tags: ["ghost_domain"], domain_active: true });
  const restart = p({ id: "r", max_strength: 5000, current_strength: 3269, rare_tags: ["restart"], restart_scope: "area" });
  const g = evaluateAreaRestartGate({ domain, restart, mechanism_match: true });
  assert.equal(g.allowed, false);
});

test("RR02 6800 pass and no second domain threshold", () => {
  const domain = p({ id: "d", max_strength: 5000, current_strength: 5000, rare_tags: ["ghost_domain"], domain_active: true });
  const restart = p({ id: "r", max_strength: 5000, current_strength: 3273, rare_tags: ["restart"], restart_scope: "area" });
  const g = evaluateAreaRestartGate({ domain, restart, mechanism_match: true });
  assert.equal(g.allowed, true);
  assert.equal(AREA_RESTART_THRESHOLD, 6800);
  assert.equal(typeof (globalThis as { HIGH_ORDER_DOMAIN_THRESHOLD?: number }).HIGH_ORDER_DOMAIN_THRESHOLD, "undefined");
});

test("RR03 max high current low cannot area restart", () => {
  const domain = p({ id: "d", max_strength: 8000, current_strength: 400, rare_tags: ["ghost_domain"], domain_active: true });
  const restart = p({ id: "r", max_strength: 8000, current_strength: 400, rare_tags: ["restart"], restart_scope: "area" });
  const g = evaluateAreaRestartGate({ domain, restart, mechanism_match: true });
  assert.equal(g.allowed, false);
  assert.equal(isHighOrderDomain(domain), false);
});

test("RR04 amp cost 3 raised to major min", () => {
  const domain = p({ id: "d", max_strength: 4000, current_strength: 4000, rare_tags: ["ghost_domain"], domain_active: true });
  const restart = p({ id: "r", max_strength: 4000, current_strength: 4000, rare_tags: ["restart"], restart_scope: "area" });
  const g = evaluateAreaRestartGate({
    domain,
    restart,
    mechanism_match: true,
    temporary_amp: { value: 700, applies_to_composite: true, revival_cost: 3 },
  });
  assert.equal(g.allowed, true);
  assert.ok(g.revival_cost >= MAJOR_REVIVAL_COST_MIN);
  assert.notEqual(g.revival_cost, 3);
});

test("RR05 unrelated amp mismatch", () => {
  const domain = p({ id: "d", max_strength: 4000, current_strength: 4000, rare_tags: ["ghost_domain"], domain_active: true });
  const restart = p({ id: "r", max_strength: 4000, current_strength: 4000, rare_tags: ["restart"] });
  const g = evaluateAreaRestartGate({
    domain,
    restart,
    mechanism_match: false,
    temporary_amp: { value: 2000, applies_to_composite: false, revival_cost: 20 },
  });
  assert.equal(g.allowed, false);
});

test("RR06 idealistic without contact blocks contain even at 9000", () => {
  const save = createSaveFromPack(DEFAULT_PACK);
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.rare_tags = ["idealistic"];
  src.mechanism_tags = [...src.mechanism_tags, "唯心"];
  src.source_relationship.is_true_source = true;
  src.in_reality = "real";
  src.source_contact_state = "suspected";
  save.player_character.stats.effective_strength = 9000;
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
  const r = evaluateContainmentP2({
    event: save.events[0]!,
    actor: save.player_character,
    items: save.items,
    ghosts: save.ghosts!,
    targets: save.scene_targets!,
    targetId: "ts",
    windowReady: true,
  });
  assert.equal(r.mode, "no_source_contact");
  assert.equal(r.success, false);
});

test("RR07 source contact opens P2 gates", () => {
  const save = createSaveFromPack(DEFAULT_PACK);
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.rare_tags = ["idealistic"];
  src.mechanism_tags = [...src.mechanism_tags, "唯心"];
  src.source_relationship.is_true_source = true;
  src.in_reality = "real";
  establishSourceContact(src, true, true);
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
  const r = evaluateContainmentP2({
    event: save.events[0]!,
    actor: save.player_character,
    items: save.items.filter((i) => i.type === "gold_container").concat(save.items),
    ghosts: save.ghosts!,
    targets: save.scene_targets!,
    targetId: "ts",
    windowReady: true,
  });
  assert.notEqual(r.mode, "no_source_contact");
});

test("RR08 contact lost blocks again", () => {
  const save = createSaveFromPack(DEFAULT_PACK);
  const src = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  src.rare_tags = ["idealistic"];
  src.source_relationship.is_true_source = true;
  src.in_reality = "real";
  establishSourceContact(src, true, true);
  loseSourceContact(src);
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
  const r = evaluateContainmentP2({
    event: save.events[0]!,
    actor: save.player_character,
    items: save.items,
    ghosts: save.ghosts!,
    targets: save.scene_targets!,
    targetId: "ts",
    windowReady: true,
  });
  assert.equal(r.mode, "no_source_contact");
});

test("RR09 suppression one_power only", () => {
  const g = makeGhost({ ghost_id: "t", display_name: "t", max: 200 });
  createSuppressionLock({
    source_id: "s",
    target: g,
    scope: "one_power",
    target_power_id: "p1",
    effective_strength: 100,
    mechanism_applies: true,
    release_condition: "timeout",
  });
  assert.equal(powerBlocked(g, "p1"), true);
  assert.equal(powerBlocked(g, "p2"), false);
});

test("RR10 release condition lifts lock", () => {
  const g = makeGhost({ ghost_id: "t", display_name: "t", max: 200 });
  createSuppressionLock({
    source_id: "s",
    target: g,
    scope: "one_power",
    target_power_id: "p1",
    effective_strength: 100,
    mechanism_applies: true,
    release_condition: "timeout",
  });
  releaseSuppressionLocks(g, "timeout");
  assert.equal(powerBlocked(g, "p1"), false);
});

test("RR11 curse without medium fails", () => {
  const r = createCurseLink({ source_id: "s", target_id: "t", medium: null });
  assert.equal(r.link, null);
});

test("RR12 distant curse remains", () => {
  const r = createCurseLink({ source_id: "s", target_id: "t", medium: "名字", break_condition: "medium_broken" });
  assert.equal(curseRemainsWhenDistant(r.link!, true), true);
});

test("RR13 non-transmissible cannot spread", () => {
  const r = createCurseLink({ source_id: "s", target_id: "t", medium: "照片", transmissible: false });
  assert.equal(spreadCurse(r.link!, "t2"), null);
});

test("RR14 borrowed effects do not possess", () => {
  const save = createSaveFromPack(DEFAULT_PACK);
  const r = createCurseLink({ source_id: "s", target_id: save.player_character.id, medium: "关系", effect_profile: ["echo_knock"] });
  applyBorrowedEffects(save.player_character, r.link!);
  assert.ok(save.player_character.borrowed_supernatural_effects?.includes("echo_knock"));
  assert.equal(save.player_character.is_ghost_controller, false);
  assert.equal(save.player_character.deadlock_state === "rule_deadlock", false);
});

test("RR15 suppression is candidate not auto deadlock", () => {
  const g = makeGhost({ ghost_id: "t", display_name: "t", max: 200 });
  const { lock } = createSuppressionLock({
    source_id: "s",
    target: g,
    scope: "one_killing_rule",
    target_rule_id: "k1",
    effective_strength: 80,
    mechanism_applies: true,
    release_condition: "x",
  });
  const cand = suppressionAsDeadlockCandidate(lock);
  assert.equal(cand.candidate, true);
  assert.equal(cand.auto_deadlock, false);
  const dl = evaluateDeadlockLogic({
    plan: {
      plan_goal: "deadlock",
      participants: ["t"],
      claimed_interactions: [{ source: "s", target: "t", claimed_effect: "unspecified" }],
      same_core_result: false,
    },
    ghosts: [g],
    items: [],
  });
  assert.equal(dl.result, "invalid_logic");
});
