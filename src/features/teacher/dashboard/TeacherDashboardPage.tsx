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
          <Eyebrow>STUDENT ROSTER</Eyebrow>
          <h2>학생 명단 관리</h2>
          <Muted>학생을 등록하거나 로그인 중지, PIN 초기화, 명단 삭제 작업을 처리합니다.</Muted>
          <a className={styles.link} href="#/students">학생 관리 열기 →</a>
        </Card>
        <Card>
          <Eyebrow>LEARNING SETS</Eyebrow>
          <h2>학습 세트 편집</h2>
          <Muted>단어와 끊어읽기 자료를 엑셀에서 붙여넣어 저장하고 게임에 연결합니다.</Muted>
          <a className={styles.link} href="#/sets">세트 편집기 열기 →</a>
        </Card>
        <Card>
          <Eyebrow>AI PROVIDER</Eyebrow>
          <h2>AI API 관리</h2>
          <Muted>Ollama Cloud 키와 모델 옵션을 설정하고 연결 및 실제 메시지를 테스트합니다.</Muted>
          <a className={styles.link} href="#/ai">AI 설정 열기 →</a>
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
