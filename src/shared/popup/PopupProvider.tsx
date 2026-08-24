import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import PopupHost, { type QueuedPopup } from "./PopupHost.tsx";
import type { ConfirmPopupOptions, InputPopupOptions, MessagePopupOptions, PopupController, PopupInputValues } from "./types.ts";

const PopupContext = createContext<PopupController | null>(null);

export function PopupProvider({ children }: { readonly children: ReactNode }) {
  const nextId = useRef(1);
  const [queue, setQueue] = useState<readonly QueuedPopup[]>([]);

  const showMessage = useCallback((options: MessagePopupOptions): Promise<void> => new Promise((resolve) => {
    const id = nextId.current++;
    setQueue((current) => [...current, { id, kind: "message", options, resolve }]);
  }), []);

  const requestConfirmation = useCallback((options: ConfirmPopupOptions): Promise<boolean> => new Promise((resolve) => {
    const id = nextId.current++;
    setQueue((current) => [...current, { id, kind: "confirm", options, resolve }]);
  }), []);

  const requestInput = useCallback((options: InputPopupOptions): Promise<PopupInputValues | null> => new Promise((resolve) => {
    const id = nextId.current++;
    setQueue((current) => [...current, { id, kind: "input", options, resolve }]);
  }), []);

  const onComplete = useCallback((id: number): void => {
    setQueue((current) => current.filter((popup) => popup.id !== id));
  }, []);

  const controller = useMemo<PopupController>(() => ({ showMessage, requestConfirmation, requestInput }), [requestConfirmation, requestInput, showMessage]);
  return <PopupContext.Provider value={controller}>{children}<PopupHost popup={queue[0] ?? null} onComplete={onComplete} /></PopupContext.Provider>;
}

export function usePopup(): PopupController {
  const controller = useContext(PopupContext);
  if (!controller) throw new Error("usePopup() must be used inside PopupProvider.");
  return controller;
}
