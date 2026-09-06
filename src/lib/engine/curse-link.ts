import { uid, nowIso } from "../utils.ts";
import type { Character, CurseLink } from "./types.ts";

export function createCurseLink(params: {
  source_id: string;
  target_id: string;
  medium?: string | null;
  attachment_condition?: string;
  effect_profile?: string[];
  break_condition?: string;
  transmissible?: boolean;
}): { link: CurseLink | null; reason: string } {
  if (!params.medium) return { link: null, reason: "no_medium" };
  return {
    link: {
      link_id: uid("curse"),
      source_id: params.source_id,
      target_id: params.target_id,
      medium: params.medium,
      attachment_condition: params.attachment_condition ?? "attached",
      effect_profile: params.effect_profile ?? ["borrowed_fragment"],
      break_condition: params.break_condition ?? "medium_broken",
      transmissible: params.transmissible === true,
      active: true,
      created_at: nowIso(),
    },
    reason: "created",
  };
}

export function curseRemainsWhenDistant(link: CurseLink, distant: boolean): boolean {
  return link.active && (!distant || link.break_condition !== "distance");
}

export function breakCurseLink(link: CurseLink, event: string) {
  if (event === link.break_condition) link.active = false;
}

export function spreadCurse(link: CurseLink, newTargetId: string): CurseLink | null {
  if (!link.active || !link.transmissible) return null;
  return { ...link, link_id: uid("curse"), target_id: newTargetId, created_at: nowIso() };
}

export function applyBorrowedEffects(actor: Character, link: CurseLink) {
  if (!link.active) return;
  actor.borrowed_supernatural_effects = [...new Set([...(actor.borrowed_supernatural_effects ?? []), ...link.effect_profile])];
  actor.is_ghost_controller = false;
  if (actor.supernatural_transition_state === "heteromorphic") return;
}
