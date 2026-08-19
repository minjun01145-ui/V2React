import PageShell from "../../../shared/PageShell.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Eyebrow, Muted } from "../../../shared/ui/Typography.tsx";
import styles from "./TeacherDashboardPage.module.css";

export default function TeacherDashboardPage({ roomId }: { readonly roomId: string }) {
  return (
    <PageShell eyebrow="TEACHER ADMIN" title="관리자 홈" roomId={roomId}>
      <div className={styles.grid}>
        <Card>
          <Eyebrow>MULTIPLAYER</Eyebrow>
          <h2>게임 대기실</h2>
          <Muted>학생 접속 상태를 확인하고 게임을 시작하거나 대기실로 되돌립니다.</Muted>
          <a className={styles.link} href="#/lobby">대기실 열기 →</a>
        </Card>
        <Card>
          <Eyebrow>SETTINGS</Eyebrow>
          <h2>게임 및 수업 설정</h2>
          <Muted>콘텐츠 선택, 게임 옵션, 점수 규칙 등 교사용 설정이 모이는 영역입니다.</Muted>
          <a className={styles.link} href="#/settings">설정 열기 →</a>
        </Card>
      </div>
    </PageShell>
  );
}
