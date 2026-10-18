import { appConfig } from "../../../config/appConfig.ts";
import PageShell from "../../../shared/PageShell.tsx";
import Card from "../../../shared/ui/Card.tsx";
import SegmentedControl from "../../../shared/ui/SegmentedControl.tsx";
import type { TenantConfig } from "../../../tenant/config.ts";
import { PRIMARY_TENANT_ID } from "../../../tenant/scope.ts";
import TeacherAiPage from "../ai/TeacherAiPage.tsx";
import FontSettings from "./FontSettings.tsx";
import ThemeSettings from "./ThemeSettings.tsx";
import styles from "./TeacherSettingsPage.module.css";
import CharacterShopManagement from "./CharacterShopManagement.tsx";

interface Props {
  readonly roomId: string;
  readonly tenant: TenantConfig;
  readonly section: "general" | "ai" | "fonts";
  readonly onSectionChange: (section: Props["section"]) => void;
}

const sections = [
  { id: "general", label: "수업 설정" },
  { id: "ai", label: "AI 설정" },
  { id: "fonts", label: "테마 · 폰트" },
] as const;

export default function TeacherSettingsPage({ roomId, tenant, section, onSectionChange }: Props) {
  const availableSections = sections.filter(({ id }) => id !== "ai" || tenant.id === PRIMARY_TENANT_ID);
  const activeSection = section === "ai" && tenant.id !== PRIMARY_TENANT_ID ? "general" : section;
  return (
    <PageShell title="설정" roomId={roomId}>
      <SegmentedControl options={availableSections} value={activeSection} onChange={onSectionChange} ariaLabel="설정 항목" />
      {activeSection === "general" ? <>
      <Card>
        <h2 className={styles.heading}>수업 설정</h2>
        <dl className={styles.list}>
          <div><dt>기본 게임</dt><dd>{appConfig.defaultGameId}</dd></div>
        </dl>
      </Card>
      <CharacterShopManagement />
      </> : null}
      {activeSection === "ai" ? <TeacherAiPage /> : null}
      {activeSection === "fonts" ? <><ThemeSettings tenantId={tenant.id} /><FontSettings tenantId={tenant.id} /></> : null}
    </PageShell>
  );
}
