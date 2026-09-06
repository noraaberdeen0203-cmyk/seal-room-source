import { uid } from "../utils.ts";
import type { ContainedGhostItem, GhostEntity } from "./types.ts";

export function createContainedGhostItem(ghost: GhostEntity, containerType: "gold" | "custom" = "gold"): ContainedGhostItem {
  return {
    item_id: uid("cgi"),
    name: `隔绝物 · ${ghost.visibility.displayed_to_player_as}`,
    item_type: "contained_ghost",
    source_ghost_id: ghost.ghost_id,
    container: {
      container_id: uid("box"),
      container_type: containerType,
      containment_integrity: containerType === "gold" ? 86 : 62,
      leakage_risk: containerType === "gold" ? 14 : 32,
      damage_risk: 10,
    },
    is_tradeable: true,
    is_driveable: ghost.driving_profile.is_driveable_after_containment,
    can_be_used_as_suppression_item: true,
    known_properties: ["容器里的东西不再敲外面的门。", "长期携带会发热。"],
    hidden_properties: [
      `source=${ghost.ghost_id}`,
      `kind=${ghost.true_entity_kind}`,
      `max=${ghost.strength_profile.max_strength}`,
    ],
    trade_risk: ["买家背调", "总部关注", "黑吃黑", "容器在交易中破损"],
    gm_notes: "不是安全物品。泄漏与交易都会推高事件。",
  };
}

export function playerFacingContained(item: ContainedGhostItem) {
  return {
    item_id: item.item_id,
    name: item.name,
    integrity: item.container.containment_integrity,
    leakage_risk: item.container.leakage_risk,
    is_tradeable: item.is_tradeable,
    is_driveable: item.is_driveable,
    can_suppress: item.can_be_used_as_suppression_item,
    known_properties: item.known_properties,
  };
}

export function decayContainer(item: ContainedGhostItem, amount = 3): ContainedGhostItem {
  const integrity = Math.max(0, item.container.containment_integrity - amount);
  return {
    ...item,
    container: {
      ...item.container,
      containment_integrity: integrity,
      leakage_risk: Math.min(100, item.container.leakage_risk + amount),
    },
  };
}
