import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import LiveLeaderboard from "../../game-engine/timed-game/LiveLeaderboard.tsx";

export default function MatchingTeacherGame({ roomId, session, set }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly set: RuntimeLearningSet;
}) {
  return <LiveLeaderboard roomId={roomId} session={session} title={`${set.name} · 짝맞추기(일부카드)`} />;
}
