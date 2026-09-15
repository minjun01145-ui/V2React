import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";

export default function FreeResponseTeacherGame(_props: TeacherGameModuleProps) {
  return <StatusPanel title="자유 답안 제출 중">마감 후 학생별 답안을 확인하고 점수를 부여할 수 있습니다.</StatusPanel>;
}
