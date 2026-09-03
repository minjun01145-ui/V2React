import { useEffect, useState } from "react";
import { getQuizGamePlan, listQuizGamePlans } from "../../../quiz-game/repository.ts";
import type { QuizGamePlan, QuizGamePlanSummary } from "../../../quiz-game/types.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Muted } from "../../../shared/ui/Typography.tsx";
import styles from "./TeacherRoomController.module.css";

export default function QuizGameLaunchPanel({ disabled, onStart }: {
  readonly disabled: boolean;
  readonly onStart: (plan: QuizGamePlan) => Promise<void>;
}) {
  const [plans, setPlans] = useState<readonly QuizGamePlanSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void listQuizGamePlans().then((next) => {
      if (!active) return;
      setPlans(next);
      setSelectedId((current) => current && next.some((plan) => plan.id === current) ? current : (next[0]?.id ?? ""));
    }).catch((value: unknown) => { if (active) setError(toErrorMessage(value, "퀴즈 목록을 불러오지 못했습니다.")); });
    return () => { active = false; };
  }, []);

  const start = async (): Promise<void> => {
    if (!selectedId || busy || disabled) return;
    setBusy(true);
    setError("");
    try {
      await onStart(await getQuizGamePlan(selectedId));
    } catch (value: unknown) {
      setError(toErrorMessage(value, "퀴즈게임을 시작하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  return <Card className={styles.quizPicker}>
    <div><h2>퀴즈게임 모드</h2><Muted>저장한 순서대로 기존 문제 엔진을 실행합니다.</Muted></div>
    <div className={styles.quizPickerControls}><label>퀴즈<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={disabled || busy}><option value="">저장된 퀴즈 선택</option>{plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name} ({plan.roundCount}문제)</option>)}</select></label><Button onClick={() => void start()} disabled={disabled || busy || !selectedId}>{busy ? "불러오는 중…" : "퀴즈 시작"}</Button></div>
    {error ? <p className={styles.setError}>{error}</p> : null}
  </Card>;
}
