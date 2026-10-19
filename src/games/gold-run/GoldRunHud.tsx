import { useEffect, useState, type RefObject } from "react";
import { FullscreenToggle } from "../../game-engine/stage/ImmersiveStage.tsx";
import { formatClock } from "../../game-engine/timed-game/clock.ts";
import { MAX_LIVES } from "./model/run.ts";
import type { GoldRunQuestion } from "./model/questions.ts";
import { BLOCK_LENGTH } from "./model/track.ts";
import type { GoldRunHud as HudState } from "./scene/GoldRunScene.ts";
import type { GateFeedback } from "./useGoldRun.ts";
import styles from "./GoldRun.module.css";

/** Gates stand three blocks apart. */
const GATE_SPACING = BLOCK_LENGTH * 3;
const FEEDBACK_MS = 1_800;

function GoldBar() {
  return <svg className={styles.goldIcon} viewBox="0 0 28 20" aria-hidden="true">
    <path d="M6 4h16l5 12H1Z" fill="#c6870f" />
    <path d="M7 4h14l3 7H4Z" fill="#ffc93a" />
    <path d="M9 6h5l-1 2H8Z" fill="#fff0a6" />
  </svg>;
}

function Heart({ full }: { readonly full: boolean }) {
  return <svg className={styles.heart} data-full={full} viewBox="0 0 24 22" aria-hidden="true">
    <path d="M12 21 2.6 11.6A5.6 5.6 0 0 1 12 3.8a5.6 5.6 0 0 1 9.4 7.8Z" />
  </svg>;
}

export default function GoldRunHud({ hud, startScore, question, feedback, remainingMs, expired, muted, onMute, error, onRetry, fullscreenTarget }: {
  readonly hud: HudState | null;
  readonly startScore: number;
  readonly question: GoldRunQuestion;
  readonly feedback: GateFeedback | null;
  readonly remainingMs: number | null;
  readonly expired: boolean;
  readonly muted: boolean;
  readonly onMute: () => void;
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly fullscreenTarget: RefObject<HTMLElement | null>;
}) {
  const [shownFeedback, setShownFeedback] = useState<GateFeedback | null>(null);
  useEffect(() => {
    if (!feedback) return undefined;
    setShownFeedback(feedback);
    const timer = window.setTimeout(() => setShownFeedback(null), FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const lives = hud?.lives ?? MAX_LIVES;
  const approach = hud ? 1 - Math.min(hud.gate.metres, GATE_SPACING) / GATE_SPACING : 0;
  const score = startScore + (hud?.score ?? 0);

  return <div className={styles.hud}>
    <header className={styles.topBar}>
      <div className={styles.plate}>
        <GoldBar />
        <strong>{hud?.coins ?? 0}</strong>
      </div>
      <div className={styles.hearts} aria-label={`목숨 ${lives}개`}>
        {Array.from({ length: MAX_LIVES }, (_, index) => <Heart key={index} full={index < lives} />)}
      </div>
      <div className={styles.clock} role="timer" data-low={!expired && remainingMs !== null && remainingMs <= 10_000}>{expired ? "종료" : formatClock(remainingMs)}</div>
      <div className={`${styles.plate} ${styles.score}`} aria-label="점수"><strong>{score.toLocaleString("ko-KR")}</strong></div>
      <button className={styles.iconButton} type="button" aria-pressed={!muted} aria-label={muted ? "효과음 켜기" : "효과음 끄기"} onClick={onMute}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor" />{muted ? <path d="m16 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="2" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" />}</svg>
      </button>
      <FullscreenToggle target={fullscreenTarget} className={styles.iconButton} />
    </header>

    <section className={styles.question} aria-live="polite" data-near={approach > 0.7}>
      <span className={styles.gateTag} data-side="o">O</span>
      <div className={styles.pair}>
        <strong>{question.prompt}</strong>
        <span className={styles.equals} aria-hidden="true">=</span>
        <strong>{question.statement}</strong>
      </div>
      <span className={styles.gateTag} data-side="x">X</span>
      <div className={styles.approach} aria-hidden="true"><i style={{ transform: `scaleX(${approach})` }} /></div>
    </section>

    {shownFeedback && <div key={shownFeedback.id} className={styles.feedback} data-correct={shownFeedback.correct}>
      {shownFeedback.correct ? "정답!" : <>{shownFeedback.question.prompt} = <b>{shownFeedback.question.correctAnswer}</b></>}
    </div>}
    {hud?.down && !expired && <div className={styles.banner}>꽈당!</div>}
    {expired && <div className={styles.result}>
      <h2>골드런 종료</h2>
      <p><GoldBar /> {hud?.coins ?? 0}</p>
      <strong>{score.toLocaleString("ko-KR")}점</strong>
    </div>}
    {error && <div className={styles.error} role="alert">
      <span>{error}</span>
      <button type="button" onClick={onRetry}>다시 저장</button>
    </div>}
  </div>;
}
