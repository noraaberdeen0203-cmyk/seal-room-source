import { clamp } from "../utils.ts";
import type { GhostEntity } from "./types.ts";
import { deriveStrength } from "./ghost-strength.ts";
import { applyGhostStacking } from "./stacking.ts";

export const AWAKENING_CONFIG = {
  base_awakening: 0.33,
};

export function awakeningFactor(revivalDegree: number): number {
  const t = clamp(revivalDegree, 0, 100) / 100;
  const base = AWAKENING_CONFIG.base_awakening;
  return base + (1 - base) * t;
}

export function isDeadlockedGhost(g: GhostEntity): boolean {
  return g.revival_profile.deadlock_status !== "none";
}

export function currentFromAnchor(g: GhostEntity, revivalDegree: number): number {
  const max = g.strength_profile.max_strength;
  const rAnchor = g.revival_profile.anchor_revival_degree;
  const sAnchor = g.revival_profile.anchor_current_strength;
  if (rAnchor == null || sAnchor == null) {
    return Math.round(max * awakeningFactor(revivalDegree));
  }
  if (revivalDegree >= 100) return max;
  if (revivalDegree <= rAnchor) return sAnchor;
  const denom = Math.max(1, 100 - rAnchor);
  return Math.round(sAnchor + (max - sAnchor) * ((revivalDegree - rAnchor) / denom));
}

export function setAwakeningAnchor(g: GhostEntity, revivalDegree: number, current: number) {
  g.revival_profile.anchor_revival_degree = revivalDegree;
  g.revival_profile.anchor_current_strength = current;
}

export function rebuildHostAnchors(ghosts: GhostEntity[], characterId: string, revivalDegree: number) {
  for (const g of hostedGhosts(ghosts, characterId)) {
    if (isDeadlockedGhost(g) || g.runtime_frozen) continue;
    setAwakeningAnchor(g, revivalDegree, g.strength_profile.current_strength);
  }
}

export function recomputeGhostCurrents(ghosts: GhostEntity[], revivalDegree: number, host?: { control: number; anchor: number }) {
  for (const g of ghosts) {
    if (g.runtime_frozen) continue;
    if (isDeadlockedGhost(g)) {
      g.strength_profile = deriveStrength({
        max_strength: g.strength_profile.max_strength,
        current_strength: g.strength_profile.current_strength,
        controllability: g.strength_profile.controllability,
        hostControl: host?.control,
        hostAnchor: host?.anchor,
        activity: g.revival_profile.ghost_activity,
      });
      continue;
    }
    const next = currentFromAnchor(g, revivalDegree);
    g.strength_profile = deriveStrength({
      max_strength: g.strength_profile.max_strength,
      current_strength: next,
      controllability: g.strength_profile.controllability,
      hostControl: host?.control,
      hostAnchor: host?.anchor,
      activity: g.revival_profile.ghost_activity,
    });
  }
}

export function hostedGhosts(ghosts: GhostEntity[] | undefined, characterId: string): GhostEntity[] {
  return (ghosts ?? []).filter((g) => g.host_character_id === characterId && !g.runtime_frozen);
}

export function computePlayerCurrentStrength(ghosts: GhostEntity[], characterId: string): {
  base: number;
  stacked: number;
  used_stacking: boolean;
} {
  const hosted = hostedGhosts(ghosts, characterId);
  const normal = hosted.filter((g) => !isDeadlockedGhost(g));
  const dead = hosted.filter(isDeadlockedGhost);
  const base =
    normal.reduce((s, g) => s + g.strength_profile.current_strength, 0) +
    dead.reduce((s, g) => s + g.strength_profile.current_strength, 0);
  const stacked = applyGhostStacking(base, hosted);
  return { base, stacked: stacked.value, used_stacking: stacked.applied };
}
