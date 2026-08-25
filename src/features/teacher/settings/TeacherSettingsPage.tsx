import { appConfig } from "../../../config/appConfig.ts";
import PageShell from "../../../shared/PageShell.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Eyebrow } from "../../../shared/ui/Typography.tsx";
import styles from "./TeacherSettingsPage.module.css";

export default function TeacherSettingsPage({ roomId }: { readonly roomId: string }) {
  return (
    <PageShell eyebrow="TEACHER SETTINGS" title="설정" roomId={roomId}>
      <Card>
        <Eyebrow>SETTINGS</Eyebrow>
        <h2 className={styles.heading}>수업 설정</h2>
        <dl className={styles.list}>
          <div><dt>현재 수업</dt><dd>{roomId}</dd></div>
          <div><dt>기본 게임</dt><dd>{appConfig.defaultGameId}</dd></div>
        </dl>
      </Card>
    </PageShell>
  );
}
