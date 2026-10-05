import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { requireAdminTenant, requireRegularStudent } from "../shared/auth.js";
import { isRecord } from "../shared/validation.js";
import { buyCharacterItem, editNextShop, ensureShop, initializeCharacter, saveCharacter, shopResponse } from "./service.js";

const options = { region: "asia-northeast3", enforceAppCheck: false, invoker: "public" } as const;
export const initializeStudentCharacter = onCall(options, async (request) => {
  const student = await requireRegularStudent(request);
  await initializeCharacter(student.studentAccountId);
  return { initialized: true };
});
export const getCharacterShop = onCall(options, async (request) => {
  const student = await requireRegularStudent(request);
  return shopResponse(await ensureShop(student.tenantId));
});
export const purchaseCharacterItem = onCall(options, async (request) => {
  const student = await requireRegularStudent(request);
  const data: unknown = request.data;
  if (!isRecord(data) || typeof data.itemId !== "number" || !Number.isSafeInteger(data.itemId)
    || typeof data.expectedPrice !== "number" || !Number.isSafeInteger(data.expectedPrice) || data.expectedPrice < 0) {
    throw new HttpsError("invalid-argument", "구매할 아이템을 확인해 주세요.");
  }
  return buyCharacterItem(student.studentAccountId, student.tenantId, data.itemId, data.expectedPrice);
});
export const saveStudentCharacter = onCall(options, async (request) => {
  const student = await requireRegularStudent(request);
  return { appearance: await saveCharacter(student.studentAccountId, isRecord(request.data) ? request.data.appearance : null) };
});
export const getNextCharacterShop = onCall(options, async (request) => {
  const admin = await requireAdminTenant(request);
  return shopResponse(await ensureShop(admin.tenantId), true);
});
export const updateNextCharacterShop = onCall(options, async (request) => {
  const admin = await requireAdminTenant(request);
  const data: unknown = request.data;
  if (!isRecord(data) || typeof data.week !== "string" || typeof data.itemId !== "number" || !Number.isSafeInteger(data.itemId)
    || typeof data.mode !== "string" || !["auto", "exclude", "feature"].includes(data.mode)
    || !(data.price === null || typeof data.price === "number" && Number.isSafeInteger(data.price) && data.price >= 1 && data.price <= 10_000)) {
    throw new HttpsError("invalid-argument", "신상 설정이 올바르지 않습니다.");
  }
  return editNextShop(admin.tenantId, data.week, data.itemId, data.mode as "auto" | "exclude" | "feature", data.price as number | null);
});
export const publishWeeklyCharacterShop = onSchedule({ region: "asia-northeast3", schedule: "0 0 * * 1", timeZone: "Asia/Seoul", retryCount: 3 }, async () => {
  await Promise.all([ensureShop("minjun"), ensureShop("hana")]);
});
