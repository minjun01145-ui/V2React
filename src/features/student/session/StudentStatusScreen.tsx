import PageShell from "../../../shared/PageShell.tsx";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import Button from "../../../shared/ui/Button.tsx";
import type { StudentStatusState } from "./studentSessionState.ts";

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
        <PageShell title="접속 중" roomId={roomId}>
          <StatusPanel title="연결 중">실시간 수업 연결을 확인하고 있습니다.</StatusPanel>
        </PageShell>
      );
    case "session-error":
      return (
        <PageShell title="연결 오류" roomId={roomId}>
          <StatusPanel title="Firebase 연결 오류" tone="error">{state.error.message}</StatusPanel>
        </PageShell>
      );
    case "player-error":
      return (
        <PageShell title="연결 오류" roomId={roomId}>
          <StatusPanel title="학생 연결 정보 오류" tone="error">{state.error.message}</StatusPanel>
        </PageShell>
      );
    case "join-error":
      return (
        <PageShell title="입장 오류" roomId={roomId}>
          <StatusPanel title="대기실 입장 실패" tone="error">{state.error.message}</StatusPanel>
          <Button onClick={onRetryJoin}>다시 시도</Button>
          <Button variant="ghost" onClick={() => void onLeave()}>다른 학생으로</Button>
        </PageShell>
      );
    case "heartbeat-error":
      return (
        <PageShell title="연결 오류" roomId={roomId}>
          <StatusPanel title="대기실 연결 확인 필요" tone="error">{state.error.message}</StatusPanel>
        </PageShell>
      );
    case "waiting-for-session":
      return (
        <PageShell title="대기 중" roomId={roomId}>
          <StatusPanel title="선생님이 대기실을 준비 중" tone="waiting">준비가 끝나면 자동으로 입장합니다.</StatusPanel>
        </PageShell>
      );
    case "joining":
      return (
        <PageShell title="대기 중" roomId={roomId}>
          <StatusPanel title="현재 라운드로 복귀 중">진행 상황을 확인하고 게임에 다시 연결합니다.</StatusPanel>
        </PageShell>
      );
  }
}
