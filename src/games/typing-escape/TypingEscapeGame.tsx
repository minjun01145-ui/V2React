import { useEffect, useMemo, useRef, useState } from "react";
import type { StudentGameModuleProps, TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import type { TypingComparisonOptions } from "../../game-engine/typing/types.ts";
import { adaptLearningSetToTyping } from "../../game-engine/typing/typingAdapter.ts";
import { readTimedGameConfig } from "../../game-engine/timed-game/config.ts";
import { ImmersiveStage } from "../../game-engine/stage/ImmersiveStage.tsx";
import { useLearningSet } from "../../learning-sets/useLearningSet.ts";
import { useRoundParticipants } from "../../multiplayer/hooks.ts";
import { displayLabel } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import EscapeStage, { type EscapeRunner } from "./EscapeStage.tsx";
import { ESCAPE_POINTS, FINISH, escapeScore, escapeTypingState, hiddenAt, phaseAt, type EscapeProgress } from "./model.ts";
import { useEscapeRace } from "./useEscapeRace.ts";
import { useEscapeAudio } from "./useEscapeAudio.ts";
import styles from "./TypingEscape.module.css";

type Props = StudentGameModuleProps | TeacherGameModuleProps;
type Runner = { id: string; label: string };
export default function TypingEscapeGame(props: Props) {
  const { session, roomId } = props;
  const setId = typeof session.gameConfig?.setId === "string" ? session.gameConfig.setId : null;
  const learning = useLearningSet(setId, session.roundId);
  const participants = useRoundParticipants(roomId, session.roundId);
  const prepared = useMemo(() => {
    if (!learning.set) return { targets: [], error: null };
    try { return { targets: adaptLearningSetToTyping(learning.set, session.gameConfig?.["escape-target"] === "meaning" ? "meaning" : "source").questions.map(q => q.targetText), error: null }; }
    catch (reason) { return { targets: [], error: reason instanceof Error ? reason.message : "학습 세트 오류" }; }
  }, [learning.set, session.gameConfig]);
  if (props.role === "student" && !session.expectedPlayerIds.includes(props.player.id)) return <StatusPanel title="다음 게임을 기다려 주세요" tone="waiting">진행 중인 경기입니다.</StatusPanel>;
  if (learning.loading || participants.loading) return <StatusPanel title="탈출 게임 준비 중">참가자와 학습 세트를 불러오고 있습니다.</StatusPanel>;
  const error = learning.error?.message ?? participants.error?.message ?? prepared.error;
  if (error || !prepared.targets.length) return <StatusPanel title="학습 세트 오류" tone="error">{error ?? "단어 또는 문장 세트를 선택해 주세요."}</StatusPanel>;
  const players = participants.value.filter(p => session.expectedPlayerIds.includes(p.playerId))
    .map(p => ({ id: p.playerId, label: displayLabel(p.displayName, p.nickname) })).sort((a, b) => a.id.localeCompare(b.id));
  return <Runtime key={`${session.roundId}:${props.role}`} props={props} targets={prepared.targets} players={players} />;
}

function Runtime({ props, targets, players }: { props: Props; targets: readonly string[]; players: readonly Runner[] }) {
  const { session } = props;
  const selfId = props.role === "student" ? props.player.id : null;
  const label = props.role === "student" ? displayLabel(props.player.displayName, props.player.nickname) : "교사";
  const duration = readTimedGameConfig(session.gameConfig).durationMs;
  const end = duration !== null && session.startedAtMs !== null ? session.startedAtMs + duration : null;
  const options: TypingComparisonOptions = { ignoreCase: session.gameConfig?.["ignore-case"] === "yes",
    ignorePunctuation: session.gameConfig?.["ignore-punctuation"] === "yes" };
  const race = useEscapeRace(props.roomId, session.roundId, selfId, label, session.startedAtMs, end, targets, options);
  const expired = end !== null && race.now >= end;
  const now = expired ? end! : race.now;
  const phase = phaseAt(session.startedAtMs, now);
  const runners: EscapeRunner[] = players.map(player => {
    const frame = race.frames.find(f => f.playerId === player.id);
    const record = race.records.find(r => r.playerId === player.id);
    const local = player.id === selfId;
    return { ...player, distance: local ? race.progress.distance : Math.max(0, Math.min(FINISH, frame?.y ?? 0)),
      escapes: local ? race.progress.escapes : Math.max(Math.floor((record?.score ?? 0) / ESCAPE_POINTS), Math.round(frame?.x ?? 0)),
      hits: local ? race.progress.hits : Math.max(0, Math.round(frame?.vx ?? 0)),
      hidden: local ? hiddenAt(race.progress, now) : frame?.vy !== 1,
      hit: local ? now < race.progress.stunnedUntil : frame?.vy === -1 };
  });
  const finished = targets[(race.progress.question + targets.length - 1) % targets.length]!;
  const content = <EscapeGameView selfId={selfId} runners={runners} progress={race.progress} phase={phase} now={now}
    remaining={end === null ? null : Math.max(0, Math.ceil((end - race.now) / 1000))} expired={expired}
    target={targets[race.progress.question % targets.length]!} options={options}
    completedText={/\s/.test(finished.trim()) ? "한 문장 완료!" : "한 단어 완료!"}
    connected={race.connected} error={race.error?.message ?? null}
    onInput={race.input} onActivity={race.activity} />;
  return props.role === "student" ? <ImmersiveStage>{content}</ImmersiveStage> : content;
}

const FEED_MS = 3_500;
type FeedItem = { key: string; at: number; text: string; hit: boolean; self: boolean };
function subject(name: string) {
  const last = name.at(-1) ?? "";
  const code = last.charCodeAt(0) - 0xac00;
  // Digits follow their Korean reading: 이, 사, 오, 구 end in a vowel.
  if (/\d/.test(last)) return `${name}${"2459".includes(last) ? "가" : "이"}`;
  return code >= 0 && code < 11_172 ? `${name}${code % 28 ? "이" : "가"}` : `${name}이(가)`;
}
/** Announces escapes and deaths; a jump of more than one is a reconnect catching up, not an event. */
function useEscapeFeed(runners: readonly EscapeRunner[], selfId: string | null, now: number) {
  const seen = useRef(new Map<string, { hits: number; escapes: number }>());
  const [feed, setFeed] = useState<readonly FeedItem[]>([]);
  useEffect(() => {
    const events: FeedItem[] = [];
    for (const runner of runners) {
      const before = seen.current.get(runner.id);
      seen.current.set(runner.id, { hits: runner.hits, escapes: runner.escapes });
      if (!before) continue;
      const self = runner.id === selfId;
      if (runner.escapes === before.escapes + 1) events.push({ key: `${runner.id}:e${runner.escapes}`, at: now, text: `${runner.label} 탈출 성공!!`, hit: false, self });
      if (runner.hits === before.hits + 1) events.push({ key: `${runner.id}:h${runner.hits}`, at: now, text: `${subject(runner.label)} 죽었습니다!`, hit: true, self });
    }
    if (events.length) setFeed(items => [...items.filter(item => now - item.at < FEED_MS), ...events].slice(-5));
  }, [runners, selfId, now]);
  return feed.filter(item => now - item.at < FEED_MS);
}

export interface EscapeGameViewProps {
  selfId: string | null; runners: readonly EscapeRunner[]; progress: EscapeProgress;
  phase: ReturnType<typeof phaseAt>; now: number; remaining: number | null; expired: boolean;
  target: string; options: TypingComparisonOptions; completedText: string; connected: boolean; error: string | null;
  onInput: (value: string, composing?: boolean) => void; onActivity: () => void;
}
export function EscapeGameView({ selfId, runners, progress, phase, now, remaining, expired, target, options, completedText, connected, error, onInput, onActivity }: EscapeGameViewProps) {
  const audio = useEscapeAudio(selfId === null, phase.active && !expired, phase,
    selfId === null ? runners.reduce((sum, runner) => sum + runner.hits, 0) : progress.hits,
    selfId === null ? runners.reduce((sum, runner) => sum + runner.escapes, 0) : progress.escapes);
  const composing = useRef(false);
  const committedComposition = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const hit = now < progress.stunnedUntil;
  const countdown = Math.ceil((progress.stunnedUntil - now) / 1000);
  const escaped = now < progress.escapedUntil;
  const completed = now < progress.completedUntil;
  const comparison = escapeTypingState(target, progress.input, options);
  const nextLetter = [...target.slice(comparison.prefix)][0] ?? "";
  const watching = phase.watching && !expired;
  const warning = phase.active && !expired && !watching && phase.syllable === 9;
  const feed = useEscapeFeed(runners, selfId, now);
  const standings = [...runners].sort((a, b) => b.escapes - a.escapes || a.label.localeCompare(b.label, "ko"));
  useEffect(() => {
    // Blurring ends any IME composition so the erased answer cannot reappear.
    composing.current = false;
    committedComposition.current = null;
    if (progress.hits) input.current?.blur();
  }, [progress.hits]);
  useEffect(() => {
    if (connected && phase.active && !expired && !hit) input.current?.focus();
  }, [connected, phase.active, expired, hit]);
  const inputStatus = expired ? "경기 종료" : !connected ? "연결 중…" : !phase.active ? "출발 준비" : hit ? `${countdown}초 뒤 출발` : watching ? "멈춰!" : escaped ? `탈출! +${ESCAPE_POINTS}` : "달려!";
  return <div className={`${styles.game} ${watching ? styles.watching : ""} ${warning ? styles.warning : ""} ${selfId && hit ? styles.hit : ""}`}>
    <header className={styles.header}>
      <h2>무궁화 <span>탈출</span></h2>
      {selfId && <div className={styles.score}><span>탈출 {progress.escapes}회</span><strong>{escapeScore(progress)}<small>점</small></strong></div>}
      <div className={`${styles.clock} ${remaining !== null && remaining <= 10 ? styles.clockUrgent : ""}`}>{remaining === null ? "∞" : remaining}<small>초</small></div>
      <button type="button" className={styles.sound} onClick={() => { audio.toggle(); input.current?.focus(); }} aria-label={audio.enabled ? "소리 끄기" : "소리 켜기"}>{audio.enabled ? "소리 끄기" : "소리 켜기"}</button>
    </header>
    <div className={styles.arena}>
      <div className={styles.chant} role="status" aria-live="off">
        <i className={styles.signal} aria-hidden="true" />
        <strong key={`${phase.cycle}:${phase.beat}:${watching}`}>{expired ? "경기 종료!" : !phase.active ? "출발 준비!" : watching ? "멈춰!! 움직이면 쏜다!" : `${phase.text}${phase.syllable === 9 ? "!!!" : phase.beatMs > 600 ? "…" : ""}`}</strong>
      </div>
      <EscapeStage runners={runners} selfId={selfId} watching={watching} cycle={phase.cycle} active={phase.active && !expired} />
      {watching && <div className={styles.redLight} aria-hidden="true" />}
      {selfId && hit && !expired && <div className={styles.hurt} key={progress.hits} aria-hidden="true" />}
      {selfId && !expired && hit && <div className={styles.death} role="status">
        <strong>죽었습니다!</strong><b key={countdown}>{countdown}</b>
      </div>}
      {selfId && !expired && !hit && (escaped || completed) && <div className={`${styles.outcome} ${escaped ? styles.success : styles.leap}`} role="status"
        key={escaped ? `escape:${progress.escapes}` : `leap:${progress.question}`}>
        <strong>{escaped ? "탈출 성공!!" : completedText}</strong><span>{escaped ? `+${ESCAPE_POINTS}점` : "점프!"}</span>
      </div>}
      {!expired && feed.length > 0 && <ol className={styles.feed} aria-live="polite">{feed.map(item =>
        <li key={item.key} className={`${item.hit ? styles.feedHit : styles.feedEscape} ${item.self ? styles.feedSelf : ""}`}>{item.text}</li>)}</ol>}
    </div>
    {(error || audio.error) && <div role="alert" className={styles.error}>{error ?? audio.error}</div>}
    {selfId && !expired && <div className={styles.typing}>
      <div className={styles.typingTop}><strong className={styles.inputStatus}>{inputStatus}</strong><div className={styles.distance} aria-label={`탈출까지 ${FINISH - progress.distance}%`}><span style={{ width: `${progress.distance}%` }} /></div><b>{progress.distance}%</b></div>
      <div className={styles.prompt}><mark>{target.slice(0, comparison.prefix)}</mark><span className={styles.nextLetter}>{nextLetter}</span>{target.slice(comparison.prefix + nextLetter.length)}</div>
      <input ref={input} aria-label="제시된 단어 또는 문장 입력" autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false}
        value={progress.input} aria-invalid={comparison.hasError} disabled={!connected || !!error || !phase.active} readOnly={hit}
        placeholder={hit ? inputStatus : "입력"} maxLength={10_000}
        onPaste={e => e.preventDefault()} onDrop={e => e.preventDefault()}
        onCompositionStart={() => { composing.current = true; }}
        onKeyDown={e => { if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key.length === 1 || e.key === "Process" || e.key === "Backspace" || e.key === "Delete")) onActivity(); }}
        onCompositionEnd={e => {
          if (!composing.current) return;
          composing.current = false; committedComposition.current = e.currentTarget.value; onInput(e.currentTarget.value);
        }}
        onChange={e => {
          if (!composing.current && committedComposition.current === e.target.value) { committedComposition.current = null; return; }
          committedComposition.current = null; onInput(e.target.value, composing.current);
        }} />
    </div>}
    {(selfId === null || expired) && <ol className={styles.ranking} aria-label="탈출 순위">{standings.map(runner => <li key={runner.id} className={runner.id === selfId ? styles.ownRank : ""}><b>{standings.findIndex(other => other.escapes === runner.escapes) + 1}</b><span>{runner.label}</span><strong>{runner.escapes * ESCAPE_POINTS}<small>점</small></strong><em>{runner.escapes}회 탈출</em></li>)}</ol>}
  </div>;
}
