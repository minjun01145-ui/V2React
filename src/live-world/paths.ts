import type { TenantId } from "../tenant/scope.ts";
import type { LiveWorldScope } from "./core/types.ts";

const FORBIDDEN_PATH_CHARACTERS = /[.#$\/[\]]/;

export function livePathSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 120 || FORBIDDEN_PATH_CHARACTERS.test(normalized)) {
    throw new Error(`Invalid live world ${label}.`);
  }
  return normalized;
}

/** Root of one realtime channel; movement, events and claims live beneath it. */
export function liveChannelPath(tenantId: TenantId, scope: LiveWorldScope): string {
  const tenant = livePathSegment(tenantId, "tenantId");
  const roomId = livePathSegment(scope.roomId, "roomId");
  const roundId = livePathSegment(scope.roundId, "roundId");
  const channelId = livePathSegment(scope.channelId, "channelId");
  return `liveWorld/v2/${tenant}/${roomId}/${roundId}/${channelId}`;
}
