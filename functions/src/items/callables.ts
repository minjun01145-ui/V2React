import { HttpsError, onCall } from "firebase-functions/v2/https";
import { isRecord } from "../shared/validation.js";
import { isSharedItemId, type SharedItemId } from "./model.js";
import {
  consumeStudentItemForAccount,
  readStudentItemInventory,
  requireStudentItemAccount,
} from "./service.js";

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

function parseItemId(value: unknown): SharedItemId {
  if (!isRecord(value) || !isSharedItemId(value.itemId)) {
    throw new HttpsError("invalid-argument", "아이템 종류가 올바르지 않습니다.");
  }
  return value.itemId;
}

export const getStudentItemInventory = onCall(options, async (request) => {
  const accountId = await requireStudentItemAccount(request);
  return { inventory: await readStudentItemInventory(accountId) };
});

export const consumeStudentItem = onCall(options, async (request) => {
  const accountId = await requireStudentItemAccount(request);
  return consumeStudentItemForAccount(
    accountId,
    parseItemId(request.data),
    parseOperationId(request.data),
  );
});
