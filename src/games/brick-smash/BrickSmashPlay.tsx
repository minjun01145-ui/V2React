import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AnswerResult } from "../../game-engine/core/types.ts";
import { formatClock } from "../../game-engine/timed-game/clock.ts";
import { GameEffectLayer } from "../../game-engine/effects/GameEffectLayer.tsx";
import { useGameEffectEngine } from "../../game-engine/effects/useGameEffectEngine.ts";
import { createLearningCompletion } from "../../game-engine/effects/model.ts";
import { brickAt, currentBrickQuestion, type BrickDetails, type BrickProgress, type BrickQuestion } from "./model.ts";
import { brickItemAt, BRICK_ITEMS, BRICK_ITEM_EFFECTS, BRICK_TIMED_ITEM_IDS, type BrickBuffs, type BrickItemId } from "./items.ts";
import { useHammerSound } from "./useHammerSound.ts";
import BrickStage, { BLAST_STEP_MS, Judgment, type Impact, type StageBrick } from "./BrickStage.tsx";
import styles from "./BrickSmash.module.css";

const VISIBLE_BRICKS = 5;
const HIT_COOLDOWN_MS = 160;
const MISS_COOLDOWN_MS = 450;
const MILESTONE_EVERY = 10;

interface Banner { readonly id: number; readonly item: BrickItemId }

const comboTier = (combo: number) => combo >= 50 ? 4 : combo >= 30 ? 3 : combo >= 10 ? 2 : combo >= 2 ? 1 : 0;

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

function PaddedNumber({ value, digits }: { readonly value: number; readonly digits: number }) {
  const text = String(value);
  return <><span className={styles.zeros}>{"0".repeat(Math.max(0, digits - text.length))}</span>{text}</>;
}

