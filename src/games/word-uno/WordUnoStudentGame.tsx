import { useEffect, useMemo, useRef, useState } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { GameEffectLayer } from "../../game-engine/effects/GameEffectLayer.tsx";
import { createGameAnnouncement } from "../../game-engine/effects/model.ts";
import { useGameEffectEngine } from "../../game-engine/effects/useGameEffectEngine.ts";
import DeadlineCountdownBar from "../../game-engine/timed-turn/DeadlineCountdownBar.tsx";
import { useDeadlineCountdown } from "../../game-engine/timed-turn/useDeadlineCountdown.ts";
import { useWordUnoAssignment } from "../../multiplayer/word-uno/hooks.ts";
import {
  drawWordUnoCard,
  expireWordUnoRound,
  expireWordUnoTurn,
  playWordUnoCard,
} from "../../multiplayer/word-uno/repository.ts";
import type { WordUnoCard, WordUnoStage } from "../../multiplayer/word-uno/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import styles from "./WordUno.module.css";

const ROUND_DURATION_MS = 3 * 60_000;
const TURN_DURATION_MS = 20_000;

type OpponentSeat = "left" | "top" | "right";

function opponentSeat(index: number, count: number): OpponentSeat {
  if (count <= 1) return "top";
  if (count === 2) return index === 0 ? "left" : "right";
  return (["left", "top", "right"] as const)[index] ?? "top";
}

function CardBackStack({ count }: { readonly count: number }) {
  return <div className={styles.cardBackStack} aria-label={`${count}장의 카드`}>
    {Array.from({ length: Math.min(3, count) }, (_unused, index) => <span aria-hidden="true" key={index} />)}
    <strong>{count}장</strong>
  </div>;
}

function actionLabel(kind: "skip" | "draw-two" | "wild"): string {
  if (kind === "skip") return "SKIP";
  if (kind === "draw-two") return "+2";
  return "WILD";
}

function CardFace({ card, showFamily = false }: { readonly card: WordUnoCard; readonly showFamily?: boolean }) {
  if (card.kind !== "word") {
    return <><strong>{actionLabel(card.kind)}</strong><small>{card.kind === "wild" ? "단계 변경" : "언제든 사용 가능"}</small></>;
  }
  return <>
    <strong>{card.text}</strong>
    <small>{card.meaning}</small>
    <em>{card.stage}단계</em>
    {showFamily && card.familyForms ? <span className={styles.familyForms}>{card.familyForms.join(" → ")}</span> : null}
  </>;
}

function WordUnoActionMotion({ motion }: {
  readonly motion: { readonly id: number; readonly kind: "play"; readonly card: WordUnoCard }
    | { readonly id: number; readonly kind: "draw" }
    | null;
}) {
  if (!motion) return null;
  return <div className={styles.actionMotionLayer} aria-hidden="true" key={motion.id}>
    {motion.kind === "play"
      ? <div className={styles.playedCardMotion} data-stage={motion.card.kind === "word" ? motion.card.stage : undefined} data-kind={motion.card.kind}>
        <CardFace card={motion.card} />
      </div>
      : <div className={styles.drawnCardMotion}><span>WORD</span><strong>UNO</strong></div>}
  </div>;
}

function SharedClock({ endsAtMs }: { readonly endsAtMs: number | null }) {
  const countdown = useDeadlineCountdown(endsAtMs, ROUND_DURATION_MS);
  const seconds = Math.ceil((countdown?.remainingMs ?? 0) / 1_000);
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return <div className={styles.roundClock} role="timer" aria-label={`게임 남은 시간 ${minutes}분 ${seconds % 60}초`}>
    <span>게임 시간</span><strong>{endsAtMs === null ? "--:--" : `${minutes}:${remainder}`}</strong>
  </div>;
}

