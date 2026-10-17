import { useEffect, useState } from "react";
import { applyAppFont, DEFAULT_APP_FONT_ID } from "../../../fonts/appFont.ts";
import { FONT_CATALOG } from "../../../fonts/catalog.ts";
import { saveAppFont, subscribeAppFont } from "../../../fonts/repository.ts";
import FontSelect from "../../../fonts/ui/FontSelect.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import type { TenantId } from "../../../tenant/scope.ts";
import styles from "./TeacherSettingsPage.module.css";

export default function FontSettings({ tenantId }: { readonly tenantId: TenantId }) {
  const [fontId, setFontId] = useState(DEFAULT_APP_FONT_ID);
  const [savedId, setSavedId] = useState(DEFAULT_APP_FONT_ID);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let persistedId = DEFAULT_APP_FONT_ID;
    const unsubscribe = subscribeAppFont(tenantId, (id) => {
      persistedId = id;
      setFontId(id);
      setSavedId(id);
      setLoading(false);
    }, (value) => {
      setError(toErrorMessage(value, "폰트 설정을 불러오지 못했습니다."));
      setLoading(false);
    });
    return () => {
      unsubscribe();
      applyAppFont(persistedId);
    };
  }, [tenantId]);

  const save = async (): Promise<void> => {
    setSaving(true);
    setError("");
    try {
      await saveAppFont(tenantId, fontId);
    } catch (value: unknown) {
      setError(toErrorMessage(value, "폰트 설정을 저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return <Card className={styles.fontSettings}>
    <h2>폰트 설정</h2>
    {loading ? <p role="status">불러오는 중…</p> : <FontSelect
      value={FONT_CATALOG.find((font) => font.id === fontId)?.family ?? ""}
      label="시스템 폰트" ariaLabel="시스템 폰트" defaultOptionLabel="기본" previewFonts={false} disabled={saving}
      onChange={(family) => {
        const id = FONT_CATALOG.find((font) => font.family === family)?.id ?? DEFAULT_APP_FONT_ID;
        setFontId(id);
        applyAppFont(id);
      }}
    />}
    {error ? <p role="alert">{error}</p> : null}
    <Button onClick={() => void save()} disabled={loading || saving || fontId === savedId}>{saving ? "저장 중…" : "저장"}</Button>
  </Card>;
}
