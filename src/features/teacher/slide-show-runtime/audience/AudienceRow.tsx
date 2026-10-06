import { useEffect, useRef, useState } from "react";
import type { Player } from "../../../../multiplayer/types.ts";
import { SLIDE_REACTIONS, type SlideReaction } from "../../../../slide-reactions/model.ts";
import { subscribeSlideReactions } from "../../../../slide-reactions/repository.ts";
import Avatar from "../../../../shared/ui/Avatar.tsx";
import styles from "./AudienceRow.module.css";

const BUBBLE_LIFETIME_MS = 2_400;

interface Bubble {
  readonly id: number;
  readonly playerId: string;
  readonly emoji: string;
}

/**
 * The class as an audience under the teacher's slide: every student's character, with the emoji
 * reactions they send floating up from them. Names are deliberately not shown.
 */
export default function AudienceRow({ roomId, players }: { readonly roomId: string; readonly players: readonly Player[] }) {
  const [bubbles, setBubbles] = useState<readonly Bubble[]>([]);
  const [error, setError] = useState(false);
  const nextId = useRef(0);

  useEffect(() => {
    const timers = new Set<number>();
    const show = ({ playerId, reaction }: SlideReaction): void => {
      const bubble = { id: nextId.current += 1, playerId, emoji: SLIDE_REACTIONS[reaction]!.emoji };
      setBubbles((list) => [...list, bubble]);
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setBubbles((list) => list.filter((item) => item.id !== bubble.id));
      }, BUBBLE_LIFETIME_MS);
      timers.add(timer);
    };
    const unsubscribe = subscribeSlideReactions(roomId, (reaction) => { setError(false); show(reaction); }, (cause) => {
      console.error(cause);
      setError(true);
    });
    return () => {
      unsubscribe();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [roomId]);

  if (players.length === 0) return null;
  return <div className={styles.row} aria-label="학생 캐릭터">
    {error ? <p className={styles.error} role="alert">학생 반응을 받지 못하고 있습니다</p> : null}
    {players.map((player, index) => <div className={styles.seat} key={player.id} style={{ animationDelay: `${(index % 7) * -0.37}s` }}>
      <Avatar avatar={player.avatar} label="학생 캐릭터" className={styles.avatar ?? ""} />
      {bubbles.filter((bubble) => bubble.playerId === player.id).map((bubble) => <span className={styles.bubble} key={bubble.id} aria-hidden="true">{bubble.emoji}</span>)}
    </div>)}
  </div>;
}
