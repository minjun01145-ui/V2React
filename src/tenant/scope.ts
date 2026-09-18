export const PRIMARY_TENANT_ID = "minjun" as const;
export const SECONDARY_TENANT_ID = "hana" as const;

export type TenantId = typeof PRIMARY_TENANT_ID | typeof SECONDARY_TENANT_ID;

const TENANT_IDS = new Set<string>([PRIMARY_TENANT_ID, SECONDARY_TENANT_ID]);
const ROOM_ID_MAX_LENGTH = 64;

export function isTenantId(value: unknown): value is TenantId {
  return typeof value === "string" && TENANT_IDS.has(value);
}

export function effectiveTenantId(value: unknown): TenantId {
  if (value === undefined || value === null) return PRIMARY_TENANT_ID;
  if (isTenantId(value)) return value;
  throw new Error("등록되지 않은 사용자 데이터입니다.");
}

export function tenantStudentKey(tenantId: TenantId, studentNumber: string): string {
  return tenantId === PRIMARY_TENANT_ID ? studentNumber : `${tenantId}--${studentNumber}`;
}

export function tenantAccountId(tenantId: TenantId, studentNumber: string): string {
  return tenantStudentKey(tenantId, studentNumber);
}

export function scopeRoomId(tenantId: TenantId, roomId: string): string {
  if (tenantId === PRIMARY_TENANT_ID) return roomId;
  const prefix = `${tenantId}--`;
  if (roomId.startsWith(prefix)) return roomId.slice(0, ROOM_ID_MAX_LENGTH);
  return `${prefix}${roomId.slice(0, ROOM_ID_MAX_LENGTH - prefix.length)}`;
}

export function belongsToTenant(value: unknown, tenantId: TenantId): boolean {
  if (value === undefined || value === null) return tenantId === PRIMARY_TENANT_ID;
  return isTenantId(value) && value === tenantId;
}
