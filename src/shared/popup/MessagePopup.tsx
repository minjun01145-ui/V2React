import Button from "../ui/Button.tsx";
import PopupFrame from "./PopupFrame.tsx";
import type { MessagePopupOptions } from "./types.ts";
import styles from "./PopupContent.module.css";

export default function MessagePopup({ options, onClose }: { readonly options: MessagePopupOptions; readonly onClose: () => void }) {
  return (
    <PopupFrame options={options} onDismiss={onClose}>
      <div className={styles.body}>
        <div className={styles.actions}><Button onClick={onClose} data-popup-autofocus>{options.confirmLabel ?? "확인"}</Button></div>
      </div>
    </PopupFrame>
  );
}
