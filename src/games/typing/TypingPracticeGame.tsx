import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getLearningSet } from "../../learning-sets/readRepository.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Button from "../../shared/ui/Button.tsx";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import { adaptLearningSetToTypingPractice } from "./typingPracticeAdapter.ts";
import { useTypingPracticeGame } from "./useTypingPracticeGame.ts";
import type { WaitingTypingConfig } from "./waitingTypingConfig.ts";
import styles from "./TypingPractice.module.css";

interface Props {
  readonly config: WaitingTypingConfig;
  readonly onExit: () => void;
}

export default function TypingPracticeGame({ config, onExit }: Props) {
  const [set, setSet] = useState<LearningSet | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setSet(null);
    setError("");
    void getLearningSet(config.setId, `waiting-typing:${config.setId}`)
      .then((value) => { if (active) setSet(value); })
      .catch((value: unknown) => { if (active) setError(toErrorMessage(value, "타자 연습 세트를 불러오지 못했습니다.")); });
    return () => { active = false; };
  }, [config.setId]);

  if (error) return <><StatusPanel title="타자 연습 오류" tone="error">{error}</StatusPanel><Button onClick={onExit}>대기실로 돌아가기</Button></>;
  if (!set) return <StatusPanel title="타자 연습 준비 중">선생님이 선택한 세트를 불러오고 있어요.</StatusPanel>;
  return <TypingPracticeBoard set={set} config={config} onExit={onExit} />;
}

function TypingPracticeBoard({ set, config, onExit }: Props & { readonly set: LearningSet }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const questionSet = adaptLearningSetToTypingPractice(set);
  const game = useTypingPracticeGame(questionSet, config);
  const overlayOpen = game.status !== "playing";

  useEffect(() => { if (!overlayOpen) inputRef.current?.focus(); }, [game.stage, overlayOpen]);
  useEffect(() => {
    if (game.status !== "stage-clear") return;
    const timer = window.setTimeout(game.nextStage, 1_500);
    return () => window.clearTimeout(timer);
  }, [game.nextStage, game.status]);

  return <main className={styles.game} onClick={() => inputRef.current?.focus()}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>WAITING TYPING</span><h1>{set.name}</h1></div>
      <Button variant="ghost" onClick={(event) => { event.stopPropagation(); onExit(); }}>대기실로</Button>
    </header>

    <section className={styles.dashboard} aria-label="게임 현황">
      <div><small>스테이지</small><strong>{game.stage}<span>/10</span></strong></div>
      <div><small>현재 타수</small><strong>{game.speed.currentCpm}<span>타</span></strong></div>
      <div><small>평균 타수</small><strong>{game.speed.averageCpm}<span>타</span></strong></div>
      <div><small>남은 기회</small><strong aria-label={`${game.lives}개`}>{"♥".repeat(game.lives)}<span>{"♡".repeat(3 - game.lives)}</span></strong></div>
    </section>

    <section className={styles.sky} aria-label="떨어지는 영어 청크">
      <div className={styles.clouds} aria-hidden="true" />
      {game.words.map((word) => <div
        className={styles.drop}
        key={word.id}
        onAnimationEnd={() => game.missWord(word.id)}
        style={{ "--drop-left": `${word.leftPercent}%`, "--drop-duration": `${word.durationMs}ms` } as CSSProperties}
      ><span>{word.question.targetText}</span></div>)}
      <div className={styles.ground}><span>목표 {game.hits} / {game.rule.targetHits}</span><div><i style={{ width: `${Math.min(100, (game.hits / game.rule.targetHits) * 100)}%` }} /></div></div>
    </section>

    <label className={styles.inputArea}>
      <span>떨어지는 영어를 입력하세요</span>
      <input
        ref={inputRef}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={game.input}
        onChange={(event) => game.updateInput(event.target.value)}
        disabled={overlayOpen}
        placeholder="여기에 타자 입력"
      />
      <small>대소문자와 특수문자는 입력하지 않아도 정답으로 인정돼요.</small>
    </label>

    {overlayOpen ? <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.resultCard}>
        <span>{game.status === "stage-clear" ? "STAGE CLEAR" : game.status === "complete" ? "ALL CLEAR" : "TRY AGAIN"}</span>
        <h2>{game.status === "stage-clear" ? `스테이지 ${game.stage} 성공!` : game.status === "complete" ? "10단계를 모두 깼어요!" : "산성비가 바닥에 닿았어요"}</h2>
        <p>평균 {game.speed.averageCpm}타 · 최고 {game.speed.bestCpm}타</p>
        <div>{game.status === "stage-clear" ? <Button onClick={(event) => { event.stopPropagation(); game.nextStage(); }}>바로 스테이지 {game.stage + 1}</Button> : <Button onClick={(event) => { event.stopPropagation(); game.restart(); }}>처음부터 다시</Button>}<Button variant="ghost" onClick={(event) => { event.stopPropagation(); onExit(); }}>대기실로</Button></div>
      </div>
    </div> : null}
  </main>;
}
