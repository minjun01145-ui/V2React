import GameHost from "../../games/GameHost.tsx";
import PageShell from "../../shared/PageShell.tsx";
import type { StudentIdentity } from "../../auth/types.ts";
import StudentStatusScreen from "./session/StudentStatusScreen.tsx";
import { useStudentSession } from "./session/useStudentSession.ts";
import WaitingRoom from "./WaitingRoom.tsx";

interface Props {
  readonly roomId: string;
  readonly identity: StudentIdentity;
  readonly onChangeStudent: () => Promise<void>;
}

export default function StudentPage({ roomId, identity, onChangeStudent }: Props) {
  const { state, retryJoin, leave } = useStudentSession({ roomId, identity, onChangeStudent });

  if (state.view === "playing") {
    return (
      <PageShell eyebrow="STUDENT GAME" title="게임 진행 중" roomId={roomId}>
        <GameHost role="student" roomId={roomId} session={state.session} player={state.player} />
      </PageShell>
    );
  }

  if (state.view === "lobby") {
    return (
      <PageShell eyebrow="STUDENT LOBBY" title="게임 대기실" roomId={roomId}>
        <WaitingRoom
          studentNumber={state.player.studentNumber}
          displayName={state.player.displayName}
          onLeave={leave}
        />
      </PageShell>
    );
  }

  return <StudentStatusScreen roomId={roomId} state={state} onRetryJoin={retryJoin} onLeave={leave} />;
}
