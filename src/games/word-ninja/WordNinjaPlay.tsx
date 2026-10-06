import { useEffect, useMemo, useRef, useState } from "react";
import type { AnswerResult } from "../../game-engine/core/types.ts";
import { formatClock } from "../../game-engine/timed-game/clock.ts";
import { FullscreenToggle } from "../../game-engine/stage/ImmersiveStage.tsx";
import { activeTimedBuffs, type TimedBuffPickup } from "../../game-engine/timed-buffs/model.ts";
import TimedBuffHud from "../../game-engine/timed-buffs/TimedBuffHud.tsx";
import { CURSE_EXTRA_OPTIONS, NINJA_ITEMS, isGoldenWave, itemForWave, ninjaQuestionAt, withDecoys,
  type NinjaDetails, type NinjaItemKind, type NinjaProgress, type NinjaQuestion } from "./model.ts";
import type { NinjaSliceContext } from "./useWordNinja.ts";
import { useNinjaSound } from "./useNinjaSound.ts";
import Dojo, { type DojoSliceContext } from "./Dojo.tsx";
import styles from "./WordNinja.module.css";

const MISS_COOLDOWN_MS = 450;
const MILESTONE_EVERY = 10;
const FEVER_COMBO = 10;

const comboTier = (combo: number) => combo >= 50 ? 4 : combo >= 30 ? 3 : combo >= 10 ? 2 : combo >= 2 ? 1 : 0;
const itemDuration = (kind: NinjaItemKind) => NINJA_ITEMS[kind].durationMs;

