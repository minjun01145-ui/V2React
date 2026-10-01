import PageShell from "../../../shared/PageShell.tsx";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import Button from "../../../shared/ui/Button.tsx";
import type { StudentStatusState } from "./studentSessionState.ts";
import styles from "./StudentStatusScreen.module.css";

interface Props {
  readonly roomId: string;
  readonly state: StudentStatusState;
  readonly onRetryJoin: () => void;
  readonly onLeave: () => Promise<void>;
}

export default function StudentStatusScreen({ roomId, state, onRetryJoin, onLeave }: Props) {
  switch (state.view) {
    case "loading":
      return (
        <div className={styles.screen}><PageShell title="접속 중" roomId={roomId}>
          <StatusPanel title="연결 중">실시간 수업 연결을 확인하고 있습니다.</StatusPanel>
        </PageShell></div>
      );
    case "session-error":
      return (
        <div className={styles.screen}><PageShell title="연결 오류" roomId={roomId}>
          <StatusPanel title="Firebase 연결 오류" tone="error">{state.error.message}</StatusPanel>
        </PageShell></div>
      );
    case "player-error":
      return (
        <div className={styles.screen}><PageShell title="연결 오류" roomId={roomId}>
          <StatusPanel title="학생 연결 정보 오류" tone="error">{state.error.message}</StatusPanel>
        </PageShell></div>
      );
    case "participant-error":
      return (
        <div className={styles.screen}><PageShell title="연결 오류" roomId={roomId}>
          <StatusPanel title="라운드 참가 정보 오류" tone="error">{state.error.message}</StatusPanel>
        </PageShell></div>
      );
    case "readiness-error":
      return (
        <div className={styles.screen}><PageShell title="접속 확인 오류" roomId={roomId}>
          <StatusPanel title="게임 시작 확인 실패" tone="error">{state.error.message}</StatusPanel>
          <Button onClick={onRetryJoin}>다시 시도</Button>
        </PageShell></div>
      );
    case "join-error":
      return (
        <div className={styles.screen}><PageShell title="입장 오류" roomId={roomId}>
          <StatusPanel title="대기실 입장 실패" tone="error">{state.error.message}</StatusPanel>
          <Button onClick={onRetryJoin}>다시 시도</Button>
          <Button variant="ghost" onClick={() => void onLeave()}>다른 학생으로</Button>
        </PageShell></div>
      );
    case "heartbeat-error":
      return (
        <div className={styles.screen}><PageShell title="연결 오류" roomId={roomId}>
          <StatusPanel title="대기실 연결 확인 필요" tone="error">{state.error.message}</StatusPanel>
        </PageShell></div>
      );
    case "waiting-for-session":
      return (
        <div className={styles.screen}><PageShell title="대기 중" roomId={roomId}>
          <StatusPanel title="선생님이 대기실을 준비 중" tone="waiting">준비가 끝나면 자동으로 입장합니다.</StatusPanel>
        </PageShell></div>
      );
    case "joining":
      return (
        <div className={styles.screen}><PageShell title="대기 중" roomId={roomId}>
          <StatusPanel title="현재 라운드로 복귀 중">진행 상황을 확인하고 게임에 다시 연결합니다.</StatusPanel>
        </PageShell></div>
      );
    case "preparing":
      return (
        <div className={styles.screen}><PageShell title="게임 시작 준비" roomId={roomId}>
          <StatusPanel title="게임을 미리 준비하는 중" tone="waiting">게임 코드·문제·진행 기록을 불러오고 있습니다. 모두 준비되면 함께 카운트다운합니다.</StatusPanel>
        </PageShell></div>
      );
  }
}
