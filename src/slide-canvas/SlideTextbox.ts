import { Textbox, classRegistry, type GraphemeData, type TextboxProps } from "fabric";

// Keep CJK's character-level breaks; Latin words only break when wider than the box.
const CHARACTER_BREAK = /[\s\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** Shares Fabric's grapheme-based cursor/style mapping without breaking ordinary words. */
class SlideTextbox extends Textbox {
  constructor(text: string, options?: Partial<TextboxProps>) {
    // Also migrate saved boxes: their old splitByGrapheme option must not restore break-all.
    super(text, { ...options, splitByGrapheme: true });
  }

  override _wrapLine(lineIndex: number, desiredWidth: number, data: GraphemeData, reservedSpace = 0): string[][] {
    const graphemes = data.wordsData[lineIndex]!.flatMap(({ word }) => word);
    const spacing = this._getWidthOfCharSpacing();
    let widest = 0;
    const widths = graphemes.map((grapheme, offset) => {
      const width = this._measureWord([grapheme], lineIndex, offset);
      widest = Math.max(widest, width - spacing);
      return width;
    });
    const available = Math.max(desiredWidth - reservedSpace, widest);
    this.dynamicMinWidth = Math.max(this.dynamicMinWidth, widest + reservedSpace);
    const lines: string[][] = [];
    let line: string[] = [];
    let lineWidth = 0;

    for (let start = 0; start < graphemes.length;) {
      let end = start + 1;
      if (!CHARACTER_BREAK.test(graphemes[start]!)) {
        while (end < graphemes.length && !CHARACTER_BREAK.test(graphemes[end]!)) end += 1;
      }
      const word = graphemes.slice(start, end);
      const wordWidth = this._measureWord(word, lineIndex, start);
      if (line.length > 0 && lineWidth + wordWidth - spacing > available) {
        lines.push(line);
        line = [];
        lineWidth = 0;
      }
      if (wordWidth - spacing <= available) {
        line.push(...word);
        lineWidth += wordWidth;
      } else {
        // overflow-wrap: anywhere for an otherwise unbreakable, oversized word.
        for (let offset = start; offset < end; offset += 1) {
          const width = widths[offset]!;
          if (line.length > 0 && lineWidth + width - spacing > available) {
            lines.push(line);
            line = [];
            lineWidth = 0;
          }
          line.push(graphemes[offset]!);
          lineWidth += width;
        }
      }
      start = end;
    }
    lines.push(line);
    return lines;
  }
}

// Preserve the existing JSON type, including old decks, imports and student rendering.
classRegistry.setClass(SlideTextbox, "Textbox");
classRegistry.setClass(SlideTextbox, "textbox");
export { SlideTextbox };
