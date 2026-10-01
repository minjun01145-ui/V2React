import { TIMED_GAME_MODE_OPTIONS, isTimedGameMode } from "../../../game-engine/timed-game/config.ts";
import Card from "../../../shared/ui/Card.tsx";
import Field from "../../../shared/ui/Field.tsx";
import Select from "../../../shared/ui/Select.tsx";
import SegmentedControl from "../../../shared/ui/SegmentedControl.tsx";
import { GameSetupPanel } from "./GameSetupPanel.tsx";
import QuizGameLaunchPanel from "./QuizGameLaunchPanel.tsx";
import styles from "./ActivityLaunchPanel.module.css";
import type { GameSetupState } from "./useGameSetup.ts";
import type { useActivityLaunch } from "./useActivityLaunch.ts";

export default function ActivityLaunchPanel({ setup, disabled, launch }: {
  readonly setup: GameSetupState;
  readonly disabled: boolean;
  readonly launch: ReturnType<typeof useActivityLaunch>;
}) {
  const { activityKind, setActivityKind, options, handleQuizPlanChange, questionCount, setQuestionCount, englishOnly, setEnglishOnly } = launch;
  return <Card className={styles.launchPanel}>
    <h2 className={styles.launchTitle}>수업 시작</h2>
    <SegmentedControl options={options} value={activityKind} onChange={setActivityKind} disabled={disabled} ariaLabel="시작할 수업 활동" />
    <div className={styles.launchContent}>
      {activityKind === "game" ? <GameSetupPanel setup={setup} disabled={disabled} /> : null}
      {activityKind === "quiz" ? <QuizGameLaunchPanel disabled={disabled} onPlanChange={handleQuizPlanChange} /> : null}
      {activityKind === "questions" ? <div className={styles.questionSetup}>
        <h2>학생 질문 만들기</h2>
        <div className={styles.questionControls}>
          <Field label="학생당 질문 수"><Select value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} disabled={disabled}>{[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count}개</option>)}</Select></Field>
          <Field label="영어 질문만 받기"><input className={styles.checkbox} type="checkbox" checked={englishOnly} onChange={(event) => setEnglishOnly(event.target.checked)} disabled={disabled} /></Field>
        </div>
      </div> : null}
      {activityKind === "latest-questions" ? <div className={styles.latestQuestionSetup}>
        <div><h2>완성된 학생 질문</h2></div>
        <Field label="게임 시간"><Select value={setup.timedMode} onChange={(event) => { if (isTimedGameMode(event.target.value)) setup.selectTimedMode(event.target.value); }} disabled={disabled}>{TIMED_GAME_MODE_OPTIONS.map((option) => <option value={option.mode} key={option.mode}>{option.label} 모드</option>)}</Select></Field>
      </div> : null}
    </div>
  </Card>;
}
