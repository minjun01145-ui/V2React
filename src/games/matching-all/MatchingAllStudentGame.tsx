import { useEffect } from "react";
import { GameEffectLayer } from "../../game-engine/effects/GameEffectLayer.tsx";
import { createScoreCelebration } from "../../game-engine/effects/model.ts";
import { useGameEffectEngine } from "../../game-engine/effects/useGameEffectEngine.ts";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { LearningCardButton } from "../../shared/ui/LearningCard.tsx";
import matchingStyles from "../matching/MatchingGame.module.css";
import styles from "./MatchingAllGame.module.css";
import { useMatchingAllGame } from "./useMatchingAllGame.ts";

export default function MatchingAllStudentGame({ roomId, session, player, set }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: LearningSet;
}) {
  const clock = useTimedGameClock(session);
  const game = useMatchingAllGame({ roomId, session, player, set, disabled: clock.expired });
  const effects = useGameEffectEngine();

  useEffect(() => {
    if (!game.lastOutcome) return;
    effects.play(createScoreCelebration({
      scoreDelta: game.lastOutcome.scoreDelta,
      combo: game.lastOutcome.combo,
      baseScore: game.baseScore,
    }));
  }, [effects.play, game.baseScore, game.lastOutcome]);

  if (game.loading) return <StatusPanel title="모든 카드 준비 중">짝이 모두 있는 카드를 준비하고 있습니다.</StatusPanel>;
  if (game.error) return <StatusPanel title="게임 연결 오류" tone="error">{game.error.message}</StatusPanel>;
  const matchedCount = game.matchedPairIds.length;

  return <main className={matchingStyles.gameShell}>
    <GameEffectLayer effect={effects.activeEffect} />
    <header className={matchingStyles.topbar}>
      <div><span>FULL PAIR MATCH</span><h1>짝맞추기 · 모든카드</h1></div>
      <div className={matchingStyles.topMetrics}><div className={matchingStyles.stats}>
        <div><small>완성한 판</small><strong>{game.progress.correctCount}</strong></div>
        <div><small>판 콤보</small><strong>{game.combo}</strong></div>
        <div><small>점수</small><strong>{game.progress.score}</strong></div>
      </div></div>
    </header>

    <section className={matchingStyles.progress} aria-label={`현재 판 ${matchedCount}/4쌍`}>
      <div style={{ width: `${matchedCount * 25}%` }} />
    </section>

    <section className={matchingStyles.instructions}>
      <strong>8장의 카드는 모두 짝이 있습니다.</strong>
      <span>4쌍을 전부 찾으면 판 점수 {game.baseScore}점과 콤보 보너스를 받습니다.</span>
    </section>

    <section className={matchingStyles.grid} aria-label="모두 짝이 있는 단어와 뜻 카드">
      {game.board.map((card) => {
        const matched = game.matchedPairIds.includes(card.pairId);
        if (matched) return <div className={styles.clearedSlot} key={card.id} aria-hidden="true" />;
        const selected = game.selectedCardId === card.id;
        return <LearningCardButton
          className={matchingStyles.matchCard}
          eyebrow={card.kind === "term" ? "WORD" : "뜻"}
          marker={card.kind === "term" ? "A" : "가"}
          tone={card.kind === "term" ? "indigo" : "mint"}
          selected={selected}
          exiting={game.removingCardIds.includes(card.id)}
          key={card.id}
          onClick={() => game.selectCard(card)}
          aria-pressed={selected}
        >
          {card.text}
        </LearningCardButton>;
      })}
    </section>

    <div className={matchingStyles.feedback} data-tone={game.feedbackTone} role="status" aria-live="polite">
      {game.feedback || "카드 두 장을 골라 첫 번째 짝을 찾아보세요."}
    </div>
  </main>;
}
