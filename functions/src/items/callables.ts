import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { requireAnonymous } from "../shared/auth.js";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import {
  consumeStoredSharedItem,
  grantStoredSharedItem,
  isAcidRainRewardItemId,
  isSharedItemId,
  parseStoredSharedItemInventory,
  type SharedItemId,
} from "./model.js";

const options = { region: "asia-northeast3", enforceAppCheck: false } as const;
const ACID_RAIN_REWARD_COOLDOWN_MS = 25_000;

function itemDocument(accountId: string) {
  return db.collection("studentGameData").doc(accountId).collection("items").doc("shared");
}

function operationDocument(accountId: string, operationId: string) {
  return itemDocument(accountId).collection("operations").doc(operationId);
}

async function requireStudentAccount(request: CallableRequest<unknown>): Promise<string> {
  const uid = requireAnonymous(request);
  const token = request.auth?.token;
  if (!token) throw new HttpsError("unauthenticated", "학생 인증 정보가 없습니다.");

  if (token.role === "test-student") return `test-${uid}`;
  if (token.role !== "student" || typeof token.studentNumber !== "string" || !token.studentNumber.trim()) {
    throw new HttpsError("permission-denied", "학생 계정 정보를 확인할 수 없습니다.");
  }

  const profile = await db.collection("studentProfiles").doc(uid).get();
  if (!profile.exists || profile.data()?.studentNumber !== token.studentNumber) {
    throw new HttpsError("permission-denied", "학생 계정 정보가 일치하지 않습니다.");
  }
  return token.studentNumber;
}

function parseOperationId(value: unknown): string {
  if (!isRecord(value) || typeof value.operationId !== "string") {
    throw new HttpsError("invalid-argument", "아이템 작업 ID가 없습니다.");
  }
  const operationId = value.operationId.trim();
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(operationId)) {
    throw new HttpsError("invalid-argument", "아이템 작업 ID가 올바르지 않습니다.");
  }
  return operationId;
}

function parseItemId(value: unknown): SharedItemId {
  if (!isRecord(value) || !isSharedItemId(value.itemId)) {
    throw new HttpsError("invalid-argument", "아이템 종류가 올바르지 않습니다.");
  }
  return value.itemId;
}

export const getStudentItemInventory = onCall(options, async (request) => {
  const accountId = await requireStudentAccount(request);
  const snapshot = await itemDocument(accountId).get();
  return {
    inventory: parseStoredSharedItemInventory(snapshot.exists ? snapshot.data()?.inventory : null),
  };
});

export const grantAcidRainItem = onCall(options, async (request) => {
  const accountId = await requireStudentAccount(request);
  const itemId = parseItemId(request.data);
  const operationId = parseOperationId(request.data);
  if (!isAcidRainRewardItemId(itemId)) {
    throw new HttpsError("invalid-argument", "산성비에서 획득할 수 없는 아이템입니다.");
  }

  return db.runTransaction(async (tx: Transaction) => {
    const itemRef = itemDocument(accountId);
    const operationRef = operationDocument(accountId, operationId);
    const [itemSnapshot, operationSnapshot] = await Promise.all([
      tx.get(itemRef),
      tx.get(operationRef),
    ]);
    const data = itemSnapshot.exists ? itemSnapshot.data() : undefined;
    const inventory = parseStoredSharedItemInventory(data?.inventory);

    if (operationSnapshot.exists) return { inventory, granted: false, duplicate: true };

    const now = Date.now();
    const lastGrantAtMs = typeof data?.lastAcidRainGrantAtMs === "number" ? data.lastAcidRainGrantAtMs : 0;
    if (lastGrantAtMs > 0 && now - lastGrantAtMs < ACID_RAIN_REWARD_COOLDOWN_MS) {
      throw new HttpsError("resource-exhausted", "산성비 아이템 보상 간격이 너무 짧습니다.");
    }

    const next = grantStoredSharedItem(inventory, itemId);
    tx.set(itemRef, {
      inventory: next,
      lastAcidRainGrantAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: now,
    }, { merge: true });
    tx.create(operationRef, {
      kind: "acid-rain-grant",
      itemId,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: now,
    });
    return { inventory: next, granted: true, duplicate: false };
  });
});

export const consumeStudentItem = onCall(options, async (request) => {
  const accountId = await requireStudentAccount(request);
  const itemId = parseItemId(request.data);
  const operationId = parseOperationId(request.data);

  return db.runTransaction(async (tx: Transaction) => {
    const itemRef = itemDocument(accountId);
    const operationRef = operationDocument(accountId, operationId);
    const [itemSnapshot, operationSnapshot] = await Promise.all([
      tx.get(itemRef),
      tx.get(operationRef),
    ]);
    const inventory = parseStoredSharedItemInventory(itemSnapshot.exists ? itemSnapshot.data()?.inventory : null);

    if (operationSnapshot.exists) {
      const consumed = operationSnapshot.data()?.consumed === true;
      return { inventory, consumed, duplicate: true };
    }

    const result = consumeStoredSharedItem(inventory, itemId);
    const now = Date.now();
    if (result.consumed) {
      tx.set(itemRef, {
        inventory: result.inventory,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtMs: now,
      }, { merge: true });
    }
    tx.create(operationRef, {
      kind: "consume",
      itemId,
      consumed: result.consumed,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: now,
    });
    return { inventory: result.inventory, consumed: result.consumed, duplicate: false };
  });
});
