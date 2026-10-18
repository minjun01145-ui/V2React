import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseClient.ts";
import type { TenantId } from "../tenant/scope.ts";
import { parseAppFontId } from "./appFont.ts";
import { parseThemeId, type ThemeId } from "../appearance/themes.ts";

export function subscribeAppearance(tenantId: TenantId, onValue: (value: { themeId: ThemeId; fontId: string }) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(doc(db, "tenants", tenantId, "settings", "appearance"),
    (snapshot) => onValue({ themeId: parseThemeId(snapshot.data()?.themeId), fontId: parseAppFontId(snapshot.data()?.fontId) }), onError);
}

export async function saveTheme(tenantId: TenantId, themeId: ThemeId): Promise<void> {
  await setDoc(doc(db, "tenants", tenantId, "settings", "appearance"), { themeId: parseThemeId(themeId), fontId: "default" }, { merge: true });
}

export function subscribeAppFont(tenantId: TenantId, onValue: (fontId: string) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(doc(db, "tenants", tenantId, "settings", "appearance"),
    (snapshot) => onValue(parseAppFontId(snapshot.data()?.fontId)), onError);
}

export async function saveAppFont(tenantId: TenantId, fontId: string): Promise<void> {
  await setDoc(doc(db, "tenants", tenantId, "settings", "appearance"), { fontId: parseAppFontId(fontId) }, { merge: true });
}
