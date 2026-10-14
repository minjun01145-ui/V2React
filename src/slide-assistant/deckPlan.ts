import type { AssistantOperation, AssistantSlide } from "./types.ts";
import type { Slide } from "../slide-show/types.ts";
import {
  duplicateSlideAt, insertSlide, moveSlideTo, removeSlideAt, replaceSlideText, withSlideBackground,
} from "../slide-canvas/slideEdits.ts";

/*
 * Splits an AI reply into the edits of the slide being edited and the edits of the slide list.
 * The slide list stays in SlideShowEditor; this module only says what the next list should be, so
 * one reply is applied in one go.
 */

function targetsCurrent(target: { readonly slides: number | "all" }, current: number): boolean {
  return target.slides === "all" || target.slides === current;
}

/** The same text fix, expressed for the described objects of the slide being edited. */
function currentSlideReplacements(operation: Extract<AssistantOperation, { op: "replaceText" }>, currentSlide: AssistantSlide): readonly AssistantOperation[] {
  return currentSlide.objects.flatMap((object): AssistantOperation[] => object.text?.includes(operation.from)
    ? [{ op: "setText", id: object.id, text: object.text.split(operation.from).join(operation.to) }]
    : []);
}

export interface AssistantSplit {
  /** Edits the Fabric canvas of the slide being edited can apply, in the AI's order. */
  readonly canvas: readonly AssistantOperation[];
  /** Edits that change the slide list. */
  readonly deck: readonly AssistantOperation[];
}

/**
 * Resolves which part of the reply belongs to the canvas and which to the slide list, including a
 * background applied to every slide and a text fix that mentions the slide being edited.
 */
export function splitAssistantReply(
  operations: readonly AssistantOperation[],
  current: number,
  currentSlide: AssistantSlide,
): AssistantSplit {
  const canvas: AssistantOperation[] = [];
  const deck: AssistantOperation[] = [];
  for (const operation of operations) {
    if (operation.op === "replaceText") {
      if (targetsCurrent(operation, current)) canvas.push(...currentSlideReplacements(operation, currentSlide));
      if (operation.slides === "all" || operation.slides !== current) deck.push(operation);
      continue;
    }
    if (operation.op === "background") {
      if (operation.slide === undefined || targetsCurrent({ slides: operation.slide }, current)) canvas.push({ op: "background", color: operation.color });
      if (operation.slide !== undefined) deck.push(operation);
      continue;
    }
    if (operation.op === "addSlide" || operation.op === "duplicateSlide" || operation.op === "deleteSlide" || operation.op === "moveSlide") deck.push(operation);
    else canvas.push(operation);
  }
  return { canvas, deck };
}

export interface DeckPlan {
  readonly slides: readonly Slide[];
  /** How many edits were made, for the reply the teacher sees. */
  readonly count: number;
}

function replaceAcrossSlides(slides: readonly Slide[], operation: Extract<AssistantOperation, { op: "replaceText" }>, current: number): DeckPlan {
  const numbers = operation.slides === "all" ? slides.map((_, index) => index + 1) : [operation.slides];
  let count = 0;
  const next = slides.map((slide, index) => {
    if (!numbers.includes(index + 1) || index + 1 === current) return slide;
    const replaced = replaceSlideText(slide, operation.from, operation.to);
    if (!replaced) return slide;
    count += replaced.count;
    return replaced.slide;
  });
  return { slides: count > 0 ? next : slides, count };
}

/**
 * Applies the slide-list operations (replace text on other slides, add/duplicate/delete/move a
 * slide, background on other or all slides) and returns the list they produce.
 */
export function planDeckOperations(
  deck: { readonly slides: readonly Slide[]; readonly current: number },
  operations: readonly AssistantOperation[],
): DeckPlan {
  let slides = deck.slides;
  let count = 0;

  for (const operation of operations) {
    if (operation.op === "replaceText") {
      const plan = replaceAcrossSlides(slides, operation, deck.current);
      slides = plan.slides;
      count += plan.count;
      continue;
    }
    if (operation.op === "background" && "slide" in operation) {
      const numbers = operation.slide === "all" ? slides.map((_, index) => index + 1) : [operation.slide];
      const applied = numbers.filter((number) => slides[number - 1] && number !== deck.current);
      if (applied.length === 0) continue;
      slides = slides.map((slide, index) => applied.includes(index + 1) ? withSlideBackground(slide, operation.color) : slide);
      count += applied.length;
      continue;
    }
    const next = operation.op === "addSlide" ? insertSlide(slides, operation.after, operation.background)
      : operation.op === "duplicateSlide" ? duplicateSlideAt(slides, operation.slide)
      : operation.op === "deleteSlide" ? removeSlideAt(slides, operation.slide)
      : operation.op === "moveSlide" ? moveSlideTo(slides, operation.from, operation.to)
      : null;
    if (!next) continue;
    slides = next;
    count += 1;
  }
  return { slides, count };
}
