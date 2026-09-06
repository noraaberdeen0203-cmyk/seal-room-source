import { uid } from "../utils.ts";
import type { RareActionPayload, ResolutionInput, SaveData } from "./types.ts";
import { applyRevivalDelta, resetRevivalCommitLog } from "./revival-delta.ts";
import { evaluateAreaRestartGate, MAJOR_REVIVAL_COST_MIN } from "./area-restart.ts";
import type { RarePowerView } from "./rare-tags.ts";
import { createSuppressionLock, powerBlocked, releaseSuppressionLocks } from "./suppression.ts";
import { createCurseLink, breakCurseLink, applyBorrowedEffects } from "./curse-link.ts";
import { establishSourceContact, ghostIsIdealistic } from "./source-contact.ts";
import { resolveDice, isSuccess } from "./dice.ts";
import { evaluateRestartRequest, resolveRestartFromSave } from "./restart-engine.ts";

export interface RareActionResult {
  handled: boolean;
  hard_block: boolean;
  hard_block_reason: string;
  skip_dice: boolean;
  interrupt: string | null;
  visible: string;
  hidden: string;
  revival_applied: number;
  notes: string;
}

function asPower(p: RareActionPayload["domain"]): RarePowerView | undefined {
  if (!p) return undefined;
  return p as RarePowerView;
}

