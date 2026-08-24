import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import type { PopupBaseOptions } from "./types.ts";
import styles from "./PopupFrame.module.css";

interface Props {
  readonly options: PopupBaseOptions;
  readonly children: ReactNode;
  readonly onDismiss?: (() => void) | undefined;
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

export default function PopupFrame({ options, children, onDismiss }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const blurBackground = options.blurBackground ?? true;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      const preferred = panelRef.current?.querySelector<HTMLElement>("[data-popup-autofocus]");
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (preferred ?? first ?? panelRef.current)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && onDismiss && (options.closeOnEscape ?? true)) {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        panelRef.current.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onDismiss, options.closeOnEscape]);

  const dismissFromBackdrop = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget && onDismiss && options.closeOnBackdrop) onDismiss();
  };

  return (
    <div className={`${styles.overlay} ${blurBackground ? styles.blurred : styles.clear}`} onMouseDown={dismissFromBackdrop} data-popup-overlay="true">
      <div className={`${styles.panel} ${styles[options.tone ?? "info"]}`} ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={options.message ? descriptionId : undefined} tabIndex={-1}>
        <div className={styles.accent} aria-hidden="true" />
        <header className={styles.header}>
          {options.eyebrow ? <p>{options.eyebrow}</p> : null}
          <h2 id={titleId}>{options.title}</h2>
          {options.message ? <div className={styles.message} id={descriptionId}>{options.message}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
