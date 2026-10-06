import type { ReactNode } from "react";
import SlideFrameBox from "../../slide-canvas/SlideFrameBox.tsx";
import SlideStage from "../../slide-canvas/SlideStage.tsx";
import type { Slide, SlideFrame } from "../../slide-show/types.ts";
import { fittedEngineFrame } from "./engineWindowFrame.ts";
import styles from "./SlideViewport.module.css";

/** The current slide, with engine content (game or status) placed in its engine window. */
export default function SlideViewport({ slide, engineFrame, engineContent, annotation, className }: {
  readonly slide: Slide;
  readonly engineFrame: SlideFrame | null;
  readonly engineContent: ReactNode;
  /** Layer drawn over the slide but under the engine window; receives the slide-unit → pixel scale. */
  readonly annotation?: ((scale: number) => ReactNode) | undefined;
  readonly className?: string | undefined;
}) {
  const engineWindow = (scale: number): ReactNode => engineFrame && engineContent
    ? <SlideFrameBox className={styles.engineWindow} frame={fittedEngineFrame(engineFrame, scale)} scale={scale}>{engineContent}</SlideFrameBox>
    : null;
  return <SlideStage
    className={className}
    canvas={slide.canvas}
    overlay={annotation || (engineFrame && engineContent) ? (scale) => <>{annotation?.(scale)}{engineWindow(scale)}</> : undefined}
  />;
}
