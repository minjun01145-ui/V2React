import { useMemo } from "react";
import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { adaptLearningSetToTyping } from "./typingAdapter.ts";
import { typingGameOptions } from "./config.ts";
import TypingLeaderboard from "./TypingLeaderboard.tsx";
import { useTypingSet } from "./useTypingSet.ts";

function TypingMonitor({ roomId, session, set }: TeacherGameModuleProps & { readonly set: unknown }) {
  const options = useMemo(() => typingGameOptions(session), [session]);
  const adaptedSet = useMemo(() => adaptLearningSetToTyping(set, options.target), [options.target, set]);
  return <TypingLeaderboard roomId={roomId} session={session} title={`${adaptedSet.title} · 타자게임`} />;
}

export default function TypingTeacherGame(props: TeacherGameModuleProps) {
  const learningSet = useTypingSet(props.session);
  if (learningSet.loading) return <StatusPanel title="학습 세트 불러오는 중">게임 문장을 준비하고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error?.message ?? "선택된 학습 세트를 찾을 수 없습니다."}</StatusPanel>;
  return <TypingMonitor {...props} set={learningSet.set} />;
}
