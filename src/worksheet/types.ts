/** A printable A4 worksheet; every worksheet kind is expressed as this data and drawn by WorksheetView. */
export interface WorksheetDocument {
  readonly title: string;
  readonly footer: string;
  /** Shrink the sentence tables so the whole worksheet fits on this many pages. */
  readonly fitPages?: number;
  readonly sections: readonly WorksheetSection[];
}

export interface WorksheetSection {
  /** Omitted for single-part worksheets that need no heading. */
  readonly title?: string;
  readonly newPage?: boolean;
  readonly blocks: readonly WorksheetBlock[];
}

export interface SentenceRow {
  readonly number: number;
  readonly english: string;
  readonly meaning: string;
}

export type WorksheetBlock =
  /** `blank` empties that column so students write it in. */
  | { readonly type: "sentences"; readonly blank?: "english" | "meaning"; readonly rows: readonly SentenceRow[] }
  | { readonly type: "questions"; readonly questions: readonly WorksheetQuestion[] }
  | { readonly type: "notice"; readonly text: string }
  /** `note` (e.g. an explanation) puts each entry on its own line. */
  | { readonly type: "answers"; readonly entries: readonly { readonly number: number; readonly answer: string; readonly note?: string }[] };

export type WorksheetQuestion = {
  readonly number: number;
  readonly text: string;
  /** A boxed passage, example (<보기>) or dialogue printed under the prompt. */
  readonly context?: string;
} & (
  | { readonly type: "choice"; readonly choices: readonly string[] }
  /** `text` holds one {{blank}} marker. */
  | { readonly type: "blank"; readonly answerLength: number }
  /** A short answer line after the text, e.g. a one-word correction. */
  | { readonly type: "line"; readonly answerLength: number }
  | { readonly type: "written"; readonly lines: number }
);
