import GameHost from "../../../games/GameHost.tsx";
import { getGame } from "../../../games/registry.ts";
import type { GameSession, Player } from "../../../multiplayer/types.ts";
import type { QuizGameSessionState } from "../../../quiz-game/types.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import Card from "../../../shared/ui/Card.tsx";
import styles from "./StudentQuizGameRuntime.module.css";

export default function StudentQuizGameRuntime({ roomId, session, player, quizGame }: {
  readonly roomId: string;
  readonly session: GameSession;
  readonly player: Player;
  readonly quizGame: QuizGameSessionState;
}) {
  const quiz = quizGame;
  const round = quiz.plan.rounds[quiz.currentRoundIndex];
  if (!round) return <StatusPanel title="퀴즈 상태 오류" tone="error">현재 문제 정보를 찾을 수 없습니다.</StatusPanel>;

  const presenter = getGame(round.gameId).presentQuizQuestion;
  return <section className={styles.runtime}>
    <header><span>{quiz.plan.name}</span><strong>{quiz.currentRoundIndex + 1} / {quiz.plan.rounds.length}</strong><small>{round.title} · {getGame(round.gameId).title}</small></header>
    {quiz.phase === "answering" ? <GameHost role="student" roomId={roomId} session={session} player={player} /> : null}
    {quiz.phase === "submissions" ? <><StatusPanel title="답안 제출이 끝났어요">친구들의 제출 상태를 확인하고 있습니다.</StatusPanel>{round.source.kind === "custom" && presenter ? <Card><h2>정답 확인</h2><div className={styles.answers}>{round.source.items.map((item, index) => { const question = presenter(item, round.gameConfig); return <div key={item.id}><b>{index + 1}</b><span>{question.prompt}</span><strong>{question.answer}</strong></div>; })}</div></Card> : null}</> : null}
    {quiz.phase === "leaderboard" ? <StatusPanel title="현재 순위 확인 중">칠판의 리더보드를 확인해 주세요. 다음 문제가 곧 시작됩니다.</StatusPanel> : null}
    {quiz.phase === "complete" ? <StatusPanel title="퀴즈가 끝났어요">수고했어요! 칠판에서 최종 순위를 확인해 주세요.</StatusPanel> : null}
  </section>;
}
