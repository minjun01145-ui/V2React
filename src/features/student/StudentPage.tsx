import { useEffect } from "react";
import type { StudentIdentity } from "../../auth/types.ts";
import StudentGamePage from "./game/StudentGamePage.tsx";
import StudentLobbyPage from "./lobby/StudentLobbyPage.tsx";
import StudentStatusScreen from "./session/StudentStatusScreen.tsx";
import { useStudentSession } from "./session/useStudentSession.ts";
import { useStudentCharacter } from "../../student-data/cosmetics/StudentCharacterProvider.tsx";
import { equippedAvatarKey } from "../../student-data/cosmetics/repository.ts";
import { updatePlayerAvatar } from "../../multiplayer/repository.ts";

interface Props {
  readonly roomId: string;
  readonly identity: StudentIdentity;
  readonly onChangeStudent: () => Promise<void>;
}

export default function StudentPage({ roomId, identity, onChangeStudent }: Props) {
  const { state, slideShow, joinWithNickname, retryJoin, leave } = useStudentSession({ roomId, identity, onChangeStudent });
  const { cosmetics, loading, error } = useStudentCharacter();
  const player = state.view === "playing" || state.view === "lobby" ? state.player : null;
  const avatar = cosmetics.equippedAvatar;
  const savedKey = equippedAvatarKey(avatar);
  const playerKey = equippedAvatarKey(player?.avatar ?? null);
  useEffect(() => {
    if (loading || error || !player || savedKey === playerKey) return;
    void updatePlayerAvatar(roomId, identity.uid, avatar).catch(console.error);
  }, [error, identity.uid, loading, player?.id, playerKey, roomId, savedKey]);

  if (state.view === "playing") {
    return <StudentGamePage roomId={roomId} session={state.session} player={state.player} slideShow={slideShow} />;
  }

  if (state.view === "lobby") {
    return <StudentLobbyPage roomId={roomId} session={state.session} player={state.player} identity={identity} onLeave={leave} />;
  }

  if (state.view === "awaiting-nickname") {
    return (
      <StudentLobbyPage
        roomId={roomId}
        player={null}
        identity={identity}
        onJoin={(choice) => joinWithNickname(choice)}
        defaultDisplayName={identity.displayName}
        selfStudentNumber={identity.studentNumber}
        onLeave={leave}
      />
    );
  }

  return <StudentStatusScreen roomId={roomId} state={state} onRetryJoin={retryJoin} onLeave={leave} />;
}
