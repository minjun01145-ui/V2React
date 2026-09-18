import { appConfig } from "../config/appConfig.ts";
import { normalizeRoomId } from "../multiplayer/roomId.ts";
import { tenantConfigFromLocation } from "../tenant/config.ts";
import { scopeRoomId } from "../tenant/scope.ts";

export function getRoomIdFromLocation(location: Pick<Location, "search"> = window.location): string {
  const params = new URLSearchParams(location.search);
  const tenant = tenantConfigFromLocation(location);
  if (!tenant) throw new Error("등록되지 않은 사용자 주소입니다.");
  return scopeRoomId(tenant.id, normalizeRoomId(params.get("room"), appConfig.defaultRoomId));
}