export function runRareAction(save: SaveData, input: ResolutionInput): RareActionResult {
  const empty: RareActionResult = {
    handled: false,
    hard_block: false,
    hard_block_reason: "",
    skip_dice: false,
    interrupt: null,
    visible: "",
    hidden: "",
    revival_applied: 0,
    notes: "",
  };
  const type = input.action_type;
  const rare = input.rare ?? {};
  const tx = uid("tx");
  if (
    type !== "area_restart" &&
    type !== "apply_suppression" &&
    type !== "release_suppression" &&
    type !== "attach_curse" &&
    type !== "break_curse" &&
    type !== "use_borrowed_supernatural" &&
    type !== "establish_source_contact" &&
    type !== "self_restart" &&
    type !== "external_restart"
  ) {
    return empty;
  }

  if (type === "area_restart") {
    const domain = asPower(rare.domain);
    const restart = asPower(rare.restart);
    const gate = evaluateAreaRestartGate({
      domain,
      restart,
      mechanism_match: rare.mechanism_match !== false,
      temporary_amp: rare.temporary_amp,
    });
    if (!gate.allowed) {
      return {
        handled: true,
        hard_block: true,
        hard_block_reason: gate.reason,
        skip_dice: true,
        interrupt: null,
        visible: "范围没有被推回去。",
        hidden: `area_restart ${gate.reason}`,
        revival_applied: 0,
        notes: gate.reason,
      };
    }
    let revival = 0;
    let interrupt: string | null = null;
    if (gate.revival_cost > 0) {
      const d = applyRevivalDelta({
        character: save.player_character,
        delta: Math.max(MAJOR_REVIVAL_COST_MIN, gate.revival_cost),
        source: "area_restart_amp",
        reason: "temporary_amplifier_major",
        transaction_id: tx,
        cost_id: `${tx}:amp`,
        save,
      });
      revival = d.applied_delta;
      if (d.interrupt) {
        save.pending_revival_endpoint = true;
        return {
          handled: true,
          hard_block: true,
          hard_block_reason: "revival_threshold",
          skip_dice: true,
          interrupt: d.interrupt,
          visible: "体内的东西一下子醒透了。",
          hidden: "revival_threshold after amp",
          revival_applied: revival,
          notes: "interrupt",
        };
      }
    }
    const dice = resolveDice({
      target: 50,
      visibility: "public",
      action_type: "area_restart",
      action_text: input.action_text,
      turn: save.turn,
      forced_roll: input.force_roll,
    });
    if (!isSuccess(dice.level) && input.force_roll && input.force_roll >= 80) {
      return {
        handled: true,
        hard_block: true,
        hard_block_reason: "dice_fail",
        skip_dice: true,
        interrupt,
        visible: "范围晃了一下，又回到原状。",
        hidden: "area restart dice fail cost kept",
        revival_applied: revival,
        notes: "dice_fail_cost_kept",
      };
    }
    return {
      handled: true,
      hard_block: false,
      hard_block_reason: "",
      skip_dice: true,
      interrupt,
      visible: "局部时空被拧了一下。",
      hidden: `effective=${gate.effective}`,
      revival_applied: revival,
      notes: "area_restart_ok",
    };
  }

  if (type === "apply_suppression") {
    const ghost = (save.ghosts ?? []).find((g) => g.ghost_id === (rare.target_ghost_id ?? input.target_id));
    const actCost = rare.activation_revival ?? 6;
    const paid = applyRevivalDelta({
      character: save.player_character,
      delta: actCost,
      source: "apply_suppression",
      reason: "activation",
      transaction_id: tx,
      cost_id: `${tx}:suppress_act`,
      save,
    });
    if (!ghost) {
      return {
        handled: true,
        hard_block: true,
        hard_block_reason: "no_target",
        skip_dice: true,
        interrupt: paid.interrupt,
        visible: "封锁没有落在任何东西上。",
        hidden: "no ghost",
        revival_applied: paid.applied_delta,
        notes: "no_target",
      };
    }
    const diceFail = input.force_roll != null && input.force_roll >= 80;
    if (diceFail) {
      return {
        handled: true,
        hard_block: true,
        hard_block_reason: "dice_fail",
        skip_dice: true,
        interrupt: paid.interrupt,
        visible: "预想中的封锁没有形成。",
        hidden: "suppression dice fail cost kept",
        revival_applied: paid.applied_delta,
        notes: "no_lock_cost_kept",
      };
    }
    createSuppressionLock({
      source_id: rare.source_id ?? save.player_character.id,
      target: ghost,
      scope: rare.scope ?? "one_power",
      target_power_id: rare.target_power_id,
      effective_strength: 80,
      mechanism_applies: rare.mechanism_match !== false,
      release_condition: "owner_release",
    });
    return {
      handled: true,
      hard_block: false,
      hard_block_reason: "",
      skip_dice: true,
      interrupt: paid.interrupt,
      visible: "某一股力量被按住了。",
      hidden: `lock scope=${rare.scope} power=${rare.target_power_id}`,
      revival_applied: paid.applied_delta,
      notes: "lock_created",
    };
  }

  if (type === "release_suppression") {
    const ghost = (save.ghosts ?? []).find((g) => g.ghost_id === rare.target_ghost_id);
    const actor = rare.release_actor_id ?? save.player_character.id;
    const owner = rare.source_id ?? save.player_character.id;
    if (actor !== owner) {
      return {
        handled: true,
        hard_block: true,
        hard_block_reason: "no_permission",
        skip_dice: true,
        interrupt: null,
        visible: "你动不了那层封锁。",
        hidden: "release denied",
        revival_applied: 0,
        notes: "denied",
      };
    }
    if (ghost) releaseSuppressionLocks(ghost, "owner_release");
    return {
      handled: true,
      hard_block: false,
      hard_block_reason: "",
      skip_dice: true,
      interrupt: null,
      visible: "封锁松了。",
      hidden: "released",
      revival_applied: 0,
      notes: "released",
    };
  }

  if (type === "attach_curse") {
    if (!rare.medium) {
      return {
        handled: true,
        hard_block: true,
        hard_block_reason: "no_medium",
        skip_dice: true,
        interrupt: null,
        visible: "联系没有建立起来。",
        hidden: "no medium",
        revival_applied: 0,
        notes: "no_medium",
      };
    }
    const created = createCurseLink({
      source_id: rare.source_id ?? "src",
      target_id: rare.target_ghost_id ?? save.player_character.id,
      medium: rare.medium,
      break_condition: rare.true_break ?? "medium_broken",
      transmissible: false,
      effect_profile: ["echo_knock"],
    });
    if (created.link) {
      save.curse_links = [...(save.curse_links ?? []), created.link];
    }
    return {
      handled: true,
      hard_block: false,
      hard_block_reason: "",
      skip_dice: true,
      interrupt: null,
      visible: "有什么东西贴上来了。",
      hidden: `link=${created.link?.link_id}`,
      revival_applied: 0,
      notes: "curse_attached",
    };
  }

  if (type === "break_curse") {
    const link = (save.curse_links ?? []).find((l) => l.link_id === rare.curse_link_id) ?? save.curse_links?.[0];
    if (link && rare.claimed_break && rare.true_break && rare.claimed_break === rare.true_break) {
      breakCurseLink(link, rare.true_break);
      return {
        handled: true,
        hard_block: false,
        hard_block_reason: "",
        skip_dice: true,
        interrupt: null,
        visible: "那层联系断了。",
        hidden: `broke via ${rare.true_break}`,
        revival_applied: 0,
        notes: "broke",
      };
    }
    return {
      handled: true,
      hard_block: true,
      hard_block_reason: "wrong_break",
      skip_dice: true,
      interrupt: null,
      visible: "灵异联系仍然存在。",
      hidden: `true_break=${rare.true_break ?? "hidden"}`,
      revival_applied: 0,
      notes: "still_active",
    };
  }

  if (type === "use_borrowed_supernatural") {
    const link = (save.curse_links ?? []).find((l) => l.active);
    const effect = rare.borrowed_effect ?? "";
    if (!link || !link.effect_profile.includes(effect)) {
      return {
        handled: true,
        hard_block: true,
        hard_block_reason: "unauthorized_power",
        skip_dice: true,
        interrupt: null,
        visible: "你抓不到那股力量。",
        hidden: "borrowed effect not granted",
        revival_applied: 0,
        notes: "unauthorized",
      };
    }
    applyBorrowedEffects(save.player_character, link);
    const paid = applyRevivalDelta({
      character: save.player_character,
      delta: rare.activation_revival ?? 4,
      source: "borrowed",
      reason: "use_effect",
      transaction_id: tx,
      cost_id: `${tx}:borrow`,
      save,
    });
    save.player_character.is_ghost_controller = false;
    return {
      handled: true,
      hard_block: false,
      hard_block_reason: "",
      skip_dice: true,
      interrupt: paid.interrupt,
      visible: "借来的力量动了一下。",
      hidden: `effect=${effect}`,
      revival_applied: paid.applied_delta,
      notes: "borrowed_ok",
    };
  }

  if (type === "establish_source_contact") {
    const ghost = (save.ghosts ?? []).find((g) => g.ghost_id === (rare.target_ghost_id ?? input.target_id));
    if (!ghost || !ghostIsIdealistic(ghost)) {
      ghost && (ghost.rare_tags = [...(ghost.rare_tags ?? []), "idealistic"]);
    }
    const g2 = ghost ?? (save.ghosts ?? [])[0];
    if (!g2) {
      return { ...empty, handled: true, hard_block: true, skip_dice: true, visible: "没有可接触的对象。" };
    }
    const match = !!rare.medium && rare.medium === rare.true_medium;
    if (match) {
      establishSourceContact(g2, true, true);
      return {
        handled: true,
        hard_block: false,
        hard_block_reason: "",
        skip_dice: true,
        interrupt: null,
        visible: "你碰到了更里面的一层。",
        hidden: "source_contact_established",
        revival_applied: 0,
        notes: "contact_ok",
      };
    }
    return {
      handled: true,
      hard_block: true,
      hard_block_reason: "wrong_medium",
      skip_dice: true,
      interrupt: null,
      visible: "媒介或行动没有产生你预想的接触。",
      hidden: `true_medium=${rare.true_medium ?? "hidden"}`,
      revival_applied: 0,
      notes: "no_contact",
    };
  }

  if (type === "self_restart" || type === "external_restart") {
    const source = rare.restart_source_id ?? save.player_character.id;
    const target = rare.restart_target_id ?? (type === "self_restart" ? source : "other");
    const ev = resolveRestartFromSave(save, {
      source_id: source,
      target_id: target,
      requested_domains: rare.requested_domains ?? ["body"],
      restart: asPower(rare.restart),
      domain: asPower(rare.domain),
      mechanism_match: rare.mechanism_match,
      source_power_id: rare.source_power_id ?? input.power_id,
      claimed_external_single_target: rare.claimed_external_single_target,
      claimed_self_revival_rewind: rare.claimed_self_revival_rewind,
      external_single_target_exception: rare.external_single_target_exception,
      can_rewind_own_source_revival: rare.can_rewind_own_source_revival,
    });
    const visible = ev.allowed
      ? "状态被拧回一段。"
      : ev.route === "area_restart"
        ? "这股重启力量无法以你预想的方式只落在目标身上。"
        : "重启没有落在你以为的位置。";
    return {
      handled: true,
      hard_block: !ev.allowed,
      hard_block_reason: ev.reason,
      skip_dice: true,
      interrupt: null,
      visible,
      hidden: `${ev.route} ${ev.reason}`,
      revival_applied: 0,
      notes: ev.route,
    };
  }

  return empty;
}

export { resetRevivalCommitLog };
export function powerIsBlocked(save: SaveData, ghostId: string, powerId: string) {
  const g = (save.ghosts ?? []).find((x) => x.ghost_id === ghostId);
  return g ? powerBlocked(g, powerId) : false;
}
