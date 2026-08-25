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
  const { state, retryJoin, leave } = useStudentSession({ roomId, identity, onChangeStudent });

  if (state.view === "playing") {
    return <StudentGamePage roomId={roomId} session={state.session} player={state.player} />;
  }

  if (state.view === "lobby") {
    return <StudentLobbyPage roomId={roomId} player={state.player} onLeave={leave} />;
  }

  return <StudentStatusScreen roomId={roomId} state={state} onRetryJoin={retryJoin} onLeave={leave} />;
}
