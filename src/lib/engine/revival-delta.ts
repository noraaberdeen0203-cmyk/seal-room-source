import { clamp } from "../utils.ts";
import type { ActionTransactionRecord, Character, SaveData } from "./types.ts";

export interface RevivalDeltaResult {
  previous_revival: number;
  new_revival: number;
  applied_delta: number;
  threshold_reached: boolean;
  interrupt: "revival_threshold" | null;
}

const TX_CAP = 128;
const ephemeral = new Set<string>();

export function resetRevivalCommitLog(_save?: SaveData) {
  ephemeral.clear();
}

function txList(save?: SaveData): ActionTransactionRecord[] {
  if (!save) return [];
  save.action_transactions = save.action_transactions ?? [];
  return save.action_transactions;
}

export function costAlreadyCommitted(save: SaveData | undefined, transaction_id: string, cost_id: string): boolean {
  return txList(save).some((t) => t.transaction_id === transaction_id && t.committed_cost_ids.includes(cost_id));
}

export function applyRevivalDelta(params: {
  character: Character;
  delta: number;
  source: string;
  reason: string;
  transaction_id: string;
  cost_id?: string;
  save?: SaveData;
}): RevivalDeltaResult {
  const costId = params.cost_id ?? `${params.transaction_id}:${params.source}:${params.reason}`;
  const key = `${params.transaction_id}::${costId}`;
  if (ephemeral.has(key) || costAlreadyCommitted(params.save, params.transaction_id, costId)) {
    return {
      previous_revival: params.character.stats.revival_degree,
      new_revival: params.character.stats.revival_degree,
      applied_delta: 0,
      threshold_reached: false,
      interrupt: null,
    };
  }
  ephemeral.add(key);
  const previous = params.character.stats.revival_degree;
  const next = clamp(previous + params.delta, 0, 100);
  params.character.stats.revival_degree = next;
  const crossed = previous < 100 && next >= 100;
  if (params.save) {
    let rec = txList(params.save).find((t) => t.transaction_id === params.transaction_id);
    if (!rec) {
      rec = { transaction_id: params.transaction_id, status: "committed", committed_cost_ids: [] };
      params.save.action_transactions!.push(rec);
      if (params.save.action_transactions!.length > TX_CAP) {
        params.save.action_transactions = params.save.action_transactions!.slice(-TX_CAP);
      }
    }
    rec.committed_cost_ids.push(costId);
    if (crossed) {
      rec.interrupt = "revival_threshold";
      rec.status = "interrupted";
      params.save.pending_revival_endpoint = true;
    }
  }
  return {
    previous_revival: previous,
    new_revival: next,
    applied_delta: next - previous,
    threshold_reached: crossed,
    interrupt: crossed ? "revival_threshold" : null,
  };
}
