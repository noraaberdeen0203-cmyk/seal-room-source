import type { RareTagId } from "./types.ts";

export const RARE_TAG_MIN_MAX: Record<RareTagId, number> = {
  lethal: 1500,
  suppression: 1500,
  curse: 1500,
  ghost_domain: 2200,
  consciousness: 2200,
  idealistic: 3000,
  restart: 3000,
};

export const RARE_TAG_ALIASES: Record<string, RareTagId> = {
  必死: "lethal",
  压制: "suppression",
  诅咒: "curse",
  鬼域: "ghost_domain",
  意识: "consciousness",
  唯心: "idealistic",
  重启: "restart",
  lethal: "lethal",
  suppression: "suppression",
  curse: "curse",
  ghost_domain: "ghost_domain",
  consciousness: "consciousness",
  idealistic: "idealistic",
  restart: "restart",
};

export const PLAYER_POWER_RARE_CAP = 3;

export interface RarePowerView {
  id: string;
  max_strength: number;
  current_strength: number;
  rare_tags: RareTagId[];
  mechanism_tags?: string[];
  consciousness_function?: string;
  restart_scope?: "self" | "single_target" | "area";
  domain_active?: boolean;
  domain_mechanism_factor?: number;
}

export function normalizeRareTag(tag: string): RareTagId | null {
  return RARE_TAG_ALIASES[tag] ?? null;
}

export function rareTagEligible(maxStrength: number, tag: string): { ok: boolean; reason: string; id: RareTagId | null } {
  const id = normalizeRareTag(tag);
  if (!id) return { ok: false, reason: "unknown_tag", id: null };
  const min = RARE_TAG_MIN_MAX[id];
  if (maxStrength < min) return { ok: false, reason: `max ${maxStrength} < ${min} for ${id}`, id };
  return { ok: true, reason: "eligible", id };
}

export function reviewPowerRareTags(power: RarePowerView, opts?: { player_created?: boolean }): {
  accepted: RareTagId[];
  rejected: { tag: RareTagId; reason: string }[];
  exception_review: boolean;
} {
  const rejected: { tag: RareTagId; reason: string }[] = [];
  const accepted: RareTagId[] = [];
  for (const raw of power.rare_tags) {
    const r = rareTagEligible(power.max_strength, raw);
    if (!r.id) continue;
    if (!r.ok) rejected.push({ tag: r.id, reason: r.reason });
    else accepted.push(r.id);
  }
  const unique = [...new Set(accepted)];
  const exception_review = !!opts?.player_created && unique.length > PLAYER_POWER_RARE_CAP;
  return { accepted: unique, rejected, exception_review };
}

export function ghostRareSummary(powers: RarePowerView[]): RareTagId[] {
  return [...new Set(powers.flatMap((p) => p.rare_tags))];
}

/** Tags on different powers cannot auto-combine into one composite mechanism. */
export function canMixRareMechanisms(powerA: RarePowerView, powerB: RarePowerView): boolean {
  return powerA.id === powerB.id;
}

export function domainEffectiveStrength(power: RarePowerView): number {
  const factor = power.domain_mechanism_factor ?? 1;
  return Math.round(power.current_strength * factor);
}

export function consciousnessBand(maxStrength: number): "none" | "low" | "mid" | "high" | "extreme" {
  if (maxStrength < 2200) return "none";
  if (maxStrength < 3500) return "low";
  if (maxStrength < 5000) return "mid";
  if (maxStrength < 7000) return "high";
  return "extreme";
}

export function isProtectiveConsciousnessFunction(fn: string | undefined): boolean {
  return (
    fn === "preserve_human_memory" ||
    fn === "fix_personality" ||
    fn === "keep_consciousness_continuity" ||
    fn === "store_self" ||
    fn === "restart_keep_memory"
  );
}
