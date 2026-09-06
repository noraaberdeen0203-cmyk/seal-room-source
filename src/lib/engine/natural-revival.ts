import { clamp } from "../utils.ts";
import type { SaveData } from "./types.ts";
import { recomputeGhostCurrents, computePlayerCurrentStrength, hostedGhosts } from "./awakening.ts";
import { applyGhostStacking } from "./stacking.ts";
import { deadGhostSuppressesRevival } from "./revival.ts";

/** Concentrated P3-B/C tuning. Not worldview constants. */
export const NATURAL_REVIVAL_CONFIG = {
  per_30_days: 10,
  multipliers: {
    no_balance: 1,
    single_ghost_instability: 1,
    multi_puzzle_conflict: 1,
    partial_deadlock: 0.9,
    dual_ghost_deadlock: 0.8,
    stable_deadlock: 0.7,
    high_quality_balance: 0.55,
    revival_deadlock: 1,
    local_deadlock: 0.8,
    global_deadlock: 1,
    rule_deadlock: 0.8,
    structural_deadlock: 0.8,
    heteromorphic_state: 1,
    anchor_state: 1,
    collapse: 1,
  } as Record<string, number>,
};

export function ratePerDay(multiplier: number): number {
  return (NATURAL_REVIVAL_CONFIG.per_30_days / 30) * multiplier;
}

export function naturalRevivalDelta(days: number, multiplier: number): number {
  if (days <= 0) return 0;
  return Math.round(((days / 30) * NATURAL_REVIVAL_CONFIG.per_30_days * multiplier) * 100) / 100;
}

/** Live P2 check. Label alone never forces 0. */
export function effectiveNaturalMultiplier(save: SaveData): number {
  const hosted = hostedGhosts(save.ghosts, save.player_character.id);
  const tableMult = hosted.length <= 1 ? 1 : (NATURAL_REVIVAL_CONFIG.multipliers[save.balance?.state ?? "no_balance"] ?? 1);
  const live = deadGhostSuppressesRevival(hosted);
  if (live.suppressed) return 0;
  return tableMult;
}

export function balanceMultiplier(save: SaveData): number {
  return effectiveNaturalMultiplier(save);
}

export interface SkipSegment {
  days: number;
  deadlockEffective?: boolean;
  forceMultiplier?: number;
}

export interface NaturalRevivalResult {
  delta: number;
  applied: boolean;
  notes: string;
  interrupted: boolean;
  interrupt_type?: "revival_threshold";
  requested_end_calendar?: number;
  actual_end_calendar?: number;
  remaining_skip_days?: number;
  revival_degree?: number;
}

function applyStrength(save: SaveData) {
  recomputeGhostCurrents(hostedGhosts(save.ghosts, save.player_character.id), save.player_character.stats.revival_degree, {
    control: save.player_character.stats.control,
    anchor: save.player_character.stats.anchor,
  });
  const str = computePlayerCurrentStrength(save.ghosts ?? [], save.player_character.id);
  const stacked = applyGhostStacking(str.base, hostedGhosts(save.ghosts, save.player_character.id));
  save.player_character.stats.effective_strength = stacked.value;
  save.player_character.stats.supernatural_strength = str.base;
}

export function settleNaturalRevival(
  save: SaveData,
  params: {
    kind: "long_time_skip" | "scene_wait";
    days?: number;
    hours?: number;
    segments?: SkipSegment[];
    deadlockDays?: number;
    afterDeadlockDays?: number;
  },
): NaturalRevivalResult {
  if (params.kind === "scene_wait") {
    return { delta: 0, applied: false, notes: "场景等待不结算自然复苏。", interrupted: false };
  }
  save.world_calendar_day = save.world_calendar_day ?? 0;
  save.natural_revival_anchor_calendar = save.natural_revival_anchor_calendar ?? save.world_calendar_day;
  const startCal = save.world_calendar_day;
  let segments: SkipSegment[] = params.segments ?? [];
  if (!segments.length && params.deadlockDays != null && params.afterDeadlockDays != null) {
    segments = [
      { days: params.deadlockDays, deadlockEffective: true },
      { days: params.afterDeadlockDays, deadlockEffective: false },
    ];
  }
  if (!segments.length) segments = [{ days: params.days ?? 0 }];
  const requestedDays = segments.reduce((s, g) => s + g.days, 0);
  const requestedEnd = startCal + requestedDays;

  let totalDelta = 0;
  let remaining = requestedDays;
  for (const seg of segments) {
    if (seg.days <= 0) continue;
    const liveMult = effectiveNaturalMultiplier(save);
    const mult =
      seg.forceMultiplier != null
        ? seg.forceMultiplier
        : seg.deadlockEffective === true
          ? 0
          : liveMult;
    const need = 100 - save.player_character.stats.revival_degree;
    if (mult > 0 && need <= 0) {
      save.player_character.stats.revival_degree = 100;
      save.world_calendar_day = startCal + (requestedDays - remaining);
      save.natural_revival_anchor_calendar = save.world_calendar_day;
      applyStrength(save);
      return {
        delta: totalDelta,
        applied: true,
        notes: "already at 100",
        interrupted: true,
        interrupt_type: "revival_threshold",
        requested_end_calendar: requestedEnd,
        actual_end_calendar: save.world_calendar_day,
        remaining_skip_days: remaining,
        revival_degree: 100,
      };
    }
    if (mult > 0 && need > 0) {
      const daysTo100 = need / ratePerDay(mult);
      if (daysTo100 <= seg.days + 1e-9) {
        const used = daysTo100;
        totalDelta += need;
        save.player_character.stats.revival_degree = 100;
        remaining -= used;
        save.world_calendar_day = startCal + (requestedDays - remaining);
        save.natural_revival_anchor_calendar = save.world_calendar_day;
        applyStrength(save);
        return {
          delta: totalDelta,
          applied: true,
          notes: `revival_threshold after ${used}d of segment`,
          interrupted: true,
          interrupt_type: "revival_threshold",
          requested_end_calendar: requestedEnd,
          actual_end_calendar: save.world_calendar_day,
          remaining_skip_days: remaining,
          revival_degree: 100,
        };
      }
    }
    const add = naturalRevivalDelta(seg.days, mult);
    totalDelta += add;
    save.player_character.stats.revival_degree = clamp(save.player_character.stats.revival_degree + add, 0, 100);
    remaining -= seg.days;
    save.world_calendar_day += seg.days;
  }
  save.natural_revival_anchor_calendar = save.world_calendar_day;
  applyStrength(save);
  return {
    delta: totalDelta,
    applied: true,
    notes: `long_time_skip ${requestedDays}d delta=${totalDelta}`,
    interrupted: false,
    requested_end_calendar: requestedEnd,
    actual_end_calendar: save.world_calendar_day,
    remaining_skip_days: 0,
    revival_degree: save.player_character.stats.revival_degree,
  };
}

