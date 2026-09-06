import assert from "node:assert/strict";
import test from "node:test";
import { deriveStrength } from "./ghost-strength.ts";
import { makeGhost } from "./ghost.ts";
import { evaluateContainmentP2, computeSideContainmentStrength } from "./containment.ts";
import { evaluateDrivingP2 } from "./driving.ts";
import { deadGhostSuppressesRevival, tickGhostsAndRevival } from "./revival.ts";
import { evaluateSameTargetCollision } from "./balance.ts";
import { setAttacking } from "./ghost-strength.ts";
import { createContainedGhostItem } from "./special-inventory.ts";
import type { Character, GameEvent, Item } from "./types.ts";

function actor(over: Partial<Character["stats"]> = {}): Character {
  return {
    id: "pc_t",
    name: "测",
    display_name: "测",
    aliases: [],
    type: "player_character",
    role: "t",
    visibility: "known",
    current_status: "",
    appearance: { public_description: "", hidden_abnormalities: [] },
    personality: { visible_traits: [], hidden_traits: [], behavior_rules: [] },
    background: { player_known: "", gm_hidden: "" },
    stats: {
      supernatural_strength: 400,
      effective_strength: 400,
      burst_strength: 400,
      revival_degree: 20,
      body: 80,
      anchor: 80,
      control: 50,
      analysis_base: 50,
      ...over,
    },
    powers: [],
    items: ["gold"],
    relationships: [],
    knowledge: [],
    unknowns: [],
    current_goals: [],
    gm_notes: "",
    common_locations: [],
    plot_hooks: [],
  };
}

function ev(): GameEvent {
  return {
    id: "evt",
    name: "t",
    status: "active",
    visible_description: "",
    hidden_truth: "",
    hazard_grade: "B",
    source_strength: 1200,
    hazard_strength: 50,
    instability: 30,
    source_entity_id: "g_src",
    source_reality_status: "real",
    known_rules: ["窗口"],
    hidden_rules: [],
    suspected_rules: [],
    false_assumptions: [],
    hazard_factors: [],
    locations: [],
    involved_characters: [],
    involved_items: [],
    event_clock_rules: [],
    containment_requirements: [],
    failure_modes: [],
    reveal_conditions: [],
    known_clues: ["窗口已开"],
    hidden_clues: [],
    social_exposure: 0,
    lockdown_status: "none",
    containment_status: "none",
    gm_notes: "",
  };
}

const gold: Item = {
  id: "gold",
  name: "金",
  type: "gold_container",
  owner_id: "pc_t",
  visibility: "known",
  origin_player_known: "",
  origin_gm_hidden: "",
  known_usage: "",
  hidden_usage: "",
  activation_condition: "",
  cost: "",
  risk: "",
  state: "intact",
  mechanism_tags: [],
  gm_notes: "",
};

test("T1 independent ghosts", () => {
  const src = makeGhost({ ghost_id: "g_src", display_name: "源", max: 1200, true_entity_kind: "source_entity" });
  const proj = makeGhost({ ghost_id: "g_p", display_name: "影", max: 80, true_entity_kind: "projection" });
  const slave = makeGhost({ ghost_id: "g_s", display_name: "奴", max: 90, true_entity_kind: "ghost_slave" });
  assert.notEqual(src.ghost_id, proj.ghost_id);
  assert.notEqual(src.strength_profile.current_strength, proj.strength_profile.current_strength);
  assert.equal(src.true_entity_kind, "source_entity");
  assert.equal(slave.true_entity_kind, "ghost_slave");
});

test("T2 false source not resolved", () => {
  const proj = makeGhost({ ghost_id: "g_p", display_name: "影", max: 80, true_entity_kind: "projection" });
  const r = evaluateContainmentP2({
    event: ev(),
    actor: actor(),
    items: [gold],
    ghosts: [proj],
    targets: [
      {
        id: "t1",
        visible_name: "人影",
        location_id: "here",
        linked_ghost_id: "g_p",
        present: true,
        visibility: "known",
        player_visible: { appearance: "", anomaly: "", known_facts: [] },
      },
    ],
    targetId: "t1",
    assumption: "source_entity",
    difficulty: "standard",
  });
  assert.equal(r.success, false);
  assert.equal(r.result, "projection_dispersed");
  assert.equal(r.is_true_source_selected, false);
  assert.match(r.visible_text, /敲门|三秒|另一/);
});

