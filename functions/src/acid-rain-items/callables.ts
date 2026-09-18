import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  grantStoredSharedItem,
  parseStoredSharedItemInventory,
} from "../items/model.js";
import {
  requireStudentItemAccount,
  studentItemDocument,
  studentItemOperationDocument,
} from "../items/service.js";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import {
  ACID_RAIN_REWARD_COOLDOWN_MS,
  isAcidRainRewardItemId,
  type AcidRainRewardItemId,
} from "./model.js";

const options = { region: "asia-northeast3", enforceAppCheck: false } as const;

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

function parseRewardItemId(value: unknown): AcidRainRewardItemId {
  if (!isRecord(value) || !isAcidRainRewardItemId(value.itemId)) {
    throw new HttpsError("invalid-argument", "산성비에서 획득할 수 없는 아이템입니다.");
  }
  return value.itemId;
}

export const grantAcidRainItem = onCall(options, async (request) => {
  const accountId = await requireStudentItemAccount(request);
  const itemId = parseRewardItemId(request.data);
  const operationId = parseOperationId(request.data);

  return db.runTransaction(async (tx: Transaction) => {
    const itemRef = studentItemDocument(accountId);
    const operationRef = studentItemOperationDocument(accountId, operationId);
    const [itemSnapshot, operationSnapshot] = await Promise.all([
      tx.get(itemRef),
      tx.get(operationRef),
    ]);
    const data = itemSnapshot.exists ? itemSnapshot.data() : undefined;
    const inventory = parseStoredSharedItemInventory(data?.inventory);

    if (operationSnapshot.exists) {
      return { inventory, granted: false, duplicate: true };
    }

    const now = Date.now();
    const lastGrantAtMs = typeof data?.lastAcidRainGrantAtMs === "number"
      ? data.lastAcidRainGrantAtMs
      : 0;
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
