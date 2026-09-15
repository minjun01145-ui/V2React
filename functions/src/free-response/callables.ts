import { onCall } from "firebase-functions/v2/https";
import { requireAdmin, requireAnonymous } from "../shared/auth.js";
import { awardFreeResponse, saveFreeResponse } from "./service.js";
import { parseAwardInput, parseSubmissionInput } from "./validation.js";

const options = { region: "asia-northeast3", enforceAppCheck: false, maxInstances: 6 } as const;

export const submitFreeResponse = onCall(options, async (request) => {
  const uid = requireAnonymous(request);
  await saveFreeResponse(uid, parseSubmissionInput(request.data));
  return { submitted: true };
});

export const awardFreeResponsePoints = onCall(options, async (request) => {
  const uid = await requireAdmin(request);
  await awardFreeResponse(uid, parseAwardInput(request.data));
  return { awarded: true };
});