export default function BrickSmashPlay({ questions, progress, seed, buffs, blocked, remainingMs, expired, pending, error, onStrike, onRetry }: {
  readonly questions: readonly BrickQuestion[];
  readonly progress: BrickProgress;
  readonly seed: string;
  readonly buffs: BrickBuffs;
  readonly blocked: boolean;
  readonly remainingMs: number | null;
  readonly expired: boolean;
  readonly pending: number;
  readonly error: string | null;
  readonly onStrike: (optionId: string) => AnswerResult<BrickDetails> | null;
  readonly onRetry: () => void;
}) {
  const [impacts, setImpacts] = useState<Impact[]>([]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [milestone, setMilestone] = useState<{ readonly id: number; readonly combo: number } | null>(null);
  const [shieldBreak, setShieldBreak] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [stunned, setStunned] = useState(false);
  const nextHitAt = useRef(0);
  const serial = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stunTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const playSound = useHammerSound();
  const effects = useGameEffectEngine();
  const [now, setNow] = useState(Date.now);
  const shownScore = useRollingNumber(progress.score);
  const question = currentBrickQuestion(questions, progress);
  const sentence = question.sentence;
  const brickAtIndex = (index: number): StageBrick => ({ index, text: sentence ? "" : brickAt(questions, index).prompt, item: brickItemAt(seed, index) });
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(clock);
  }, []);
  useEffect(() => () => {
    if (stunTimer.current) clearTimeout(stunTimer.current);
    timers.current.forEach(clearTimeout);
  }, []);

  const strike = (optionId: string, lane: number) => {
    if (blocked || expired || performance.now() < nextHitAt.current) return;
    const before = progress;
    const result = onStrike(optionId);
    if (!result) return;
    const details = result.details;
    const protectedMiss = details?.protectedMiss ?? false;
    const count = details?.removedCount ?? (result.isCorrect ? 1 : 0);
    const item = details?.activatedItem ?? null;
    const combo = result.isCorrect ? before.combo + 1 : protectedMiss ? before.combo : 0;
    const hit: Impact = { id: ++serial.current, correct: result.isCorrect, protectedMiss,
      bricks: Array.from({ length: count }, (_, offset) => brickAtIndex(before.currentIndex + offset)),
      side: lane % 2 ? -1 : 1, score: result.scoreDelta, judgment: details?.judgment ?? null, bomb: item === "bomb",
      gold: result.isCorrect && (details?.buffs?.gold ?? 0) > Date.now(), combo, brokenCombo: !result.isCorrect && !protectedMiss ? before.combo : 0 };
    setImpact(hit);
    setImpacts((previous) => [...previous.slice(-5), hit]);
    buttons.current[lane]?.animate(result.isCorrect
      ? [{ transform: "translateY(6px)", filter: "brightness(1.8)" }, { transform: "none", filter: "none" }]
      : [{ transform: "translateX(-8px)" }, { transform: "translateX(7px)" }, { transform: "translateX(-4px)" }, { transform: "none" }],
    { duration: result.isCorrect ? 200 : 320, easing: "ease-out" });
    const stun = !result.isCorrect && !protectedMiss;
    nextHitAt.current = performance.now() + (stun ? MISS_COOLDOWN_MS : HIT_COOLDOWN_MS);
    if (stunTimer.current) clearTimeout(stunTimer.current);
    setStunned(stun);
    if (stun) stunTimer.current = setTimeout(() => setStunned(false), MISS_COOLDOWN_MS);
    if (item) setBanner({ id: hit.id, item });
    if (protectedMiss) setShieldBreak(hit.id);
    const milestoneHit = result.isCorrect && Math.floor(combo / MILESTONE_EVERY) > Math.floor(before.combo / MILESTONE_EVERY);
    if (milestoneHit) setMilestone({ id: hit.id, combo: Math.floor(combo / MILESTONE_EVERY) * MILESTONE_EVERY });
    if (!muted) {
      if (hit.bomb) hit.bricks.forEach((_, offset) => timers.current.push(setTimeout(() => playSound("boom"), offset * BLAST_STEP_MS)));
      else playSound(result.isCorrect ? "hit" : protectedMiss ? "block" : "miss", combo);
      if (item && item !== "bomb") playSound("item");
      if (milestoneHit) playSound("milestone");
    }
    if (result.isCorrect && sentence && sentence.chunkIndex === sentence.chunks.length - 1) {
      effects.play(createLearningCompletion({ text: sentence.chunks.join(" "), meaning: sentence.meaning, durationMs: 1_100 }));
    }
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']"))) return;
      const index = ["Digit1", "Digit2", "Digit3"].indexOf(event.code);
      const option = question.options[index];
      if (!option) return;
      event.preventDefault();
      strike(option.id, index);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  const gold = !expired && buffs.gold > now;
  const shielded = !expired && buffs.shield;
  const activeTimed = expired ? [] : BRICK_TIMED_ITEM_IDS.filter((id) => buffs[id] > now);
  const bannerItem = banner ? BRICK_ITEMS[banner.item] : null;

  return <section className={styles.game} aria-label="벽돌 팡팡" data-tier={comboTier(progress.combo)} data-gold={gold} data-sentence={Boolean(sentence)}>
    <GameEffectLayer effect={effects.activeEffect} className={styles.announcement} />
    <header className={styles.header}>
      <h1>벽돌<span>팡팡</span></h1>
      <div className={styles.clock} role="timer" data-low={!expired && remainingMs !== null && remainingMs <= 10_000}>{expired ? "FINISH" : formatClock(remainingMs)}</div>
      <button className={styles.sound} type="button" aria-pressed={!muted} aria-label={muted ? "효과음 켜기" : "효과음 끄기"} onClick={() => setMuted(!muted)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor" />{muted ? <path d="m16 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="2" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" />}</svg>
      </button>
    </header>

    <div className={styles.scorebar}>
      <div className={styles.score}>
        <span>SCORE</span>
        <strong aria-label={`${progress.score}점`}><PaddedNumber value={shownScore} digits={7} /></strong>
        {gold && <em className={styles.multiplier}>×2</em>}
      </div>
      <div className={styles.bricks}><span>BRICKS</span><strong><PaddedNumber value={progress.currentIndex} digits={3} /></strong></div>
    </div>

    <div className={styles.buffs} aria-label="적용 중인 아이템">
      {activeTimed.map((id) => {
        const left = buffs[id] - now;
        return <span key={id} className={styles.buff} data-item={id} style={{ "--left": Math.min(1, left / BRICK_ITEM_EFFECTS[id].durationMs) } as CSSProperties}>
          <i aria-hidden="true">{BRICK_ITEMS[id].emoji}</i>{BRICK_ITEMS[id].name}<b>{id === "hammer" ? "2개씩" : "점수 ×2"}</b><small>{Math.ceil(left / 1_000)}</small>
        </span>;
      })}
    </div>

    {sentence && <div className={styles.sentence} aria-label="조립할 문장">
      <h2>{sentence.meaning}</h2>
      <div className={styles.assembled} aria-label="조립한 덩어리">
        {sentence.chunks.map((chunk, index) => index < sentence.chunkIndex
          ? <span key={index} className={styles.slotDone}>{chunk}</span>
          : <span key={index} className={index === sentence.chunkIndex ? styles.slotNext : styles.slotEmpty} aria-label={index === sentence.chunkIndex ? "다음 덩어리" : undefined}>?</span>)}
      </div>
    </div>}

    <div className={styles.arena}>
      <BrickStage bricks={Array.from({ length: VISIBLE_BRICKS }, (_, offset) => brickAtIndex(progress.currentIndex + offset))}
        impact={impact} impacts={impacts} golden={gold} twin={buffs.hammer > now} shielded={shielded} timerKey={progress.correctCount}
        onImpactDone={(id) => setImpacts((previous) => previous.filter((item) => item.id !== id))} />
      <div className={styles.combo} data-active={progress.combo >= 2} aria-label={`${progress.combo} 콤보`}>
        <span>COMBO</span>
        <strong key={`combo-${progress.attemptCount}`}>{progress.combo}</strong>
      </div>
      {impact?.correct && <Judgment key={`judge-${impact.id}`} hit={impact} />}
      {milestone && <div key={milestone.id} className={styles.milestone} onAnimationEnd={(event) => { if (event.target === event.currentTarget) setMilestone(null); }} aria-hidden="true">
        <i /><strong>{milestone.combo}</strong><span>COMBO</span>
      </div>}
      {banner && bannerItem && <div key={banner.id} className={styles.banner} data-item={banner.item} role="status" onAnimationEnd={(event) => { if (event.target === event.currentTarget) setBanner(null); }}>
        <i aria-hidden="true">{bannerItem.emoji}</i>
        <strong>{bannerItem.name}</strong>
        <span>{bannerItem.description}</span>
      </div>}
    </div>

    {expired ? <div className={styles.finished} role="status">
      <h2>FINISH</h2>
      <p><span>SCORE</span><b>{progress.score.toLocaleString()}</b></p>
      <p><span>BRICKS</span><b>{progress.currentIndex}</b></p>
      {pending > 0 && <small>기록 저장 중…</small>}
    </div>
      : <div className={styles.deck} data-shielded={shielded}>
        {shielded && <div className={styles.dome} aria-label="보호막 1회"><span>SHIELD</span></div>}
        {shieldBreak !== null && <div key={shieldBreak} className={styles.domeBreak} aria-hidden="true" onAnimationEnd={(event) => { if (event.target === event.currentTarget) setShieldBreak(null); }}>
          {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}
        </div>}
        <div className={styles.controls} data-count={question.options.length} data-stunned={stunned}>
          {question.options.map((option, index) => <button key={index} ref={(element) => { buttons.current[index] = element; }} type="button"
            className={styles.answer} disabled={blocked} onClick={() => strike(option.id, index)}>
            <kbd>{index + 1}</kbd><span>{option.text}</span>
          </button>)}
        </div>
      </div>}
    {error ? <div className={styles.error} role="alert">{error}<button type="button" onClick={onRetry}>저장 다시 시도</button></div>
      : !expired && pending >= 12 ? <div className={styles.error} role="status">기록 저장을 기다리는 중…</div> : null}
  </section>;
}
