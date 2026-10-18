import { useEffect, useState } from "react";
import { THEMES, type ThemeId } from "../../../appearance/themes.ts";
import { saveTheme, subscribeAppearance } from "../../../fonts/repository.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Card from "../../../shared/ui/Card.tsx";
import type { TenantId } from "../../../tenant/scope.ts";
import styles from "./TeacherSettingsPage.module.css";
import ThemePreview from "./ThemePreview.tsx";

export default function ThemeSettings({ tenantId }: { readonly tenantId: TenantId }) {
  const [selected, setSelected] = useState<ThemeId>("classic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => subscribeAppearance(tenantId, ({ themeId }) => {
    setSelected(themeId);
    setLoading(false);
  }, (value) => {
    setError(toErrorMessage(value, "테마를 불러오지 못했습니다."));
    setLoading(false);
  }), [tenantId]);
  async function select(id: ThemeId) {
    if (id === selected) return;
    setSaving(true);
    setError("");
    try { await saveTheme(tenantId, id); }
    catch (value) { setError(toErrorMessage(value, "테마를 저장하지 못했습니다.")); }
    finally { setSaving(false); }
  }
  return <Card className={styles.fontSettings}>
    <h2>테마</h2>
    <div className={styles.themes}>
      {THEMES.map((theme) => <button type="button" key={theme.id} aria-pressed={selected === theme.id}
        disabled={loading || saving} onClick={() => void select(theme.id)}>
        <ThemePreview themeId={theme.id} />
        <span>{theme.label}{selected === theme.id ? " ✓" : ""}</span>
      </button>)}
    </div>
    {loading || saving ? <p role="status">{saving ? "테마 적용 중…" : "불러오는 중…"}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </Card>;
}
