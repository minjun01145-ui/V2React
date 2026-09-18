import { appConfig } from "../config/appConfig.ts";
import { isTenantId, PRIMARY_TENANT_ID, SECONDARY_TENANT_ID, type TenantId } from "./scope.ts";

export interface TenantConfig {
  readonly id: TenantId;
  readonly brandName: string;
  readonly brandAlt: string;
  readonly adminAuthEmail: string | null;
  readonly usePrimaryLogo: boolean;
}

const TENANTS: Readonly<Record<TenantId, TenantConfig>> = Object.freeze({
  [PRIMARY_TENANT_ID]: Object.freeze({
    id: PRIMARY_TENANT_ID,
    brandName: "민준쌤 게임기",
    brandAlt: "민준쌤 게임기 V2R",
    adminAuthEmail: appConfig.adminAuthEmail || null,
    usePrimaryLogo: true,
  }),
  [SECONDARY_TENANT_ID]: Object.freeze({
    id: SECONDARY_TENANT_ID,
    brandName: "길동쌤 게임기",
    brandAlt: "길동쌤 게임기 V2R",
    adminAuthEmail: null,
    usePrimaryLogo: false,
  }),
});

export function tenantConfig(tenantId: TenantId): TenantConfig {
  return TENANTS[tenantId];
}

export function tenantConfigFromLocation(location: Pick<Location, "search"> = window.location): TenantConfig | null {
  const rawTenantId = new URLSearchParams(location.search).get("tenant");
  if (!rawTenantId) return TENANTS[PRIMARY_TENANT_ID];
  const tenantId = rawTenantId.trim().toLowerCase();
  return isTenantId(tenantId) ? TENANTS[tenantId] : null;
}

export function currentTenantConfig(): TenantConfig {
  const tenant = tenantConfigFromLocation();
  if (!tenant) throw new Error("등록되지 않은 사용자 주소입니다.");
  return tenant;
}

export function tenantHref(pathname: string, tenantId: TenantId, params: Readonly<Record<string, string | null | undefined>> = {}): string {
  const search = new URLSearchParams();
  if (tenantId !== PRIMARY_TENANT_ID) search.set("tenant", tenantId);
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}
