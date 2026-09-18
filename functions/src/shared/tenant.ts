import { HttpsError } from "firebase-functions/v2/https";

export const PRIMARY_TENANT_ID = "minjun" as const;
export const SECONDARY_TENANT_ID = "gildong" as const;
export type TenantId = typeof PRIMARY_TENANT_ID | typeof SECONDARY_TENANT_ID;

export function isTenantId(value: unknown): value is TenantId {
  return value === PRIMARY_TENANT_ID || value === SECONDARY_TENANT_ID;
}

export function parseTenantId(value: unknown): TenantId {
  if (value === undefined || value === null) return PRIMARY_TENANT_ID;
  if (!isTenantId(value)) throw new HttpsError("invalid-argument", "사용자 주소 정보가 올바르지 않습니다.");
  return value;
}

export function effectiveTenantId(value: unknown): TenantId {
  if (value === undefined || value === null) return PRIMARY_TENANT_ID;
  if (isTenantId(value)) return value;
  throw new HttpsError("failed-precondition", "등록되지 않은 사용자 데이터입니다.");
}

export function belongsToTenant(value: unknown, tenantId: TenantId): boolean {
  if (value === undefined || value === null) return tenantId === PRIMARY_TENANT_ID;
  return isTenantId(value) && value === tenantId;
}

export function tenantStudentKey(tenantId: TenantId, studentNumber: string): string {
  return tenantId === PRIMARY_TENANT_ID ? studentNumber : `${tenantId}--${studentNumber}`;
}

export function tenantAccountId(tenantId: TenantId, studentNumber: string): string {
  return tenantStudentKey(tenantId, studentNumber);
}
