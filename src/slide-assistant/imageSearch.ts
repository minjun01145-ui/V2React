import { encodeSlideImage } from "../slide-canvas/imageFile.ts";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Thumbnails come from Wikimedia's image hosts (upload. or thumb.wikimedia.org). */
const IMAGE_HOST = /^https:\/\/[a-z]+\.wikimedia\.org\//;

interface CommonsPage {
  readonly index?: number;
  readonly imageinfo?: readonly { readonly mime?: string; readonly thumburl?: string }[];
}

/**
 * Finds a freely licensed picture on Wikimedia Commons (no key needed; it allows browser
 * requests) and returns it as a slide-ready data URL.
 */
export async function findSlideImage(query: string): Promise<string> {
  const params = new URLSearchParams({
    action: "query", format: "json", origin: "*", generator: "search", gsrnamespace: "6", gsrlimit: "10",
    gsrsearch: `${query} filetype:bitmap`, prop: "imageinfo", iiprop: "url|mime", iiurlwidth: "1280",
  });
  const response = await fetch(`${COMMONS_API}?${params}`);
  if (!response.ok) throw new Error("그림을 검색하지 못했습니다.");
  const data: unknown = await response.json();
  const pages = typeof data === "object" && data !== null && "query" in data
    ? Object.values(((data as { query?: { pages?: Record<string, CommonsPage> } }).query?.pages) ?? {})
    : [];
  const candidate = pages
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((page) => page.imageinfo?.[0])
    .find((info) => IMAGE_HOST.test(info?.thumburl ?? "") && PHOTO_TYPES.has(info?.mime ?? ""));
  if (!candidate?.thumburl) throw new Error(`"${query}" 그림을 찾지 못했습니다.`);
  const image = await fetch(candidate.thumburl);
  if (!image.ok) throw new Error("그림을 내려받지 못했습니다.");
  return (await encodeSlideImage(await image.blob())).dataUrl;
}
