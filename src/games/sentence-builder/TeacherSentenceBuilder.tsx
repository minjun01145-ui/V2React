import { useMemo } from "react";
import { readSentenceUnit } from "../../game-engine/sequence/words.ts";
import LiveLeaderboard from "../../game-engine/timed-game/LiveLeaderboard.tsx";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import { adaptReadingChunksSet } from "./readingChunksAdapter.ts";

interface Props {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly set: unknown;
}

export default function TeacherSentenceBuilder({ roomId, session, set }: Props) {
  const adaptedSet = useMemo(() => adaptReadingChunksSet(set, readSentenceUnit(session.gameConfig)), [set, session.gameConfig]);
  return <LiveLeaderboard roomId={roomId} session={session} title={`${adaptedSet.title} · 문장 조립`} />;
}
