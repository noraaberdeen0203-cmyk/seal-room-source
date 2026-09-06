import type { RarePowerView } from "./rare-tags.ts";
import { consciousnessBand, isProtectiveConsciousnessFunction } from "./rare-tags.ts";

export function evaluateConsciousnessAttackGate(power: RarePowerView | undefined): {
  allowed: boolean;
  reason: string;
} {
  if (!power || !power.rare_tags.includes("consciousness")) {
    return { allowed: false, reason: "no_consciousness_tag" };
  }
  if (power.consciousness_function === "read_fragment" || power.consciousness_function === "brief_forget" || power.consciousness_function === "bias") {
    return { allowed: false, reason: "low_function_cannot_attack_core" };
  }
  if (power.consciousness_function === "attack_heteromorph_core" || consciousnessBand(power.max_strength) === "extreme") {
    return { allowed: true, reason: "core_attack_eligible" };
  }
  if (power.consciousness_function === "overwrite_personality" || power.consciousness_function === "transfer" || power.consciousness_function === "replace") {
    return { allowed: true, reason: "high_function" };
  }
  return { allowed: false, reason: "function_not_attack" };
}

export function consciousnessTagProtectsHeteromorph(power: RarePowerView | undefined): boolean {
  if (!power) return false;
  if (!power.rare_tags.includes("consciousness") && !power.rare_tags.includes("restart") && !power.rare_tags.includes("idealistic")) {
    return false;
  }
  return isProtectiveConsciousnessFunction(power.consciousness_function);
}
