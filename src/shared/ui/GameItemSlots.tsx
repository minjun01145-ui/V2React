
import styles from "./GameItemSlots.module.css";

export interface GameItemSlotView {
  readonly id: string;
  readonly shortcut: string;
  readonly label: string;
  readonly quantity?: number;
  readonly disabled?: boolean;
  readonly onUse?: () => void;
}

export default function GameItemSlots({
  slots,
  ariaLabel = "아이템 슬롯",
}: {
  readonly slots: readonly GameItemSlotView[];
  readonly ariaLabel?: string;
}) {
  return <section className={styles.slots} aria-label={ariaLabel}>
    {slots.map((slot) => <button
      key={slot.id}
      type="button"
      disabled={slot.disabled === true || !slot.onUse}
      onClick={(event) => {
        event.stopPropagation();
        slot.onUse?.();
      }}
    >
      <kbd>{slot.shortcut}</kbd>
      <span>{slot.label}</span>
      {typeof slot.quantity === "number" ? <b>{slot.quantity}</b> : null}
    </button>)}
  </section>;
}
