import type { DiceLogEntry, DiceVisibility, ResultLevel, ActionType } from "./types.ts";
import { uid, nowIso } from "../utils.ts";

export function rollD100(): number {
  return 1 + Math.floor(Math.random() * 100);
}

export function classifyMargin(margin: number, roll: number): ResultLevel {
  if (roll === 1) return "extreme_success";
  if (roll === 100) return "extreme_fail";
  if (margin >= 40) return "great_success";
  if (margin >= 10) return "success";
  if (margin >= 0) return "narrow_success";
  if (margin >= -20) return "fail_with_info";
  if (margin >= -50) return "severe_fail";
  return "catastrophe";
}

export const RESULT_LABEL: Record<ResultLevel, string> = {
  extreme_success: "极端成功",
  great_success: "大成功",
  success: "成功",
  narrow_success: "险胜",
  fail_with_info: "失败但获得信息",
  severe_fail: "严重失败",
  catastrophe: "灾难失败",
  extreme_fail: "极端失败",
};

export function resolveDice(params: {
  target: number;
  visibility: DiceVisibility;
  action_type: ActionType;
  action_text: string;
  turn: number;
  forced_roll?: number;
}): DiceLogEntry {
  const roll = params.forced_roll ?? rollD100();
  const margin = params.target - roll;
  const level = classifyMargin(margin, roll);
  return {
    id: uid("dice"),
    turn: params.turn,
    visibility: params.visibility,
    action_type: params.action_type,
    action_text: params.action_text,
    target_value: params.target,
    roll,
    margin,
    level,
    notes: `目标 ${params.target} / 骰面 ${roll} / 差值 ${margin}`,
    at: nowIso(),
  };
}

export function isSuccess(level: ResultLevel): boolean {
  return (
    level === "extreme_success" ||
    level === "great_success" ||
    level === "success" ||
    level === "narrow_success"
  );
}
