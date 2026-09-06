import { create } from "zustand";
import type { ActionType, ContentPack, PlayerSuspectedKind, SaveData } from "./engine/types";
import { DEFAULT_PACK } from "./packs/default-pack";
import { createSaveFromPack, validatePack, migrateSave } from "./engine/content-pack";
import { stripHiddenSave } from "./engine/visibility";
import { resolveAction } from "./engine/resolution";
import { localNarrate, type GmOutput } from "./engine/narrate-local";
import { askGm } from "./gm/narrate";
import { nowIso, uid } from "./utils";
import { rebuildVisible } from "./engine/knowledge";

const SAVE_KEY = "seal-room.save.v1";
const PACK_KEY = "seal-room.pack.v1";

export type AppView =
  | "start"
  | "play"
  | "sheet"
  | "npcs"
  | "archive"
  | "clues"
  | "event"
  | "gm"
  | "dice"
  | "pack";

interface AppState {
  view: AppView;
  pack: ContentPack;
  save: SaveData | null;
  busy: boolean;
  lastError: string | null;
  packIssues: string[];
  setView: (v: AppView) => void;
  newGame: (pack?: ContentPack) => void;
  loadLocal: () => boolean;
  persist: () => void;
  importPackJson: (text: string) => boolean;
  importSaveJson: (text: string) => boolean;
  exportSave: () => string;
  exportGmSave: () => string;
  exportPack: () => string;
  submitAction: (
    text: string,
    type?: ActionType,
    extra?: {
      target_id?: string;
      suspected_kind?: PlayerSuspectedKind | null;
      contained_item_id?: string;
      force_drive?: boolean;
      teammate_roles?: { character_id: string; role: string; strength?: number; mechanism_tags?: string[] }[];
    },
  ) => Promise<void>;
  toggleGm: () => void;
  moveTo: (locationId: string) => void;
}

function persistSave(save: SaveData | null) {
  if (!save) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* ignore quota */
  }
}

