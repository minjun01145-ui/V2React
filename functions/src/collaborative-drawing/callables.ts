import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdminTenant, requireRoomCaller } from "../shared/auth.js";
import { db } from "../shared/firebase.js";
import { effectiveTenantId } from "../shared/tenant.js";
import { isRecord } from "../shared/validation.js";

function pathSegment(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 120 || /[.#$\/[\]\x00-\x1f\x7f]/.test(value)) {
    throw new HttpsError("invalid-argument", "그림판 주소가 올바르지 않습니다.");
  }
  return value;
}

function boardAddress(data: unknown) {
  if (!isRecord(data)) throw new HttpsError("invalid-argument", "그림판 주소가 필요합니다.");
  const roomId = pathSegment(data.roomId);
  const boardId = pathSegment(data.boardId);
  // Enable additional board names here when another mode adopts the module.
  if (boardId !== "lobby") throw new HttpsError("invalid-argument", "사용할 수 없는 그림판입니다.");
  return { roomId, boardId };
}

export const joinDrawingBoard = onCall({ region: "asia-northeast3", enforceAppCheck: false, invoker: "public" }, async (request) => {
  const { roomId, boardId } = boardAddress(request.data);
  const uid = await requireRoomCaller(request, roomId);
  const session = await db.collection("multiplayerSessions").doc(roomId).get();
  const tenantId = effectiveTenantId(session.data()?.tenantId);
  await getDatabase().ref(`drawingAccess/v1/${tenantId}/${roomId}/${boardId}/${uid}`).set(true);
  return { joined: true };
});

export const clearDrawingBoard = onCall({ region: "asia-northeast3", enforceAppCheck: false, invoker: "public" }, async (request) => {
  const { roomId, boardId } = boardAddress(request.data);
  const { tenantId } = await requireAdminTenant(request);
  const session = await db.collection("multiplayerSessions").doc(roomId).get();
  const raw: unknown = session.data();
  if (!session.exists || !isRecord(raw) || effectiveTenantId(raw.tenantId) !== tenantId) {
    throw new HttpsError("permission-denied", "이 그림판을 관리할 권한이 없습니다.");
  }
  // One atomic replacement deletes storage and invalidates in-flight old strokes.
  await getDatabase().ref(`drawingBoards/v1/${tenantId}/${roomId}/${boardId}`).transaction((current: unknown) => {
    const generation = isRecord(current) && typeof current.generation === "number" ? current.generation : 0;
    return { generation: generation + 1 };
  });
  return { cleared: true };
});
