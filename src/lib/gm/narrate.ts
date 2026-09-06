import { createServerFn } from "@tanstack/react-start";
import type { GmOutput } from "../engine/narrate-local";
import type { ResolutionResult, VisibleContext } from "../engine/types";
import { visibleResolution } from "../engine/visibility";

export const askGm = createServerFn({ method: "POST" })
  .validator((input: {
    action: string;
    visible: VisibleContext;
    result: ResolutionResult;
    styleHint?: string;
  }) => input)
  .handler(async ({ data }): Promise<{ ok: true; output: GmOutput } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "AI is not available" };

    const system = [
      "你是《隔绝室》的规则向 GM。文风冷峻、克制、短句，不煽情，不写成打怪升级。",
      "只根据玩家可见信息叙述。禁止输出隐藏真相、NPC 隐藏动机、完整厉鬼规律、源头真实身份。",
      "可以暗示异常，但不能明示未揭示内容。",
      "灵异规律优先于骰子。若规则引擎标记规律已触发或机制不匹配，不得用剧情让行动直接成功。",
      "不得把危害等级写成源头战斗力。",
      "成功也要写代价。失败要留下线索或窗口，不要直接宣布游戏结束。",
      "只输出 JSON，键为 scene_result, state_changes, new_clues, visible_risks, available_actions, gm_notes_hidden。",
      "scene_result 用中文，分段，200-450 字。",
    ].join("\n");

    const user = JSON.stringify(
      {
        action: data.action,
        visible_context: data.visible,
        resolution: visibleResolution(data.result),
      },
      null,
      2,
    );

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.6,
          max_tokens: 900,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(18000),
      });
      if (!res.ok) return { ok: false, error: `xAI API error ${res.status}` };
      const body = (await res.json()) as { choices: { message: { content: string } }[] };
      const text = body.choices[0]?.message.content ?? "";
      const parsed = extractJson(text);
      if (!parsed) return { ok: false, error: "AI 输出无法解析" };
      return { ok: true, output: parsed };
    } catch {
      return { ok: false, error: "AI 请求失败" };
    }
  });

function extractJson(text: string): GmOutput | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as GmOutput;
    if (typeof obj.scene_result !== "string") return null;
    return {
      scene_result: obj.scene_result,
      state_changes: arr(obj.state_changes),
      new_clues: arr(obj.new_clues),
      visible_risks: arr(obj.visible_risks),
      available_actions: arr(obj.available_actions),
      gm_notes_hidden: String(obj.gm_notes_hidden ?? ""),
    };
  } catch {
    return null;
  }
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}
