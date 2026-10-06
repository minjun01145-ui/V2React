import { useEffect, useRef, useState } from "react";
import { SLIDE_REACTION_COOLDOWN_MS, SLIDE_REACTIONS } from "../../../slide-reactions/model.ts";
import { sendSlideReaction } from "../../../slide-reactions/repository.ts";
import styles from "./ReactionBar.module.css";

/** Emoji buttons under the student's slide; each tap floats that emoji over the student on the teacher screen. */
export default function ReactionBar({ roomId, playerId }: { readonly roomId: string; readonly playerId: string }) {
  const [cooling, setCooling] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const react = (reaction: number): void => {
    if (cooling) return;
    setCooling(true);
    setSent(reaction);
    timer.current = window.setTimeout(() => { setCooling(false); setSent(null); }, SLIDE_REACTION_COOLDOWN_MS);
    void sendSlideReaction(roomId, playerId, reaction)
      .then(() => setError(false))
      .catch((cause: unknown) => { console.error(cause); setError(true); });
  };

  return <div className={styles.bar} role="group" aria-label="반응하기">
    {SLIDE_REACTIONS.map((item, index) => <button type="button" className={styles.reaction} key={item.label} aria-label={item.label} data-sent={sent === index} disabled={cooling} onClick={() => react(index)}>{item.emoji}</button>)}
    {error ? <p className={styles.error} role="alert">반응을 보내지 못했어요</p> : null}
  </div>;
}
