import type { ContentPack, SaveData } from "./types.ts";
import { uid, nowIso } from "../utils.ts";
import { DEFAULT_TIERS } from "./strength.ts";
import { recomputeHazard } from "./hazard.ts";
import { rebuildVisible } from "./knowledge.ts";
import { emptyBalance } from "./balance.ts";
import { DEFAULT_PACK } from "../packs/default-pack.ts";

export function migrateSave(save: SaveData): { save: SaveData; migrated: boolean; rejected?: string } {
  let migrated = false;
  if (!save.player_character) return { save, migrated: false, rejected: "缺少玩家角色，存档不兼容。" };
  if (!save.ghosts) {
    save.ghosts = structuredClone(DEFAULT_PACK.ghosts ?? []);
    migrated = true;
  }
  if (!save.special_inventory) {
    save.special_inventory = [];
    migrated = true;
  }
  if (!save.balance) {
    save.balance = emptyBalance();
    migrated = true;
  }
  if (!save.scene_targets) {
    save.scene_targets = structuredClone(DEFAULT_PACK.scene_targets ?? []);
    migrated = true;
  }
  if (!save.action_transactions) {
    save.action_transactions = [];
    migrated = true;
  }
  if (save.player_character.deadlock_state == null) {
    save.player_character.deadlock_state = "none";
    save.player_character.supernatural_transition_state = save.player_character.supernatural_transition_state ?? "normal_controller";
    save.player_character.human_memory_exists = save.player_character.human_memory_exists ?? true;
    migrated = true;
  }
  return { save, migrated };
}

export interface PackIssue {
  path: string;
  message: string;
}

export function validatePack(raw: unknown): { ok: true; pack: ContentPack } | { ok: false; issues: PackIssue[] } {
  const issues: PackIssue[] = [];
  if (!raw || typeof raw !== "object") return { ok: false, issues: [{ path: "$", message: "根节点必须是对象" }] };
  const p = raw as Partial<ContentPack>;
  if (!p.pack_id) issues.push({ path: "pack_id", message: "缺少 pack_id" });
  if (!p.pack_name) issues.push({ path: "pack_name", message: "缺少 pack_name" });
  const arrays: (keyof ContentPack)[] = [
    "characters",
    "powers",
    "items",
    "events",
    "locations",
    "organizations",
  ];
  for (const key of arrays) {
    const v = p[key];
    if (v !== undefined && !Array.isArray(v)) issues.push({ path: String(key), message: "必须是数组" });
  }
  const chars = p.characters ?? [];
  if (!chars.some((c) => c.type === "player_character")) {
    issues.push({ path: "characters", message: "至少需要一个 type=player_character 的角色" });
  }
  chars.forEach((c, i) => {
    if (!c.id) issues.push({ path: `characters[${i}].id`, message: "缺少 id" });
    if (!c.stats) issues.push({ path: `characters[${i}].stats`, message: "缺少 stats" });
  });
  (p.events ?? []).forEach((e, i) => {
    if (!e.id) issues.push({ path: `events[${i}].id`, message: "缺少 id" });
    if (e.source_strength != null && e.hazard_strength != null && e.source_strength === e.hazard_strength) {
      // not an error — just a smell we allow
    }
  });
  if (issues.length) return { ok: false, issues };
  const pack: ContentPack = {
    pack_id: p.pack_id!,
    pack_name: p.pack_name!,
    version: p.version ?? "0.1.0",
    description: p.description ?? "",
    characters: p.characters ?? [],
    powers: p.powers ?? [],
    items: p.items ?? [],
    events: p.events ?? [],
    locations: p.locations ?? [],
    organizations: p.organizations ?? [],
    plot_hooks: p.plot_hooks ?? [],
    reveal_conditions: p.reveal_conditions ?? [],
    strength_tiers: p.strength_tiers?.length ? p.strength_tiers : DEFAULT_TIERS,
    validation_rules: p.validation_rules ?? [],
    ghosts: p.ghosts ?? [],
    scene_targets: p.scene_targets ?? [],
  };
  return { ok: true, pack };
}

export function createSaveFromPack(pack: ContentPack): SaveData {
  const player = pack.characters.find((c) => c.type === "player_character");
  if (!player) throw new Error("内容包缺少玩家角色");
  const startLoc =
    pack.locations.find((l) => player.common_locations.includes(l.id)) ?? pack.locations[0];
  const save: SaveData = {
    save_id: uid("save"),
    created_at: nowIso(),
    updated_at: nowIso(),
    pack_id: pack.pack_id,
    current_stage_id: "opening",
    current_location_id: startLoc?.id ?? "unknown",
    turn: 1,
    player_character_id: player.id,
    player_character: structuredClone(player),
    characters: structuredClone(pack.characters),
    powers: structuredClone(pack.powers),
    items: structuredClone(pack.items),
    events: structuredClone(pack.events).map(recomputeHazard),
    locations: structuredClone(pack.locations),
    organizations: structuredClone(pack.organizations),
    reveal_conditions: structuredClone(pack.reveal_conditions),
    strength_tiers: pack.strength_tiers.length ? pack.strength_tiers : DEFAULT_TIERS,
    visible_context: {
      location_id: startLoc?.id ?? "",
      location_name: startLoc?.name ?? "",
      location_description: startLoc?.player_known_description ?? "",
      known_npcs: [],
      self_status: player.current_status,
      known_items: [],
      clues: [],
      confirmed_rules: [],
      suspected_rules: [],
      visible_anomalies: [],
    },
    hidden_context: {
      truths: [],
      npc_motives: [],
      event_sources: [],
      upcoming_clocks: [],
      hidden_abnormalities: [],
    },
    knowledge_log: [],
    dice_log: [],
    turn_log: [],
    gm_mode: false,
    difficulty: "standard",
    world_calendar_day: 0,
    natural_revival_anchor_calendar: 0,
    ghosts: structuredClone(pack.ghosts ?? []),
    ghost_relations: [],
    balance: emptyBalance(),
    special_inventory: [],
    scene_targets: structuredClone(pack.scene_targets ?? []),
  };
  rebuildVisible(save);
  return save;
}
