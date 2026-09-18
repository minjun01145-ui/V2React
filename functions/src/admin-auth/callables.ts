import { onCall } from "firebase-functions/v2/https";
import { requireAdminTenant } from "../shared/auth.js";
import { adminAuth } from "../shared/firebase.js";

const callableOptions = { region: "asia-northeast3", enforceAppCheck: false } as const;

export const syncAdminTenantClaim = onCall(callableOptions, async (request) => {
  const { uid, tenantId } = await requireAdminTenant(request);
  const user = await adminAuth.getUser(uid);
  await adminAuth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), tenantId });
  return { tenantId } as const;
});
