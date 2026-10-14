import { encodeSlideImage } from "../slide-canvas/imageFile.ts";
import type { AssistantImageCredit } from "./types.ts";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Thumbnails come from Wikimedia's image hosts (upload. or thumb.wikimedia.org). */
const IMAGE_HOST = /^https:\/\/[a-z]+\.wikimedia\.org\//;
const THUMB_WIDTH = 1280;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_QUERY = 80;

export interface CommonsImage {
  readonly url: string;
  readonly pageUrl: string;
  readonly creator: string;
  readonly license: string;
  readonly licenseUrl: string;
}

export interface SlideImage {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly credit: AssistantImageCredit;
}

interface CommonsPage {
  readonly index?: number;
  readonly title?: string;
  readonly imageinfo?: readonly {
    readonly mime?: string;
    readonly thumburl?: string;
    readonly descriptionurl?: string;
    readonly extmetadata?: unknown;
  }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function commonsPages(value: unknown): readonly CommonsPage[] {
  if (!isRecord(value) || !isRecord(value.query) || !isRecord(value.query.pages)) return [];
  return Object.values(value.query.pages).flatMap((page) => isRecord(page) ? [page as CommonsPage] : []);
}

/**
 * Only licences that allow commercial reuse, so a picture can be printed in teaching material.
 * Attribution and share-alike are fine; NonCommercial, NoDerivatives and GFDL are not kept.
 */
export function isCommerciallyUsableLicense(name: string): boolean {
  const license = name.trim().toLowerCase();
  if (!license) return false;
  if (/-nc|-nd|(^|\W)nc(\W|$)|non-?commercial|no-?deriv|fair use|gfdl/.test(license)) return false;
  return /^(cc0\b|cc by\b|public domain\b|attribution\b|no restrictions\b|pd-)/.test(license);
}

function metadataFields(page: CommonsPage): readonly { readonly name: string; readonly value: string }[] {
  const meta = page.imageinfo?.[0]?.extmetadata;
  if (!isRecord(meta)) return [];
  return Object.entries(meta).flatMap(([name, item]) => {
    if (!isRecord(item) || item.value === undefined || item.value === null) return [];
    const value = String(item.value).trim();
    return value ? [{ name, value }] : [];
  });
}

function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function field(fields: readonly { readonly name: string; readonly value: string }[], name: string): string {
  return plainText(fields.find((item) => item.name === name)?.value ?? "");
}

/**
 * Picks the freely licensed pictures out of a Commons search response, keeping the licence
 * and author of each so the slides can credit them. Pure, so the search rules stay testable.
 */
export function parseCommonsResults(value: unknown): readonly CommonsImage[] {
  return commonsPages(value)
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((page): CommonsImage[] => {
      const info = page.imageinfo?.[0];
      const url = info?.thumburl ?? "";
      const fields = metadataFields(page);
      const license = field(fields, "LicenseShortName");
      if (!IMAGE_HOST.test(url) || !PHOTO_TYPES.has(info?.mime ?? "") || !isCommerciallyUsableLicense(license)) return [];
      return [{
        url,
        pageUrl: plainText(info?.descriptionurl ?? ""),
        creator: field(fields, "Artist") || plainText(String(page.title ?? "").replace(/^File:/, "")),
        license,
        licenseUrl: field(fields, "LicenseUrl"),
      }];
    });
}

/** Short credit line for an inserted picture, e.g. "Barcaviktor25 · CC BY-SA 4.0 · Wikimedia Commons". */
export function imageCreditText(credit: AssistantImageCredit): string {
  return [credit.creator, credit.license, credit.source].filter(Boolean).join(" · ");
}

function searchUrl(query: string): string {
  return `${COMMONS_API}?${new URLSearchParams({
    action: "query", format: "json", origin: "*", generator: "search", gsrnamespace: "6", gsrlimit: "20",
    gsrsearch: `${query} filetype:bitmap`, prop: "imageinfo", iiprop: "url|mime|size|extmetadata", iiurlwidth: String(THUMB_WIDTH),
  })}`;
}

/**
 * Finds one freely licensed picture on Wikimedia Commons (no key needed; it allows browser
 * requests) and returns it as a slide-ready data URL together with its credit. The picture
 * goes through the same encode step as an uploaded file before it can reach a slide.
 */
export async function findSlideImage(query: string, fetchImpl: typeof fetch = fetch): Promise<SlideImage> {
  const search = query.trim().slice(0, MAX_QUERY);
  if (!search) throw new Error("그림 검색어가 비어 있습니다.");
  const response = await fetchImpl(searchUrl(search));
  if (!response.ok) throw new Error("그림을 검색하지 못했습니다.");
  const candidate = parseCommonsResults(await response.json())[0];
  if (!candidate) throw new Error(`"${search}" 그림을 찾지 못했습니다.`);
  let image: Response;
  try {
    image = await fetchImpl(candidate.url, { signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error("그림을 내려받지 못했습니다.");
  }
  const type = image.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!image.ok || !PHOTO_TYPES.has(type)) throw new Error("그림을 내려받지 못했습니다.");
  const blob = await image.blob();
  if (blob.size > MAX_SOURCE_BYTES) throw new Error("그림이 너무 커서 가져올 수 없습니다.");
  const encoded = await encodeSlideImage(blob);
  return {
    dataUrl: encoded.dataUrl, width: encoded.width, height: encoded.height,
    credit: { source: "Wikimedia Commons", creator: candidate.creator, license: candidate.license, licenseUrl: candidate.licenseUrl, pageUrl: candidate.pageUrl },
  };
}