export default function WordUnoStudentGame({ roomId, session, player }: StudentGameModuleProps) {
  const assignment = useWordUnoAssignment(roomId, session.roundId, player.id);
  const state = assignment.value;
  const roundCountdown = useDeadlineCountdown(state?.endsAtMs ?? null, ROUND_DURATION_MS);
  const turnCountdown = useDeadlineCountdown(state?.turnDeadlineAtMs ?? null, TURN_DURATION_MS);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [shakeRevision, setShakeRevision] = useState(0);
  const [pendingWild, setPendingWild] = useState<string | null>(null);
  const [turnRetry, setTurnRetry] = useState(0);
  const [roundRetry, setRoundRetry] = useState(0);
  const [actionMotion, setActionMotion] = useState<
    { readonly id: number; readonly kind: "play"; readonly card: WordUnoCard }
    | { readonly id: number; readonly kind: "draw" }
    | null
  >(null);
  const motionSequenceRef = useRef(0);
  const turnExpiryKey = useRef("");
  const roundExpiryKey = useRef("");
  const turnEffectKeyRef = useRef("");
  const effects = useGameEffectEngine();
  const colorsSetting = session.gameConfig?.["word-uno-colors"];
  const colorsEnabled = colorsSetting !== "off" && colorsSetting !== false;
  const isMyTurn = state?.status === "active" && state.currentPlayerId === player.id;
  const joinedAfterRoundStart = !session.expectedPlayerIds.includes(player.id);

  useEffect(() => { setPendingWild(null); setActionError(""); }, [state?.revision]);

  useEffect(() => {
    if (!state?.endsAtMs || state.status === "completed" || !roundCountdown?.expired) return;
    const key = String(state.endsAtMs);
    if (roundExpiryKey.current === key) return;
    roundExpiryKey.current = key;
    const retry = (): void => {
      window.setTimeout(() => {
        roundExpiryKey.current = "";
        setRoundRetry((value) => value + 1);
      }, 1_000);
    };
    void expireWordUnoRound(roomId, session.roundId).then((accepted) => { if (!accepted) retry(); }).catch(retry);
  }, [roomId, roundCountdown?.expired, roundRetry, session.roundId, state?.endsAtMs, state?.status]);

  useEffect(() => {
    if (!state || state.status !== "active" || !state.turnDeadlineAtMs || !turnCountdown?.expired || roundCountdown?.expired) return;
    const key = `${state.revision}:${state.turnDeadlineAtMs}`;
    if (turnExpiryKey.current === key) return;
    turnExpiryKey.current = key;
    const retry = (): void => {
      window.setTimeout(() => {
        turnExpiryKey.current = "";
        setTurnRetry((value) => value + 1);
      }, 700);
    };
    void expireWordUnoTurn({
      roomId,
      roundId: session.roundId,
      revision: state.revision,
      deadlineAtMs: state.turnDeadlineAtMs,
    }).then((accepted) => { if (!accepted) retry(); }).catch(retry);
  }, [roomId, roundCountdown?.expired, session.roundId, state, turnCountdown?.expired, turnRetry]);

  const memberById = useMemo(() => new Map(state?.members.map((member) => [member.playerId, member]) ?? []), [state?.members]);

  useEffect(() => {
    if (!state || state.status !== "active" || !state.currentPlayerId) return;
    const key = `${session.roundId}:${state.generation}:${state.revision}:${state.currentPlayerId}`;
    if (turnEffectKeyRef.current === key) return;
    turnEffectKeyRef.current = key;
    const myTurn = state.currentPlayerId === player.id;
    const nickname = memberById.get(state.currentPlayerId)?.nickname ?? "다른 친구";
    effects.play(createGameAnnouncement({
      headline: myTurn ? "내 차례!" : `${nickname}의 차례`,
      metric: myTurn ? "카드를 내거나 한 장 뽑으세요" : "잠시 기다려 주세요",
      durationMs: 900,
    }));
  }, [effects.play, memberById, player.id, session.roundId, state]);

  if (assignment.error) return <StatusPanel title="Word UNO 연결 오류" tone="error">{assignment.error.message}</StatusPanel>;
  if (joinedAfterRoundStart) return <StatusPanel title="다음 게임부터 참여" tone="waiting">이번 라운드의 조 편성은 이미 끝났습니다. 현재 조는 바꾸지 않고 다음 게임이 시작되면 참여합니다.</StatusPanel>;
  if (assignment.loading || !state) return <StatusPanel title="Word UNO 준비 중" tone="waiting">게임 조와 카드를 준비하고 있습니다.</StatusPanel>;
  if (state.status === "waiting") return <StatusPanel title="게임 참가 대기 중" tone="waiting">이번 라운드의 조 편성은 이미 끝났습니다. 다음 게임이 시작되면 참여할 수 있습니다.</StatusPanel>;

  const roundEnded = state.status === "completed" || Boolean(roundCountdown?.expired);
  if (roundEnded) {
    return <div className={styles.shell}><SharedClock endsAtMs={state.endsAtMs} /><StatusPanel title="Word UNO 종료">
      {state.rank ? `${state.rank}등으로 게임을 마쳤습니다.` : "선생님이 다음 활동을 준비할 때까지 기다려 주세요."}
    </StatusPanel></div>;
  }

  if (state.status === "finished") {
    return <div className={styles.shell}><SharedClock endsAtMs={state.endsAtMs} /><StatusPanel title={`${state.rank ?? ""}등으로 완료!`}>
      다른 친구들이 게임을 마칠 때까지 기다려 주세요.
    </StatusPanel></div>;
  }

  const failAction = (reason: unknown): void => {
    setActionError(toErrorMessage(reason, "이 카드는 지금 낼 수 없습니다."));
    setShakeRevision((value) => value + 1);
  };

  const play = async (cardId: string, wildStage?: WordUnoStage): Promise<void> => {
    if (busy || !isMyTurn) return;
    const card = state.hand.find((item) => item.id === cardId);
    if (!card) return;
    setBusy(true);
    setActionError("");
    try {
      await playWordUnoCard({
        roomId,
        roundId: session.roundId,
        operationId: crypto.randomUUID(),
        revision: state.revision,
        cardId,
        ...(wildStage ? { wildStage } : {}),
      });
      motionSequenceRef.current += 1;
      setActionMotion({ id: motionSequenceRef.current, kind: "play", card });
      setPendingWild(null);
    } catch (reason: unknown) {
      failAction(reason);
    } finally {
      setBusy(false);
    }
  };

  const chooseCard = (card: WordUnoCard): void => {
    if (busy || !isMyTurn) return;
    if (card.kind === "wild") setPendingWild(card.id);
    else void play(card.id);
  };

  const draw = async (): Promise<void> => {
    if (busy || !isMyTurn) return;
    setBusy(true);
    setActionError("");
    try {
      await drawWordUnoCard({ roomId, roundId: session.roundId, operationId: crypto.randomUUID(), revision: state.revision });
      motionSequenceRef.current += 1;
      setActionMotion({ id: motionSequenceRef.current, kind: "draw" });
    } catch (reason: unknown) {
      failAction(reason);
    } finally {
      setBusy(false);
    }
  };

  const opponents = state.members.filter((member) => member.playerId !== player.id);
  const self = memberById.get(player.id);

  return <div className={styles.shell} data-colors={colorsEnabled ? "on" : "off"}>
    <GameEffectLayer effect={effects.activeEffect} className={styles.turnEffectLayer} />
    <div className={styles.gameHeader}>
      <div><span>{state.groupLabel ?? "Word UNO"}</span><strong>{isMyTurn ? "내 차례" : `${memberById.get(state.currentPlayerId ?? "")?.nickname ?? "다른 친구"} 차례`}</strong></div>
      <SharedClock endsAtMs={state.endsAtMs} />
      <div className={styles.stageBadge}><span>현재 단계</span><strong>{state.activeStage ? `${state.activeStage}단계` : "선택 전"}</strong></div>
    </div>

    {state.turnDeadlineAtMs !== null
      ? <DeadlineCountdownBar deadlineAtMs={state.turnDeadlineAtMs} durationMs={TURN_DURATION_MS} label="턴 남은 시간" />
      : null}

    <div className={styles.unoTableScene} aria-label="Word UNO 게임 테이블">
      <WordUnoActionMotion motion={actionMotion} />
      {opponents.map((member, index) => <div
        className={styles.opponentSeat}
        data-seat={opponentSeat(index, opponents.length)}
        data-current={member.playerId === state.currentPlayerId}
        key={member.playerId}
      >
        <div className={styles.seatHeading}>
          <strong>{member.nickname}</strong>
          {member.rank ? <em>{member.rank}등</em> : member.playerId === state.currentPlayerId ? <em>현재 차례</em> : null}
        </div>
        <CardBackStack count={member.handCount} />
      </div>)}

      <div className={styles.tableCenter}>
        <div className={styles.feltTable}>
          <button
            type="button"
            className={styles.drawPileButton}
            onClick={() => void draw()}
            disabled={!isMyTurn || busy || turnCountdown?.expired}
            aria-label="카드 한 장 뽑기"
          >
            <span>WORD</span><strong>UNO</strong><small>한 장 뽑기</small>
          </button>
          <div className={styles.discardArea}>
            <span>PLAY</span>
            {state.topCard
              ? <div className={styles.cardFace} data-stage={state.topCard.kind === "word" ? state.topCard.stage : undefined} data-kind={state.topCard.kind}><CardFace card={state.topCard} showFamily /></div>
              : <div className={styles.emptyCard}>카드 준비 중</div>}
          </div>
        </div>
        <div className={styles.tableRule}>
          <strong>{isMyTurn ? "내 차례 · 카드를 내거나 덱을 눌러 한 장 뽑으세요." : "차례를 기다리고 있습니다."}</strong>
          {state.activeFamilyForms ? <span>같은 단어 변화: {state.activeFamilyForms.join(" → ")}</span> : null}
          <span>SKIP과 +2는 언제든 낼 수 있으며 현재 단계는 바뀌지 않습니다.</span>
        </div>
      </div>

      <div className={styles.selfSeat} data-current={isMyTurn}>
        <span>나</span><strong>{self?.nickname ?? player.nickname ?? "내 카드"}</strong><em>{state.hand.length}장</em>
      </div>
    </div>

    {actionError ? <p className={styles.actionError} role="alert">{actionError}</p> : null}

    {pendingWild ? <Card className={styles.wildChooser}>
      <strong>WILD로 바꿀 단계를 선택하세요.</strong>
      <div>{([1, 2, 3] as const).map((nextStage) => <Button key={nextStage} onClick={() => void play(pendingWild, nextStage)} disabled={busy}>{nextStage}단계</Button>)}</div>
      <Button variant="ghost" onClick={() => setPendingWild(null)} disabled={busy}>취소</Button>
    </Card> : null}

    <section className={styles.handSection} aria-label="내 카드">
      <div className={styles.handHeading}><div><span>내 카드</span><strong>{state.hand.length}장</strong></div><span className={styles.handHint}>낼 카드가 없으면 테이블의 덱을 눌러 뽑으세요.</span></div>
      <div className={styles.hand} key={shakeRevision} data-shake={Boolean(actionError)}>
        {state.hand.map((card) => <button
          type="button"
          className={styles.handCard}
          data-stage={card.kind === "word" ? card.stage : undefined}
          data-kind={card.kind}
          key={card.id}
          onClick={() => chooseCard(card)}
          disabled={!isMyTurn || busy || turnCountdown?.expired}
        ><CardFace card={card} /></button>)}
      </div>
    </section>
  </div>;
}
