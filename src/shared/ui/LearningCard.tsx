import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import styles from "./LearningCard.module.css";

export type LearningCardTone = "indigo" | "mint" | "warm";

interface SharedProps {
  readonly eyebrow: string;
  readonly marker?: string | undefined;
  readonly tone?: LearningCardTone | undefined;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

function classes(className: string | undefined): string {
  return [styles.card, className ?? ""].filter(Boolean).join(" ");
}

export function LearningCardButton({
  eyebrow,
  marker,
  tone = "indigo",
  children,
  className,
  selected = false,
  exiting = false,
  ...buttonProps
}: SharedProps & ButtonHTMLAttributes<HTMLButtonElement> & { readonly selected?: boolean; readonly exiting?: boolean }) {
  return <button
    type="button"
    {...buttonProps}
    className={classes(className)}
    data-tone={tone}
    data-selected={selected}
    data-exiting={exiting}
  >
    <span className={styles.eyebrow}>{eyebrow}</span>
    <strong className={styles.content}>{children}</strong>
    {marker ? <i className={styles.marker} aria-hidden="true">{marker}</i> : null}
  </button>;
}

export function LearningCardSurface({
  eyebrow,
  marker,
  tone = "warm",
  children,
  className,
  ...articleProps
}: SharedProps & HTMLAttributes<HTMLElement>) {
  return <article {...articleProps} className={classes(className)} data-tone={tone}>
    <span className={styles.eyebrow}>{eyebrow}</span>
    <strong className={styles.content}>{children}</strong>
    {marker ? <i className={styles.marker} aria-hidden="true">{marker}</i> : null}
  </article>;
}
