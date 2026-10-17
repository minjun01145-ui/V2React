import { useEffect } from "react";
import type { TenantId } from "../tenant/scope.ts";
import { applyAppFont, DEFAULT_APP_FONT_ID } from "./appFont.ts";
import { subscribeAppFont } from "./repository.ts";

/** Runs before login as appearance is public, non-sensitive tenant data. */
export function useAppFont(tenantId: TenantId): void {
  useEffect(() => {
    document.documentElement.style.removeProperty("--app-font-family");
    return subscribeAppFont(tenantId, applyAppFont, (error) => {
      applyAppFont(DEFAULT_APP_FONT_ID);
      console.error("앱 글꼴 설정을 불러오지 못했습니다.", error);
    });
  }, [tenantId]);
}
