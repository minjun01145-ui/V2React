export interface WorksheetDocument {
  readonly title: string;
  readonly subtitle: string;
  readonly kind: string;
  readonly sections: readonly WorksheetSection[];
}

export interface WorksheetSection {
  readonly title: string;
  readonly newPage?: boolean;
  readonly blocks: readonly WorksheetBlock[];
}

export type WorksheetBlock =
  | { readonly type: "sentences"; readonly writing?: boolean; readonly rows: readonly { readonly number: number; readonly english: string; readonly meaning: string }[] }
  | { readonly type: "questions"; readonly questions: readonly WorksheetQuestion[] }
  | { readonly type: "notice"; readonly text: string }
  | { readonly type: "answers"; readonly entries: readonly { readonly number: number; readonly answer: string }[] };

export type WorksheetQuestion = {
  readonly number: number;
  readonly text: string;
} & (
  | { readonly type: "choice"; readonly choices: readonly string[] }
  | { readonly type: "blank"; readonly answerLength: number }
  | { readonly type: "written"; readonly lines: 3 | 4 }
);
