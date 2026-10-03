import { useMemo, useRef, useState } from "react";
import type { StudentGameModuleProps, TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { adaptLearningSetToTyping } from "../../game-engine/typing/typingAdapter.ts";
import { getTypingComparisonState } from "../../game-engine/typing/typingEngine.ts";
import { readTimedGameConfig } from "../../game-engine/timed-game/config.ts";
import { ImmersiveStage } from "../../game-engine/stage/ImmersiveStage.tsx";
import { useLearningSet } from "../../learning-sets/useLearningSet.ts";
import { useRoundParticipants } from "../../multiplayer/hooks.ts";
import { displayLabel } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import EscapeStage from "./EscapeStage.tsx";
import { CHANT, FINISH, escapeScore, hiddenAt, phaseAt } from "./model.ts";
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
  const race = useEscapeRace(props.roomId, session.roundId, selfId, label, session.startedAtMs, end, targets);
  const expired = end !== null && race.now >= end;
  const phase = phaseAt(session.startedAtMs, race.now);
  const audio = useEscapeAudio(props.role === "teacher", phase.active && !expired, phase.cycle, phase.syllable, phase.watching);
  const composing = useRef(false);
  const committedComposition = useRef<string | null>(null);
  const [draft, setDraft] = useState("");
  const target = targets[race.progress.question % targets.length]!;
  const comparison = getTypingComparisonState(target, race.progress.input);
  const finished = race.progress.distance >= FINISH;
  const hit = race.now < race.progress.stunnedUntil;
  const runners = players.map(player => {
    const frame = race.frames.find(f => f.playerId === player.id);
    const local = player.id === selfId;
    return { ...player, distance: local ? race.progress.distance : Math.max(0, Math.min(FINISH, frame?.y ?? race.records.find(r => r.playerId === player.id)?.score ?? 0)),
      hidden: local ? hiddenAt(race.progress, race.now) : frame?.vy !== 1, hit: local ? hit : frame?.vy === -1 };
  });
  const score = (runner: typeof runners[number]) => runner.distance < FINISH ? runner.distance
    : runner.id === selfId ? escapeScore(race.progress) : race.records.find(r => r.playerId === runner.id)?.score ?? FINISH;
  const standings = [...runners].sort((a, b) => score(b) - score(a) || a.label.localeCompare(b.label, "ko"));
  const content = <div className={styles.game}>
    <header className={styles.header}><h2>무궁화 탈출</h2><span>{end === null ? "무제한" : `${Math.max(0, Math.ceil((end - race.now) / 1000))}초`}</span>
      {props.role === "teacher" && <button type="button" onClick={audio.toggle}>{audio.enabled ? "소리 끄기" : "소리 켜기"}</button>}</header>
    <div className={`${styles.chant} ${phase.watching && !expired ? styles.danger : ""}`} aria-label="무궁화꽃이피었습니다">
      {!phase.active ? <strong>출발 준비</strong> : expired ? <strong>경기 종료</strong> : CHANT.map((letter, i) => <span key={i} className={i <= phase.syllable ? styles.spoken : ""}>{letter}</span>)}
      {phase.watching && !expired && <b>숨으세요!</b>}
    </div>
    <EscapeStage runners={runners} selfId={selfId} watching={phase.watching && !expired} cycle={phase.cycle} />
    {(race.error || audio.error) && <div role="alert" className={styles.error}>{race.error?.message ?? audio.error}</div>}
    {selfId && !expired && !finished && <div className={styles.typing}>
      <div className={styles.prompt}><mark>{target.slice(0, comparison.currentPrefixLength)}</mark>{target.slice(comparison.currentPrefixLength)}</div>
      <input aria-label="제시된 단어 또는 문장 입력" autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false}
        value={composing.current ? draft : race.progress.input} aria-invalid={comparison.hasError}
        disabled={!race.connected || !!race.error || !phase.active} readOnly={hit}
        placeholder={hit ? "앗! 뒤로 밀렸어요" : "입력하면 전진 · 멈추면 숨기"}
        onPaste={e => e.preventDefault()} onDrop={e => e.preventDefault()}
        onCompositionStart={() => { composing.current = true; setDraft(race.progress.input); }}
        onKeyDown={e => { if (!e.ctrlKey && !e.metaKey && (e.key.length === 1 || e.key === "Process" || e.key === "Backspace")) race.activity(); }}
        onCompositionEnd={e => { composing.current = false; committedComposition.current = e.currentTarget.value; race.input(e.currentTarget.value); }}
        onChange={e => {
          if (composing.current) { setDraft(e.target.value); return; }
          if (committedComposition.current === e.target.value) { committedComposition.current = null; return; }
          committedComposition.current = null; race.input(e.target.value);
        }} />
      <div className={styles.status}><strong>{hit ? "피격! −15" : phase.watching ? "입력 금지" : hiddenAt(race.progress, race.now) ? "쓰레기통 안" : "전진 중"}</strong><span>{race.progress.distance} / {FINISH}</span></div>
    </div>}
    {selfId && finished && <div className={styles.finished}>탈출 성공! 🎉</div>}
    {(props.role === "teacher" || expired || finished) && <ol className={styles.ranking} aria-label="탈출 순위">{standings.map(runner => <li key={runner.id}><b>{standings.findIndex(other => score(other) === score(runner)) + 1}</b><span>{runner.label}</span><strong>{runner.distance >= FINISH ? "탈출 성공" : `${Math.round(runner.distance)} / ${FINISH}`}</strong></li>)}</ol>}
  </div>;
  return props.role === "student" ? <ImmersiveStage>{content}</ImmersiveStage> : content;
}
