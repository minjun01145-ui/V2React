import type { WorksheetDocument } from "./types.ts";

/* Rough print geometry of WorksheetView on A4, in millimetres. It only has to be close: the result shrinks
   sentence tables a little so a worksheet stays within its page budget instead of spilling one row over. */
const PAGE_HEIGHT = 297 - 14 - 16;
const HEADER = 24;
const FOOTER = 14;
const TABLE_HEADER = 8;
const ROW_PADDING = 5.5;
const ENGLISH_LINE = 5.8;
const MEANING_LINE = 5;
const ENGLISH_CHARS_PER_LINE = 50;
const MEANING_UNITS_PER_LINE = 19;
const MIN_SCALE = 0.62;

/** Hangul is about twice as wide as Latin text at the same size. */
function meaningUnits(text: string): number {
  let units = 0;
  for (const char of text) units += /[\u3131-\uD7A3]/.test(char) ? 1 : 0.55;
  return units;
}

/** Scale factor (MIN_SCALE..1) for sentence tables so `document` fits in `fitPages` pages. */
export function worksheetFitScale(document: WorksheetDocument): number {
  if (!document.fitPages) return 1;
  let content = 0;
  for (const section of document.sections) {
    for (const block of section.blocks) {
      if (block.type !== "sentences") continue;
      content += TABLE_HEADER * document.fitPages;
      for (const row of block.rows) {
        const englishLines = Math.max(1, Math.ceil(row.english.length / ENGLISH_CHARS_PER_LINE));
        const meaningLines = Math.max(1, Math.ceil(meaningUnits(row.meaning) / MEANING_UNITS_PER_LINE));
        content += Math.max(englishLines * ENGLISH_LINE, meaningLines * MEANING_LINE) + ROW_PADDING;
      }
    }
  }
  const available = document.fitPages * PAGE_HEIGHT - HEADER - FOOTER;
  return content <= available ? 1 : Math.max(MIN_SCALE, Math.floor((available / content) * 100) / 100);
}
