import GameHost from "../../../games/GameHost.tsx";
import PageShell from "../../../shared/PageShell.tsx";
import type { GameSession, Player } from "../../../multiplayer/types.ts";

interface Props {
  readonly roomId: string;
  readonly session: GameSession;
  readonly player: Player;
}

export default function StudentGamePage({ roomId, session, player }: Props) {
  return (
    <PageShell eyebrow="STUDENT GAME" title="게임 진행 중" roomId={roomId}>
      <GameHost role="student" roomId={roomId} session={session} player={player} />
    </PageShell>
  );
}