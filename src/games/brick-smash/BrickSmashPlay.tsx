import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AnswerResult } from "../../game-engine/core/types.ts";
import { formatClock } from "../../game-engine/timed-game/clock.ts";
import { GameEffectLayer } from "../../game-engine/effects/GameEffectLayer.tsx";
import { useGameEffectEngine } from "../../game-engine/effects/useGameEffectEngine.ts";
import { createGameAnnouncement, createLearningCompletion } from "../../game-engine/effects/model.ts";
import { brickAt, currentBrickQuestion, type BrickDetails, type BrickProgress, type BrickQuestion } from "./model.ts";
import { brickItemAt, brickItemAnnouncement, BRICK_ITEMS, type BrickBuffs } from "./items.ts";
import { useHammerSound } from "./useHammerSound.ts";
import styles from "./BrickSmash.module.css";

interface Impact { readonly id: number; readonly correct: boolean; readonly prompts: readonly string[]; readonly color: number; readonly side: number; readonly score: number; readonly bomb: boolean; readonly protectedMiss: boolean }
const BRICK_COLORS = ["#ffb74b", "#b2a2ff", "#61d9ca", "#ff8198", "#72baff"];
const colorStyle = (index: number): CSSProperties => ({ "--brick": BRICK_COLORS[index % BRICK_COLORS.length] } as CSSProperties);

