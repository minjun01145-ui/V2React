import PageShell from "../../../shared/PageShell.tsx";
import Card from "../../../shared/ui/Card.tsx";
import styles from "./TeacherDashboardPage.module.css";

export default function TeacherDashboardPage({ roomId }: { readonly roomId: string }) {
  return (
    <PageShell title="관리자 홈" roomId={roomId}>
      <div className={styles.grid}>
        <Card>
          <h2>게임 대기실</h2>
          <a className={styles.link} href="#/lobby">열기 →</a>
        </Card>
        <Card>
          <h2>학생 명단 관리</h2>
          <a className={styles.link} href="#/students">열기 →</a>
        </Card>
        <Card>
          <h2>학습 세트 편집</h2>
          <a className={styles.link} href="#/sets">열기 →</a>
        </Card>
        <Card>
          <h2>AI API 관리</h2>
          <a className={styles.link} href="#/ai">열기 →</a>
        </Card>
        <Card>
          <h2>수업 설정</h2>
          <a className={styles.link} href="#/settings">열기 →</a>
        </Card>
        <Card>
          <h2>테스트 툴</h2>
          <a className={styles.link} href="#/test-tool">열기 →</a>
        </Card>
      </div>
    </PageShell>
  );
}
