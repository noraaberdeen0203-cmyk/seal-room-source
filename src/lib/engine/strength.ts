import type { StrengthTier } from "./types.ts";

export const DEFAULT_TIERS: StrengthTier[] = [
  { tier_id: 0, min_strength: 0, max_strength: 49, label: "残留", description: "残影、未成型规律、几乎无法独立杀人。" },
  { tier_id: 1, min_strength: 50, max_strength: 199, label: "碎片", description: "局部规律成立，可在狭窄条件下伤人。" },
  { tier_id: 2, min_strength: 200, max_strength: 499, label: "成型", description: "完整杀人规律，可独立构成事件源头。" },
  { tier_id: 3, min_strength: 500, max_strength: 1199, label: "压制", description: "可覆盖普通成型灵异，具备稳定对抗窗口。" },
  { tier_id: 4, min_strength: 1200, max_strength: 2499, label: "断层", description: "层级开始出现明显断层，常规手段难以正面硬抗。" },
  { tier_id: 5, min_strength: 2500, max_strength: 4999, label: "区域", description: "可改写一片区域的规则优先级。" },
  { tier_id: 6, min_strength: 5000, max_strength: 7999, label: "异类门槛", description: "接近不再被普通人世界理解的层级。" },
  { tier_id: 7, min_strength: 8000, max_strength: 10000, label: "不可直视", description: "极少出现。正面对抗几乎没有意义。" },
];

export function tierOf(strength: number, tiers: StrengthTier[] = DEFAULT_TIERS): StrengthTier {
  const hit = tiers.find((t) => strength >= t.min_strength && strength <= t.max_strength);
  return hit ?? tiers[tiers.length - 1]!;
}

export function tierGapModifier(attacker: number, defender: number, tiers: StrengthTier[] = DEFAULT_TIERS): number {
  const a = tierOf(attacker, tiers).tier_id;
  const d = tierOf(defender, tiers).tier_id;
  const gap = a - d;
  if (gap >= 3) return 35;
  if (gap === 2) return 20;
  if (gap === 1) return 10;
  if (gap === 0) return 0;
  if (gap === -1) return -12;
  if (gap === -2) return -25;
  return -40;
}
