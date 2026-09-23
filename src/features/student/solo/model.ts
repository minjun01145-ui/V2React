import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import type { SessionStatus } from "../../../multiplayer/constants.ts";

export function canEnterSolo(sessionStatus: SessionStatus, requiredActivityActive: boolean): boolean {
  return sessionStatus !== SESSION_STATUS.PREPARING
    && sessionStatus !== SESSION_STATUS.PLAYING
    && !requiredActivityActive;
}
