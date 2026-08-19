import { appConfig } from "../config/appConfig.ts";
import { normalizeRoomId } from "../multiplayer/roomId.ts";

export function getRoomIdFromLocation(location: Pick<Location, "search"> = window.location): string {
  const params = new URLSearchParams(location.search);
  return normalizeRoomId(params.get("room"), appConfig.defaultRoomId);
}
