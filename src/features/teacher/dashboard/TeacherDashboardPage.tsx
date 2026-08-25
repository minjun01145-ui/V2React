import PageShell from "../../../shared/PageShell.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Eyebrow } from "../../../shared/ui/Typography.tsx";
import styles from "./TeacherDashboardPage.module.css";

export default function TeacherDashboardPage({ roomId }: { readonly roomId: string }) {
  return (
    <PageShell eyebrow="TEACHER ADMIN" title="관리자 홈" roomId={roomId}>
      <div className={styles.grid}>
        <Card>
          <Eyebrow>MULTIPLAYER</Eyebrow>
          <h2>게임 대기실</h2>
          <a className={styles.link} href="#/lobby">열기 →</a>
        </Card>
        <Card>
          <Eyebrow>STUDENT ROSTER</Eyebrow>
          <h2>학생 명단 관리</h2>
          <a className={styles.link} href="#/students">열기 →</a>
        </Card>
        <Card>
          <Eyebrow>LEARNING SETS</Eyebrow>
          <h2>학습 세트 편집</h2>
          <a className={styles.link} href="#/sets">열기 →</a>
        </Card>
        <Card>
          <Eyebrow>AI PROVIDER</Eyebrow>
          <h2>AI API 관리</h2>
          <a className={styles.link} href="#/ai">열기 →</a>
        </Card>
        <Card>
          <Eyebrow>SETTINGS</Eyebrow>
          <h2>수업 설정</h2>
          <a className={styles.link} href="#/settings">열기 →</a>
        </Card>
        <Card>
          <Eyebrow>ISOLATED SANDBOX</Eyebrow>
          <h2>테스트 툴</h2>
          <a className={styles.link} href="#/test-tool">열기 →</a>
        </Card>
      </div>
    </PageShell>
  );
}
