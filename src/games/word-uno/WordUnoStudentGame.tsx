import { useEffect, useMemo, useRef, useState } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
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
const TURN_DURATION_MS = 10_000;

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
  const turnExpiryKey = useRef("");
  const roundExpiryKey = useRef("");
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
    } catch (reason: unknown) {
      failAction(reason);
    } finally {
      setBusy(false);
    }
  };

  return <div className={styles.shell} data-colors={colorsEnabled ? "on" : "off"}>
    <div className={styles.gameHeader}>
      <div><span>{state.groupLabel ?? "Word UNO"}</span><strong>{isMyTurn ? "내 차례" : `${memberById.get(state.currentPlayerId ?? "")?.nickname ?? "다른 친구"} 차례`}</strong></div>
      <SharedClock endsAtMs={state.endsAtMs} />
      <div className={styles.stageBadge}><span>현재 단계</span><strong>{state.activeStage ? `${state.activeStage}단계` : "선택 전"}</strong></div>
    </div>

    {state.turnDeadlineAtMs !== null
      ? <DeadlineCountdownBar deadlineAtMs={state.turnDeadlineAtMs} durationMs={TURN_DURATION_MS} label="턴 남은 시간" />
      : null}

    <div className={styles.memberStrip}>
      {state.members.map((member) => <div key={member.playerId} data-current={member.playerId === state.currentPlayerId}>
        <strong>{member.nickname}</strong><span>{member.handCount}장</span>{member.rank ? <em>{member.rank}등</em> : null}
      </div>)}
    </div>

    <div className={styles.tableArea}>
      <div className={styles.topCardWrap}>
        <span>바닥 카드</span>
        {state.topCard
          ? <div className={styles.cardFace} data-stage={state.topCard.kind === "word" ? state.topCard.stage : undefined} data-kind={state.topCard.kind}><CardFace card={state.topCard} showFamily /></div>
          : <div className={styles.emptyCard}>카드 준비 중</div>}
      </div>
      <Card className={styles.ruleCard}>
        <strong>{isMyTurn ? "카드를 내거나 한 장 뽑으세요." : "차례를 기다리고 있습니다."}</strong>
        {state.activeFamilyForms ? <span>같은 단어 변화: {state.activeFamilyForms.join(" → ")}</span> : null}
        <span>SKIP과 +2는 언제든 낼 수 있으며 현재 단계는 바뀌지 않습니다.</span>
      </Card>
    </div>

    {actionError ? <p className={styles.actionError} role="alert">{actionError}</p> : null}

    {pendingWild ? <Card className={styles.wildChooser}>
      <strong>WILD로 바꿀 단계를 선택하세요.</strong>
      <div>{([1, 2, 3] as const).map((nextStage) => <Button key={nextStage} onClick={() => void play(pendingWild, nextStage)} disabled={busy}>{nextStage}단계</Button>)}</div>
      <Button variant="ghost" onClick={() => setPendingWild(null)} disabled={busy}>취소</Button>
    </Card> : null}

    <section className={styles.handSection} aria-label="내 카드">
      <div className={styles.handHeading}><div><span>내 카드</span><strong>{state.hand.length}장</strong></div><Button onClick={() => void draw()} disabled={!isMyTurn || busy || turnCountdown?.expired}>한 장 뽑기</Button></div>
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
