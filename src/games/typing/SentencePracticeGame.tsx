import { useEffect, useRef, useState } from "react";
import { useLearningSet } from "../../learning-sets/useLearningSet.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import { typingDemoSet } from "./demoSet.ts";
import { adaptLearningSetToTypingPractice } from "./typingPracticeAdapter.ts";
import { useSentencePractice } from "./useSentencePractice.ts";
import { savePracticeCompletion, type PracticeCompletion } from "../../student-data/typing-practice/repository.ts";
import type { WaitingTypingConfig } from "./waitingTypingConfig.ts";
import type { TypingQuestionSet } from "./types.ts";
import styles from "./Typing.module.css";

interface Props {
  readonly roomId: string;
  readonly nickname: string;
  readonly config: WaitingTypingConfig;
  readonly onExit: () => void;
}

export default function SentencePracticeGame(props: Props) {
  const remote = useLearningSet(props.config.setId === typingDemoSet.id ? null : props.config.setId);
  const set = props.config.setId === typingDemoSet.id ? typingDemoSet : remote.set;
  if (remote.error || (!remote.loading && !set)) return <>
    <StatusPanel title="단문 연습을 불러오지 못했어요" tone="error">{remote.error?.message ?? "세트를 찾을 수 없습니다."}</StatusPanel>
    <Button onClick={props.onExit}>대기실로</Button>
  </>;
  if (!set) return <StatusPanel title="단문 연습 준비 중">지정된 세트를 불러오고 있어요.</StatusPanel>;
  const questions = adaptLearningSetToTypingPractice(set);
  if (!questions.questions.length) return <><StatusPanel title="문장이 없습니다">다른 세트를 선택해주세요.</StatusPanel><Button onClick={props.onExit}>대기실로</Button></>;
  return <SentencePracticeBoard key={set.id} {...props} set={questions} />;
}

function formatDate(value: number) {
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function SentencePracticeBoard({ roomId, nickname, config, onExit, set }: Props & { readonly set: TypingQuestionSet }) {
  const game = useSentencePractice(set, config);
  const runId = useRef(crypto.randomUUID());
  const inputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<PracticeCompletion | null>(null);
  const [saveError, setSaveError] = useState("");
  const [retry, setRetry] = useState(0);
  const [showRanking, setShowRanking] = useState(false);

  useEffect(() => {
    if (game.completedAt === null) return;
    let active = true;
    setSaveError("");
    void savePracticeCompletion(roomId, runId.current, game.speed, set.questions.length)
      .then((value) => { if (active) setSaved(value); })
      .catch(() => { if (active) setSaveError("기록을 저장하지 못했어요. 다시 저장해주세요."); });
    return () => { active = false; };
  }, [game.completedAt, game.speed, roomId, set.questions.length, retry]);

  const result = saved?.result;
  return <main className={styles.game}>
    <header className={styles.topbar}><h1>영어 단문 연습</h1><Button variant="ghost" onClick={onExit}>대기실로</Button></header>
    {game.completedAt !== null ? <Card className={styles.typingCard}>
      {showRanking && saved ? <>
        <h2>{Number(saved.month.slice(5))}월의 영어 단문연습 순위</h2>
        <p>{saved.month.slice(0, 4)}년 · 평균 타수 순 · 학생별 월간 최고 기록</p>
        <div className={styles.tableScroll}><table className={styles.ranking}>
          <thead><tr><th>순위</th><th>닉네임</th><th>학반</th><th>최고 순간타수</th><th>평균타수</th><th>완주 일시</th></tr></thead>
          <tbody>{saved.records.map((entry, index) => <tr key={index}><td>{index + 1}</td><td>{entry.nickname}</td><td>{entry.classroom}</td><td>{entry.bestCpm}</td><td>{entry.averageCpm}</td><td>{formatDate(entry.completedAt)}</td></tr>)}</tbody>
        </table></div>
      </> : <>
        <h2>세트를 모두 완주했어요!</h2><p>{set.title} · {set.questions.length}문장</p>
        <p>{result?.nickname ?? nickname}{result ? ` · ${result.classroom}` : ""}</p>
        <p>최고 순간타수 {game.speed.bestCpm}타/분 · 평균타수 {game.speed.averageCpm}타/분</p>
        <p>{formatDate(result?.completedAt ?? game.completedAt)}</p>
        <p role="status">{saveError || (saved ? "기록을 저장했어요." : "기록을 저장하고 있어요…")}</p>
        {saveError ? <Button onClick={() => setRetry((value) => value + 1)}>다시 저장</Button> : null}
        <Button disabled={!saved} onClick={() => setShowRanking(true)}>다음 · 월간 순위</Button>
      </>}
    </Card> : <>
      <section className={styles.metrics} aria-label="타자 통계">
        <div><small>현재 타수</small><strong>{game.speed.currentCpm}</strong><span>타/분</span></div>
        <div><small>평균 타수</small><strong>{game.speed.averageCpm}</strong><span>타/분</span></div>
        <div><small>최고 순간타수</small><strong>{game.speed.bestCpm}</strong><span>타/분</span></div>
        <div><small>진행</small><strong>{game.index + 1} / {set.questions.length}</strong></div>
      </section>
      <Card className={styles.typingCard}>
        <div className={styles.cardHeader}><span>{set.title}</span><p>{game.question?.helperText}</p></div>
        <p className={styles.target}><span>{game.question?.targetText.slice(0, game.comparison.currentPrefixLength)}</span><b data-error={game.comparison.hasError}>{game.question?.targetText.slice(game.comparison.currentPrefixLength)}</b></p>
        <label className={styles.inputLabel}><span>문장을 입력한 뒤 Enter를 눌러주세요.</span>
          <input ref={inputRef} autoFocus value={game.input} onChange={(event) => game.updateInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); game.next(); } }}
            aria-invalid={game.comparison.hasError} autoComplete="off" autoCapitalize="off" spellCheck={false} />
        </label>
        <div className={styles.feedback} data-tone={game.comparison.hasError ? "error" : "neutral"} role="status">
          {game.comparison.hasError ? "빨간 부분부터는 타수가 기록되지 않아요. 오타를 고쳐주세요." : "정확하게 입력한 부분만 타수에 반영됩니다."}
          <Button disabled={!game.comparison.isComplete} onClick={() => { game.next(); inputRef.current?.focus(); }}>{game.index === set.questions.length - 1 ? "완주" : "다음 문장"}</Button>
        </div>
        <p>{config.ignoreCase ? "대소문자 구분 없음" : "대소문자 구분"} · {config.ignorePunctuation ? "특수문자 생략 가능" : "특수문자 포함"}</p>
        <ol className={styles.upcoming} start={game.index + 2} aria-label="다음에 입력할 문장">
          {set.questions.slice(game.index + 1, game.index + 5).map((question) => <li key={question.id}>{question.targetText}</li>)}
        </ol>
      </Card>
    </>}
  </main>;
}
