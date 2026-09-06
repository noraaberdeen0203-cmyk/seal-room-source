import { tierOf } from "./strength.ts";
import type { StrengthTier } from "./types.ts";

export type LethalEndpoint = "instant_death" | "negated" | "incapacitation" | "structure_shock" | "ignored_vs_heteromorph" | "consciousness_attack";

export function evaluateLethalVsNormal(params: {
  attack_strength: number;
  defender_strength: number;
  has_lethal_tag: boolean;
  rule_triggered: boolean;
  tiers?: StrengthTier[];
}): { endpoint: LethalEndpoint; nonlethal_continues: boolean; notes: string } {
  if (!params.has_lethal_tag || !params.rule_triggered) {
    return { endpoint: "negated", nonlethal_continues: true, notes: "no lethal eligibility" };
  }
  const atk = tierOf(params.attack_strength, params.tiers).tier_id;
  const def = tierOf(params.defender_strength, params.tiers).tier_id;
  if (def >= atk + 3) {
    return { endpoint: "negated", nonlethal_continues: true, notes: "defender_tier >= attack_tier+3" };
  }
  return { endpoint: "instant_death", nonlethal_continues: true, notes: "lethal endpoint" };
}

export function evaluateLethalVsHeteromorph(params: {
  attack_strength: number;
  heteromorph_strength: number;
  has_lethal_tag: boolean;
  has_consciousness_mechanism: boolean;
  tiers?: StrengthTier[];
}): { endpoint: LethalEndpoint; notes: string } {
  if (!params.has_lethal_tag) return { endpoint: "negated", notes: "no lethal" };
  if (params.has_consciousness_mechanism) {
    return { endpoint: "consciousness_attack", notes: "route ConsciousnessAttackGate" };
  }
  const atk = tierOf(params.attack_strength, params.tiers).tier_id;
  const def = tierOf(params.heteromorph_strength, params.tiers).tier_id;
  const gap = atk - def;
  if (gap >= 2) return { endpoint: "incapacitation", notes: "temporary_supernatural_incapacitation" };
  if (gap <= 0) return { endpoint: "ignored_vs_heteromorph", notes: "pure lethal ignored" };
  return { endpoint: "structure_shock", notes: "gap 1 structure shock only" };
}