test("T3 containment strength success", () => {
  const src = makeGhost({
    ghost_id: "g_src",
    display_name: "源",
    max: 1200,
    true_entity_kind: "source_entity",
    in_reality: "real",
    source_relationship: {
      is_true_source: true,
      linked_source_id: "g_src",
      parent_puzzle_id: null,
      can_end_event_if_contained: true,
    },
  });
  src.strength_profile.current_strength = 1200;
  const host = makeGhost({
    ghost_id: "g_h",
    display_name: "体",
    max: 4000,
    true_entity_kind: "possessed_ghost",
    host_character_id: "pc_t",
  });
  host.strength_profile = deriveStrength({
    max_strength: 4000,
    current_strength: 3000,
    controllability: 0.6,
    hostControl: 80,
    hostAnchor: 80,
  });
  const r = evaluateContainmentP2({
    event: ev(),
    actor: actor({ control: 80 }),
    items: [gold],
    ghosts: [src, host],
    targets: [
      {
        id: "ts",
        visible_name: "源头轮廓",
        location_id: "here",
        linked_ghost_id: "g_src",
        present: true,
        visibility: "known",
        player_visible: { appearance: "", anomaly: "", known_facts: [] },
      },
    ],
    targetId: "ts",
    windowReady: true,
  });
  assert.ok(r.side_strength > 1200, `side=${r.side_strength}`);
  assert.equal(r.result, "contained");
  assert.ok(r.item);
});

test("T4 containment strength limit", () => {
  const src = makeGhost({
    ghost_id: "g_src",
    display_name: "源",
    max: 2000,
    true_entity_kind: "source_entity",
    in_reality: "real",
    source_relationship: {
      is_true_source: true,
      linked_source_id: "g_src",
      parent_puzzle_id: null,
      can_end_event_if_contained: true,
    },
  });
  src.strength_profile.current_strength = 1400;
  const host = makeGhost({
    ghost_id: "g_h",
    display_name: "体",
    max: 400,
    true_entity_kind: "possessed_ghost",
    host_character_id: "pc_t",
  });
  host.strength_profile = deriveStrength({
    max_strength: 400,
    current_strength: 200,
    controllability: 0.4,
  });
  const r = evaluateContainmentP2({
    event: ev(),
    actor: actor({ effective_strength: 200 }),
    items: [gold],
    ghosts: [src, host],
    targets: [
      {
        id: "ts",
        visible_name: "源头轮廓",
        location_id: "here",
        linked_ghost_id: "g_src",
        present: true,
        visibility: "known",
        player_visible: { appearance: "", anomaly: "", known_facts: [] },
      },
    ],
    targetId: "ts",
    windowReady: true,
  });
  assert.ok(r.side_strength <= 1400, `side=${r.side_strength}`);
  assert.equal(r.result, "limited");
  assert.equal(r.item, null);
});

test("T5 standard driving requires contained ghost", () => {
  const src = makeGhost({ ghost_id: "g_src", display_name: "源", max: 400, true_entity_kind: "source_entity" });
  const d = evaluateDrivingP2({
    actor: actor(),
    ghosts: [src],
    items: [gold],
    special: [],
    targetGhostId: "g_src",
    force: false,
  });
  assert.equal(d.outcome, "缺少关押物");
  const item = createContainedGhostItem(src);
  const d2 = evaluateDrivingP2({
    actor: actor(),
    ghosts: [src],
    items: [gold],
    special: [item],
    containedItemId: item.item_id,
    force: false,
  });
  assert.notEqual(d2.outcome, "缺少关押物");
  assert.equal(d2.entry, "standard_after_containment");
});

