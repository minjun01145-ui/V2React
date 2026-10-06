import { SLIDE_HEIGHT, SLIDE_WIDTH, type SlideFrame } from "../../slide-show/types.ts";

/** Smallest on-screen size (CSS px) at which a game still shows its controls, such as a submit button. */
export const MIN_ENGINE_WINDOW_PX = { width: 360, height: 300 } as const;

const FULL_SLIDE: SlideFrame = { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT };

/** The authored engine window when it is big enough on this screen, otherwise the whole slide. */
export function fittedEngineFrame(frame: SlideFrame, scale: number): SlideFrame {
  return frame.width * scale >= MIN_ENGINE_WINDOW_PX.width && frame.height * scale >= MIN_ENGINE_WINDOW_PX.height ? frame : FULL_SLIDE;
}
