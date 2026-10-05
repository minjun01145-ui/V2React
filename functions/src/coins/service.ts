import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/firebase.js";
import { tenantAccountId, tenantStudentKey, type TenantId } from "../shared/tenant.js";
import { isRecord, normalizePersonName } from "../shared/validation.js";
import { parseBalance } from "./model.js";

export const GAME_PARTICIPATION_COINS = 10;
export const walletDocument = (accountId: string) => db.collection("studentGameData").doc(accountId).collection("wallet").doc("v2coins");

// Rewards use teacher-started rounds, never a balance or reward amount supplied by a browser.
// The receipt is per student account + room + round, even after a UID changes at login.
export async function grantGameParticipationCoins(tenantId: TenantId, roomId: string, roundId: string, participant: unknown): Promise<boolean> {
  if (!isRecord(participant) || typeof participant.studentNumber !== "string" || !/^[0-9]{1,12}$/.test(participant.studentNumber)
    || typeof participant.displayName !== "string") return false;
  const studentNumber = participant.studentNumber;
  const accountId = tenantAccountId(tenantId, studentNumber);
  const ref = walletDocument(accountId);
  const receiptId = createHash("sha256").update(`${roomId}\0${roundId}`).digest("hex");
  const receiptRef = ref.collection("rewards").doc(receiptId);
  return db.runTransaction(async (tx) => {
    const [wallet, receipt, roster] = await Promise.all([
      tx.get(ref), tx.get(receiptRef), tx.get(db.collection("studentRoster").doc(tenantStudentKey(tenantId, studentNumber))),
    ]);
    if (receipt.exists || !roster.exists || roster.data()?.active === false
      || normalizePersonName(roster.data()?.displayName) !== normalizePersonName(participant.displayName)) return false;
    const balance = wallet.exists ? parseBalance(wallet.data()?.balance) : 0;
    if (!Number.isSafeInteger(balance + GAME_PARTICIPATION_COINS)) throw new Error("V2코인 잔액 범위를 초과했습니다.");
    tx.set(ref, { balance: balance + GAME_PARTICIPATION_COINS, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: Date.now() }, { merge: true });
    tx.create(receiptRef, { roomId, roundId, amount: GAME_PARTICIPATION_COINS, createdAt: FieldValue.serverTimestamp() });
    return true;
  });
}
