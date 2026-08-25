import type { Player } from "../../../multiplayer/types.ts";
import { usePlayers } from "../../../multiplayer/hooks.ts";
import Button from "../../../shared/ui/Button.tsx";
import PageShell from "../../../shared/PageShell.tsx";
import PlayerGrid from "../../../multiplayer/ui/PlayerGrid.tsx";
import NicknamePrompt from "./NicknamePrompt.tsx";
import TypingGameButton from "./TypingGameButton.tsx";
import WaitingRoom from "./WaitingRoom.tsx";

interface LobbyProps {
  readonly roomId: string;
  readonly player: Player;
  readonly onLeave: () => Promise<void>;
}

interface EntryProps {
  readonly roomId: string;
  readonly player: null;
  readonly onJoin: (nickname: string | null) => Promise<void>;
  readonly onLeave: () => Promise<void>;
  readonly defaultDisplayName: string;
  readonly selfStudentNumber: string;
}

type Props = LobbyProps | EntryProps;

export default function StudentLobbyPage(props: Props) {
  if (props.player === null) {
    const { roomId, onJoin, onLeave, defaultDisplayName, selfStudentNumber } = props;
    return (
      <PageShell title="게임 대기실" roomId={roomId}>
        <NicknamePrompt
          defaultDisplayName={defaultDisplayName}
          onChooseNickname={onJoin}
        />
        <WaitingRoomSkeleton roomId={roomId} selfStudentNumber={selfStudentNumber} onLeave={onLeave} />
      </PageShell>
    );
  }

  const { roomId, player, onLeave } = props;
  return (
    <PageShell title="게임 대기실" roomId={roomId}>
      <WaitingRoom
        roomId={roomId}
        selfStudentNumber={player.studentNumber}
        displayName={player.displayName}
        nickname={player.nickname}
        onLeave={onLeave}
      />
    </PageShell>
  );
}

function WaitingRoomSkeleton({
  roomId,
  selfStudentNumber,
  onLeave,
}: {
  readonly roomId: string;
  readonly selfStudentNumber: string;
  readonly onLeave: () => Promise<void>;
}) {
  const { activePlayers } = usePlayers(roomId);
  return (
    <>
      <PlayerGrid players={activePlayers} selfStudentNumber={selfStudentNumber} />
      <TypingGameButton />
      <Button variant="ghost" onClick={() => void onLeave()}>다른 학생으로</Button>
    </>
  );
}