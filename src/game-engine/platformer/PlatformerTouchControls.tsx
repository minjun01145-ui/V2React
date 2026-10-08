import type { PointerEvent } from "react";
import type { PlatformerInput } from "./movement.ts";
import type { PlatformerKeyActions } from "./usePlatformerKeyboard.ts";
import styles from "./PlatformerTouchControls.module.css";

const ACTIONS = [
  { action: "left", label: "왼쪽", text: "◀" },
  { action: "right", label: "오른쪽", text: "▶" },
  { action: "punch", label: "펀치", text: "✊" },
  { action: "drop", label: "내려가기", text: "▼" },
  { action: "jump", label: "점프", text: "점프" },
] as const;
type TouchAction = (typeof ACTIONS)[number]["action"];

/** On-screen buttons for touch devices; hidden where a mouse and keyboard are available. */
export default function PlatformerTouchControls({ input, actions, label, onPress }: {
  readonly input: PlatformerInput;
  readonly actions: PlatformerKeyActions;
  readonly label: string;
  /** Called on every press, e.g. to keep keyboard focus on the stage. */
  readonly onPress?: () => void;
}) {
  const press = (event: PointerEvent<HTMLButtonElement>, action: TouchAction): void => {
    event.preventDefault();
    onPress?.();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (action === "punch") actions.punch();
    else if (action === "drop") actions.drop?.();
    else if (action === "jump") input.jumpQueued = true;
    else input.held.set(`pointer-${event.pointerId}`, action);
  };
  const release = (event: PointerEvent<HTMLButtonElement>): void => {
    input.held.delete(`pointer-${event.pointerId}`);
  };
  return <div className={styles.touchControls} aria-label={label}>
    {ACTIONS.filter(({ action }) => action !== "drop" || actions.drop).map(({ action, label: actionLabel, text }) => <button
      type="button"
      key={action}
      aria-label={actionLabel}
      className={action === "left" || action === "right" ? undefined : styles.touchPrimary}
      onPointerDown={(event) => press(event, action)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >{text}</button>)}
  </div>;
}
