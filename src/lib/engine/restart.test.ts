import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRestartRequest, areaRestartDomainsForParticipant } from "./restart-engine.ts";
import type { RarePowerView } from "./rare-tags.ts";
import { createSaveFromPack } from "./content-pack.ts";
import { DEFAULT_PACK } from "../packs/default-pack.ts";
import { resolveAction } from "./resolution.ts";
import { applyRevivalDelta } from "./revival-delta.ts";
import { settleNaturalRevival } from "./natural-revival.ts";
import { readFileSync } from "node:fs";

const restartPow = (max: number, cur: number): RarePowerView => ({
  id: "rst",
  max_strength: max,
  current_strength: cur,
  rare_tags: ["restart"],
  restart_scope: "area",
});
const domainPow = (max: number, cur: number): RarePowerView => ({
  id: "dom",
  max_strength: max,
  current_strength: cur,
  rare_tags: ["ghost_domain"],
  domain_active: true,
});

test("RF01 self restart without domain allowed", () => {
  const r = evaluateRestartRequest({
    source_id: "A",
    target_id: "A",
    requested_domains: ["body"],
    restart: restartPow(3000, 800),
  });
  assert.equal(r.allowed, true);
  assert.equal(r.route, "self_restart");
});

test("RF02 external one target no exception no domain fails area gate", () => {
  const r = evaluateRestartRequest({
    source_id: "A",
    target_id: "B",
    requested_domains: ["body"],
    restart: restartPow(3000, 800),
  });
  assert.equal(r.route, "area_restart");
  assert.equal(r.allowed, false);
});

test("RF03 external 6799 fails", () => {
  const r = evaluateRestartRequest({
    source_id: "A",
    target_id: "B",
    requested_domains: ["body"],
    restart: restartPow(5000, 3269),
    domain: domainPow(5000, 5000),
    mechanism_match: true,
  });
  assert.equal(r.allowed, false);
});

test("RF04 external 6800 passes", () => {
  const r = evaluateRestartRequest({
    source_id: "A",
    target_id: "B",
    requested_domains: ["body"],
    restart: restartPow(5000, 3273),
    domain: domainPow(5000, 5000),
    mechanism_match: true,
  });
  assert.equal(r.allowed, true);
});

test("RF05 explicit exception skips area gate", () => {
  const r = evaluateRestartRequest({
    source_id: "A",
    target_id: "B",
    requested_domains: ["body"],
    restart: restartPow(3000, 400),
    canonical_restart_profile: { external_single_target_exception: true, can_rewind_own_source_revival: false },
  });
  assert.equal(r.route, "exceptional_external_single");
  assert.equal(r.allowed, true);
});

test("RF06 self strips own revival_state", () => {
  const r = evaluateRestartRequest({
    source_id: "A",
    target_id: "A",
    requested_domains: ["body", "revival_state"],
    restart: restartPow(3000, 800),
  });
  assert.ok(!r.effective_domains.includes("revival_state"));
  assert.ok(r.stripped_domains.includes("revival_state"));
});

test("RF07 area covering source strips source revival only", () => {
  const src = areaRestartDomainsForParticipant({
    source_id: "A",
    participant_id: "A",
    requested: ["body", "revival_state", "injury"],
  });
  const other = areaRestartDomainsForParticipant({
    source_id: "A",
    participant_id: "B",
    requested: ["body", "revival_state", "injury"],
  });
  assert.ok(!src.effective.includes("revival_state"));
  assert.ok(src.effective.includes("body"));
  assert.ok(other.effective.includes("revival_state"));
});

test("RF08 independent B can rewind A revival", () => {
  const r = evaluateRestartRequest({
    source_id: "B",
    target_id: "A",
    requested_domains: ["revival_state"],
    restart: restartPow(5000, 3273),
    domain: domainPow(5000, 5000),
    mechanism_match: true,
  });
  assert.equal(r.allowed, true);
  assert.ok(r.effective_domains.includes("revival_state"));
});

test("RF09 reciprocal area restarts allowed sequentially", () => {
  const ab = evaluateRestartRequest({
    source_id: "A",
    target_id: "B",
    requested_domains: ["revival_state"],
    restart: restartPow(5000, 3273),
    domain: domainPow(5000, 5000),
    mechanism_match: true,
  });
  const ba = evaluateRestartRequest({
    source_id: "B",
    target_id: "A",
    requested_domains: ["revival_state"],
    restart: restartPow(5000, 3273),
    domain: domainPow(5000, 5000),
    mechanism_match: true,
  });
  assert.equal(ab.allowed && ba.allowed, true);
});

test("RF10 memory restart unsupported", () => {
  const r = evaluateRestartRequest({
    source_id: "A",
    target_id: "A",
    requested_domains: ["memory"],
    restart: restartPow(4000, 2000),
  });
  assert.equal(r.allowed, false);
  assert.equal(r.route, "unsupported");
});

test("RF11 force_drive 95 to 100 via applyRevivalDelta", () => {
  const save = createSaveFromPack(DEFAULT_PACK);
  save.player_character.stats.revival_degree = 95;
  const incoming = save.ghosts!.find((g) => g.ghost_id === "ghost_knock")!;
  incoming.host_character_id = null;
  incoming.strength_profile.current_strength = 3000;
  const r = resolveAction(save, {
    action_type: "force_drive",
    action_text: "强行驾驭",
    target_id: "ghost_knock",
    force_drive: true,
  });
  assert.equal(save.player_character.stats.revival_degree, 100);
  assert.equal(r.interrupt, "revival_threshold");
});

test("RF12 no direct += revival in engine except natural and applyRevivalDelta", () => {
  const files = [
    "src/lib/engine/resolution.ts",
    "src/lib/engine/rare-actions.ts",
    "src/lib/engine/driving.ts",
    "src/lib/engine/containment.ts",
  ];
  for (const f of files) {
    const src = readFileSync(`/workspace/${f}`, "utf8");
    assert.equal(src.includes("revival_degree + cost.revival"), false, f);
    assert.equal(/\+=\s*[^\n]*revival/.test(src), false, f);
  }
});

test("RF13 persist cost ids across save load", () => {
  const save = createSaveFromPack(DEFAULT_PACK);
  const before = save.player_character.stats.revival_degree;
  applyRevivalDelta({
    character: save.player_character,
    delta: 7,
    source: "t",
    reason: "c1",
    transaction_id: "tx1",
    cost_id: "c1",
    save,
  });
  const raw = JSON.parse(JSON.stringify(save));
  applyRevivalDelta({
    character: raw.player_character,
    delta: 7,
    source: "t",
    reason: "c1",
    transaction_id: "tx1",
    cost_id: "c1",
    save: raw,
  });
  assert.equal(raw.player_character.stats.revival_degree, before + 7);
});

test("RF14 long_time_skip still interrupts at 100", () => {
  const save = createSaveFromPack(DEFAULT_PACK);
  save.player_character.stats.revival_degree = 99;
  const r = settleNaturalRevival(save, { kind: "long_time_skip", days: 30 });
  assert.equal(save.player_character.stats.revival_degree, 100);
  assert.equal(r.interrupted || r.interrupt_type === "revival_threshold" || r.revival_degree === 100, true);
});