/** Rolls the shown score toward the real one so every gain visibly ticks up. */
function useRollingNumber(target: number) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const step = (time: number) => {
      const t = Math.min((time - start) / 380, 1);
      from.current = Math.round(origin + (target - origin) * (1 - (1 - t) ** 3));
      setShown(from.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

/** Items picked up this session; they live on this device only, like the wave they came from. */
function useNinjaItems() {
  const pickups = useRef<TimedBuffPickup<NinjaItemKind>[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const buffs = activeTimedBuffs(pickups.current, itemDuration, now);
  useEffect(() => {
    if (buffs.length === 0) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [buffs.length]);
  const pick = (kind: NinjaItemKind) => {
    const at = Date.now();
    pickups.current = [...pickups.current.filter((pickup) => pickup.atMs + itemDuration(pickup.kind) > at), { kind, atMs: at }];
    setNow(at);
  };
  const frenzyNow = () => activeTimedBuffs(pickups.current, itemDuration, Date.now()).some((buff) => buff.kind === "frenzy");
  return { buffs, pick, frenzyNow };
}

export default function WordNinjaPlay({ questions, progress, seed, blocked, remainingMs, expired, pending, error, onSlice, onRetry }: {
  readonly questions: readonly NinjaQuestion[];
  readonly progress: NinjaProgress;
  readonly seed: string;
  readonly blocked: boolean;
  readonly remainingMs: number | null;
  readonly expired: boolean;
  readonly pending: number;
  readonly error: string | null;
  readonly onSlice: (wave: NinjaQuestion, optionId: string, context: NinjaSliceContext) => AnswerResult<NinjaDetails> | null;
  readonly onRetry: () => void;
}) {
  const [muted, setMuted] = useState(false);
  const [stunned, setStunned] = useState(false);
  const [milestone, setMilestone] = useState<{ readonly id: number; readonly combo: number } | null>(null);
  const [brokenCombo, setBrokenCombo] = useState<{ readonly id: number; readonly combo: number } | null>(null);
  const nextSliceAt = useRef(0);
  const stunTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serial = useRef(0);
  const section = useRef<HTMLElement>(null);
  const play = useNinjaSound();
  const items = useNinjaItems();
  const shownScore = useRollingNumber(progress.score);
  const frenzy = items.buffs.some((buff) => buff.kind === "frenzy");
  const curses = items.buffs.find((buff) => buff.kind === "curse")?.stacks ?? 0;
  const base = ninjaQuestionAt(questions, progress.currentIndex);
  const question = useMemo(() => withDecoys(base, questions, curses * CURSE_EXTRA_OPTIONS, seed), [base, questions, curses, seed]);
  const golden = isGoldenWave(seed, progress.currentIndex);
  const fever = progress.combo >= FEVER_COMBO;
  useEffect(() => () => { if (stunTimer.current) clearTimeout(stunTimer.current); }, []);

  const slice = (wave: NinjaQuestion, optionId: string, { elapsedMs, golden: goldenFruit, remaining }: DojoSliceContext) => {
    if (blocked || expired || performance.now() < nextSliceAt.current) return null;
    const before = progress.combo;
    const frenzyCut = items.frenzyNow();
    const result = onSlice(wave, optionId, { elapsedMs, golden: goldenFruit, frenzy: frenzyCut, advance: !frenzyCut || remaining === 0 });
    if (!result) return null;
    const id = ++serial.current;
    if (result.isCorrect) {
      const combo = before + 1;
      if (Math.floor(combo / MILESTONE_EVERY) > Math.floor(before / MILESTONE_EVERY)) {
        setMilestone({ id, combo: Math.floor(combo / MILESTONE_EVERY) * MILESTONE_EVERY });
        if (!muted) play("milestone");
      }
    } else {
      nextSliceAt.current = performance.now() + MISS_COOLDOWN_MS;
      if (stunTimer.current) clearTimeout(stunTimer.current);
      setStunned(true);
      stunTimer.current = setTimeout(() => setStunned(false), MISS_COOLDOWN_MS);
      if (before >= 3) setBrokenCombo({ id, combo: before });
    }
    return result;
  };

  return <section ref={section} className={styles.game} aria-label="단어 닌자" data-tier={comboTier(progress.combo)} data-fever={fever}
    data-stunned={stunned} data-frenzy={frenzy} data-cursed={curses > 0}>
    <header className={styles.header}>
      <h1>단어 <span>닌자</span></h1>
      <div className={styles.clock} role="timer" data-low={!expired && remainingMs !== null && remainingMs <= 10_000}>{expired ? "종료" : formatClock(remainingMs)}</div>
      <button className={styles.iconButton} type="button" aria-pressed={!muted} aria-label={muted ? "효과음 켜기" : "효과음 끄기"} onClick={() => setMuted(!muted)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor" />{muted ? <path d="m16 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="2" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" />}</svg>
      </button>
      <FullscreenToggle target={section} className={styles.iconButton} />
    </header>

    <div className={styles.topRow}>
      <div className={styles.score}><span>점수</span><strong aria-label={`${progress.score}점`}>{shownScore.toLocaleString()}</strong></div>
      <div className={styles.prompt} data-golden={golden} key={progress.currentIndex}>
        {golden && <em>황금 ×2</em>}
        <strong>{question.prompt}</strong>
      </div>
      <div className={styles.combo} data-active={progress.combo >= 2} aria-label={`${progress.combo} 연속`}>
        <strong key={`combo-${progress.attemptCount}`}>{progress.combo}</strong><span>연속</span>
      </div>
    </div>

    <div className={styles.arena}>
      <Dojo question={question} waveKey={progress.currentIndex} golden={golden} item={itemForWave(seed, progress.currentIndex)}
        active={!expired} fever={fever} frenzy={frenzy} onSlice={slice}
        onItem={items.pick} playSound={(sound) => { if (!muted) play(sound, progress.combo); }} />
      {!expired && <TimedBuffHud buffs={items.buffs} definitions={NINJA_ITEMS} className={styles.buff} />}
      {milestone && <div key={milestone.id} className={styles.milestone} aria-hidden="true"
        onAnimationEnd={(event) => { if (event.target === event.currentTarget) setMilestone(null); }}>
        <strong>{milestone.combo}</strong><span>연속</span>
      </div>}
      {brokenCombo && <div key={brokenCombo.id} className={styles.broken} aria-hidden="true"
        onAnimationEnd={(event) => { if (event.target === event.currentTarget) setBrokenCombo(null); }}>
        <strong>{brokenCombo.combo}</strong><span>연속 끊김</span>
      </div>}
      {expired && <div className={styles.finished} role="status">
        <h2>종료</h2>
        <p><span>점수</span><b>{progress.score.toLocaleString()}</b></p>
        <p><span>벤 단어</span><b>{progress.correctCount}</b></p>
        {pending > 0 && <small>기록 저장 중…</small>}
      </div>}
    </div>
    <div className={styles.footer}>
      <span>벤 단어 <b>{progress.correctCount}</b></span>
      {error ? <div className={styles.error} role="alert">{error}<button type="button" onClick={onRetry}>저장 다시 시도</button></div>
        : !expired && pending >= 12 ? <div className={styles.error} role="status">기록 저장을 기다리는 중…</div> : null}
    </div>
  </section>;
}
