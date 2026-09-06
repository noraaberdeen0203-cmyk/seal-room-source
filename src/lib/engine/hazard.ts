import { clamp } from "../utils.ts";
import type { GameEvent, HazardGrade } from "./types.ts";

export function gradeFromScore(score: number): HazardGrade {
  if (score >= 7200) return "S";
  if (score >= 3800) return "A";
  if (score >= 1400) return "B";
  return "C";
}

export function recomputeHazard(event: GameEvent): GameEvent {
  const factorWeight: Record<string, number> = {
    杀人效率高: 900,
    触发条件宽: 1100,
    游荡: 700,
    扩散快: 1400,
    不可封锁: 1200,
    不可关押: 900,
    牵连其他厉鬼: 800,
    社会暴露: 1000,
    媒介传播: 1500,
    恐慌扩大媒介: 900,
    驭鬼者刺激源头: 600,
    固定不动: -800,
    条件苛刻: -900,
    可封锁: -700,
    可关押: -500,
  };
  let score = event.hazard_strength;
  for (const f of event.hazard_factors) {
    score += factorWeight[f] ?? 80;
  }
  score += event.instability * 18;
  score += event.social_exposure * 12;
  if (event.lockdown_status === "full") score -= 900;
  if (event.lockdown_status === "failed") score += 700;
  score = clamp(score, 0, 10000);
  return {
    ...event,
    hazard_strength: Math.round(score),
    hazard_grade: gradeFromScore(score),
  };
}

export function applyClock(event: GameEvent, reason: string): GameEvent {
  const rule = event.event_clock_rules.find((r) => reason.includes(r.condition) || r.condition === reason);
  const delta = rule?.instability_delta ?? (reason.includes("正确") || reason.includes("封锁成功") ? -8 : 6);
  const next = {
    ...event,
    instability: clamp(event.instability + delta, 0, 100),
  };
  return recomputeHazard(next);
}
