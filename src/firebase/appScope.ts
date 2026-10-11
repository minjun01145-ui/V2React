import { PRIMARY_TENANT_ID, type TenantId } from "../tenant/scope.ts";

export function firebaseAppName(role: "student" | "teacher", tenantId: TenantId): string {
  // Preserve primary logins while isolating each tenant's Auth persistence.
  return tenantId === PRIMARY_TENANT_ID ? `jurye-${role}` : `jurye-${role}-${tenantId}`;
}
