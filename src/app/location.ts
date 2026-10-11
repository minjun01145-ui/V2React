import { appConfig } from "../config/appConfig.ts";
import { normalizeRoomId } from "../multiplayer/roomId.ts";
import { tenantConfigFromLocation } from "../tenant/config.ts";
import { PRIMARY_TENANT_ID, scopeRoomId } from "../tenant/scope.ts";

export function getRoomIdFromLocation(location: Pick<Location, "search"> = window.location): string {
  const params = new URLSearchParams(location.search);
  const tenant = tenantConfigFromLocation(location);
  if (!tenant) throw new Error("등록되지 않은 사용자 주소입니다.");
  const rawRoomId = params.get("room")?.normalize("NFKC").trim();
  const prefix = `${tenant.id}--`;
  // Links may already contain a scoped ID; normalize only the room part.
  const roomId = tenant.id !== PRIMARY_TENANT_ID && rawRoomId?.startsWith(prefix)
    ? rawRoomId.slice(prefix.length)
    : rawRoomId;
  return scopeRoomId(tenant.id, normalizeRoomId(roomId, appConfig.defaultRoomId));
}
