import { useApp } from "@/lib/store";
import { RESULT_LABEL } from "@/lib/engine/dice";
import { tierOf } from "@/lib/engine/strength";
import { Button, Chip, Meter, Panel } from "./ui";

export function SheetPanel() {
  const save = useApp((s) => s.save);
  if (!save) return null;
  const pc = save.player_character;
  const powers = save.powers.filter((p) => pc.powers.includes(p.id));
  const items = save.items.filter((i) => pc.items.includes(i.id));
  const tier = tierOf(pc.stats.effective_strength, save.strength_tiers);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel className="space-y-4 p-5">
        <div>
          <div className="text-xs text-subtle">{pc.role}</div>
          <h2 className="font-display text-2xl">{pc.display_name}</h2>
          <p className="mt-2 text-sm text-muted">{pc.appearance.public_description}</p>
        </div>
        <p className="text-sm">{pc.current_status}</p>
        <p className="text-sm text-muted">{pc.background.player_known}</p>
        <div className="grid gap-3">
          <Meter label="复苏度" value={pc.stats.revival_degree} tone="warn" />
          <Meter label="身体" value={pc.stats.body} tone="ok" />
          <Meter label="意识锚点" value={pc.stats.anchor} />
          <Meter label="掌控度" value={pc.stats.control} />
          <Meter label="规律解析基础" value={pc.stats.analysis_base} />
        </div>
        <div className="text-sm text-muted">
          基础灵异强度 {pc.stats.supernatural_strength} · 实战压制力 {pc.stats.effective_strength} · 阶位{" "}
          {tier.label}
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel className="space-y-3 p-5">
          <h3 className="text-sm">驾驭灵异</h3>
          {powers.map((p) => (
            <div key={p.id} className="space-y-1 border-t border-line pt-3">
              <div className="flex justify-between gap-2 text-sm">
                <span>{p.name}</span>
                <span className="text-muted">强度 {p.base_strength}</span>
              </div>
              <p className="text-xs text-muted">{p.known_effects.join(" ")}</p>
              <div className="flex flex-wrap gap-1">
                {p.mechanism_tags.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
              <p className="text-xs text-subtle">
                叠加 {p.stacking.current_stack_layers}/{p.stacking.stacking_cap} · 效率{" "}
                {p.stacking.stacking_efficiency}
              </p>
            </div>
          ))}
        </Panel>
        <Panel className="space-y-3 p-5">
          <h3 className="text-sm">关押物</h3>
          {(save.special_inventory ?? []).length === 0 ? (
            <p className="text-xs text-muted">还没有成功关押的源头。</p>
          ) : (
            (save.special_inventory ?? []).map((i) => (
              <div key={i.item_id} className="border-t border-line pt-3 text-sm">
                <div>{i.name}</div>
                <p className="text-xs text-muted">
                  完整度 {i.container.containment_integrity} · 可交易 {i.is_tradeable ? "是" : "否"} · 可驾驭{" "}
                  {i.is_driveable ? "是" : "否"}
                </p>
                <p className="text-xs text-subtle">{i.known_properties.join(" ")}</p>
              </div>
            ))
          )}
        </Panel>
        <Panel className="space-y-3 p-5">
          <h3 className="text-sm">持有物</h3>
          {items.map((i) => (
            <div key={i.id} className="border-t border-line pt-3">
              <div className="text-sm">
                {i.name} <span className="text-subtle">{i.state}</span>
              </div>
              <p className="text-xs text-muted">{i.known_usage}</p>
              <p className="text-xs text-subtle">{i.risk}</p>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

export function NpcPanel() {
  const save = useApp((s) => s.save);
  const gm = save?.gm_mode;
  if (!save) return null;
  const list = save.characters.filter((c) => c.type !== "player_character" && (gm || c.visibility !== "hidden"));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map((c) => (
        <Panel key={c.id} className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm">{c.visibility === "hidden" && !gm ? "？" : c.display_name || c.name}</div>
              <div className="text-xs text-subtle">{c.role}</div>
            </div>
            <Chip>{c.visibility}</Chip>
          </div>
          <p className="text-xs text-muted">{c.appearance.public_description || c.current_status}</p>
          <p className="text-xs">{c.background.player_known}</p>
          {gm ? (
            <p className="text-xs text-warn">GM · {c.background.gm_hidden}</p>
          ) : null}
        </Panel>
      ))}
    </div>
  );
}

export function CluePanel() {
  const save = useApp((s) => s.save);
  if (!save) return null;
  const groups = {
    confirmed_rule: "已确认规律",
    suspected_rule: "疑似规律",
    false_assumption: "可能的误判",
    known_npc_fact: "人物",
    known_item_effect: "物品",
    known_location_fact: "地点",
    rumor: "传闻",
  } as const;
  return (
    <div className="space-y-4">
      {save.events.map((e) => (
        <Panel key={e.id} className="space-y-2 p-4">
          <div className="text-sm">{e.name}</div>
          <div className="text-xs text-muted">已确认</div>
          <ul className="list-disc pl-4 text-sm">
            {e.known_rules.length ? e.known_rules.map((r) => <li key={r}>{r}</li>) : <li>尚无确认规律</li>}
          </ul>
          <div className="text-xs text-muted">疑似</div>
          <ul className="list-disc pl-4 text-sm text-muted">
            {e.suspected_rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="text-xs text-muted">可能的误判</div>
          <ul className="list-disc pl-4 text-sm text-subtle">
            {e.false_assumptions.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Panel>
      ))}
      <Panel className="space-y-3 p-4">
        <div className="text-sm">线索日志</div>
        {save.knowledge_log.length === 0 ? (
          <p className="text-sm text-muted">还没有新的确认信息。观察、失败和正确的封锁都会留下东西。</p>
        ) : (
          save.knowledge_log
            .filter((k) => k.type !== "hidden_truth" || save.gm_mode)
            .map((k) => (
              <div key={k.id} className="border-t border-line pt-3">
                <div className="text-xs text-subtle">{groups[k.type as keyof typeof groups] ?? k.type}</div>
                <div className="text-sm">{k.title}</div>
                <p className="text-sm text-muted">{k.body}</p>
              </div>
            ))
        )}
      </Panel>
    </div>
  );
}

export function EventPanel() {
  const save = useApp((s) => s.save);
  if (!save) return null;
  return (
    <div className="space-y-4">
      {save.events.map((e) => (
        <Panel key={e.id} className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl">{e.name}</h2>
            <div className="flex gap-1.5">
              <Chip tone="danger">危害 {e.hazard_grade}</Chip>
              <Chip>{e.status}</Chip>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted">{e.visible_description}</p>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <div className="text-xs text-subtle">源头灵异强度</div>
              <div className="tabular">{e.source_strength ?? "未知"}</div>
            </div>
            <div>
              <div className="text-xs text-subtle">事件危害强度</div>
              <div className="tabular">{e.hazard_strength}</div>
            </div>
            <div>
              <div className="text-xs text-subtle">失控度</div>
              <div className="tabular">{e.instability}</div>
            </div>
          </div>
          <p className="text-xs text-subtle">这两列必须分开读。高强度可以是低危害，低强度也可以是高危害。</p>
          <div className="text-xs text-muted">
            封锁 {e.lockdown_status} · 关押 {e.containment_status} · 社会暴露 {e.social_exposure}
          </div>
          <div className="flex flex-wrap gap-1">
            {e.hazard_factors.map((f) => (
              <Chip key={f}>{f}</Chip>
            ))}
          </div>
          {save.gm_mode ? (
            <div className="space-y-1 rounded-md border border-line p-3 text-xs text-warn">
              <div>GM 真相</div>
              <p>{e.hidden_truth}</p>
              <p>现实状态：{e.source_reality_status}</p>
              {e.hidden_rules.map((r) => (
                <p key={r}>{r}</p>
              ))}
            </div>
          ) : null}
        </Panel>
      ))}
    </div>
  );
}

export function DicePanel() {
  const save = useApp((s) => s.save);
  if (!save) return null;
  const rows = save.gm_mode ? save.dice_log : save.dice_log.filter((d) => d.visibility === "public");
  return (
    <Panel className="overflow-x-auto p-4">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="text-xs text-subtle">
          <tr>
            <th className="py-2">回合</th>
            <th>可见</th>
            <th>行动</th>
            <th>目标</th>
            <th>骰面</th>
            <th>差值</th>
            <th>结果</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-6 text-muted">
                还没有骰。提交行动后会出现明骰。
              </td>
            </tr>
          ) : (
            rows.map((d) => (
              <tr key={d.id} className="border-t border-line">
                <td className="py-2 tabular">{d.turn}</td>
                <td>{d.visibility === "public" ? "明" : "暗"}</td>
                <td className="max-w-48 truncate">{d.action_text}</td>
                <td className="tabular">{d.target_value}</td>
                <td className="tabular">{d.roll}</td>
                <td className="tabular">{d.margin}</td>
                <td>{RESULT_LABEL[d.level]}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Panel>
  );
}

export function GmPanel() {
  const { save, toggleGm } = useApp();
  if (!save) return null;
  return (
    <div className="space-y-4">
      <Panel className="flex items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm">GM 权限</div>
          <p className="text-xs text-muted">打开后显示隐藏真相与暗骰。玩家界面默认关闭。</p>
        </div>
        <Button variant={save.gm_mode ? "danger" : "line"} onClick={toggleGm}>
          {save.gm_mode ? "关闭 GM" : "打开 GM"}
        </Button>
      </Panel>
      {!save.gm_mode ? (
        <p className="text-sm text-muted">隐藏层未解锁。</p>
      ) : (
        <>
          <Panel className="space-y-2 p-4 text-sm">
            <div>隐藏真相</div>
            {save.hidden_context.truths.map((t) => (
              <p key={t} className="text-muted">
                {t}
              </p>
            ))}
          </Panel>
          <Panel className="space-y-2 p-4 text-sm">
            <div>NPC 动机</div>
            {save.hidden_context.npc_motives.map((t) => (
              <p key={t} className="text-muted">
                {t}
              </p>
            ))}
          </Panel>
          <Panel className="space-y-2 p-4 text-sm">
            <div>事件时钟</div>
            {save.hidden_context.upcoming_clocks.map((t) => (
              <p key={t} className="text-muted">
                {t}
              </p>
            ))}
          </Panel>
          <Panel className="space-y-2 p-4 text-sm">
            <div>最近主持备注</div>
            {[...save.turn_log]
              .reverse()
              .filter((t) => t.hidden_text)
              .slice(0, 6)
              .map((t) => (
                <p key={t.id} className="text-xs text-warn">
                  #{t.turn} {t.hidden_text}
                </p>
              ))}
          </Panel>
          <Panel className="space-y-3 p-4 text-sm">
            <div>厉鬼实体（隐藏层）</div>
            {(save.ghosts ?? []).map((g) => (
              <div key={g.ghost_id} className="space-y-1 border-t border-line pt-2 text-xs text-muted">
                <div className="text-fg">
                  {g.display_name} · {g.true_entity_kind}
                </div>
                <div>
                  max {g.strength_profile.max_strength} / current {g.strength_profile.current_strength} /
                  ctrl {g.strength_profile.controlled_strength} / unctrl {g.strength_profile.uncontrolled_strength} /
                  atk {g.strength_profile.attack_strength}
                </div>
                <div>
                  袭击 {g.attack_state.is_attacking ? "是" : "否"} · {g.attack_state.attack_intent_source} · 规律{" "}
                  {g.killing_rules.map((r) => `${r.rule_id}:${r.stage}`).join(" ") || "无"}
                </div>
                <div>
                  死机 {g.revival_profile.deadlock_status} · 宿主 {g.host_character_id ?? "无"}
                </div>
              </div>
            ))}
            <div className="pt-2">
              平衡 {save.balance?.state ?? "no_balance"} · {save.balance?.last_state_transition_reason}
            </div>
            {save.last_containment ? (
              <div>上次关押隐藏：{save.last_containment.hidden_result_text}</div>
            ) : null}
          </Panel>
        </>
      )}
    </div>
  );
}

export function ArchivePanel() {
  const save = useApp((s) => s.save);
  if (!save) return null;
  const powers = save.powers.filter((p) => p.owner_id === save.player_character.id || save.gm_mode);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel className="space-y-3 p-4">
        <h3 className="text-sm">灵异</h3>
        {powers.map((p) => (
          <div key={p.id} className="border-t border-line pt-3 text-sm">
            <div>
              {p.name} · {p.base_strength}
            </div>
            <p className="text-xs text-muted">{p.known_effects.join(" ")}</p>
            {save.gm_mode ? <p className="text-xs text-warn">{p.hidden_effects.join(" ")}</p> : null}
          </div>
        ))}
      </Panel>
      <Panel className="space-y-3 p-4">
        <h3 className="text-sm">物品</h3>
        {save.items
          .filter((i) => i.visibility !== "hidden" || save.gm_mode)
          .map((i) => (
            <div key={i.id} className="border-t border-line pt-3 text-sm">
              <div>{i.name}</div>
              <p className="text-xs text-muted">{i.known_usage}</p>
              {save.gm_mode ? <p className="text-xs text-warn">{i.hidden_usage}</p> : null}
            </div>
          ))}
      </Panel>
    </div>
  );
}

export function PackPanel() {
  const { pack, exportPack, exportSave, importPackJson, packIssues } = useApp();
  return (
    <div className="space-y-4">
      <Panel className="space-y-2 p-5">
        <h2 className="font-display text-xl">{pack.pack_name}</h2>
        <p className="text-sm text-muted">{pack.description}</p>
        <p className="text-xs text-subtle">
          {pack.characters.length} 角色 · {pack.events.length} 事件 · {pack.items.length} 物品
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="line"
            onClick={() => download("seal-room-pack.json", exportPack())}
          >
            导出内容包
          </Button>
          <Button variant="line" onClick={() => download("seal-room-save.json", exportSave())}>
            导出存档
          </Button>
        </div>
      </Panel>
      <Panel className="space-y-3 p-5">
        <h3 className="text-sm">粘贴 JSON 覆盖内容包</h3>
        <textarea
          className="min-h-40 w-full rounded-md border border-line bg-raised p-3 font-mono text-xs"
          placeholder="在此粘贴内容包 JSON，失焦时校验。"
          onBlur={(e) => {
            if (e.target.value.trim()) importPackJson(e.target.value);
          }}
        />
        {packIssues.map((i) => (
          <p key={i} className="text-xs text-danger">
            {i}
          </p>
        ))}
      </Panel>
    </div>
  );
}

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
