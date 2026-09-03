import type { StudentIdentity } from "../../auth/types.ts";
import StudentGamePage from "./game/StudentGamePage.tsx";
import StudentLobbyPage from "./lobby/StudentLobbyPage.tsx";
import StudentStatusScreen from "./session/StudentStatusScreen.tsx";
import { useStudentSession } from "./session/useStudentSession.ts";

interface Props {
  readonly roomId: string;
  readonly identity: StudentIdentity;
  readonly onChangeStudent: () => Promise<void>;
}

export default function StudentPage({ roomId, identity, onChangeStudent }: Props) {
  const { state, quizGame, joinWithNickname, retryJoin, leave } = useStudentSession({ roomId, identity, onChangeStudent });

  if (state.view === "playing") {
    return <StudentGamePage roomId={roomId} session={state.session} player={state.player} quizGame={quizGame} />;
  }

  if (state.view === "lobby") {
    return <StudentLobbyPage roomId={roomId} session={state.session} player={state.player} identity={identity} />;
  }

  if (state.view === "awaiting-nickname") {
    return (
      <StudentLobbyPage
        roomId={roomId}
        player={null}
        onJoin={(nickname) => joinWithNickname({ nickname })}
        defaultDisplayName={identity.displayName}
        selfStudentNumber={identity.studentNumber}
      />
    );
  }

  return <StudentStatusScreen roomId={roomId} state={state} onRetryJoin={retryJoin} onLeave={leave} />;
}
