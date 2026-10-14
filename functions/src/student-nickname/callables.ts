import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireRegularStudent } from "../shared/auth.js";
import { db } from "../shared/firebase.js";
import { effectiveTenantId } from "../shared/tenant.js";
import { isRecord } from "../shared/validation.js";
import { ensureDailyRandomNickname } from "./service.js";

const options = { region: "asia-northeast3", enforceAppCheck: false } as const;
const ROOM_ID_PATTERN = /^[\p{L}\p{N}._-]{1,64}$/u;

function parseRoomId(value: unknown): string {
  const roomId = isRecord(value) && typeof value.roomId === "string" ? value.roomId : "";
  if (!ROOM_ID_PATTERN.test(roomId)) throw new HttpsError("invalid-argument", "대기실을 확인해 주세요.");
  return roomId;
}

/**
 * Returns the student's one graded random nickname for today (Korea time), drawing it on the
 * server the first time it is asked for. The roll lives under the student's server-owned
 * account document, so a reload, another device or a direct Firestore write cannot reroll it
 * before the next day. The room only needs to belong to the student's tenant: the student rolls
 * before joining, and a later call replaces the name only if another player already wears it.
 */
export const ensureDailyStudentNickname = onCall(options, async (request) => {
  const student = await requireRegularStudent(request);
  const roomId = parseRoomId(request.data);
  const session = await db.collection("multiplayerSessions").doc(roomId).get();
  const sessionData: unknown = session.exists ? session.data() : null;
  if (!isRecord(sessionData) || effectiveTenantId(sessionData.tenantId) !== student.tenantId) {
    throw new HttpsError("permission-denied", "이 대기실의 랜덤 닉네임을 뽑을 수 없습니다.");
  }
  try {
    const roll = await ensureDailyRandomNickname({ accountId: student.studentAccountId, roomId, uid: student.uid });
    return { nickname: roll.nickname, nicknameGrade: roll.nicknameGrade, rollDay: roll.rollDay };
  } catch (error: unknown) {
    logger.error("Daily nickname roll failed", { roomId, message: error instanceof Error ? error.message : "unknown" });
    throw new HttpsError("internal", "랜덤 닉네임을 뽑지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
});
