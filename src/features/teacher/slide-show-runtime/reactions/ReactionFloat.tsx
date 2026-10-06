import { useEffect, useRef, useState } from "react";
import type { Player } from "../../../../multiplayer/types.ts";
import { SLIDE_REACTIONS, type SlideReaction } from "../../../../slide-reactions/model.ts";
import { subscribeSlideReactions } from "../../../../slide-reactions/repository.ts";
import styles from "./ReactionFloat.module.css";

const BUBBLE_LIFETIME_MS = 2_600;

interface Bubble {
  readonly id: number;
  readonly emoji: string;
  /** Horizontal start, as a percentage of the slide width. */
  readonly left: number;
}

/**
 * Students' emoji reactions rising from random spots along the bottom of the teacher's slide.
 * It overlays the slide without taking space and never catches clicks. Only reactions from
 * this room's players are shown.
 */
export default function ReactionFloat({ roomId, players }: { readonly roomId: string; readonly players: readonly Player[] }) {
  const [bubbles, setBubbles] = useState<readonly Bubble[]>([]);
  const [error, setError] = useState(false);
  const nextId = useRef(0);
  const playerIds = useRef(new Set<string>());
  playerIds.current = new Set(players.map((player) => player.id));

  useEffect(() => {
    const timers = new Set<number>();
    const show = ({ playerId, reaction }: SlideReaction): void => {
      if (!playerIds.current.has(playerId)) return;
      const bubble = { id: nextId.current += 1, emoji: SLIDE_REACTIONS[reaction]!.emoji, left: 6 + Math.random() * 88 };
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

  return <div className={styles.layer} aria-hidden={!error}>
    {bubbles.map((bubble) => <span className={styles.bubble} key={bubble.id} style={{ left: `${bubble.left}%` }}>{bubble.emoji}</span>)}
    {error ? <p className={styles.error} role="alert">학생 반응을 받지 못하고 있습니다</p> : null}
  </div>;
}
