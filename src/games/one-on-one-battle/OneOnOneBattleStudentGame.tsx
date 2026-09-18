
import { useEffect, useMemo, useRef, useState } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { GameEffectLayer } from "../../game-engine/effects/GameEffectLayer.tsx";
import { createGameAnnouncement } from "../../game-engine/effects/model.ts";
import { useGameEffectEngine } from "../../game-engine/effects/useGameEffectEngine.ts";
import DeadlineCountdownBar from "../../game-engine/timed-turn/DeadlineCountdownBar.tsx";
import { useDeadlineCountdown } from "../../game-engine/timed-turn/useDeadlineCountdown.ts";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import { sharedItemQuantity } from "../../items/inventory.ts";
import LearningSetTable from "../../learning-sets/table/LearningSetTable.tsx";
import { learningSetTableEntries, type LearningSetTableSide } from "../../learning-sets/table/model.ts";
import { useLearningSet } from "../../learning-sets/useLearningSet.ts";
import BattleResultStage from "../../multiplayer/battle-result/BattleResultStage.tsx";
import { useBattleAssignment } from "../../multiplayer/battle/hooks.ts";
import {
  expireBattlePhase,
  issueBattleQuestion,
  refreshBattleMatch,
  submitBattleAnswer,
  useBattleItem,
} from "../../multiplayer/battle/repository.ts";
import { useStudentItemInventory } from "../../student-data/items/useStudentItemInventory.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import { usePopup } from "../../shared/popup/index.ts";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import GameItemSlots from "../../shared/ui/GameItemSlots.tsx";
import { canUseBattleInk } from "./battleSharedItems.ts";
import {
  parseBattleGameConfig,
  resolveBattleQuestionSide,
} from "./config.ts";
import styles from "./OneOnOneBattle.module.css";

function Hearts({ count }: { readonly count: number }) {
  return <span className={styles.hearts} aria-label={`남은 하트 ${count}개`}>
    {[0, 1].map((index) => <i key={index} data-alive={index < count}>♥</i>)}
  </span>;
}

