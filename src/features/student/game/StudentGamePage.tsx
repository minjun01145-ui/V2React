import GameHost from "../../../games/GameHost.tsx";
import StudentGameFrame from "./StudentGameFrame.tsx";
import type { GameSession, Player } from "../../../multiplayer/types.ts";
import type { QuizGameSessionState } from "../../../quiz-game/types.ts";
import StudentQuizGameRuntime from "../quiz-game-runtime/StudentQuizGameRuntime.tsx";

interface Props {
  readonly roomId: string;
  readonly session: GameSession;
  readonly player: Player;
  readonly quizGame: QuizGameSessionState | null;
}

export default function StudentGamePage({ roomId, session, player, quizGame }: Props) {
  return (
    <StudentGameFrame>
      {quizGame
        ? <StudentQuizGameRuntime roomId={roomId} session={session} player={player} quizGame={quizGame} />
        : <GameHost role="student" roomId={roomId} session={session} player={player} />}
    </StudentGameFrame>
  );
}
