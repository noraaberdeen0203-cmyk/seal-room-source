import type { GhostEntity, SourceContactState } from "./types.ts";

export function ghostIsIdealistic(ghost: GhostEntity): boolean {
  return (
    ghost.rare_tags?.includes("idealistic") === true ||
    ghost.mechanism_tags.includes("唯心") ||
    ghost.mechanism_tags.includes("idealistic")
  );
}

export function hasSourceContact(ghost: GhostEntity): boolean {
  return ghost.source_contact_state === "source_contact_established";
}

export function establishSourceContact(ghost: GhostEntity, mediumPresent: boolean, mechanismCorrect: boolean): SourceContactState {
  if (!mediumPresent || !mechanismCorrect) {
    ghost.source_contact_state = ghost.source_contact_state ?? "suspected";
    return ghost.source_contact_state;
  }
  ghost.source_contact_state = "source_contact_established";
  return ghost.source_contact_state;
}

export function loseSourceContact(ghost: GhostEntity): SourceContactState {
  ghost.source_contact_state = "contact_lost";
  return ghost.source_contact_state;
}

export function idealisticBlocksContainment(ghost: GhostEntity): boolean {
  return ghostIsIdealistic(ghost) && !hasSourceContact(ghost);
}
