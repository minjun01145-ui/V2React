
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { GameEffectLayer } from "../../game-engine/effects/GameEffectLayer.tsx";
import { createGameAnnouncement } from "../../game-engine/effects/model.ts";
import { useGameEffectEngine } from "../../game-engine/effects/useGameEffectEngine.ts";
import { sharedItemQuantity } from "../../items/inventory.ts";
import { getLearningSet } from "../../learning-sets/readRepository.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import { publishTypingLiveMetric } from "../../multiplayer/live-metrics/repository.ts";
import type { TypingLiveMetricValues } from "../../multiplayer/live-metrics/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { grantAcidRainReward } from "../../student-data/items/acidRainRewards.ts";
import { useStudentItemInventory } from "../../student-data/items/useStudentItemInventory.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Button from "../../shared/ui/Button.tsx";
import GameItemSlots from "../../shared/ui/GameItemSlots.tsx";
import { adaptLearningSetToTypingPractice } from "./typingPracticeAdapter.ts";
import { ACID_RAIN_ITEM_KIND, type AcidRainItemKind } from "./acidRainEngine.ts";
import {
  ACID_RAIN_SHARED_ITEM_EFFECTS,
  type AcidRainItemStore,
} from "./acidRainSharedItems.ts";
import { typingDemoSet } from "./demoSet.ts";
import { getTypingComparisonState } from "./typingEngine.ts";
import { useTypingPracticeGame } from "./useTypingPracticeGame.ts";
import type { WaitingTypingConfig } from "./waitingTypingConfig.ts";
import styles from "./TypingPractice.module.css";

interface Props {
  readonly config: WaitingTypingConfig;
  readonly onExit: () => void;
}

export interface TypingPracticeLiveContext {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
}

interface TypingPracticeBoardProps {
  readonly set: RuntimeLearningSet;
  readonly config: WaitingTypingConfig;
  readonly onExit?: () => void;
  readonly liveContext?: TypingPracticeLiveContext;
}

export default function TypingPracticeGame({ config, onExit }: Props) {
  const [set, setSet] = useState<RuntimeLearningSet | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (config.setId === typingDemoSet.id) {
      setSet(typingDemoSet);
      setError("");
      return () => { active = false; };
    }

    setSet(null);
    setError("");
    void getLearningSet(config.setId, `waiting-typing:${config.setId}`)
      .then((value) => { if (active) setSet(value); })
      .catch((value: unknown) => {
        if (!active) return;
        console.error(value);
        setSet(typingDemoSet);
        setError("");
      });

    return () => { active = false; };
  }, [config.setId]);

  if (error) {
    return <>
      <StatusPanel title="타자 연습 오류" tone="error">{error}</StatusPanel>
      <Button onClick={onExit}>대기실로 돌아가기</Button>
    </>;
  }
  if (!set) {
    return <StatusPanel title="타자 연습 준비 중">
      선생님이 선택한 세트를 불러오고 있어요.
    </StatusPanel>;
  }

  return <TypingPracticeBoard set={set} config={config} onExit={onExit} />;
}

