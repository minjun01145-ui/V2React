import type { AssistantDeck, AssistantDeckSlide, AssistantSlide } from "./types.ts";
import type { Slide } from "../slide-show/types.ts";
import { slideTexts } from "../slide-canvas/slideEdits.ts";

/*
 * Builds the deck context the AI sees. The edited slide goes in full (as described objects, never
 * as Fabric JSON); every other slide contributes its text only, and the whole context is kept
 * inside the size the AI request accepts, so a long deck is trimmed here instead of rejected.
 */

/** Characters the deck context may take; the server rejects requests above its own limit. */
const MAX_CONTEXT_CHARS = 6_000;
/** Per-slide text cap, so one slide full of text cannot crowd out the rest of the review. */
const MAX_TEXT_PER_SLIDE = 1_500;

function sizeOf(currentSlide: AssistantSlide, otherSlides: readonly AssistantDeckSlide[], fonts: readonly string[]): number {
  return JSON.stringify({ currentSlide, otherSlides, fonts }).length;
}

/** One other slide: its texts, shortened until the per-slide cap is met. */
function slideEntry(number: number, texts: readonly string[]): AssistantDeckSlide {
  const kept: string[] = [];
  let length = 0;
  for (const text of texts) {
    if (length >= MAX_TEXT_PER_SLIDE) break;
    const shortened = text.slice(0, MAX_TEXT_PER_SLIDE - length);
    kept.push(shortened);
    length += shortened.length;
  }
  return { n: number, texts: kept };
}

/**
 * The deck summary the AI sees: the described slide in full, the other slides as text, and the
 * font families it may choose from. Slides that no longer fit are left out and reported, so the
 * AI can tell the teacher it read only part of the show.
 */
export function describeDeck({ slides, current, currentSlide, fonts }: {
  readonly slides: readonly Slide[];
  readonly current: number;
  readonly currentSlide: AssistantSlide;
  readonly fonts: readonly string[];
  readonly truncated?: boolean;
}): AssistantDeck {
  const otherSlides: AssistantDeckSlide[] = [];
  let truncated = false;
  for (const [index, slide] of slides.entries()) {
    if (index + 1 === current) continue;
    const entry = slideEntry(index + 1, slideTexts(slide.canvas));
    if (sizeOf(currentSlide, [...otherSlides, entry], fonts) > MAX_CONTEXT_CHARS) {
      truncated = true;
      break;
    }
    otherSlides.push(entry);
  }
  return { slideCount: slides.length, current, currentSlide, otherSlides, fonts, truncated };
}