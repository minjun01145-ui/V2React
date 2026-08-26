import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { displayLabel } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { useMatchingGame } from "./useMatchingGame.ts";
import styles from "./MatchingGame.module.css";

export default function MatchingStudentGame({ roomId, session, player, set }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: LearningSet;
}) {
  const game = useMatchingGame({ roomId, session, player, set });
  if (game.loading) return <StatusPanel title="짝맞추기 준비 중">내 진행 상황을 연결하고 있습니다.</StatusPanel>;
  if (game.error) return <StatusPanel title="게임 연결 오류" tone="error">{game.error.message}</StatusPanel>;

  const progressPercent = game.pairCount === 0 ? 0 : Math.round((game.progress.correctCount / game.pairCount) * 100);
  if (game.isComplete) return <main className={styles.complete}>
    <div className={styles.completeBurst} aria-hidden="true">★</div>
    <span>MATCH COMPLETE</span>
    <h1>모든 짝을 찾았어요!</h1>
    <p>{displayLabel(player.displayName, player.nickname)}님, 단어 {game.pairCount}개를 모두 맞췄습니다.</p>
    <strong>{game.progress.score}점</strong>
  </main>;

  return <main className={styles.gameShell}>
    <header className={styles.topbar}>
      <div><span>PAIR MATCH</span><h1>짝맞추기</h1></div>
      <div className={styles.stats}>
        <div><small>찾은 짝</small><strong>{game.progress.correctCount}<i> / {game.pairCount}</i></strong></div>
        <div><small>점수</small><strong>{game.progress.score}</strong></div>
      </div>
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
        return <button
          type="button"
          className={styles.matchCard}
          data-kind={card.kind}
          data-selected={selected}
          data-removing={removing}
          key={card.id}
          onClick={() => game.selectCard(card)}
          aria-pressed={selected}
        >
          <span>{card.kind === "term" ? "WORD" : "뜻"}</span>
          <strong>{card.text}</strong>
          <i aria-hidden="true">{card.kind === "term" ? "A" : "가"}</i>
        </button>;
      })}
    </section>

    <div className={styles.feedback} data-tone={game.feedbackTone} role="status" aria-live="polite">
      {game.feedback || "카드 두 장을 골라 짝을 찾아보세요."}
    </div>
  </main>;
}