export function TypingPracticeBoard({
  set,
  config,
  onExit,
  liveContext,
}: TypingPracticeBoardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRefs = useRef(new Map<string, HTMLDivElement>());
  const questionSet = adaptLearningSetToTypingPractice(set);
  const persistentItems = useStudentItemInventory();

  const itemStore = useMemo<AcidRainItemStore | undefined>(() => {
    if (!persistentItems.available) return undefined;
    return {
      inventory: {
        bomb: sharedItemQuantity(persistentItems.inventory, "bomb"),
        ice: sharedItemQuantity(persistentItems.inventory, "ice"),
      },
      grant: async (itemId) => {
        try {
          await persistentItems.runMutation(() => grantAcidRainReward(itemId));
          return true;
        } catch (error) {
          console.error("산성비 아이템 획득 저장 실패", error);
          return false;
        }
      },
      consume: async (itemId) => {
        try {
          return await persistentItems.consumeItem(itemId);
        } catch (error) {
          console.error("산성비 아이템 사용 저장 실패", error);
          return false;
        }
      },
    };
  }, [
    persistentItems.available,
    persistentItems.consumeItem,
    persistentItems.inventory,
    persistentItems.runMutation,
  ]);

  const game = useTypingPracticeGame(questionSet, config, itemStore);
  const effects = useGameEffectEngine();
  const overlayOpen = game.status !== "playing";
  const liveMetricValues = useRef<TypingLiveMetricValues>({
    ...game.speed,
    currentStage: game.stage,
  });
  const iceEffect = ACID_RAIN_SHARED_ITEM_EFFECTS.ice;

  useEffect(() => {
    liveMetricValues.current = { ...game.speed, currentStage: game.stage };
  }, [game.speed, game.stage]);

  useEffect(() => {
    if (persistentItems.error) {
      console.error("학생 공용 아이템 인벤토리 동기화 실패", persistentItems.error);
    }
  }, [persistentItems.error]);

  useEffect(() => {
    if (!liveContext) return undefined;

    let active = true;
    let publishing = false;
    let pending: TypingLiveMetricValues | null = null;

    const publish = (): void => {
      pending = liveMetricValues.current;
      if (publishing) return;
      publishing = true;

      const drain = async (): Promise<void> => {
        while (active && pending) {
          const values = pending;
          pending = null;
          try {
            await publishTypingLiveMetric({
              roomId: liveContext.roomId,
              roundId: liveContext.session.roundId,
              gameId: liveContext.session.gameId,
              player: liveContext.player,
              values,
            });
          } catch (error) {
            console.error("산성비 진행 상황 동기화 실패", error);
          }
        }
        publishing = false;
      };

      void drain();
    };

    publish();
    const intervalId = window.setInterval(publish, 1_000);
    return () => {
      active = false;
      pending = null;
      window.clearInterval(intervalId);
    };
  }, [liveContext]);

  useEffect(() => {
    if (!overlayOpen) inputRef.current?.focus();
  }, [game.stage, overlayOpen]);

  useEffect(() => {
    if (game.status !== "stage-clear") return;
    const timer = window.setTimeout(game.nextStage, 1_500);
    return () => window.clearTimeout(timer);
  }, [game.nextStage, game.status]);

  useEffect(() => {
    const playbackRate = game.itemUsePending
      ? 0
      : game.iceActive
        ? iceEffect.playbackRate
        : 1;

    for (const element of dropRefs.current.values()) {
      for (const animation of element.getAnimations()) {
        animation.updatePlaybackRate(playbackRate);
      }
    }
  }, [game.iceActive, game.itemUsePending, game.words, iceEffect.playbackRate]);

  useEffect(() => {
    const event = game.lastEvent;
    if (!event) return;

    if (event.kind === "bomb-collected") {
      effects.play(createGameAnnouncement({
        headline: "폭탄 아이템 획득!",
        metric: "1번 슬롯",
        detail: "화면의 모든 카드를 없앨 수 있어요.",
      }));
    } else if (event.kind === "heart-collected") {
      effects.play(createGameAnnouncement({
        headline: "목숨 +1!",
        metric: "❤️",
        detail: "남은 기회가 하나 늘었습니다.",
      }));
    } else if (event.kind === "ice-collected") {
      effects.play(createGameAnnouncement({
        headline: "얼음 아이템 획득!",
        metric: "2번 슬롯",
        detail: `${iceEffect.durationMs / 1000}초 동안 낙하속도를 절반으로 줄여요.`,
      }));
    } else if (event.kind === "candy-collected") {
      effects.play(createGameAnnouncement({
        headline: "캔디 발견!",
        metric: "🍬",
        detail: "선생님께 얘기해서 사탕 하나 받으세요!",
      }));
    } else if (event.kind === "bomb-used") {
      effects.play(createGameAnnouncement({
        headline: "폭탄 발동!",
        metric: `${event.clearedCount}개 카드 정리`,
        tone: "warning",
      }));
    } else if (event.kind === "ice-used") {
      effects.play(createGameAnnouncement({
        headline: "얼음 발동!",
        metric: `${iceEffect.durationMs / 1000}초 감속`,
        detail: "낙하속도가 절반으로 줄었습니다.",
      }));
    } else {
      effects.play(createGameAnnouncement({
        headline: `${event.slot}번 슬롯이 비어 있어요`,
        metric: "아이템을 먼저 획득하세요",
      }));
    }
  }, [effects.play, game.lastEvent, iceEffect.durationMs]);

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    const slot = game.input.trim() === "1"
      ? 1
      : game.input.trim() === "2"
        ? 2
        : null;
    if (!slot) return;
    event.preventDefault();
    void game.useItem(slot);
  };

  return <main className={styles.game} onClick={() => inputRef.current?.focus()}>
    <GameEffectLayer effect={effects.activeEffect} />

    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>
          {liveContext ? "LIVE ACID RAIN" : "WAITING TYPING"}
        </span>
        <h1>{set.name}</h1>
      </div>
      {onExit
        ? <Button
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              onExit();
            }}
          >
            대기실로
          </Button>
        : null}
    </header>

    <section className={styles.dashboard} aria-label="게임 현황">
      <div>
        <small>스테이지</small>
        <strong>{game.stage}<span>/10</span></strong>
      </div>
      <div>
        <small>남은 기회</small>
        <strong aria-label={`${game.lives}개`}>
          {"♥".repeat(game.lives)}
          <span>{"♡".repeat(Math.max(0, 3 - game.lives))}</span>
        </strong>
      </div>
    </section>

    <div className={styles.playArea}>
      <aside className={styles.speedPanel} aria-label="타자속도">
        <div>
          <small>현재 타수</small>
          <strong>{game.speed.currentCpm}</strong>
          <span>타/분</span>
        </div>
        <div>
          <small>평균 타수</small>
          <strong>{game.speed.averageCpm}</strong>
          <span>타/분</span>
        </div>
        {game.iceActive ? <p>❄️ 감속 중</p> : null}
      </aside>

      <section className={styles.sky} aria-label="떨어지는 영어 청크">
        <div className={styles.clouds} aria-hidden="true" />
        {game.words.map((word) => {
          const comparison = getTypingComparisonState(word.question.targetText, game.input, {
            ignoreCase: config.ignoreCase,
            ignorePunctuation: config.ignorePunctuation,
          });
          const prefixLength =
            word.id === game.activeWordId && comparison.matchedUnitCount > 0
              ? comparison.currentPrefixLength
              : 0;

          return <div
            className={styles.drop}
            key={word.id}
            ref={(element) => {
              if (element) dropRefs.current.set(word.id, element);
              else dropRefs.current.delete(word.id);
            }}
            data-lane={word.lane}
            data-item={word.itemKind ?? undefined}
            onAnimationEnd={() => game.missWord(word.id)}
            style={{ "--drop-duration": `${word.durationMs}ms` } as CSSProperties}
          >
            <span>
              {itemEmoji(word.itemKind)}
              <b>{word.question.targetText.slice(0, prefixLength)}</b>
              {word.question.targetText.slice(prefixLength)}
            </span>
          </div>;
        })}

        {game.clearedWords.map((word) => <div
          className={styles.hitEffect}
          key={word.id}
          data-lane={word.lane}
          onAnimationEnd={() => game.removeClearEffect(word.id)}
          style={{ top: `${Math.max(3, word.progress * 82)}%` }}
        >
          <span>{itemEmoji(word.itemKind)}{word.label}<i>✓</i></span>
        </div>)}

        <div className={styles.ground}>
          <span>목표 {game.hits} / {game.rule.targetHits}</span>
          <div>
            <i style={{ width: `${Math.min(100, (game.hits / game.rule.targetHits) * 100)}%` }} />
          </div>
        </div>
      </section>
    </div>

    <label className={styles.inputArea}>
      <span>떨어지는 영어를 입력하세요</span>
      <input
        ref={inputRef}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={game.input}
        onChange={(event) => game.updateInput(event.target.value)}
        onKeyDown={onInputKeyDown}
        disabled={overlayOpen || game.itemUsePending}
        placeholder="여기에 타자 입력"
      />
      <small>대소문자와 특수문자는 생략 가능 · 1 또는 2를 입력하고 Enter를 누르면 아이템 사용</small>
    </label>

    <GameItemSlots
      slots={[
        {
          id: "bomb",
          shortcut: "1",
          label: "💣 폭탄",
          quantity: game.inventory.bomb,
          disabled: game.inventory.bomb === 0 || overlayOpen || game.itemUsePending,
          onUse: () => { void game.useItem(1); },
        },
        {
          id: "ice",
          shortcut: "2",
          label: "❄️ 얼음",
          quantity: game.inventory.ice,
          disabled: game.inventory.ice === 0 || overlayOpen || game.itemUsePending,
          onUse: () => { void game.useItem(2); },
        },
        { id: "slot-3", shortcut: "3", label: "준비 중", disabled: true },
        { id: "slot-4", shortcut: "4", label: "준비 중", disabled: true },
      ]}
    />

    {overlayOpen
      ? <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.resultCard}>
            <span>
              {game.status === "stage-clear"
                ? "STAGE CLEAR"
                : game.status === "complete"
                  ? "ALL CLEAR"
                  : "TRY AGAIN"}
            </span>
            <h2>
              {game.status === "stage-clear"
                ? `스테이지 ${game.stage} 성공!`
                : game.status === "complete"
                  ? "10단계를 모두 깼어요!"
                  : "산성비가 바닥에 닿았어요"}
            </h2>
            <p>평균 {game.speed.averageCpm}타 · 최고 {game.speed.bestCpm}타</p>
            <div>
              {game.status === "stage-clear"
                ? <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      game.nextStage();
                    }}
                  >
                    바로 스테이지 {game.stage + 1}
                  </Button>
                : <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      game.restart();
                    }}
                  >
                    1단계부터 다시
                  </Button>}
              {onExit
                ? <Button
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      onExit();
                    }}
                  >
                    대기실로
                  </Button>
                : null}
            </div>
          </div>
        </div>
      : null}
  </main>;
}

function itemEmoji(itemKind: AcidRainItemKind | null): string {
  if (itemKind === ACID_RAIN_ITEM_KIND.BOMB) return "💣 ";
  if (itemKind === ACID_RAIN_ITEM_KIND.HEART) return "❤️ ";
  if (itemKind === ACID_RAIN_ITEM_KIND.ICE) return "❄️ ";
  if (itemKind === ACID_RAIN_ITEM_KIND.CANDY) return "🍬 ";
  return "";
}
