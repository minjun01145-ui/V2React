/** What the slide AI helper sees: the slide (1280x720) as a short list of objects with ids o1, o2 … in stacking order. */
export interface AssistantObject {
  readonly id: string;
  readonly kind: "text" | "shape" | "line" | "image";
  readonly z: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly text?: string;
  readonly fill?: string;
  readonly fontSize?: number;
  readonly bold?: boolean;
  readonly textAlign?: string;
  readonly fontFamily?: string;
  readonly background?: string;
}

export interface AssistantSlide {
  readonly background: string;
  readonly objects: readonly AssistantObject[];
}

/** Another slide of the deck: only its text, so the prompt keeps fitting the token budget. */
export interface AssistantDeckSlide {
  readonly n: number;
  readonly texts: readonly string[];
}

/** The deck as the AI helper sees it: the slide being edited in full, the other slides as text. */
export interface AssistantDeck {
  readonly slideCount: number;
  readonly current: number;
  readonly currentSlide: AssistantSlide;
  readonly otherSlides: readonly AssistantDeckSlide[];
  /** Font families the editor can render; the AI may only pick from these. */
  readonly fonts: readonly string[];
  /** True when some slides were left out of the summary because the deck is very long. */
  readonly truncated: boolean;
}

export type TextAlign = "left" | "center" | "right";
export type ArrangeAction = "front" | "forward" | "backward" | "back";

/** Where a freely licensed picture came from; kept on the inserted image object. */
export interface AssistantImageCredit {
  readonly source: string;
  readonly creator: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly pageUrl: string;
}

export interface AssistantImageSource {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly credit: AssistantImageCredit;
}

/**
 * Edits the AI asks for; the server validates them and the editor applies them.
 * `id` refers to a described object of the slide being edited, `slide` to a one-based slide number.
 */
export type AssistantOperation =
  | { readonly op: "move"; readonly id: string; readonly left: number; readonly top: number }
  | { readonly op: "resize"; readonly id: string; readonly width: number; readonly height?: number }
  | { readonly op: "style"; readonly id: string; readonly fill?: string; readonly fontSize?: number; readonly bold?: boolean; readonly textAlign?: TextAlign; readonly fontFamily?: string; readonly background?: string | null; readonly opacity?: number }
  | { readonly op: "arrange"; readonly id: string; readonly action: ArrangeAction }
  | { readonly op: "setText"; readonly id: string; readonly text: string }
  | { readonly op: "delete"; readonly id: string }
  | { readonly op: "addText"; readonly text: string; readonly left: number; readonly top: number; readonly width: number; readonly fontSize?: number; readonly fill?: string; readonly bold?: boolean; readonly textAlign?: TextAlign; readonly fontFamily?: string; readonly background?: string | null }
  | { readonly op: "addShape"; readonly shape: "rect" | "circle" | "triangle"; readonly left: number; readonly top: number; readonly width: number; readonly height: number; readonly fill?: string }
  | { readonly op: "addImage"; readonly query: string; readonly left?: number; readonly top?: number; readonly width?: number }
  | { readonly op: "background"; readonly color: string; readonly slide?: number | "all" }
  | { readonly op: "replaceText"; readonly from: string; readonly to: string; readonly slides: number | "all" }
  | { readonly op: "addSlide"; readonly after?: number; readonly background?: string }
  | { readonly op: "duplicateSlide"; readonly slide: number }
  | { readonly op: "deleteSlide"; readonly slide: number }
  | { readonly op: "moveSlide"; readonly from: number; readonly to: number };

export interface AssistantReply {
  readonly message: string;
  readonly operations: readonly AssistantOperation[];
}
