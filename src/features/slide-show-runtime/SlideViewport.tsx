import type { ReactNode } from "react";
import SlideFrameBox from "../../slide-canvas/SlideFrameBox.tsx";
import SlideStage from "../../slide-canvas/SlideStage.tsx";
import type { Slide, SlideFrame } from "../../slide-show/types.ts";
import styles from "./SlideViewport.module.css";

/** The current slide, with engine content (game or status) placed in its engine window. */
export default function SlideViewport({ slide, engineFrame, engineContent, className }: {
  readonly slide: Slide;
  readonly engineFrame: SlideFrame | null;
  readonly engineContent: ReactNode;
  readonly className?: string | undefined;
}) {
  return <SlideStage
    className={className}
    canvas={slide.canvas}
    overlay={engineFrame && engineContent ? (scale) => <SlideFrameBox className={styles.engineWindow} frame={engineFrame} scale={scale}>{engineContent}</SlideFrameBox> : undefined}
  />;
}
