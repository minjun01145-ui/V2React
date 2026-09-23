import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { useSimpleQuizGame } from "./useSimpleQuizGame.ts";
import { useSimpleQuizSet } from "./useSimpleQuizSet.ts";
import SimpleQuizPlay from "./SimpleQuizPlay.tsx";

export default function SimpleQuizStudentModule({ roomId, session, player }: StudentGameModuleProps) {
  const learningSet = useSimpleQuizSet(session);
  const clock = useTimedGameClock(session);
  if (learningSet.loading) return <StatusPanel title="심플퀴즈 준비 중">문제와 선택지를 만들고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="단어 세트 오류" tone="error">{learningSet.error?.message ?? "선택한 단어 세트를 찾을 수 없습니다."}</StatusPanel>;
  return <SimpleQuizMultiplayerGame roomId={roomId} session={session} player={player} set={learningSet.set} clockExpired={clock.expired} />;
}

function SimpleQuizMultiplayerGame({ roomId, session, player, set, clockExpired }: {
  readonly roomId: string;
  readonly session: StudentGameModuleProps["session"];
  readonly player: StudentGameModuleProps["player"];
  readonly set: NonNullable<ReturnType<typeof useSimpleQuizSet>["set"]>;
  readonly clockExpired: boolean;
}) {
  const game = useSimpleQuizGame({ roomId, session, player, set, disabled: clockExpired });
  return <SimpleQuizPlay game={game} clockExpired={clockExpired} />;
}
