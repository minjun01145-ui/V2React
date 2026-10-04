import { lazy, Suspense } from "react";
import GameHost from "../../../games/GameHost.tsx";
import StudentGameFrame from "./StudentGameFrame.tsx";
import type { GameSession, Player } from "../../../multiplayer/types.ts";
import type { SlideShowSessionState } from "../../../slide-show/types.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";

// Fabric.js is only downloaded by students when a slide show is actually running.
const StudentSlideShowRuntime = lazy(() => import("../slide-show-runtime/StudentSlideShowRuntime.tsx"));

interface Props {
  readonly roomId: string;
  readonly session: GameSession;
  readonly player: Player;
  readonly slideShow: SlideShowSessionState | null;
}

export default function StudentGamePage({ roomId, session, player, slideShow }: Props) {
  return (
    <StudentGameFrame>
      {slideShow
        ? <Suspense fallback={<StatusPanel title="슬라이드쇼를 여는 중" tone="waiting">잠시만 기다려 주세요.</StatusPanel>}><StudentSlideShowRuntime roomId={roomId} session={session} player={player} slideShow={slideShow} /></Suspense>
        : <GameHost role="student" roomId={roomId} session={session} player={player} />}
    </StudentGameFrame>
  );
}
