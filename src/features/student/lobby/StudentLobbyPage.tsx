import { useState } from "react";
import type { GameSession, Player } from "../../../multiplayer/types.ts";
import type { StudentIdentity } from "../../../auth/types.ts";
import { usePlayers } from "../../../multiplayer/hooks.ts";
import Button from "../../../shared/ui/Button.tsx";
import PageShell from "../../../shared/PageShell.tsx";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import PlayerGrid from "../../../multiplayer/ui/PlayerGrid.tsx";
import NicknamePrompt from "./NicknamePrompt.tsx";
import TypingGameButton from "./TypingGameButton.tsx";
import WaitingRoom from "./WaitingRoom.tsx";

interface LobbyProps {
  readonly roomId: string;
  readonly session: GameSession;
  readonly player: Player;
  readonly identity: StudentIdentity;
  readonly onLeave: () => Promise<void>;
}

interface EntryProps {
  readonly roomId: string;
  readonly player: null;
  readonly onJoin: (nickname: string | null) => Promise<void>;
  readonly defaultDisplayName: string;
  readonly selfStudentNumber: string;
  readonly onLeave: () => Promise<void>;
}

type Props = LobbyProps | EntryProps;

export default function StudentLobbyPage(props: Props) {
  const [leaving, setLeaving] = useState(false);
  const leaveButton = (
    <Button
      variant="ghost"
      disabled={leaving}
      onClick={() => {
        if (leaving) return;
        setLeaving(true);
        void props.onLeave().catch((error: unknown) => {
          console.error(error);
          setLeaving(false);
        });
      }}
    >
      {leaving ? "나가는 중…" : "대기실 나가기"}
    </Button>
  );

  if (props.player === null) {
    if (leaving) {
      return (
        <PageShell title="게임 대기실" roomId={props.roomId} actions={leaveButton}>
          <StatusPanel title="대기실에서 나가는 중" tone="waiting">로그인 화면으로 이동하고 있습니다.</StatusPanel>
        </PageShell>
      );
    }
    const { roomId, onJoin, defaultDisplayName, selfStudentNumber } = props;
    return (
      <PageShell title="게임 대기실" roomId={roomId} actions={leaveButton}>
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
    <PageShell title="게임 대기실" roomId={roomId} actions={leaveButton}>
      <WaitingRoom
        roomId={roomId}
        session={session}
        selfStudentNumber={player.studentNumber}
        displayName={player.displayName}
        nickname={player.nickname}
        avatar={player.avatar ?? null}
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
