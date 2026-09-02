import type { GameSession, Player } from "../../../multiplayer/types.ts";
import type { StudentIdentity } from "../../../auth/types.ts";
import { usePlayers } from "../../../multiplayer/hooks.ts";
import Button from "../../../shared/ui/Button.tsx";
import PageShell from "../../../shared/PageShell.tsx";
import PlayerGrid from "../../../multiplayer/ui/PlayerGrid.tsx";
import NicknamePrompt from "./NicknamePrompt.tsx";
import TypingGameButton from "./TypingGameButton.tsx";
import WaitingRoom from "./WaitingRoom.tsx";

interface LobbyProps {
  readonly roomId: string;
  readonly session: GameSession;
  readonly player: Player;
  readonly identity: StudentIdentity;
}

interface EntryProps {
  readonly roomId: string;
  readonly player: null;
  readonly onJoin: (nickname: string | null) => Promise<void>;
  readonly defaultDisplayName: string;
  readonly selfStudentNumber: string;
}

type Props = LobbyProps | EntryProps;

export default function StudentLobbyPage(props: Props) {
  if (props.player === null) {
    const { roomId, onJoin, defaultDisplayName, selfStudentNumber } = props;
    return (
      <PageShell title="게임 대기실" roomId={roomId}>
        <NicknamePrompt
          defaultDisplayName={defaultDisplayName}
          onChooseNickname={onJoin}
        />
        <WaitingRoomSkeleton roomId={roomId} selfStudentNumber={selfStudentNumber} />
      </PageShell>
    );
  }

  const { roomId, session, player, identity } = props;
  return (
    <PageShell title="게임 대기실" roomId={roomId}>
      <WaitingRoom
        roomId={roomId}
        session={session}
        selfStudentNumber={player.studentNumber}
        displayName={player.displayName}
        nickname={player.nickname}
        uid={identity.uid}
      />
    </PageShell>
  );
}

function WaitingRoomSkeleton({
  roomId,
  selfStudentNumber,
}: {
  readonly roomId: string;
  readonly selfStudentNumber: string;
}) {
  const { activePlayers } = usePlayers(roomId);
  return (
    <>
      <PlayerGrid players={activePlayers} selfStudentNumber={selfStudentNumber} />
      <TypingGameButton />
      <Button variant="ghost" disabled>상점 보기</Button>
    </>
  );
}
