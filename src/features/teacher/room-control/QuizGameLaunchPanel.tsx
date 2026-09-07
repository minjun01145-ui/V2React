import { useEffect, useState } from "react";
import { getQuizGamePlan, listQuizGamePlans } from "../../../quiz-game/repository.ts";
import type { QuizGamePlan, QuizGamePlanSummary } from "../../../quiz-game/types.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import { Muted } from "../../../shared/ui/Typography.tsx";
import styles from "./TeacherRoomController.module.css";

export default function QuizGameLaunchPanel({ disabled, onPlanChange }: {
  readonly disabled: boolean;
  readonly onPlanChange: (plan: QuizGamePlan | null) => void;
}) {
  const [plans, setPlans] = useState<readonly QuizGamePlanSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(false);

  useEffect(() => {
    let active = true;
    void listQuizGamePlans().then((next) => {
      if (!active) return;
      setPlans(next);
      setSelectedId((current) => current && next.some((plan) => plan.id === current) ? current : (next[0]?.id ?? ""));
    }).catch((value: unknown) => { if (active) setError(toErrorMessage(value, "퀴즈 목록을 불러오지 못했습니다.")); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    onPlanChange(null);
    if (!selectedId) return () => { active = false; };
    setLoadingPlan(true);
    setError("");
    void getQuizGamePlan(selectedId).then((plan) => {
      if (active) onPlanChange(plan);
    }).catch((value: unknown) => {
      if (active) setError(toErrorMessage(value, "퀴즈 내용을 불러오지 못했습니다."));
    }).finally(() => { if (active) setLoadingPlan(false); });
    return () => { active = false; };
  }, [onPlanChange, selectedId]);

  return <div className={styles.quizSetup}>
    <h2>퀴즈쇼 모드</h2>
    <label>퀴즈<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={disabled || loadingPlan}><option value="">저장된 퀴즈 선택</option>{plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name} ({plan.roundCount}문제)</option>)}</select></label>
    {loadingPlan ? <Muted>퀴즈 내용을 불러오는 중…</Muted> : null}
    {error ? <p className={styles.setError}>{error}</p> : null}
  </div>;
}
