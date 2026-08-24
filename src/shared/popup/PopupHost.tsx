import { createPortal } from "react-dom";
import ConfirmPopup from "./ConfirmPopup.tsx";
import InputPopup from "./InputPopup.tsx";
import MessagePopup from "./MessagePopup.tsx";
import type { ConfirmPopupOptions, InputPopupOptions, MessagePopupOptions, PopupInputValues } from "./types.ts";

export type QueuedPopup =
  | { readonly id: number; readonly kind: "message"; readonly options: MessagePopupOptions; readonly resolve: () => void }
  | { readonly id: number; readonly kind: "confirm"; readonly options: ConfirmPopupOptions; readonly resolve: (confirmed: boolean) => void }
  | { readonly id: number; readonly kind: "input"; readonly options: InputPopupOptions; readonly resolve: (values: PopupInputValues | null) => void };

export default function PopupHost({ popup, onComplete }: { readonly popup: QueuedPopup | null; readonly onComplete: (id: number) => void }) {
  if (!popup || typeof document === "undefined") return null;
  const content = popup.kind === "message"
    ? <MessagePopup key={popup.id} options={popup.options} onClose={() => { popup.resolve(); onComplete(popup.id); }} />
    : popup.kind === "confirm"
      ? <ConfirmPopup key={popup.id} options={popup.options} onConfirm={() => { popup.resolve(true); onComplete(popup.id); }} onCancel={() => { popup.resolve(false); onComplete(popup.id); }} />
      : <InputPopup key={popup.id} options={popup.options} onResolve={(values) => { popup.resolve(values); onComplete(popup.id); }} onCancel={() => { popup.resolve(null); onComplete(popup.id); }} />;
  return createPortal(content, document.body);
}
