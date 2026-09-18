import { onCall } from "firebase-functions/v2/https";
import { requireAdminForRoom, requireRoomStudent } from "../shared/auth.js";
import { awardFreeResponse, saveFreeResponse } from "./service.js";
import { parseAwardInput, parseSubmissionInput } from "./validation.js";

const options = { region: "asia-northeast3", enforceAppCheck: false, maxInstances: 6 } as const;

export const submitFreeResponse = onCall(options, async (request) => {
  const input = parseSubmissionInput(request.data);
  const uid = await requireRoomStudent(request, input.roomId);
  await saveFreeResponse(uid, input);
  return { submitted: true };
});

export const awardFreeResponsePoints = onCall(options, async (request) => {
  const input = parseAwardInput(request.data);
  const uid = await requireAdminForRoom(request, input.roomId);
  await awardFreeResponse(uid, input);
  return { awarded: true };
});
