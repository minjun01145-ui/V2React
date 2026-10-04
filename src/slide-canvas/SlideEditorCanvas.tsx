import { useEffect, useRef } from "react";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../slide-show/types.ts";
import { SlideEditorController, type SlideObjectStyle } from "./SlideEditorController.ts";
import styles from "./SlideEditorCanvas.module.css";

interface Props {
  readonly onReady: (controller: SlideEditorController | null) => void;
  readonly onChange: () => void;
  readonly onSelectionChange: (style: SlideObjectStyle | null) => void;
}

/** Mounts an editable Fabric canvas that always fills the available width at 16:9. */
export default function SlideEditorCanvas({ onReady, onChange, onSelectionChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Fabric listeners are bound once; route them through refs to the latest callbacks.
  const callbacks = useRef({ onChange, onSelectionChange });
  callbacks.current = { onChange, onSelectionChange };

  useEffect(() => {
    const container = containerRef.current;
    const host = hostRef.current;
    if (!container || !host) return undefined;
    const element = document.createElement("canvas");
    host.appendChild(element);
    const controller = new SlideEditorController(element, {
      onChange: () => callbacks.current.onChange(),
      onSelectionChange: (style) => callbacks.current.onSelectionChange(style),
    });
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      controller.resize(Math.min(width, height * SLIDE_WIDTH / SLIDE_HEIGHT));
    });
    observer.observe(container);
    const keyDown = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']") && !host.contains(event.target)) return;
      controller.handleKeyDown(event);
    };
    window.addEventListener("keydown", keyDown);
    onReady(controller);
    return () => {
      window.removeEventListener("keydown", keyDown);
      observer.disconnect();
      onReady(null);
      void controller.dispose().finally(() => host.replaceChildren());
    };
  }, [onReady]);

  return <div ref={containerRef} className={styles.container}><div ref={hostRef} className={styles.board} /></div>;
}
