import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import LiveLeaderboard from "../../game-engine/timed-game/LiveLeaderboard.tsx";

export default function MatchingTeacherGame({ roomId, session, set }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly set: LearningSet;
}) {
  return <LiveLeaderboard roomId={roomId} session={session} title={`${set.name} · 짝맞추기`} />;
}
