import type { Player } from "../../../multiplayer/types.ts";
import PageShell from "../../../shared/PageShell.tsx";
import WaitingRoom from "./WaitingRoom.tsx";

interface Props {
  readonly roomId: string;
  readonly player: Player;
  readonly onLeave: () => Promise<void>;
}

export default function StudentLobbyPage({ roomId, player, onLeave }: Props) {
  return (
    <PageShell eyebrow="STUDENT LOBBY" title="게임 대기실" roomId={roomId}>
      <WaitingRoom
        studentNumber={player.studentNumber}
        displayName={player.displayName}
        onLeave={onLeave}
      />
    </PageShell>
  );
}