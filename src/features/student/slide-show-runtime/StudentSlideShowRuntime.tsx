import { useEffect, useRef } from "react";
import { GameEffectLayer } from "../../../game-engine/effects/GameEffectLayer.tsx";
import { createGameAnnouncement } from "../../../game-engine/effects/model.ts";
import { useGameEffectEngine } from "../../../game-engine/effects/useGameEffectEngine.ts";
import GameHost from "../../../games/GameHost.tsx";
import { getGame } from "../../../games/registry.ts";
import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import type { GameSession, Player } from "../../../multiplayer/types.ts";
import type { SlideShowSessionState } from "../../../slide-show/types.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import SlideViewport from "../../slide-show-runtime/SlideViewport.tsx";
import { useMyShowScore } from "../../slide-show-runtime/useMyShowScore.ts";
import { useShowRunSlides } from "../../slide-show-runtime/useShowRunSlides.ts";
import styles from "./StudentSlideShowRuntime.module.css";

/** Celebrates points the teacher hands out, using the same effect layer as the games. */
function useAwardEffects(awards: Readonly<Record<string, number>>, playerId: string) {
  const effects = useGameEffectEngine();
  const previous = useRef<number | null>(null);
  const total = awards[playerId] ?? 0;
  useEffect(() => {
    const before = previous.current;
    previous.current = total;
    if (before === null || before === total) return;
    const delta = total - before;
    effects.play(delta > 0
      ? createGameAnnouncement({ headline: "선생님 보너스!", metric: `+${delta}점`, durationMs: 1_800 })
      : createGameAnnouncement({ headline: "감점", metric: `${delta}점`, tone: "warning", durationMs: 1_800 }));
  }, [effects.play, total]);
  return effects.activeEffect;
}

export default function StudentSlideShowRuntime({ roomId, session, player, slideShow }: {
  readonly roomId: string;
  readonly session: GameSession;
  readonly player: Player;
  readonly slideShow: SlideShowSessionState;
}) {
  const { slides, loading, error } = useShowRunSlides(roomId, slideShow.runId);
  const score = useMyShowScore(roomId, player.id, slideShow);
  const awardEffect = useAwardEffects(slideShow.awards, player.id);
  const slide = slides.get(slideShow.slideIds[slideShow.currentSlideIndex] ?? "");
  const engine = slideShow.engine?.slideId === slide?.id ? slideShow.engine : null;

  const engineContent = !engine ? null
    : engine.phase === "answering"
      ? session.status === SESSION_STATUS.PLAYING && session.roundId === engine.roundId
        ? <GameHost role="student" roomId={roomId} session={session} player={player} />
        : null
      : <div className={styles.engineStatus}>
        <strong>{engine.phase === "submissions" ? "제출 마감!" : "결과 발표"}</strong>
        <span>{getGame(engine.round.gameId).title}</span>
      </div>;

  return <section className={styles.runtime}>
    <GameEffectLayer effect={awardEffect} />
    <header className={styles.hud}>
      <span className={styles.name}>{slideShow.name}</span>
      <strong className={styles.page}>{slideShow.currentSlideIndex + 1} / {slideShow.slideIds.length}</strong>
      <span className={styles.score}><b>{score.toLocaleString("ko-KR")}</b>점</span>
    </header>
    <div className={styles.body}>
      {error ? <StatusPanel title="슬라이드를 불러오지 못했어요" tone="error">{error.message}</StatusPanel>
        : loading || !slide ? <StatusPanel title="슬라이드를 불러오는 중" tone="waiting">잠시만 기다려 주세요.</StatusPanel>
        : <SlideViewport slide={slide} engineFrame={engine?.frame ?? null} engineContent={engineContent} />}
    </div>
  </section>;
}
