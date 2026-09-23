import type { TenantId } from "../../tenant/scope.ts";

export function soloRunProgressPath(tenantId: TenantId, runId: string, ownerUid: string): string {
  for (const segment of [tenantId, runId, ownerUid]) {
    if (!segment || segment.includes("/")) throw new Error("Solo 저장 경로가 올바르지 않습니다.");
  }
  return `tenants/${tenantId}/soloRuns/${runId}/progress/${ownerUid}`;
}
