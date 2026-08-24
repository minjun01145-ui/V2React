import Button from "../ui/Button.tsx";
import PopupFrame from "./PopupFrame.tsx";
import type { ConfirmPopupOptions } from "./types.ts";
import styles from "./PopupContent.module.css";

interface Props {
  readonly options: ConfirmPopupOptions;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export default function ConfirmPopup({ options, onConfirm, onCancel }: Props) {
  return (
    <PopupFrame options={options} onDismiss={onCancel}>
      <div className={styles.body}>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onCancel}>{options.cancelLabel ?? "취소"}</Button>
          <Button onClick={onConfirm} data-popup-autofocus>{options.confirmLabel ?? "확인"}</Button>
        </div>
      </div>
    </PopupFrame>
  );
}
