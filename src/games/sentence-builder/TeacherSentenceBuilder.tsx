import { useMemo } from "react";
import LiveLeaderboard from "../../game-engine/timed-game/LiveLeaderboard.tsx";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import { adaptReadingChunksSet } from "./readingChunksAdapter.ts";

interface Props {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly set: unknown;
}

export default function TeacherSentenceBuilder({ roomId, session, set }: Props) {
  const adaptedSet = useMemo(() => adaptReadingChunksSet(set), [set]);
  return <LiveLeaderboard roomId={roomId} session={session} title={`${adaptedSet.title} · 문장 만들기`} />;
}
