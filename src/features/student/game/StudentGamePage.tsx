import GameHost from "../../../games/GameHost.tsx";
import PageShell from "../../../shared/PageShell.tsx";
import type { GameSession, Player } from "../../../multiplayer/types.ts";
import StudentQuizGameRuntime from "../quiz-game-runtime/StudentQuizGameRuntime.tsx";

interface Props {
  readonly roomId: string;
  readonly session: GameSession;
  readonly player: Player;
}

export default function StudentGamePage({ roomId, session, player }: Props) {
  return (
    <PageShell title="게임 진행 중" roomId={roomId}>
      {session.quizGame
        ? <StudentQuizGameRuntime roomId={roomId} session={session} player={player} />
        : <GameHost role="student" roomId={roomId} session={session} player={player} />}
    </PageShell>
  );
}
