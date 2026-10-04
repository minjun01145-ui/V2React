import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AnswerResult } from "../../game-engine/core/types.ts";
import { formatClock } from "../../game-engine/timed-game/clock.ts";
import { GameEffectLayer } from "../../game-engine/effects/GameEffectLayer.tsx";
import { useGameEffectEngine } from "../../game-engine/effects/useGameEffectEngine.ts";
import { createLearningCompletion } from "../../game-engine/effects/model.ts";
import { brickAt, currentBrickQuestion, type BrickDetails, type BrickProgress, type BrickQuestion } from "./model.ts";
import { brickItemAt, BRICK_ITEMS, BRICK_ITEM_EFFECTS, BRICK_TIMED_ITEM_IDS, type BrickBuffs, type BrickItemId } from "./items.ts";
import { useHammerSound } from "./useHammerSound.ts";
import BrickStage, { type Impact, type StageBrick } from "./BrickStage.tsx";
import styles from "./BrickSmash.module.css";

const VISIBLE_BRICKS = 5;
const HIT_COOLDOWN_MS = 160;
const MISS_COOLDOWN_MS = 450;

interface Banner { readonly id: number; readonly item: BrickItemId | "shield-used" }

const heat = (combo: number) => combo >= 10 ? 3 : combo >= 5 ? 2 : combo >= 2 ? 1 : 0;

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
  const [muted, setMuted] = useState(false);
  const [stunned, setStunned] = useState(false);
  const nextHitAt = useRef(0);
  const serial = useRef(0);
  const stunTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const playSound = useHammerSound();
  const effects = useGameEffectEngine();
  const [now, setNow] = useState(Date.now);
  const question = currentBrickQuestion(questions, progress);
  const sentence = question.sentence;
  const brickAtIndex = (index: number): StageBrick => ({ index, text: sentence ? "" : brickAt(questions, index).prompt, item: brickItemAt(seed, index) });
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(clock);
  }, []);
  useEffect(() => () => { if (stunTimer.current) clearTimeout(stunTimer.current); }, []);

  const strike = (optionId: string, lane: number) => {
    if (blocked || expired || performance.now() < nextHitAt.current) return;
    const before = progress;
    const result = onStrike(optionId);
    if (!result) return;
    const details = result.details;
    const protectedMiss = details?.protectedMiss ?? false;
    const count = details?.removedCount ?? (result.isCorrect ? 1 : 0);
    const hit: Impact = { id: ++serial.current, correct: result.isCorrect, protectedMiss,
      bricks: Array.from({ length: count }, (_, offset) => brickAtIndex(before.currentIndex + offset)),
      side: lane % 2 ? -1 : 1, score: result.scoreDelta, bomb: details?.activatedItem === "bomb", combo: before.combo + 1 };
    setImpact(hit);
    setImpacts((previous) => [...previous.slice(-5), hit]);
    buttons.current[lane]?.animate(result.isCorrect
      ? [{ transform: "translateY(7px) scale(.97)", filter: "brightness(1.35)" }, { transform: "none", filter: "none" }]
      : [{ transform: "translateX(-8px)" }, { transform: "translateX(7px)" }, { transform: "translateX(-4px)" }, { transform: "none" }],
    { duration: result.isCorrect ? 180 : 320, easing: "ease-out" });
    const stun = !result.isCorrect && !protectedMiss;
    nextHitAt.current = performance.now() + (stun ? MISS_COOLDOWN_MS : HIT_COOLDOWN_MS);
    if (stunTimer.current) clearTimeout(stunTimer.current);
    setStunned(stun);
    if (stun) stunTimer.current = setTimeout(() => setStunned(false), MISS_COOLDOWN_MS);
    const item = details?.activatedItem ?? null;
    if (item) setBanner({ id: hit.id, item });
    else if (protectedMiss) setBanner({ id: hit.id, item: "shield-used" });
    if (!muted) {
      playSound(result.isCorrect ? "hit" : protectedMiss ? "block" : "miss", hit.combo);
      if (item) playSound("item");
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

  const comboHeat = heat(progress.combo);
  const activeTimed = expired ? [] : BRICK_TIMED_ITEM_IDS.filter((id) => buffs[id] > now);
  const bannerItem = banner && banner.item !== "shield-used" ? BRICK_ITEMS[banner.item] : null;

  return <section className={styles.game} aria-label="벽돌 팡팡" data-heat={comboHeat} data-sentence={Boolean(sentence)}>
    <GameEffectLayer effect={effects.activeEffect} className={styles.announcement} />
    <header className={styles.header}>
      <h1>벽돌 <span>팡팡</span></h1>
      <div className={styles.clock} role="timer" data-low={!expired && remainingMs !== null && remainingMs <= 10_000}>{expired ? "종료" : formatClock(remainingMs)}</div>
      <button className={styles.sound} type="button" aria-pressed={!muted} aria-label={muted ? "효과음 켜기" : "효과음 끄기"} onClick={() => setMuted(!muted)}>{muted ? "🔇" : "🔊"}</button>
    </header>

    <div className={styles.hud}>
      <div className={styles.stat}><span>🧱 벽돌</span><strong key={`b-${progress.currentIndex}`} className={progress.currentIndex ? styles.pop : undefined}>{progress.currentIndex}</strong></div>
      <div className={`${styles.stat} ${styles.score}`}><span>점수</span><strong key={`s-${progress.score}`} className={progress.score ? styles.pop : undefined}>{progress.score}</strong></div>
      <div className={styles.stat} data-active={progress.combo >= 2}>
        <span>콤보</span>
        <strong key={`c-${progress.attemptCount}`} className={progress.combo >= 2 ? styles.pop : undefined}>{progress.combo >= 2 ? <>{comboHeat >= 2 ? "🔥" : ""}{progress.combo}</> : "–"}</strong>
      </div>
    </div>

    <div className={styles.buffs} aria-label="적용 중인 아이템">
      {activeTimed.map((id) => {
        const left = buffs[id] - now;
        return <span key={id} className={styles.buff} data-item={id} style={{ "--left": Math.min(1, left / BRICK_ITEM_EFFECTS[id].durationMs) } as CSSProperties}>
          <i aria-hidden="true">{BRICK_ITEMS[id].emoji}</i>{BRICK_ITEMS[id].name} <b>{id === "hammer" ? "2개씩" : "점수 2배"}</b><small>{Math.ceil(left / 1_000)}초</small>
        </span>;
      })}
      {!expired && buffs.shield && <span className={styles.buff} data-item="shield"><i aria-hidden="true">🛡️</i>보호막 <b>1회</b></span>}
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
        impact={impact} impacts={impacts} golden={buffs.gold > now} double={buffs.hammer > now} shielded={!expired && buffs.shield}
        onImpactDone={(id) => setImpacts((previous) => previous.filter((item) => item.id !== id))} />
      {banner && <div key={banner.id} className={styles.banner} data-item={banner.item} role="status" onAnimationEnd={() => setBanner(null)}>
        <i aria-hidden="true">{bannerItem?.emoji ?? "🛡️"}</i>
        <strong>{bannerItem ? `${bannerItem.name}!` : "보호막 발동!"}</strong>
        <span>{bannerItem?.description ?? "콤보 유지"}</span>
      </div>}
    </div>

    {expired ? <div className={styles.finished} role="status">
      <h2>게임 종료!</h2>
      <p><b>🧱 {progress.currentIndex}개</b><b>⭐ {progress.score}점</b></p>
      {pending > 0 && <small>기록 저장 중…</small>}
    </div>
      : <div className={styles.controls} data-count={question.options.length} data-stunned={stunned}>
        {question.options.map((option, index) => <button key={index} ref={(element) => { buttons.current[index] = element; }} type="button"
          className={styles.answer} data-lane={index} disabled={blocked} onClick={() => strike(option.id, index)}>
          <kbd>{index + 1}</kbd><span>{option.text}</span>
        </button>)}
      </div>}
    {error ? <div className={styles.error} role="alert">{error}<button type="button" onClick={onRetry}>저장 다시 시도</button></div>
      : !expired && pending >= 12 ? <div className={styles.error} role="status">기록 저장을 기다리는 중…</div> : null}
  </section>;
}