function Hammer() {
  return <svg viewBox="0 0 180 180" aria-hidden="true"><path d="M90 60 119 160Q121 171 111 173L102 175Q94 175 92 166L65 68Z" fill="#a86137" stroke="#241c36" strokeWidth="6" /><path d="m96 113 17-4m-13 21 18-4m-13 22 17-4" stroke="#e7a961" strokeWidth="5" /><path d="M19 31Q18 23 28 21L110 8Q120 7 124 16L138 59Q140 68 130 71L44 88Q34 89 31 80Z" fill="#e9edf9" stroke="#241c36" strokeWidth="7" /><path d="m30 37 84-16 8 22-84 16Z" fill="#fff" /><path d="m40 69 88-17 5 12-89 17Z" fill="#a9afcc" /></svg>;
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
  const [muted, setMuted] = useState(false);
  const [cooling, setCooling] = useState(false);
  const nextHitAt = useRef(0);
  const serial = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playSound = useHammerSound();
  const effects = useGameEffectEngine();
  const [now, setNow] = useState(Date.now);
  const question = currentBrickQuestion(questions, progress);
  const sentence = question.sentence;
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(clock);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const strike = (optionId: string, index: number) => {
    if (blocked || expired || performance.now() < nextHitAt.current) return;
    const result = onStrike(optionId);
    if (!result) return;
    const details = result.details;
    const count = details?.removedCount ?? (result.isCorrect ? 1 : 0);
    const hit: Impact = { id: ++serial.current, correct: result.isCorrect,
      prompts: Array.from({ length: count }, (_, offset) => sentence ? "" : brickAt(questions, progress.currentIndex + offset).prompt),
      color: progress.currentIndex, side: index === 0 ? 1 : -1, score: result.scoreDelta,
      bomb: details?.activatedItem === "bomb", protectedMiss: details?.protectedMiss ?? false };
    setImpact(hit);
    setImpacts((previous) => [...previous.slice(-5), hit]);
    const lightning = (details?.buffs?.lightning ?? buffs.lightning) > Date.now();
    const delay = result.isCorrect || hit.protectedMiss ? lightning ? 90 : 180 : 430;
    nextHitAt.current = performance.now() + delay;
    setCooling(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCooling(false), delay);
    if (!muted) playSound(result.isCorrect || hit.protectedMiss, progress.combo + 1);
    if (details?.activatedItem) effects.play(brickItemAnnouncement(details.activatedItem));
    else if (hit.protectedMiss) effects.play(createGameAnnouncement({ headline: "🛡️ 보호막!", metric: "콤보 유지", durationMs: 650 }));
    else if (result.isCorrect && sentence && sentence.chunkIndex === sentence.chunks.length - 1) {
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

  return <section className={styles.game} aria-label="벽돌 팡팡">
    <GameEffectLayer effect={effects.activeEffect} className={styles.announcement} />
    <header className={styles.header}>
      <h1>벽돌 <span>팡팡</span></h1>
      <div className={styles.clock} role="timer">{expired ? "종료" : formatClock(remainingMs)}</div>
      <button className={styles.sound} type="button" aria-pressed={!muted} aria-label={muted ? "효과음 켜기" : "효과음 끄기"} onClick={() => setMuted(!muted)}>{muted ? "소리 OFF" : "소리 ON"}</button>
    </header>
    <div className={styles.scoreboard}>
      <span>날린 벽돌</span>
      <strong key={progress.currentIndex} className={progress.currentIndex ? styles.scorePop : undefined}>{progress.currentIndex}<small>개</small></strong>
      <span className={styles.points}>{progress.score}점</span>
      <div className={styles.combo} key={`combo-${progress.attemptCount}`}>{progress.combo >= 2 ? `${progress.combo} COMBO` : ""}</div>
    </div>
    <div className={styles.buffs} aria-label="적용 중인 아이템">
      {!expired && (["hammer", "gold", "lightning"] as const).filter((id) => buffs[id] > now).map((id) => <span key={id} data-item={id}>{BRICK_ITEMS[id].emoji} {BRICK_ITEMS[id].name} <b>{Math.ceil((buffs[id] - now) / 1_000)}초</b></span>)}
      {!expired && buffs.shield && <span>🛡️ 보호막 1회</span>}
    </div>
    {sentence && <div className={styles.sentence} aria-label="조립할 문장">
      <h2>{sentence.meaning}</h2>
      <div className={styles.assembled} aria-label="조립한 덩어리">{sentence.chunks.slice(0, sentence.chunkIndex).map((chunk, index) => <span key={index}>{chunk}</span>)}<b aria-label="다음 덩어리">▰</b></div>
      <span className={styles.chunkCount}>{sentence.chunkIndex + 1} / {sentence.chunks.length}</span>
    </div>}
    <div className={styles.arena}>
      <div className={styles.rings} aria-hidden="true" />
      <div key={`stage-${impact?.id ?? 0}`} className={`${styles.stage} ${impact ? impact.correct ? styles.shake : impact.protectedMiss ? styles.protected : styles.recoil : ""}`}>
        <div className={styles.stack} key={progress.currentIndex} data-drop={impact?.correct ?? false} style={{ "--drop": `${(impact?.prompts.length ?? 1) * -58}px` } as CSSProperties}>
          {[4, 3, 2, 1, 0].map((offset) => {
            const item = brickItemAt(seed, progress.currentIndex + offset);
            return <div key={offset} className={`${styles.brick} ${offset === 0 ? styles.current : ""} ${item ? styles.special : ""}`} style={colorStyle(progress.currentIndex + offset)} aria-hidden={offset !== 0}
              aria-label={offset === 0 && item ? `${BRICK_ITEMS[item].name} 특수벽돌` : undefined}>
              {!sentence && brickAt(questions, progress.currentIndex + offset).prompt}
              {item && <span className={styles.itemIcon}>{BRICK_ITEMS[item].emoji}</span>}
            </div>;
          })}
        </div>
        <div className={styles.pedestal} aria-hidden="true" />
        <div key={`hammer-${impact?.id ?? 0}`} data-powered={buffs.hammer > now} data-golden={buffs.gold > now} className={`${styles.hammer} ${impact ? impact.correct || impact.protectedMiss ? styles.swing : styles.bounce : ""}`}><Hammer /></div>
      </div>
      {impacts.map((hit) => <div key={hit.id} className={styles.impact} style={{ "--side": hit.side, ...colorStyle(hit.color) } as CSSProperties}
        onAnimationEnd={(event) => { if (event.target === event.currentTarget) setImpacts((previous) => previous.filter((item) => item.id !== hit.id)); }} aria-hidden="true">
        {hit.correct ? <>
          {hit.prompts.map((prompt, offset) => <div key={offset} className={`${styles.brick} ${styles.flying} ${hit.bomb ? styles.exploding : ""}`} style={{ bottom: `${48 + offset * 58}px`, ...colorStyle(hit.color + offset), "--side": offset % 2 ? -hit.side : hit.side } as CSSProperties}>{prompt}</div>)}
          <div className={styles.flash} />
          {Array.from({ length: 9 }, (_, i) => <i key={i} className={styles.fragment} style={{ "--i": i } as CSSProperties} />)}
          <b className={styles.popText}>{hit.bomb ? "콰쾅!" : hit.prompts.length > 1 ? "파팡!" : "팡!"}</b><b className={styles.plus}>+{hit.score}</b>
        </> : <><b className={styles.clang}>{hit.protectedMiss ? "🛡️" : "깽!"}</b><div className={styles.sparks}>✧</div></>}
      </div>)}
    </div>
    {expired ? <div className={styles.finished} role="status"><h2>게임 종료!</h2><strong>{progress.currentIndex}개 · {progress.score}점</strong>{pending > 0 && <p>기록 저장 중…</p>}</div>
      : <div className={styles.controls}>
        {question.options.map((option, index) => <button key={index} type="button" className={styles.answer} data-lane={index}
          disabled={blocked || cooling} onClick={() => strike(option.id, index)}><kbd>{index + 1}</kbd><span>{option.text}</span></button>)}
      </div>}
    {error ? <div className={styles.error} role="alert">{error}<button type="button" onClick={onRetry}>저장 다시 시도</button></div>
      : !expired && pending >= 12 ? <div className={styles.error} role="status">기록 저장을 기다리는 중…</div> : null}
  </section>;
}
