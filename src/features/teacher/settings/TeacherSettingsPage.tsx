import { appConfig } from "../../../config/appConfig.ts";
import PageShell from "../../../shared/PageShell.tsx";
import Card from "../../../shared/ui/Card.tsx";
import styles from "./TeacherSettingsPage.module.css";

export default function TeacherSettingsPage({ roomId: _roomId }: { readonly roomId: string }) {
  return (
    <PageShell title="설정" roomId={_roomId}>
      <Card>
        <h2 className={styles.heading}>수업 설정</h2>
        <dl className={styles.list}>
          <div><dt>기본 게임</dt><dd>{appConfig.defaultGameId}</dd></div>
        </dl>
      </Card>
    </PageShell>
  );
}