export const useApp = create<AppState>((set, get) => ({
  view: "start",
  pack: DEFAULT_PACK,
  save: null,
  busy: false,
  lastError: null,
  packIssues: [],

  setView: (view) => set({ view }),

  newGame: (pack) => {
    const p = pack ?? get().pack;
    const save = createSaveFromPack(p);
    const opening = localNarrate(save, "进入现场", {
      rule: { triggered: false, rule_text: "", lethal: false, medium: "", delayable: true },
      mechanism: { matched: true, tags_used: [], notes: "" },
      dice: null,
      hard_block: false,
      hard_block_reason: "",
      containment: { attempted: false, success: false, mode: "none", notes: "" },
      driving: { attempted: false, outcome: "none", notes: "" },
      cost: { level: "轻微", revival: 0, body: 0, anchor: 0, instability: 0 },
      state_changes: [],
      new_clues: [],
      revealed_fields: [],
      visible_risks: save.visible_context.visible_anomalies,
      available_actions: [
        "观察 17 层楼道，不敲门、不应声。",
        "先找管理员周晚问失踪住户。",
        "封锁楼层，驱散围观和拍摄。",
        "阅读现场档案。",
        "去仓库确认金棺封条是否还在。",
      ],
      gm_notes_hidden: save.hidden_context.truths.join(" | "),
    });
    const ev = save.events.find((e) => e.status === "active");
    save.turn_log = [
      {
        id: uid("turn"),
        turn: 0,
        actor: "gm",
        visible_text:
          opening.scene_result +
          (ev
            ? `\n\n当前事件：${ev.name}。危害等级 ${ev.hazard_grade}，失控度 ${ev.instability}。源头灵异强度另计，不在你此刻的权限页上。`
            : ""),
        hidden_text: save.hidden_context.truths.join("\n"),
        state_changes: [],
        new_clues: ev?.known_clues ?? [],
        visible_risks: opening.visible_risks,
        available_actions: opening.available_actions,
        at: nowIso(),
      },
    ];
    persistSave(save);
    set({ save, pack: p, view: "play", lastError: null });
  },

  loadLocal: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveData;
      if (!parsed?.player_character) return false;
      const { save, rejected } = migrateSave(parsed);
      if (rejected) {
        set({ lastError: rejected });
        return false;
      }
      rebuildVisible(save);
      set({ save, view: "play", lastError: null });
      return true;
    } catch {
      return false;
    }
  },

  persist: () => persistSave(get().save),

  importPackJson: (text) => {
    try {
      const parsed = JSON.parse(text);
      const result = validatePack(parsed);
      if (!result.ok) {
        set({ packIssues: result.issues.map((i) => `${i.path}: ${i.message}`) });
        return false;
      }
      try {
        localStorage.setItem(PACK_KEY, text);
      } catch {
        /* ignore */
      }
      set({ pack: result.pack, packIssues: [], lastError: null });
      return true;
    } catch {
      set({ packIssues: ["JSON 无法解析"] });
      return false;
    }
  },

  importSaveJson: (text) => {
    try {
      const parsed = JSON.parse(text) as SaveData;
      if (!parsed.player_character || !parsed.events) {
        set({ lastError: "存档缺少必要字段" });
        return false;
      }
      const { save, rejected } = migrateSave(parsed);
      if (rejected) {
        set({ lastError: rejected });
        return false;
      }
      rebuildVisible(save);
      persistSave(save);
      set({ save, view: "play", lastError: null });
      return true;
    } catch {
      set({ lastError: "存档 JSON 无法解析" });
      return false;
    }
  },

  exportSave: () => {
    const save = get().save;
    if (!save) return "{}";
    return JSON.stringify(stripHiddenSave(save), null, 2);
  },
  exportGmSave: () => JSON.stringify(get().save, null, 2),
  exportPack: () => JSON.stringify(get().pack, null, 2),

  toggleGm: () => {
    const save = get().save;
    if (!save) return;
    const next = { ...save, gm_mode: !save.gm_mode, updated_at: nowIso() };
    persistSave(next);
    set({ save: next });
  },

  moveTo: (locationId) => {
    const save = get().save;
    if (!save) return;
    const loc = save.locations.find((l) => l.id === locationId);
    if (!loc) return;
    save.current_location_id = locationId;
    rebuildVisible(save);
    save.turn_log = [
      ...save.turn_log,
      {
        id: uid("turn"),
        turn: save.turn,
        actor: "system",
        visible_text: `你前往 ${loc.name}。${loc.player_known_description}`,
        hidden_text: loc.gm_hidden_description,
        state_changes: [`地点 → ${loc.name}`],
        new_clues: [],
        visible_risks: loc.special_rules,
        available_actions: ["观察周围。", "检查是否有新的媒介。"],
        at: nowIso(),
      },
    ];
    persistSave(save);
    set({ save: { ...save } });
  },

  submitAction: async (text, type, extra) => {
    const save = get().save;
    if (!save || !text.trim() || get().busy) return;
    set({ busy: true, lastError: null });
    const snapshot: SaveData = JSON.parse(JSON.stringify(save)) as SaveData;
    const result = resolveAction(snapshot, {
      action_type: type ?? "other",
      action_text: text.trim(),
      target_id: extra?.target_id,
      suspected_kind: extra?.suspected_kind ?? null,
      contained_item_id: extra?.contained_item_id,
      force_drive: extra?.force_drive === true || type === "force_drive",
      teammate_roles: extra?.teammate_roles,
    });
    let output: GmOutput;
    try {
      const ai = await Promise.race([
        askGm({
          data: {
            action: text.trim(),
            visible: snapshot.visible_context,
            result,
          },
        }),
        new Promise<{ ok: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ ok: false, error: "timeout" }), 20000),
        ),
      ]);
      output = ai.ok ? ai.output : localNarrate(snapshot, text.trim(), result);
      if (!ai.ok) {
        output.scene_result =
          output.scene_result + "\n\n（规则引擎已结算。叙事层使用本地 GM。）";
      }
    } catch {
      output = localNarrate(snapshot, text.trim(), result);
    }
    snapshot.turn_log = [
      ...snapshot.turn_log,
      {
        id: uid("turn"),
        turn: snapshot.turn,
        actor: "player",
        visible_text: text.trim(),
        state_changes: [],
        new_clues: [],
        visible_risks: [],
        available_actions: [],
        at: nowIso(),
      },
      {
        id: uid("turn"),
        turn: snapshot.turn,
        actor: "gm",
        visible_text: output.scene_result,
        hidden_text: output.gm_notes_hidden || result.gm_notes_hidden,
        state_changes: output.state_changes.length ? output.state_changes : result.state_changes,
        new_clues: output.new_clues,
        visible_risks: output.visible_risks,
        available_actions: output.available_actions.length
          ? output.available_actions
          : result.available_actions,
        at: nowIso(),
      },
    ];
    persistSave(snapshot);
    set({ save: snapshot, busy: false, view: "play" });
  },
}));
