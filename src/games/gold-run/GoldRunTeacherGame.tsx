import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import LiveLeaderboard from "../../game-engine/timed-game/LiveLeaderboard.tsx";

export default function GoldRunTeacherGame({ roomId, session }: TeacherGameModuleProps) {
  return <LiveLeaderboard roomId={roomId} session={session} title="골드런" />;
}
