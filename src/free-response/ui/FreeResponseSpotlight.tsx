import { useEffect, useState, type ReactNode } from "react";
import { FREE_RESPONSE_AWARD_POINTS, type FreeResponseRow } from "../types.ts";
import styles from "./FreeResponseSpotlight.module.css";

const TEXT_SCALES = [0.75, 1, 1.25, 1.5, 2] as const;

/**
 * Projects submitted answers one at a time in large type over the whole screen. Rendered in place
 * (not through a portal) so it also shows while the presenter view is in browser fullscreen.
 */
export default function FreeResponseSpotlight({ rows, showNicknames, nicknameToggle, onAward, busyPlayerId, disabled, onClose }: {
  readonly rows: readonly FreeResponseRow[];
  readonly showNicknames: boolean;
  readonly nicknameToggle: ReactNode;
  readonly onAward: (playerId: string) => void;
  readonly busyPlayerId: string | null;
  readonly disabled: boolean;
  readonly onClose: () => void;
}) {
  const submitted = rows.filter((row) => row.response);
  const [index, setIndex] = useState(0);
  const [scaleIndex, setScaleIndex] = useState(1);
  const current = submitted[Math.min(index, submitted.length - 1)];
  const last = submitted.length - 1;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight" || event.key === "PageDown") setIndex((value) => Math.min(last, value + 1));
      else if (event.key === "ArrowLeft" || event.key === "PageUp") setIndex((value) => Math.max(0, value - 1));
      else return;
      // Keep the slide presenter from turning the page underneath.
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [last, onClose]);

  const awarded = current?.response?.score === FREE_RESPONSE_AWARD_POINTS;
  return <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="답안 크게 보기">
    <header className={styles.bar}>
      <strong>{submitted.length === 0 ? "제출된 답안 없음" : `${Math.min(index, last) + 1} / ${submitted.length}`}</strong>
      {nicknameToggle}
      <div className={styles.zoom}>
        <button type="button" aria-label="글씨 작게" onClick={() => setScaleIndex((value) => Math.max(0, value - 1))} disabled={scaleIndex === 0}>가−</button>
        <button type="button" aria-label="글씨 크게" onClick={() => setScaleIndex((value) => Math.min(TEXT_SCALES.length - 1, value + 1))} disabled={scaleIndex === TEXT_SCALES.length - 1}>가+</button>
      </div>
      <button type="button" className={styles.close} onClick={onClose}>닫기</button>
    </header>
    {current ? <main className={styles.stage}>
      {showNicknames && current.nickname ? <p className={styles.name}>{current.nickname}</p> : null}
      <p className={styles.answer} style={{ fontSize: `calc(clamp(1.75rem, 4vw, 3.5rem) * ${TEXT_SCALES[scaleIndex]})` }}>{current.response!.answer}</p>
    </main> : <main className={styles.stage} />}
    <footer className={styles.bar}>
      <button type="button" className={styles.nav} aria-label="이전 답안" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index <= 0}>◀</button>
      {current ? <button type="button" className={styles.award} data-awarded={awarded} onClick={() => onAward(current.playerId)} disabled={disabled || busyPlayerId !== null || awarded}>
        {busyPlayerId === current.playerId ? "점수 저장 중…" : awarded ? "100점 부여 완료" : "+100점 부여"}
      </button> : null}
      <button type="button" className={styles.nav} aria-label="다음 답안" onClick={() => setIndex((value) => Math.min(last, value + 1))} disabled={index >= last}>▶</button>
    </footer>
  </div>;
}