test("T6 forced driving penalty", () => {
  const src = makeGhost({
    ghost_id: "g_src",
    display_name: "源",
    max: 2000,
    true_entity_kind: "source_entity",
  });
  src.attack_state.is_attacking = true;
  const d = evaluateDrivingP2({
    actor: actor(),
    ghosts: [src],
    items: [gold],
    special: [],
    targetGhostId: "g_src",
    force: true,
  });
  assert.equal(d.entry, "forced_without_containment");
  assert.ok(d.forced_penalties.length >= 1);
  assert.ok(d.revival >= 20);
  assert.ok(["anchor_state", "collapse", "multi_puzzle_conflict"].includes(d.balance_state));
});

test("T7 dead ghost suppresses revival", () => {
  const dead = makeGhost({
    ghost_id: "g_d",
    display_name: "死机",
    max: 2000,
    true_entity_kind: "possessed_ghost",
    host_character_id: "pc_t",
  });
  dead.strength_profile.current_strength = 1800;
  dead.revival_profile.deadlock_status = "revival_deadlock";
  dead.revival_profile.deadlock_scope = ["g_o"];
  const other = makeGhost({
    ghost_id: "g_o",
    display_name: "其他",
    max: 1600,
    true_entity_kind: "possessed_ghost",
    host_character_id: "pc_t",
  });
  other.strength_profile.current_strength = 1600;
  const check = deadGhostSuppressesRevival([dead, other]);
  assert.equal(check.suppressed, true);
});

test("T8 deadlock breaks when sum exceeds", () => {
  const dead = makeGhost({
    ghost_id: "g_d",
    display_name: "死机",
    max: 2000,
    true_entity_kind: "possessed_ghost",
    host_character_id: "pc_t",
  });
  dead.strength_profile.current_strength = 1800;
  dead.revival_profile.deadlock_status = "revival_deadlock";
  dead.revival_profile.deadlock_scope = ["g_o"];
  const other = makeGhost({
    ghost_id: "g_o",
    display_name: "其他",
    max: 2000,
    true_entity_kind: "possessed_ghost",
    host_character_id: "pc_t",
  });
  other.strength_profile.current_strength = 1850;
  const check = deadGhostSuppressesRevival([dead, other]);
  assert.equal(check.suppressed, false);
});

test("T9 current !== controlled", () => {
  const p = deriveStrength({
    max_strength: 3000,
    current_strength: 1500,
    controllability: 0.4,
  });
  assert.equal(p.current_strength, 1500);
  assert.ok(Math.abs(p.controlled_strength - 600) <= 120, String(p.controlled_strength));
  assert.ok(p.uncontrolled_strength > p.controlled_strength * 0.5);
});

test("T10 same target attack deadlock", () => {
  const a = makeGhost({
    ghost_id: "g_a",
    display_name: "内",
    max: 900,
    true_entity_kind: "possessed_ghost",
    host_character_id: "pc_t",
  });
  const b = makeGhost({
    ghost_id: "g_b",
    display_name: "外",
    max: 900,
    true_entity_kind: "source_entity",
  });
  setAttacking(a, "pc_t", "defensive_reaction");
  setAttacking(b, "pc_t", "killing_rule_triggered");
  const hit = evaluateSameTargetCollision({
    hostGhosts: [a],
    incoming: b,
    hostId: "pc_t",
    gap: 0,
  });
  assert.ok(["dual_ghost_deadlock", "partial_deadlock", "stable_deadlock"].includes(hit.state), hit.state);
});

test("side strength teammates", () => {
  const r = computeSideContainmentStrength({
    actor: actor(),
    ghosts: [],
    items: [gold],
    teammates: [
      { role: "suppress_source", strength: 200 },
      { role: "evacuate", strength: 999 },
    ],
  });
  assert.ok(r.final < 200 + 999 + 400);
  assert.match(r.notes.join(","), /疏散|evacuate|不计入/);
});
