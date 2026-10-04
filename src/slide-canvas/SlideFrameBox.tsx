import type { ReactNode } from "react";
import type { SlideFrame } from "../slide-show/types.ts";
import styles from "./SlideFrameBox.module.css";

/** Places content over a SlideStage at a rectangle given in slide units. */
export default function SlideFrameBox({ frame, scale, className, children }: {
  readonly frame: SlideFrame;
  readonly scale: number;
  readonly className?: string | undefined;
  readonly children?: ReactNode;
}) {
  return <div
    className={[styles.box, className ?? ""].filter(Boolean).join(" ")}
    style={{ left: frame.x * scale, top: frame.y * scale, width: frame.width * scale, height: frame.height * scale }}
  >{children}</div>;
}
