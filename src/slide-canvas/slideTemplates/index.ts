import { CLASSIC_BLUE } from "./classicBlue.ts";
import { WARM_NOTE } from "./warmNote.ts";
import { BLUE_TEXTBOOK } from "./blueTextbook.ts";
import { CLEAN_TITLE, QUIET_NOTE } from "./cleanTitle.ts";
import { YELLOW_GRID, CALM_GREEN } from "./paper.ts";
import type { SlideTemplate } from "./types.ts";

export type { SlideTemplate, TemplateDecoration, TemplateLayout, TemplateText, TemplateVariant } from "./types.ts";
export { applyTemplate } from "./apply.ts";

/** 양식 순서가 곧 편집기 패널의 카드 순서다. */
export const SLIDE_TEMPLATES: readonly SlideTemplate[] = [
  CLASSIC_BLUE,
  WARM_NOTE,
  BLUE_TEXTBOOK,
  CLEAN_TITLE,
  QUIET_NOTE,
  YELLOW_GRID,
  CALM_GREEN,
];
