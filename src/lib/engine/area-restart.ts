import { stackingEngineComposite } from "./stacking.ts";
import type { RarePowerView } from "./rare-tags.ts";
import { rareTagEligible, domainEffectiveStrength } from "./rare-tags.ts";

export const AREA_RESTART_THRESHOLD = 6800;
export const MAJOR_REVIVAL_COST_MIN = 20;

export function isHighOrderDomain(power: RarePowerView): boolean {
  return power.rare_tags.includes("ghost_domain") && domainEffectiveStrength(power) >= AREA_RESTART_THRESHOLD;
}

export interface AreaRestartInput {
  domain?: RarePowerView;
  restart?: RarePowerView;
  mechanism_match: boolean;
  temporary_amp?: { value: number; applies_to_composite: boolean; revival_cost: number };
}

export function computeAreaRestartEffective(input: AreaRestartInput): {
  value: number;
  native: number;
  mismatch: boolean;
  used_amp: boolean;
  revival_cost: number;
} {
  if (!input.mechanism_match || !input.domain || !input.restart) {
    return { value: 0, native: 0, mismatch: true, used_amp: false, revival_cost: 0 };
  }
  if (!rareTagEligible(input.domain.max_strength, "ghost_domain").ok) {
    return { value: 0, native: 0, mismatch: true, used_amp: false, revival_cost: 0 };
  }
  if (!rareTagEligible(input.restart.max_strength, "restart").ok) {
    return { value: 0, native: 0, mismatch: true, used_amp: false, revival_cost: 0 };
  }
  const domainCur = domainEffectiveStrength(input.domain);
  const restartCur = input.restart.current_strength;
  const stacked = stackingEngineComposite({
    components: [domainCur, restartCur],
    mechanism_match: true,
  });
  const native = stacked.value;
  const ampOk = !!input.temporary_amp?.applies_to_composite;
  const amp = ampOk ? input.temporary_amp!.value : 0;
  const value = native + amp;
  const used_amp = ampOk && native < AREA_RESTART_THRESHOLD && value >= AREA_RESTART_THRESHOLD;
  const rawCost = input.temporary_amp?.revival_cost ?? 0;
  const revival_cost = used_amp ? Math.max(MAJOR_REVIVAL_COST_MIN, rawCost) : 0;
  return { value, native, mismatch: false, used_amp, revival_cost };
}

export function evaluateAreaRestartGate(input: AreaRestartInput): {
  allowed: boolean;
  reason: string;
  effective: number;
  revival_cost: number;
} {
  if (!input.restart || !rareTagEligible(input.restart.max_strength, "restart").ok) {
    return { allowed: false, reason: "missing_restart", effective: 0, revival_cost: 0 };
  }
  if (!input.domain || !rareTagEligible(input.domain.max_strength, "ghost_domain").ok) {
    return { allowed: false, reason: "missing_domain", effective: 0, revival_cost: 0 };
  }
  if (input.domain.domain_active === false) {
    return { allowed: false, reason: "domain_inactive", effective: 0, revival_cost: 0 };
  }
  const eff = computeAreaRestartEffective(input);
  if (eff.mismatch) return { allowed: false, reason: "mechanism_mismatch", effective: 0, revival_cost: 0 };
  if (eff.value < AREA_RESTART_THRESHOLD) {
    return { allowed: false, reason: "below_6800", effective: eff.value, revival_cost: 0 };
  }
  return { allowed: true, reason: "hard_gate_pass", effective: eff.value, revival_cost: eff.revival_cost };
}

export function evaluateSingleRestart(restart: RarePowerView | undefined): { allowed: boolean; reason: string } {
  if (!restart) return { allowed: false, reason: "missing_restart" };
  if (!rareTagEligible(restart.max_strength, "restart").ok) return { allowed: false, reason: "max_gate" };
  if (restart.restart_scope === "area") return { allowed: false, reason: "use_area_gate" };
  return { allowed: true, reason: "single_or_self_ok_without_domain" };
}
