import assert from "node:assert/strict";
import { cropAround, lineBoxes, passageWords, readingSlideCanvas, toSlideBox } from "../src/slide-builder/reading-text/slideLayout.ts";
import { alignSentences, normalizeToken, splitChunks, type PdfWord } from "../src/slide-builder/reading-text/textMatching.ts";

/** Lays words out like a textbook page: one entry per line, 10 units per character. */
function page(pageNumber: number, lines: readonly string[], top = 100): PdfWord[] {
  return lines.flatMap((line, row) => {
    let x = 50;
    return line.split(" ").map((text) => {
      const word = { text, page: pageNumber, x0: x, y0: top + row * 30, x1: x + text.length * 10, y1: top + row * 30 + 20 };
      x = word.x1 + 10;
      return word;
    });
  });
}

const glossary = page(1, ["Q1 What color are most buildings?", "pearl narrow souvenir"], 600);
const passage = page(2, [
  "Hi Inho,",
  "I’m in Chefchaouen, the Blue Pearl of Morocco. All day",
  "5 long, I enjoyed taking pictures of the blue streets and",
  "blue buildings.",
]);
const words = [...glossary, ...passage];

assert.equal(normalizeToken("I’m"), "i'm", "curly and straight apostrophes match");
assert.equal(normalizeToken("Morocco."), "morocco");
assert.deepEqual(splitChunks("All day long, / I enjoyed / "), ["All day long,", "I enjoyed"]);

const [greeting, first, second, missing] = alignSentences(words, [
  splitChunks("Hi Inho,"),
  splitChunks("I'm in Chefchaouen, / the Blue Pearl of Morocco."),
  splitChunks("All day long, / I enjoyed / taking pictures of the blue streets and blue buildings."),
  splitChunks("This sentence is not in the book."),
]);
assert.equal(greeting!.found, true);
assert.equal(first!.chunks[1]!.page, 2, "the passage page is found among other pages");
assert.deepEqual(first!.chunks[1]!.words.map((word) => word.text), ["the", "Blue", "Pearl", "of", "Morocco."]);
assert.deepEqual(second!.chunks[0]!.words.map((word) => word.text), ["All", "day", "long,"], "a line number between words is skipped");
assert.equal(missing!.found, false, "a sentence absent from the PDF is reported instead of guessed");

// A chunk wrapping onto the next line gets one box per line.
const wrapped = second!.chunks[2]!.words;
assert.equal(lineBoxes(wrapped).length, 2);
const [lineOne] = lineBoxes(second!.chunks[0]!.words);
assert.ok(lineOne!.x < passage.find((word) => word.text === "All")!.x0 && lineOne!.y < passage.find((word) => word.text === "All")!.y0, "boxes are padded around the words");

// The crop keeps whole lines, is 16:9 and stays on the page.
const pageSize = { width: 595, height: 794 };
const shown = passageWords(first!.chunks.flatMap((chunk) => chunk!.words), passage);
assert.ok(shown.some((word) => word.text === "day"), "words the set leaves out on a matched line are still in frame");
const crop = cropAround(shown, pageSize);
assert.ok(Math.abs(crop.width / crop.height - 16 / 9) < 0.01, "a passage nearly as wide as the page still gets a 16:9 crop");
const tall = cropAround(page(3, Array.from({ length: 24 }, () => "a long line of passage text here")), pageSize);
assert.ok(tall.height >= 24 * 30 - 10, "a tall passage is never cut; the slide letterboxes it instead");
assert.ok(crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= pageSize.width && crop.y + crop.height <= pageSize.height);

const slideBox = toSlideBox(lineOne!, crop);
assert.ok(slideBox.x >= 0 && slideBox.x + slideBox.width <= 1280 && slideBox.y >= 0 && slideBox.y + slideBox.height <= 720, "chunk boxes land on the slide");

const canvas = JSON.parse(readingSlideCanvas({ src: "data:image/webp;base64,AAAA", width: 1600, height: 900 }, crop, [slideBox])) as { objects: { type: string; selectable?: boolean }[] };
assert.deepEqual(canvas.objects.map((object) => object.type), ["Image", "Rect"]);
assert.equal(canvas.objects[0]!.selectable, false, "the page image stays put while editing the boxes");

console.log("reading text slide tests passed");
