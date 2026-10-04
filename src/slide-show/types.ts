export const SLIDE_SHOW_SCHEMA_VERSION = 1 as const;

/** Slides are authored on a fixed 16:9 board and scaled to every screen. */
export const SLIDE_WIDTH = 1280;
export const SLIDE_HEIGHT = 720;

export const MAX_SLIDES = 100;
/** Serialized canvas (including embedded images) must fit in one Firestore document. */
export const MAX_SLIDE_CANVAS_BYTES = 900_000;

export type SlideEngineSource =
  | { readonly kind: "stored-set"; readonly setId: string | null }
  | { readonly kind: "free-response"; readonly prompt: string }
  | {
      readonly kind: "custom";
      readonly setType: "vocabulary" | "reading-chunks";
      readonly items: readonly SlideEngineCustomItem[];
    };

export interface SlideEngineCustomItem {
  readonly id: string;
  readonly sourceText: string;
  readonly meaning: string;
}

/** A question engine embedded in a slide: which game runs and what it asks. */
export interface SlideEngineRound {
  readonly gameId: string;
  readonly source: SlideEngineSource;
  readonly durationSeconds: number;
  readonly gameConfig: Readonly<Record<string, string>>;
}

/** Engine window position on the slide board, in slide units. */
export interface SlideFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SlideEngine {
  readonly frame: SlideFrame;
  readonly round: SlideEngineRound;
}

export interface Slide {
  readonly id: string;
  /** Fabric.js canvas JSON. Opaque to the domain apart from size limits. */
  readonly canvas: string;
  readonly engine: SlideEngine | null;
}

export interface SlideShowSummary {
  readonly id: string;
  readonly name: string;
  readonly slideCount: number;
  readonly updatedAtMs: number;
}

export interface SlideShow {
  readonly id: string;
  readonly name: string;
  readonly slides: readonly Slide[];
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export type SlideEnginePhase = "answering" | "submissions" | "results";

export interface ActiveSlideEngine {
  readonly slideId: string;
  readonly roundId: string;
  readonly phase: SlideEnginePhase;
  readonly frame: SlideFrame;
  readonly round: SlideEngineRound;
}

/** Live presentation state stored on the room session document. */
export interface SlideShowSessionState {
  readonly runId: string;
  readonly showId: string;
  readonly name: string;
  readonly slideIds: readonly string[];
  readonly currentSlideIndex: number;
  readonly engine: ActiveSlideEngine | null;
  /** Engine rounds whose progress counts toward the show leaderboard. */
  readonly scoredRoundIds: readonly string[];
  /** Points handed out by the teacher during the show, per player. */
  readonly awards: Readonly<Record<string, number>>;
}
