import assert from "node:assert/strict";
import { lineBoxes, passageWords, planPageViews, readingSlideCanvas, toSlideBox, type Box } from "../src/slide-builder/reading-text/slideLayout.ts";
import { alignSentences, normalizeToken, splitChunks, type PdfWord } from "../src/slide-builder/reading-text/textMatching.ts";

/** Lays words out like a textbook page: one entry per line, `size` units per character. */
function page(pageNumber: number, lines: readonly string[], top = 100, size = 10, left = 50): PdfWord[] {
  return lines.flatMap((line, row) => {
    let x = left;
    return line.split(" ").map((text) => {
      const y0 = top + row * size * 3;
      const word = { text, page: pageNumber, x0: x, y0, x1: x + text.length * size, y1: y0 + size * 2 };
      x = word.x1 + size;
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
const strayPage = [...page(6, ["I bought some souvenirs."]), ...page(6, ["mint"], 700)];
const [stray] = alignSentences(strayPage, [splitChunks("I bought / some souvenirs. mint")]);
assert.ok(stray!.chunks[1]!.words.every((word) => word.text !== "mint"), "a matching word far away on the page is not pulled into the sentence");

// A chunk wrapping onto the next line gets one box per line.
const wrapped = second!.chunks[2]!.words;
assert.equal(lineBoxes(wrapped).length, 2);
const [lineOne] = lineBoxes(second!.chunks[0]!.words);
assert.ok(lineOne!.x < passage.find((word) => word.text === "All")!.x0 && lineOne!.y < passage.find((word) => word.text === "All")!.y0, "boxes are padded around the words");

// Views zoom into the passage like a hand-made 본문 slide.
const pageSize = { width: 595, height: 794 };
const inside = (words: readonly PdfWord[], crop: Box): boolean => words.every((word) => word.x0 >= crop.x && word.x1 <= crop.x + crop.width && word.y0 >= crop.y && word.y1 <= crop.y + crop.height);
const shown = passageWords(first!.chunks.flatMap((chunk) => chunk!.words), passage);
assert.ok(shown.some((word) => word.text === "day"), "words the set leaves out on a matched line are still in frame");

const letterLines = Array.from({ length: 10 }, (_, row) => `line${row} of the letter with some words in it`);
const letter = page(4, letterLines, 340, 6, 80);
const letterChunks = letterLines.map((_, row) => letter.filter((word) => word.text === `line${row}` || (word.y0 === letter.find((item) => item.text === `line${row}`)!.y0 && word.x0 < 200)));
const [view, ...restViews] = planPageViews(letterChunks, letter, pageSize);
assert.ok(Math.abs(view!.crop.width / view!.crop.height - 16 / 9) < 0.01, "views are 16:9");
assert.ok(view!.crop.width < pageSize.width * 0.7, "the view zooms in instead of showing the whole page");
assert.ok(inside(letter.filter((word) => word.y0 === letter[0]!.y0), view!.crop), "full lines stay visible across the slide");
assert.ok(restViews.length + 1 < letterChunks.length, "the view stays put while several chunks advance");

const tallLines = Array.from({ length: 30 }, (_, row) => `row${row} words of a long passage`);
const tall = page(5, tallLines, 60, 6, 80);
const tallChunks = tallLines.map((_, row) => tall.filter((word) => word.y0 === 60 + row * 18));
const tallViews = planPageViews(tallChunks, tall, pageSize);
assert.ok(tallViews.length > 1, "a long passage scrolls through several views");
assert.ok(tallViews.every((item, index) => index === 0 || item.crop.y > tallViews[index - 1]!.crop.y), "views move down the passage");
for (const item of tallViews) for (const index of item.chunks) assert.ok(inside(tallChunks[index]!, item.crop), "every chunk is inside its view");
assert.ok(tallViews.every((item) => item.crop.x >= 0 && item.crop.y >= 0 && item.crop.x + item.crop.width <= pageSize.width && item.crop.y + item.crop.height <= pageSize.height));

const crop = planPageViews([second!.chunks[0]!.words], passage, pageSize)[0]!.crop;
const slideBox = toSlideBox(lineOne!, crop);
assert.ok(slideBox.x >= 0 && slideBox.x + slideBox.width <= 1280 && slideBox.y >= 0 && slideBox.y + slideBox.height <= 720, "chunk boxes land on the slide");

const canvas = JSON.parse(readingSlideCanvas({ src: "data:image/webp;base64,AAAA", width: 1600, height: 900 }, crop, [slideBox])) as { objects: { type: string; selectable?: boolean }[] };
assert.deepEqual(canvas.objects.map((object) => object.type), ["Image", "Rect"]);
assert.equal(canvas.objects[0]!.selectable, false, "the page image stays put while editing the boxes");

console.log("reading text slide tests passed");
