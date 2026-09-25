import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import SentenceBuilderPlay from "./SentenceBuilderPlay.tsx";
import { useSentenceBuilderGame } from "./useSentenceBuilderGame.ts";

export default function StudentSentenceBuilder({ roomId, session, player, set, disabled = false, embedded = false, advanceRequestId = 0, onQuestionComplete, onAdvanced }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: unknown;
  readonly disabled?: boolean;
  readonly embedded?: boolean;
  readonly advanceRequestId?: number;
  readonly onQuestionComplete?: (completionId: string) => void;
  readonly onAdvanced?: () => void;
}) {
  const clock = useTimedGameClock(session);
  const engine = useSentenceBuilderGame({ roomId, session, player, set, disabled: disabled || (!embedded && clock.expired) });
  return <SentenceBuilderPlay
    engine={engine}
    roundId={session.roundId}
    playerId={player.id}
    disabled={disabled}
    embedded={embedded}
    advanceRequestId={advanceRequestId}
    {...(onQuestionComplete ? { onQuestionComplete } : {})}
    {...(onAdvanced ? { onAdvanced } : {})}
    clockExpired={clock.expired}
    remainingMs={clock.remainingMs}
  />;
}
