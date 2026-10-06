import { inflateRawSync } from "node:zlib";

/*
 * Reads the body text of a .hwpx (OWPML zip) file. Paragraphs become lines and table
 * rows become tab-separated lines; formatting, pictures and headers are ignored.
 */

const NOT_HWPX = "HWPX 파일을 읽지 못했습니다.";
const MAX_UNZIPPED_BYTES = 30 * 1024 * 1024;
const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };

function sectionEntries(data: Buffer): ReadonlyMap<string, Buffer> {
  let end = data.length - 22;
  while (end >= 0 && data.readUInt32LE(end) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error(NOT_HWPX);
  const count = data.readUInt16LE(end + 10);
  let position = data.readUInt32LE(end + 16);
  let unzipped = 0;
  const sections = new Map<string, Buffer>();
  for (let index = 0; index < count; index += 1) {
    if (data.readUInt32LE(position) !== 0x02014b50) throw new Error(NOT_HWPX);
    const method = data.readUInt16LE(position + 10);
    const size = data.readUInt32LE(position + 20);
    const nameLength = data.readUInt16LE(position + 28);
    const local = data.readUInt32LE(position + 42);
    const name = data.subarray(position + 46, position + 46 + nameLength).toString("utf8");
    position += 46 + nameLength + data.readUInt16LE(position + 30) + data.readUInt16LE(position + 32);
    if (!/^Contents\/section\d+\.xml$/i.test(name)) continue;
    if (data.readUInt32LE(local) !== 0x04034b50) throw new Error(NOT_HWPX);
    const offset = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    const raw = data.subarray(offset, offset + size);
    const content = method === 0 ? raw : method === 8 ? inflateRawSync(raw, { maxOutputLength: MAX_UNZIPPED_BYTES }) : null;
    if (!content) throw new Error(NOT_HWPX);
    unzipped += content.length;
    if (unzipped > MAX_UNZIPPED_BYTES) throw new Error(NOT_HWPX);
    sections.set(name, content);
  }
  return sections;
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return ENTITIES[code] ?? match;
  });
}

function sectionText(xml: string): string {
  let out = "";
  let inText = false;
  let cellDepth = 0;
  for (const [, closing, name, selfClosing, text] of xml.matchAll(/<(\/?)hp:(\w+)[^>]*?(\/?)>|([^<]+)/g)) {
    if (text !== undefined) {
      if (inText) out += decodeEntities(text);
      continue;
    }
    if (name === "t") inText = !closing && !selfClosing;
    else if (name === "tab" && inText) out += " ";
    else if (name === "lineBreak") out += cellDepth > 0 ? " " : "\n";
    else if (name === "tc" && !selfClosing) {
      if (closing) {
        cellDepth -= 1;
        out += "\t";
      } else cellDepth += 1;
    } else if (name === "tr" && closing) out = `${out.replace(/\t$/, "")}\n`;
    else if (name === "p" && closing) out += cellDepth > 0 ? " " : "\n";
  }
  return out;
}

export function extractHwpxText(data: Buffer): string {
  let sections: ReadonlyMap<string, Buffer>;
  try {
    sections = sectionEntries(data);
  } catch {
    throw new Error(NOT_HWPX);
  }
  if (sections.size < 1) throw new Error(NOT_HWPX);
  const order = (name: string): number => Number(/(\d+)\.xml$/i.exec(name)?.[1] ?? 0);
  return [...sections.keys()]
    .sort((left, right) => order(left) - order(right))
    .map((name) => sectionText(sections.get(name)?.toString("utf8") ?? ""))
    .join("\n")
    .split("\n")
    .map((line) => line.replace(/[  ]+/g, " ").replace(/ *\t */g, "\t").trim())
    .filter(Boolean)
    .join("\n");
}
