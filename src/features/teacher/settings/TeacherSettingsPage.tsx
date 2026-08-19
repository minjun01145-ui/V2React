import { appConfig } from "../../../config/appConfig.ts";
import PageShell from "../../../shared/PageShell.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Eyebrow, Muted } from "../../../shared/ui/Typography.tsx";
import styles from "./TeacherSettingsPage.module.css";

export default function TeacherSettingsPage({ roomId }: { readonly roomId: string }) {
  return (
    <PageShell eyebrow="TEACHER SETTINGS" title="설정" roomId={roomId}>
      <Card>
        <Eyebrow>ARCHITECTURE SLOT</Eyebrow>
        <h2 className={styles.heading}>교사용 설정 영역</h2>
        <Muted>콘텐츠와 게임 선택, 제한 시간, 점수 규칙처럼 교사만 변경해야 하는 설정을 이 화면에 추가할 수 있습니다.</Muted>
        <dl className={styles.list}>
          <div><dt>현재 수업</dt><dd>{roomId}</dd></div>
          <div><dt>기본 게임</dt><dd>{appConfig.defaultGameId}</dd></div>
        </dl>
      </Card>
    </PageShell>
  );
}
