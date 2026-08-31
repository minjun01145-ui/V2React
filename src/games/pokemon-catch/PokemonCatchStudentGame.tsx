import type { ComponentType } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import StudentPokemonCatch, { type PokemonMatchingQuizComponent, type PokemonSentenceQuizComponent } from "./StudentPokemonCatch.tsx";
import { usePokemonCatchSet } from "./usePokemonCatchSet.ts";

export function createPokemonCatchStudentGame(
  MatchingQuiz: PokemonMatchingQuizComponent,
  SentenceQuiz: PokemonSentenceQuizComponent,
): ComponentType<StudentGameModuleProps> {
  return function PokemonCatchStudentGame({ roomId, session, player }: StudentGameModuleProps) {
    const learningSet = usePokemonCatchSet(session);
    if (learningSet.loading) return <StatusPanel title="학습 세트 불러오는 중">야생 포켓몬과 문제를 준비하고 있습니다.</StatusPanel>;
    if (learningSet.error || !learningSet.set) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error?.message ?? "선택한 학습 세트를 찾을 수 없습니다."}</StatusPanel>;
    return <StudentPokemonCatch roomId={roomId} session={session} player={player} set={learningSet.set} MatchingQuiz={MatchingQuiz} SentenceQuiz={SentenceQuiz} />;
  };
}

