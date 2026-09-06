import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import type { ActionType, PlayerSuspectedKind } from "@/lib/engine/types";
import { visibleSceneTargets } from "@/lib/engine/ghost";
import { playerFacingContained } from "@/lib/engine/special-inventory";
import { publicBalanceLabel } from "@/lib/engine/visibility";
import { RESULT_LABEL } from "@/lib/engine/dice";
import { Button, Chip, Meter, Panel, Textarea } from "./ui";

const TYPES: { id: ActionType; label: string }[] = [
  { id: "observe", label: "观察" },
  { id: "lockdown", label: "封锁" },
  { id: "evade", label: "逃离" },
  { id: "use_power", label: "动用灵异" },
  { id: "contain", label: "关押" },
  { id: "drive_or_bind", label: "驾驭" },
  { id: "force_drive", label: "强行驾驭" },
  { id: "social", label: "交涉" },
  { id: "other", label: "其他" },
];

export function PlayView() {
  const { save, busy, submitAction, moveTo } = useApp();
  const [text, setText] = useState("");
  const [type, setType] = useState<ActionType>("observe");
  const [targetId, setTargetId] = useState("");
  const [guess, setGuess] = useState<PlayerSuspectedKind | "">("");
  const [allyRole, setAllyRole] = useState<"inactive" | "direct_source_suppression" | "evacuate">("inactive");
  const logRef = useRef<HTMLDivElement>(null);
  const lastGm = useMemo(
    () => [...(save?.turn_log ?? [])].reverse().find((t) => t.actor === "gm"),
    [save],
  );
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [save?.turn_log.length]);
  if (!save) return null;
  const pc = save.player_character;
  const ev = save.events.find((e) => e.status === "active");
  const lastDice = [...save.dice_log].reverse().find((d) => d.visibility === "public");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <div ref={logRef} className="max-h-[52vh] space-y-4 overflow-y-auto rounded-lg border border-line bg-surface p-5">
          {save.turn_log.map((t) => (
            <article key={t.id} className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] tracking-wide text-subtle">
                <span>{t.actor === "player" ? "行动" : t.actor === "gm" ? "现场" : "系统"}</span>
                <span className="tabular">#{t.turn}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{t.visible_text}</p>
              {t.state_changes.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {t.state_changes.map((s) => (
                    <Chip key={s}>{s}</Chip>
                  ))}
                </div>
              ) : null}
              {t.new_clues.length ? (
                <ul className="space-y-1 text-sm text-muted">
                  {t.new_clues.map((c) => (
                    <li key={c}>线索 · {c}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>

        {lastDice ? (
          <Panel className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="text-subtle">D100</span>
            <span className="tabular text-lg">{lastDice.roll}</span>
            <span className="text-muted">目标 {lastDice.target_value}</span>
            <span className="text-muted">差值 {lastDice.margin}</span>
            <Chip tone={lastDice.margin >= 0 ? "ok" : "danger"}>{RESULT_LABEL[lastDice.level]}</Chip>
          </Panel>
        ) : null}

        <Panel className="space-y-3 p-4">
          <div className="flex flex-wrap gap-1">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={
                  type === t.id
                    ? "rounded-md bg-raised px-3 py-2 text-xs text-fg"
                    : "rounded-md px-3 py-2 text-xs text-muted"
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="写下你要做的事。关押请选可见目标，不要选类型。"
          />
          <label className="block text-[11px] tracking-wide text-subtle">可见目标（不是类型）</label>
          <select
            className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">—— 不指定 ——</option>
            {visibleSceneTargets(save.scene_targets, save.current_location_id).map((t) => (
              <option key={t.id} value={t.id}>
                {t.visible_name}
              </option>
            ))}
          </select>
          <label className="block text-[11px] tracking-wide text-subtle">你的判断（可选，不参与关押成功判定）</label>
          <select
            className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm"
            value={guess}
            onChange={(e) => setGuess(e.target.value as PlayerSuspectedKind | "")}
          >
            <option value="">—— 不记录判断 ——</option>
            <option value="source_entity">我认为是源头</option>
            <option value="medium">我认为是媒介</option>
            <option value="projection">我认为是投影</option>
            <option value="ghost_slave">我认为是鬼奴</option>
            <option value="phenomenon">我认为是灵异现象</option>
            <option value="unknown">我不确定</option>
          </select>
          <label className="block text-[11px] tracking-wide text-subtle">本轮队友分工</label>
          <select
            className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm"
            value={allyRole}
            onChange={(e) => setAllyRole(e.target.value as typeof allyRole)}
          >
            <option value="inactive">林澄不参与压制</option>
            <option value="direct_source_suppression">林澄参与同一源头压制</option>
            <option value="evacuate">林澄只疏散/封锁</option>
          </select>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !text.trim()}
              onClick={() => {
                void submitAction(text, type, {
                  target_id: targetId || undefined,
                  suspected_kind: guess || null,
                  force_drive: type === "force_drive",
                  teammate_roles:
                    allyRole === "inactive"
                      ? []
                      : [{ character_id: "npc_lin", role: allyRole, strength: allyRole === "direct_source_suppression" ? 200 : 0 }],
                });
                setText("");
              }}
            >
              {busy ? "结算中" : "提交行动"}
            </Button>
          </div>
          {lastGm?.available_actions?.length ? (
            <div className="flex flex-wrap gap-2">
              {lastGm.available_actions.map((a) => (
                <button
                  key={a}
                  type="button"
                  className="rounded-md border border-line px-3 py-2 text-left text-xs text-muted hover:text-fg"
                  onClick={() => setText(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          ) : null}
        </Panel>
      </div>

      <aside className="space-y-4">
        <Panel className="space-y-3 p-4">
          <div className="text-xs text-subtle">处理员</div>
          <div className="font-display text-lg">{pc.display_name}</div>
          <p className="text-xs text-muted">{pc.current_status}</p>
          <Meter label="复苏度" value={pc.stats.revival_degree} tone={pc.stats.revival_degree > 70 ? "danger" : "warn"} />
          <Meter label="身体" value={pc.stats.body} tone={pc.stats.body < 40 ? "danger" : "ok"} />
          <Meter label="意识锚点" value={pc.stats.anchor} tone={pc.stats.anchor < 40 ? "danger" : "ok"} />
          <Meter label="掌控度" value={pc.stats.control} />
          <div className="flex justify-between text-xs text-muted">
            <span>灵异强度 {pc.stats.effective_strength}</span>
            <span>解析 {pc.stats.analysis_base}</span>
          </div>
        </Panel>

        {ev ? (
          <Panel className="space-y-2 p-4">
            <div className="text-xs text-subtle">当前事件</div>
            <div className="text-sm">{ev.name}</div>
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="danger">危害 {ev.hazard_grade}</Chip>
              <Chip>失控 {ev.instability}</Chip>
              {save.gm_mode ? <Chip>源头强度 {ev.source_strength ?? "?"}</Chip> : <Chip>源头强度 未授权</Chip>}
            </div>
            <p className="text-xs text-muted">危害强度 {ev.hazard_strength} · 与源头强度分开计算</p>
          </Panel>
        ) : null}

        <Panel className="space-y-2 p-4">
          <div className="text-xs text-subtle">地点</div>
          <div className="flex flex-col gap-1">
            {save.locations
              .filter((l) => l.visibility !== "hidden")
              .map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => moveTo(l.id)}
                  className={
                    l.id === save.current_location_id
                      ? "rounded-md bg-raised px-3 py-2 text-left text-xs"
                      : "rounded-md px-3 py-2 text-left text-xs text-muted hover:text-fg"
                  }
                >
                  {l.name}
                </button>
              ))}
          </div>
        </Panel>

        {(save.special_inventory ?? []).length ? (
          <Panel className="space-y-2 p-4">
            <div className="text-xs text-subtle">关押物</div>
            {(save.special_inventory ?? []).map((it) => {
              const face = playerFacingContained(it);
              return (
                <div key={it.item_id} className="border-t border-line pt-2 text-xs">
                  <div>{face.name}</div>
                  <div className="text-muted">完整度 {face.integrity} · 泄漏 {face.leakage_risk}</div>
                  {face.is_driveable ? (
                    <button
                      type="button"
                      className="mt-1 text-accent"
                      onClick={() =>
                        void submitAction("尝试驾驭关押物", "drive_or_bind", {
                          contained_item_id: it.item_id,
                        })
                      }
                    >
                      是否尝试驾驭
                    </button>
                  ) : (
                    <div className="text-muted">普通驾驭不可用</div>
                  )}
                  <button
                    type="button"
                    className="mt-1 block text-danger"
                    onClick={() =>
                      void submitAction("强行驾驭", "force_drive", {
                        contained_item_id: it.item_id,
                      })
                    }
                  >
                    强行驾驭（高危）
                  </button>
                </div>
              );
            })}
          </Panel>
        ) : null}

        {save.balance && save.balance.state !== "no_balance" ? (
          <Panel className="space-y-1 p-4 text-xs">
            <div className="text-subtle">体内结构（可见结论）</div>
            <div>{publicBalanceLabel(save.balance.state)}</div>
            <div className="text-muted">稳定 {save.balance.stability}</div>
          </Panel>
        ) : null}
      </aside>
    </div>
  );
}
