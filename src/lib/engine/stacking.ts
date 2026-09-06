import { clamp } from "../utils.ts";
import type { GhostEntity, StackingProfile } from "./types.ts";

/**
 * Unified StackingEngine. Not linear multiplication.
 * Pressure density / repeat checks / fault tolerance / cost share.
 */
export function computeStackedPressure(base: number, profile: StackingProfile): number {
  if (!profile.can_stack || profile.current_stack_layers <= 1) return base;
  const layers = Math.min(profile.current_stack_layers, profile.stacking_cap || 1);
  const eff = clamp(profile.stacking_efficiency, 0, 6);
  let extra = 0;
  for (let i = 1; i < layers; i++) {
    const band = base * (0.18 + eff * 0.04) * Math.pow(0.62, i - 1);
    extra += band;
  }
  return Math.round(base + extra);
}

export function repeatChecksFromStack(profile: StackingProfile): number {
  if (!profile.can_stack) return 1;
  return 1 + Math.min(2, Math.max(0, profile.current_stack_layers - 1));
}

export function costShareFactor(profile: StackingProfile): number {
  if (!profile.can_stack || profile.current_stack_layers <= 1) return 1;
  const layers = Math.min(profile.current_stack_layers, profile.stacking_cap || 1);
  return clamp(1 - (layers - 1) * 0.12, 0.55, 1);
}

export function ghostsHaveStackingMechanism(ghosts: GhostEntity[]): boolean {
  if (ghosts.length < 2) return false;
  return ghosts.every((g) => g.mechanism_tags.includes("stacking"));
}

/** 1×2≈3 special stacking after base sum. Requires explicit stacking tags. */
export function applyGhostStacking(baseSum: number, ghosts: GhostEntity[]): { value: number; applied: boolean } {
  if (!ghostsHaveStackingMechanism(ghosts)) return { value: baseSum, applied: false };
  const profile: StackingProfile = {
    can_stack: true,
    stacking_efficiency: 1.2,
    stacking_cap: ghosts.length,
    current_stack_layers: ghosts.length,
    stacking_sources: ghosts.map((g) => g.ghost_id),
    stacking_conditions: ["stacking"],
    stacking_risks: ["规则互相咬合"],
  };
  return { value: computeStackedPressure(baseSum, profile), applied: true };
}

export function cooperativeOpposition(maxValues: number[]): number {
  if (!maxValues.length) return 0;
  const sorted = [...maxValues].sort((a, b) => b - a);
  let acc = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    acc += Math.round(sorted[i]! * Math.pow(0.55, i));
  }
  return acc;
}

/** Unified StackingEngine entry for matched composite mechanisms (area restart etc). */
export function stackingEngineComposite(params: {
  components: number[];
  mechanism_match: boolean;
  amplifier?: number;
}): { value: number; applied: boolean; mismatch: boolean } {
  if (!params.mechanism_match) return { value: 0, applied: false, mismatch: true };
  const native = cooperativeOpposition(params.components);
  return { value: native + (params.amplifier ?? 0), applied: true, mismatch: false };
}
