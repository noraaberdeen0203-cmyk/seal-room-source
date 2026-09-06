import type { ResolutionResult, SaveData } from "./types";
import { RESULT_LABEL } from "./dice";

export interface GmOutput {
  scene_result: string;
  state_changes: string[];
  new_clues: string[];
  visible_risks: string[];
  available_actions: string[];
  gm_notes_hidden: string;
}

export function localNarrate(save: SaveData, action: string, result: ResolutionResult): GmOutput {
  const loc = save.visible_context;
  const ev = save.events.find((e) => e.status === "active") ?? save.events[0];
  const diceLine = result.dice
    ? `明骰 D100=${result.dice.roll}，目标 ${result.dice.target_value}，${RESULT_LABEL[result.dice.level]}。`
    : "本轮没有有效骰，因为硬规则先于判定成立。";

  const parts: string[] = [];
  parts.push(`${loc.location_name}。${loc.location_description}`);
  parts.push(`你尝试：${action}`);
  if (result.rule.triggered) {
    parts.push(`先结算规律。与「${result.rule.medium}」有关的条件似乎被你碰到了。骰子不能把已经碰上的媒介说成没碰上。`);
  }
  if (!result.mechanism.matched) {
    parts.push(result.mechanism.notes);
  }
  if (result.hard_block) {
    parts.push(result.hard_block_reason);
  }
  parts.push(diceLine);
  if (result.containment.attempted) {
    parts.push(result.containment.notes);
  }
  if (result.driving.attempted) {
    parts.push(`${result.driving.outcome}。${result.driving.notes}`);
  }
  if (ev) {
    parts.push(
      `事件「${ev.name}」目前危害 ${ev.hazard_grade}（危害强度 ${ev.hazard_strength}），源头灵异强度是另一回事，此刻你并不能把它读成同一数字。失控度 ${ev.instability}。`,
    );
  }
  parts.push("现场仍然冷。能确定的只有你刚刚付出的那一点代价，以及还没写全的线索。");

  return {
    scene_result: parts.join("\n\n"),
    state_changes: result.state_changes,
    new_clues: result.new_clues.map((c) => `${c.title}：${c.body}`),
    visible_risks: result.visible_risks,
    available_actions: result.available_actions,
    gm_notes_hidden: result.gm_notes_hidden,
  };
}
