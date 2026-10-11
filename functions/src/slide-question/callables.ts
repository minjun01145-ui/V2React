import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireRoomStudent } from "../shared/auth.js";
import { parseFreeResponseScope } from "../free-response/validation.js";
import { isRecord } from "../shared/validation.js";
import { saveSlideQuestion } from "./service.js";

export const submitSlideQuestion = onCall({ region: "asia-northeast3", enforceAppCheck: false, maxInstances: 6, timeoutSeconds: 180 }, async (request) => {
  const scope = parseFreeResponseScope(request.data);
  const answer = isRecord(request.data) && typeof request.data.answer === "string" ? request.data.answer.trim() : "";
  if (!answer || answer.length > 1000) throw new HttpsError("invalid-argument", "답안은 1~1000자로 입력해 주세요.");
  const uid = await requireRoomStudent(request, scope.roomId);
  await saveSlideQuestion(uid, { ...scope, answer });
  return { submitted: true };
});
