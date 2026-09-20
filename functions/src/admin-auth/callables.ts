import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdminTenant } from "../shared/auth.js";
import { adminAuth, db } from "../shared/firebase.js";
import type { TenantId } from "../shared/tenant.js";

const callableOptions = { region: "asia-northeast3", enforceAppCheck: false, invoker: "public" } as const;

const BOOTSTRAP_ADMINS: Readonly<Record<string, { readonly email: string; readonly tenantId: TenantId }>> = Object.freeze({
  "9fk18smCbqPFK03L6pf3G1e0e8v1": Object.freeze({
    email: "orangecu48@gmail.com",
    tenantId: "hana",
  }),
});

export const bootstrapAdminTenant = onCall<{ readonly tenantId?: unknown }>(callableOptions, async (request) => {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("unauthenticated", "관리자 로그인이 필요합니다.");
  }

  const bootstrap = BOOTSTRAP_ADMINS[request.auth.uid];
  const email = typeof request.auth.token.email === "string" ? request.auth.token.email.toLowerCase() : "";
  if (!bootstrap || email !== bootstrap.email || request.data?.tenantId !== bootstrap.tenantId) {
    throw new HttpsError("permission-denied", "관리자 권한이 없습니다.");
  }

  const ref = db.collection("admins").doc(request.auth.uid);
  const snapshot = await ref.get();
  if (snapshot.exists) {
    const existing = snapshot.data();
    if (existing?.active === false || existing?.tenantId !== bootstrap.tenantId) {
      throw new HttpsError("permission-denied", "기존 관리자 권한과 일치하지 않습니다.");
    }
  } else {
    await ref.set({ active: true, tenantId: bootstrap.tenantId });
  }

  const user = await adminAuth.getUser(request.auth.uid);
  await adminAuth.setCustomUserClaims(request.auth.uid, {
    ...(user.customClaims ?? {}),
    tenantId: bootstrap.tenantId,
  });
  return { tenantId: bootstrap.tenantId } as const;
});

export const syncAdminTenantClaim = onCall(callableOptions, async (request) => {
  const { uid, tenantId } = await requireAdminTenant(request);
  const user = await adminAuth.getUser(uid);
  await adminAuth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), tenantId });
  return { tenantId } as const;
});