export default function OneOnOneBattleStudentGame({
  roomId,
  session,
  player,
}: StudentGameModuleProps) {
  const setId = typeof session.gameConfig?.setId === "string" ? session.gameConfig.setId : null;
  const learningSet = useLearningSet(setId, session.roundId);
  const battle = useBattleAssignment(roomId, session.roundId, player.id);
  const persistentItems = useStudentItemInventory();
  const clock = useTimedGameClock(session);
  const effects = useGameEffectEngine();
  const { requestConfirmation, showMessage } = usePopup();
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [now, setNow] = useState(Date.now());
  const eventKey = useRef("");
  const turnKey = useRef("");
  const expiryKey = useRef("");
  const rewardRefreshKey = useRef("");
  const state = battle.value;

  const battleConfig = useMemo(
    () => parseBattleGameConfig(session.gameConfig),
    [session.gameConfig],
  );

  const entries = useMemo(
    () => learningSet.set
      ? learningSetTableEntries(learningSet.set.type, learningSet.set.items)
      : [],
    [learningSet.set],
  );

  const durationMs = state?.phase === "choosing"
    ? 10_000
    : battleConfig.answerDurationMs;
  const countdown = useDeadlineCountdown(state?.deadlineAtMs ?? null, durationMs);

  const inkCount = persistentItems.available
    ? sharedItemQuantity(persistentItems.inventory, "ink")
    : 0;
  const bombCount = persistentItems.available
    ? sharedItemQuantity(persistentItems.inventory, "bomb")
    : 0;
  const iceCount = persistentItems.available
    ? sharedItemQuantity(persistentItems.inventory, "ice")
    : 0;

  const canUseInk = Boolean(
    state
    && state.status === "active"
    && persistentItems.available
    && inkCount > 0
    && !busy
    && canUseBattleInk(state.phase, state.role),
  );
  const inkBlocked = (state?.inkBlockedUntilAtMs ?? 0) > now;

  useEffect(() => {
    setAnswer("");
  }, [state?.selectedItemId, state?.generation]);

  useEffect(() => {
    const blockedUntil = state?.inkBlockedUntilAtMs ?? 0;
    if (blockedUntil <= Date.now()) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [state?.inkBlockedUntilAtMs]);

  useEffect(() => {
    if (
      !state
      || !state.eventWasMine
      || state.eventRewardItemId !== "ink"
      || state.eventRevision <= 0
    ) {
      return;
    }

    const key = `${state.generation}:${state.eventRevision}:ink-reward`;
    if (rewardRefreshKey.current === key) return;
    rewardRefreshKey.current = key;

    void persistentItems.refresh().catch((error) => {
      console.error("배틀 보상 인벤토리 새로고침 실패", error);
    });
  }, [
    persistentItems.refresh,
    state?.eventRewardItemId,
    state?.eventRevision,
    state?.eventWasMine,
    state?.generation,
  ]);

  useEffect(() => {
    if (!state || state.status !== "active") return;
    const key = `${state.generation}:${state.questionNumber}:${state.phase}:${state.role}`;

    if (state.eventRevision > 0) {
      const nextEventKey = `${state.generation}:${state.eventRevision}:${state.eventType}`;
      if (eventKey.current !== nextEventKey) {
        eventKey.current = nextEventKey;

        if (state.eventType === "question-issued") {
          effects.play(createGameAnnouncement({
            headline: state.role === "defender" ? "문제가 도착했습니다!" : "문제를 보냈습니다!",
            metric: state.rewardAvailable
              ? "🎁 이번 문제에는 아이템이 걸려 있어요"
              : state.role === "defender"
                ? `${battleConfig.answerSeconds}초 안에 답하세요`
                : "상대의 답을 기다립니다",
            tone: "info",
          }));
        }

        if (state.eventType === "correct") {
          effects.play(createGameAnnouncement({
            headline: state.eventWasMine && state.eventRewardItemId === "ink"
              ? "정답! 먹물 아이템 획득!"
              : state.eventWasMine
                ? "문제를 맞췄습니다!"
                : "상대가 문제를 맞췄습니다!",
            metric: state.eventWasMine && state.eventRewardItemId === "ink"
              ? "🦑 먹물 +1"
              : "턴이 바뀝니다",
            tone: "info",
          }));
        }

        if (state.eventType === "wrong" || state.eventType === "timeout") {
          effects.play(createGameAnnouncement({
            headline: state.eventType === "timeout" ? "시간 초과!" : "정답이 아닙니다!",
            metric: "하트가 하나 줄었습니다",
            tone: "warning",
          }));
        }

        if (state.eventType === "ink-used") {
          effects.play(createGameAnnouncement({
            headline: state.eventWasMine ? "먹물 발사!" : "상대가 먹물을 사용했습니다!",
            metric: state.eventWasMine
              ? "상대 화면을 5초 가립니다"
              : "5초 동안 화면이 가려집니다",
            tone: "warning",
          }));
        }

        if (state.phase === "choosing" && state.role === "attacker") {
          turnKey.current = key;
          const timer = window.setTimeout(() => {
            effects.play(createGameAnnouncement({
              headline: "나의 공격 차례입니다!",
              metric: "10초 안에 문제 선택",
              tone: "warning",
            }));
          }, 1_550);
          return () => window.clearTimeout(timer);
        }

        return;
      }
    }

    if (
      state.phase === "choosing"
      && state.role === "attacker"
      && turnKey.current !== key
    ) {
      turnKey.current = key;
      effects.play(createGameAnnouncement({
        headline: "나의 공격 차례입니다!",
        metric: "10초 안에 문제 선택",
        tone: "warning",
      }));
    }
  }, [battleConfig.answerSeconds, effects.play, state]);

  useEffect(() => {
    if (
      !state
      || state.status !== "active"
      || state.deadlineAtMs === null
      || !countdown?.expired
      || clock.expired
      || state.phase === "grading"
    ) {
      return;
    }

    const key = `${state.generation}:${state.deadlineAtMs}`;
    if (expiryKey.current === key) return;
    expiryKey.current = key;

    void expireBattlePhase({
      roomId,
      roundId: session.roundId,
      generation: state.generation,
      deadlineAtMs: state.deadlineAtMs,
    }).catch(() => {
      window.setTimeout(() => {
        expiryKey.current = "";
      }, 700);
    });
  }, [clock.expired, countdown?.expired, roomId, session.roundId, state]);

  useEffect(() => {
    if (state?.status !== "searching" || clock.expired) return undefined;

    const refresh = () => {
      setNow(Date.now());
      void refreshBattleMatch(roomId, session.roundId).catch(console.error);
    };

    refresh();
    const timer = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(timer);
  }, [clock.expired, roomId, session.roundId, state?.status]);

  if (learningSet.error || battle.error) {
    return <StatusPanel title="배틀 연결 오류" tone="error">
      {learningSet.error?.message ?? battle.error?.message}
    </StatusPanel>;
  }

  if (learningSet.loading || battle.loading || !state) {
    return <StatusPanel title="상대를 찾고 있습니다" tone="waiting">
      익명의 배틀 상대를 편성하고 있어요.
    </StatusPanel>;
  }

  if (clock.expired) {
    return <StatusPanel title="배틀 시간이 종료되었습니다">
      Kills {state.kills} · Deaths {state.deaths}
    </StatusPanel>;
  }

  if (
    state.result
    && (state.status === "completed" || (state.resultUntilAtMs ?? 0) > now)
  ) {
    return <div className={styles.search}>
      <GameEffectLayer effect={effects.activeEffect} />
      <section className={styles.result}>
        <h1>{state.result.headline}</h1>
        <BattleResultStage outcome={state.result.outcome} players={state.result.players} />
        <p>
          {state.status === "completed"
            ? "배틀이 완료되었습니다."
            : "잠시 후 다른 학생을 우선으로 새 상대를 찾습니다."}
        </p>
      </section>
    </div>;
  }

  if (state.status === "searching") {
    return <div className={styles.search}>
      <TimedGameStatus session={session} />
      <StatusPanel title="새로운 상대를 찾고 있습니다" tone="waiting">
        다른 학생과의 매칭을 우선합니다. 가능한 상대가 없으면 잠시 후 이전 상대와도 다시 만날 수 있어요.
        {" · "}Kills {state.kills} / Deaths {state.deaths}
      </StatusPanel>
    </div>;
  }

  if (state.status === "completed") {
    return <StatusPanel title="공동 승리!">배틀을 완료했습니다.</StatusPanel>;
  }

  const select = async (
    itemId: string,
    requestedSide: LearningSetTableSide,
  ): Promise<void> => {
    if (busy || state.role !== "attacker" || state.phase !== "choosing") return;

    const entry = entries.find((item) => item.id === itemId);
    if (!entry) return;

    const side = resolveBattleQuestionSide(
      battleConfig.direction,
      requestedSide,
    );
    const promptText = side === "meaning" ? entry.source : entry.meaning;
    const directionLabel = side === "meaning" ? "해석 문제" : "영작 문제";

    if (!await requestConfirmation({
      title: `${directionLabel}로 낼까요?`,
      message: promptText,
      confirmLabel: "네, 문제 내기",
      cancelLabel: "다시 고르기",
      tone: "warning",
    })) {
      return;
    }

    setBusy(true);
    try {
      await issueBattleQuestion({
        roomId,
        roundId: session.roundId,
        generation: state.generation,
        itemId,
        side,
      });
    } catch (reason: unknown) {
      await showMessage({
        title: "문제를 내지 못했습니다",
        message: toErrorMessage(reason, "배틀 상태를 다시 확인해 주세요."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (): Promise<void> => {
    if (
      busy
      || state.role !== "defender"
      || state.phase !== "answering"
      || !answer.trim()
    ) {
      return;
    }

    setBusy(true);
    try {
      await submitBattleAnswer({
        roomId,
        roundId: session.roundId,
        generation: state.generation,
        submissionId: crypto.randomUUID(),
        answer: answer.trim(),
      });
    } catch (reason: unknown) {
      await showMessage({
        title: "답안을 채점하지 못했습니다",
        message: toErrorMessage(reason, "시간을 다시 받고 재시도할 수 있습니다."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const useInk = async (): Promise<void> => {
    if (!canUseInk) return;

    setBusy(true);
    try {
      const result = await persistentItems.runMutation(() => useBattleItem({
        roomId,
        roundId: session.roundId,
        generation: state.generation,
        operationId: crypto.randomUUID(),
        itemId: "ink",
      }));

      if (!result.consumed) {
        await showMessage({
          title: "먹물을 사용할 수 없습니다",
          message: "보유한 먹물 수량을 다시 확인해 주세요.",
          tone: "warning",
        });
      }
    } catch (reason: unknown) {
      await showMessage({
        title: "먹물을 사용하지 못했습니다",
        message: toErrorMessage(reason, "상대의 현재 턴을 다시 확인해 주세요."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const banner = state.phase === "choosing"
    ? state.role === "attacker"
      ? "나의 공격 차례입니다!"
      : "상대가 문제를 내고 있습니다…"
    : state.phase === "answering"
      ? state.role === "defender"
        ? "문제가 도착했습니다! 답을 입력하세요."
        : "상대가 문제를 풀고 있습니다…"
      : "AI가 채점 중입니다…";

  const directionHint = battleConfig.direction === "translation-only"
    ? "해석 문제만 · 어느 칸을 눌러도 영어 → 한글로 출제"
    : battleConfig.direction === "composition-only"
      ? "영작 문제만 · 어느 칸을 눌러도 한글 → 영어로 출제"
      : "영작·해석 모두 · 누른 칸에 따라 문제 방향 선택";

  return <div className={styles.shell}>
    <GameEffectLayer effect={effects.activeEffect} />

    <div className={styles.topbar}>
      <div>
        <span>MY RECORD</span>
        <strong>Kills {state.kills} · Deaths {state.deaths}</strong>
      </div>
      <Hearts count={state.hearts} />
      <div>
        <span>BATTLE TURNS</span>
        <strong>{state.questionNumber} / {state.turnLimit}</strong>
      </div>
    </div>

    <TimedGameStatus session={session} compact />

    {state.deadlineAtMs !== null && state.phase !== "grading"
      ? <DeadlineCountdownBar
          deadlineAtMs={state.deadlineAtMs}
          durationMs={durationMs}
          label={state.phase === "choosing" ? "문제 선택 시간" : "답변 시간"}
        />
      : null}

    <div className={styles.banner} data-role={state.role}>{banner}</div>

    <GameItemSlots
      ariaLabel="배틀 공용 아이템 슬롯"
      slots={[
        {
          id: "ink",
          shortcut: "1",
          label: "🦑 먹물",
          quantity: inkCount,
          disabled: !canUseInk,
          onUse: () => { void useInk(); },
        },
        {
          id: "bomb",
          shortcut: "2",
          label: "💣 폭탄",
          quantity: bombCount,
          disabled: true,
        },
        {
          id: "ice",
          shortcut: "3",
          label: "❄️ 얼음",
          quantity: iceCount,
          disabled: true,
        },
        {
          id: "slot-4",
          shortcut: "4",
          label: "준비 중",
          disabled: true,
        },
      ]}
    />

    <p className={styles.itemHint}>
      {canUseInk
        ? "먹물을 누르면 상대 화면을 5초 가립니다."
        : inkCount > 0
          ? "먹물은 상대가 문제를 고르거나 답하는 동안 사용할 수 있습니다."
          : "정답 보상에서 먹물을 획득할 수 있습니다."}
    </p>

    {state.rewardAvailable && state.phase === "answering"
      ? <div className={styles.treasure}>
          🎁 이번 문제를 맞히면 먹물 아이템을 획득합니다!
        </div>
      : null}

    {state.phase === "choosing"
      ? <Card className={styles.panel}>
          <div className={styles.panelHeading}>
            <h2>
              {state.role === "attacker"
                ? "표에서 문제로 낼 문장을 선택하세요"
                : "학습표를 보며 기다려 주세요"}
            </h2>
            {state.role === "attacker" ? <small>{directionHint}</small> : null}
          </div>
          <LearningSetTable
            entries={entries}
            usedItemIds={state.usedItemIds}
            disabled={state.role !== "attacker" || busy}
            compact
            onSelect={(itemId, side) => void select(itemId, side)}
          />
        </Card>
      : null}

    {state.phase === "answering"
      ? <Card className={styles.panel}>
          <p className={styles.answerGuide}>
            상대가 고른 문제의 답을 입력하세요. 제한시간 {battleConfig.answerSeconds}초
          </p>
          <div className={styles.prompt}>{state.prompt}</div>

          {state.role === "defender"
            ? <form
                className={styles.answerForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <input
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  autoFocus
                  maxLength={1000}
                  disabled={busy || countdown?.expired}
                  placeholder="정답을 입력하세요"
                />
                <Button
                  type="submit"
                  disabled={busy || !answer.trim() || countdown?.expired}
                >
                  {busy ? "제출 중…" : "답 제출"}
                </Button>
              </form>
            : <p>상대 학생이 답을 입력하고 있습니다.</p>}
        </Card>
      : null}

    {state.phase === "grading"
      ? <Card className={styles.grading}>
          <i className={styles.spinner} />
          <h2>AI가 채점 중입니다</h2>
          <p>두 학생 모두 판정이 끝날 때까지 잠시 기다려 주세요.</p>
        </Card>
      : null}

    {inkBlocked
      ? <div className={styles.inkOverlay} role="status" aria-live="assertive">
          <div>
            <span>🦑</span>
            <strong>먹물 공격!</strong>
            <p>5초 뒤 다시 보입니다.</p>
          </div>
        </div>
      : null}
  </div>;
}
