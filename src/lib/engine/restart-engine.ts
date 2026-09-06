import type { Power, RestartProfile, SaveData } from "./types.ts";
import type { RarePowerView } from "./rare-tags.ts";
import { rareTagEligible } from "./rare-tags.ts";
import { evaluateAreaRestartGate } from "./area-restart.ts";

export const SUPPORTED_RESTART_DOMAINS = ["body", "position", "injury", "supernatural_state", "revival_state"] as const;
export const UNSUPPORTED_RESTART_DOMAINS = ["memory", "consciousness", "causal_history"] as const;
export const FORBIDDEN_RESTART_AUTHORITY_FIELDS = [
  "external_single_target_exception",
  "can_rewind_own_source_revival",
  "bypass_area_restart_gate",
  "ignore_source_self_exclusion",
] as const;

export type RestartRoute = "self_restart" | "area_restart" | "exceptional_external_single" | "unsupported";

export interface RestartRequest {
  source_id: string;
  target_id: string;
  requested_domains: string[];
  restart?: RarePowerView;
  domain?: RarePowerView;
  mechanism_match?: boolean;
  source_power_id?: string;
  canonical_power?: Power;
  canonical_restart_profile?: RestartProfile;
  /** untrusted — ignored */
  external_single_target_exception?: boolean;
  can_rewind_own_source_revival?: boolean;
  claimed_external_single_target?: boolean;
  claimed_self_revival_rewind?: boolean;
}

export function defaultRestartProfile(): RestartProfile {
  return { external_single_target_exception: false, can_rewind_own_source_revival: false };
}

export function readCanonicalRestartProfile(power?: Power | null): RestartProfile {
  return {
    external_single_target_exception: power?.restart_profile?.external_single_target_exception === true,
    can_rewind_own_source_revival: power?.restart_profile?.can_rewind_own_source_revival === true,
  };
}

export function stripUntrustedRestartAuthority<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload };
  for (const k of FORBIDDEN_RESTART_AUTHORITY_FIELDS) delete next[k];
  return next;
}

export function filterRestartDomains(params: {
  requested: string[];
  source_id: string;
  target_id: string;
  can_rewind_own_source_revival?: boolean;
}): { effective: string[]; stripped: string[]; unsupported: string[] } {
  const unsupported = params.requested.filter((d) => (UNSUPPORTED_RESTART_DOMAINS as readonly string[]).includes(d));
  let effective = params.requested.filter((d) => (SUPPORTED_RESTART_DOMAINS as readonly string[]).includes(d));
  const stripped: string[] = [];
  const selfTarget = params.source_id === params.target_id;
  if (selfTarget && !params.can_rewind_own_source_revival && effective.includes("revival_state")) {
    effective = effective.filter((d) => d !== "revival_state");
    stripped.push("revival_state");
  }
  return { effective, stripped, unsupported };
}

export function evaluateRestartRequest(req: RestartRequest): {
  route: RestartRoute;
  allowed: boolean;
  reason: string;
  effective_domains: string[];
  stripped_domains: string[];
  area_gate?: ReturnType<typeof evaluateAreaRestartGate>;
  authority_claim_ignored: boolean;
} {
  const claimIgnored = !!(
    req.external_single_target_exception ||
    req.can_rewind_own_source_revival ||
    req.claimed_external_single_target ||
    req.claimed_self_revival_rewind
  );
  const profile = req.canonical_restart_profile ?? readCanonicalRestartProfile(req.canonical_power);
  const unsupported = req.requested_domains.filter((d) => (UNSUPPORTED_RESTART_DOMAINS as readonly string[]).includes(d));
  if (unsupported.length) {
    return {
      route: "unsupported",
      allowed: false,
      reason: "unsupported_special_mechanism_required",
      effective_domains: [],
      stripped_domains: [],
      authority_claim_ignored: claimIgnored,
    };
  }
  if (req.restart && !rareTagEligible(req.restart.max_strength, "restart").ok) {
    return {
      route: "self_restart",
      allowed: false,
      reason: "restart_tag_gate",
      effective_domains: [],
      stripped_domains: [],
      authority_claim_ignored: claimIgnored,
    };
  }
  const self = req.source_id === req.target_id;
  const filtered = filterRestartDomains({
    requested: req.requested_domains,
    source_id: req.source_id,
    target_id: req.target_id,
    can_rewind_own_source_revival: profile.can_rewind_own_source_revival,
  });
  if (self) {
    return {
      route: "self_restart",
      allowed: true,
      reason: profile.can_rewind_own_source_revival
        ? "self_revival_rewind_eligible_not_auto_success"
        : "self_restart_no_domain_required",
      effective_domains: filtered.effective,
      stripped_domains: filtered.stripped,
      authority_claim_ignored: claimIgnored,
    };
  }
  if (profile.external_single_target_exception) {
    return {
      route: "exceptional_external_single",
      allowed: true,
      reason: "explicit_external_single_exception",
      effective_domains: filtered.effective,
      stripped_domains: filtered.stripped,
      authority_claim_ignored: claimIgnored,
    };
  }
  const gate = evaluateAreaRestartGate({
    domain: req.domain,
    restart: req.restart,
    mechanism_match: req.mechanism_match !== false,
  });
  return {
    route: "area_restart",
    allowed: gate.allowed,
    reason: gate.allowed ? "area_restart_hard_gate_pass" : gate.reason,
    effective_domains: filtered.effective,
    stripped_domains: filtered.stripped,
    area_gate: gate,
    authority_claim_ignored: claimIgnored,
  };
}

export function resolveRestartFromSave(save: SaveData, req: RestartRequest): ReturnType<typeof evaluateRestartRequest> {
  const power = save.powers.find((p) => p.id === req.source_power_id) ?? req.canonical_power;
  return evaluateRestartRequest({
    ...req,
    canonical_power: power,
    canonical_restart_profile: readCanonicalRestartProfile(power),
    external_single_target_exception: undefined,
    can_rewind_own_source_revival: undefined,
  });
}

export function areaRestartDomainsForParticipant(params: {
  source_id: string;
  participant_id: string;
  requested: string[];
  can_rewind_own_source_revival?: boolean;
  canonical_power?: Power;
}) {
  const flag = params.canonical_power
    ? readCanonicalRestartProfile(params.canonical_power).can_rewind_own_source_revival
    : !!params.can_rewind_own_source_revival;
  return filterRestartDomains({
    requested: params.requested,
    source_id: params.source_id,
    target_id: params.participant_id,
    can_rewind_own_source_revival: flag,
  });
}
