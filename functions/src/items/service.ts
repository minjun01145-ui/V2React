import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { requireAnonymous } from "../shared/auth.js";
import { db } from "../shared/firebase.js";
import { effectiveTenantId, tenantAccountId } from "../shared/tenant.js";
import {
  consumeStoredSharedItem,
  grantStoredSharedItem,
  parseStoredSharedItemInventory,
  type SharedItemId,
  type StoredSharedItemInventory,
} from "./model.js";

export function studentItemDocument(accountId: string) {
  return db.collection("studentGameData").doc(accountId).collection("items").doc("shared");
}

export function studentItemOperationDocument(accountId: string, operationId: string) {
  return studentItemDocument(accountId).collection("operations").doc(operationId);
}

export async function requireStudentItemAccount(request: CallableRequest<unknown>): Promise<string> {
  const uid = requireAnonymous(request);
  const token = request.auth?.token;
  if (!token) throw new HttpsError("unauthenticated", "학생 인증 정보가 없습니다.");

  if (token.role === "test-student") return `test-${uid}`;
  if (token.role !== "student" || typeof token.studentNumber !== "string" || !token.studentNumber.trim()) {
    throw new HttpsError("permission-denied", "학생 계정 정보를 확인할 수 없습니다.");
  }

  const profile = await db.collection("studentProfiles").doc(uid).get();
  const tenantId = effectiveTenantId(token.tenantId);
  if (!profile.exists || profile.data()?.studentNumber !== token.studentNumber || effectiveTenantId(profile.data()?.tenantId) !== tenantId) {
    throw new HttpsError("permission-denied", "학생 계정 정보가 일치하지 않습니다.");
  }
  return tenantAccountId(tenantId, token.studentNumber);
}

export async function readStudentItemInventory(accountId: string): Promise<StoredSharedItemInventory> {
  const snapshot = await studentItemDocument(accountId).get();
  return parseStoredSharedItemInventory(snapshot.exists ? snapshot.data()?.inventory : null);
}

export async function grantStudentItemInTransaction(
  tx: Transaction,
  accountId: string,
  itemId: SharedItemId,
  operationId: string,
): Promise<{
  readonly inventory: StoredSharedItemInventory;
  readonly granted: boolean;
  readonly duplicate: boolean;
}> {
  const itemRef = studentItemDocument(accountId);
  const operationRef = studentItemOperationDocument(accountId, operationId);
  const [itemSnapshot, operationSnapshot] = await Promise.all([
    tx.get(itemRef),
    tx.get(operationRef),
  ]);
  const inventory = parseStoredSharedItemInventory(itemSnapshot.exists ? itemSnapshot.data()?.inventory : null);

  if (operationSnapshot.exists) {
    return { inventory, granted: false, duplicate: true };
  }

  const next = grantStoredSharedItem(inventory, itemId);
  const now = Date.now();
  tx.set(itemRef, {
    inventory: next,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: now,
  }, { merge: true });
  tx.create(operationRef, {
    kind: "grant",
    itemId,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
  });
  return { inventory: next, granted: true, duplicate: false };
}

export async function consumeStudentItemInTransaction(
  tx: Transaction,
  accountId: string,
  itemId: SharedItemId,
  operationId: string,
): Promise<{
  readonly inventory: StoredSharedItemInventory;
  readonly consumed: boolean;
  readonly duplicate: boolean;
}> {
  const itemRef = studentItemDocument(accountId);
  const operationRef = studentItemOperationDocument(accountId, operationId);
  const [itemSnapshot, operationSnapshot] = await Promise.all([
    tx.get(itemRef),
    tx.get(operationRef),
  ]);
  const inventory = parseStoredSharedItemInventory(itemSnapshot.exists ? itemSnapshot.data()?.inventory : null);

  if (operationSnapshot.exists) {
    return {
      inventory,
      consumed: operationSnapshot.data()?.consumed === true,
      duplicate: true,
    };
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
  return {
    inventory: result.inventory,
    consumed: result.consumed,
    duplicate: false,
  };
}

export async function consumeStudentItemForAccount(
  accountId: string,
  itemId: SharedItemId,
  operationId: string,
): Promise<{
  readonly inventory: StoredSharedItemInventory;
  readonly consumed: boolean;
  readonly duplicate: boolean;
}> {
  return db.runTransaction((tx) =>
    consumeStudentItemInTransaction(tx, accountId, itemId, operationId),
  );
}
