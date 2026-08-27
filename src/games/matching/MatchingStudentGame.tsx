import { useEffect } from "react";
import { GameEffectLayer } from "../../game-engine/effects/GameEffectLayer.tsx";
import { createScoreCelebration } from "../../game-engine/effects/model.ts";
import { useGameEffectEngine } from "../../game-engine/effects/useGameEffectEngine.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { LearningCardButton } from "../../shared/ui/LearningCard.tsx";
import { useMatchingGame } from "./useMatchingGame.ts";
import styles from "./MatchingGame.module.css";

export default function MatchingStudentGame({ roomId, session, player, set }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: LearningSet;
}) {
  const clock = useTimedGameClock(session);
  const game = useMatchingGame({ roomId, session, player, set, disabled: clock.expired });
  const effects = useGameEffectEngine();

  useEffect(() => {
    if (!game.lastOutcome?.isCorrect) return;
    effects.play(createScoreCelebration({
      scoreDelta: game.lastOutcome.scoreDelta,
      combo: game.lastOutcome.combo,
    }));
  }, [effects.play, game.lastOutcome]);

  if (game.loading) return <StatusPanel title="짝맞추기 준비 중">내 진행 상황을 연결하고 있습니다.</StatusPanel>;
  if (game.error) return <StatusPanel title="게임 연결 오류" tone="error">{game.error.message}</StatusPanel>;

  const progressPercent = game.pairCount === 0 ? 0 : Math.round((game.progress.completedQuestionIds.length / game.pairCount) * 100);

  return <main className={styles.gameShell}>
    <GameEffectLayer effect={effects.activeEffect} />
    <header className={styles.topbar}>
      <div><span>PAIR MATCH</span><h1>짝맞추기</h1></div>
      <div className={styles.topMetrics}><div className={styles.stats}>
        <div><small>찾은 짝</small><strong>{game.progress.correctCount}</strong></div>
        <div><small>콤보</small><strong>{game.combo}</strong></div>
        <div><small>점수</small><strong>{game.progress.score}</strong></div>
      </div></div>
    </header>

    <section className={styles.progress} aria-label={`진행률 ${progressPercent}%`}>
      <div style={{ width: `${progressPercent}%` }} />
    </section>

    <section className={styles.instructions}>
      <strong>단어와 알맞은 뜻을 차례로 눌러주세요.</strong>
      <span>화면 속 진짜 짝은 1~2개! 같은 종류의 카드를 누르면 선택이 바뀝니다.</span>
    </section>

    <section className={styles.grid} aria-label="단어와 뜻 카드">
      {game.board.map((card) => {
        const selected = game.selectedCardId === card.id;
        const removing = game.removingCardIds.includes(card.id);
        return <LearningCardButton
          className={styles.matchCard}
          eyebrow={card.kind === "term" ? "WORD" : "뜻"}
          marker={card.kind === "term" ? "A" : "가"}
          tone={card.kind === "term" ? "indigo" : "mint"}
          selected={selected}
          exiting={removing}
          key={card.id}
          onClick={() => game.selectCard(card)}
          aria-pressed={selected}
        >
          {card.text}
        </LearningCardButton>;
      })}
    </section>

    <div className={styles.feedback} data-tone={game.feedbackTone} role="status" aria-live="polite">
      {game.feedback || "카드 두 장을 골라 짝을 찾아보세요."}
    </div>
  </main>;
}
