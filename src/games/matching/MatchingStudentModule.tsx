import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import MatchingStudentGame from "./MatchingStudentGame.tsx";
import MatchingAllStudentGame from "./MatchingAllStudentGame.tsx";
import { readMatchingCardMode } from "./config.ts";
import { useMatchingSet } from "./useMatchingSet.ts";

export default function MatchingStudentModule({ roomId, session, player }: StudentGameModuleProps) {
  const learningSet = useMatchingSet(session);
  if (learningSet.loading) return <StatusPanel title="단어 세트 불러오는 중">짝맞추기 카드를 준비하고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="단어 세트 오류" tone="error">{learningSet.error?.message ?? "선택한 단어 세트를 찾을 수 없습니다."}</StatusPanel>;
  const Game = readMatchingCardMode(session.gameConfig, session.gameId) === "all" ? MatchingAllStudentGame : MatchingStudentGame;
  return <Game key={session.roundId} roomId={roomId} session={session} player={player} set={learningSet.set} />;
}
