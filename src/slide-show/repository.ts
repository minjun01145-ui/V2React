import { deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { currentTenantConfig } from "../tenant/config.ts";
import { tenantSlideShowRef, tenantSlideShowsCollection, tenantSlideShowSlidesCollection } from "../tenant/firestoreData.ts";
import { SLIDE_SHOW_SCHEMA_VERSION, type Slide, type SlideShow, type SlideShowSummary } from "./types.ts";
import { isSlideId, parseSlide, validateSlides, validateSlideShowName } from "./validation.ts";

/**
 * A show is a metadata document (name and slide order) plus one document per slide,
 * so embedded images stay within Firestore's per-document size limit.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ShowMeta {
  readonly name: string;
  readonly slideIds: readonly string[];
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

function parseShowMeta(value: unknown): ShowMeta | null {
  if (!isRecord(value) || value.schemaVersion !== SLIDE_SHOW_SCHEMA_VERSION) return null;
  const { name, slideIds, createdAtMs, updatedAtMs } = value;
  if (typeof name !== "string" || !name.trim() || !Array.isArray(slideIds) || !slideIds.every(isSlideId)) return null;
  if (typeof createdAtMs !== "number" || typeof updatedAtMs !== "number") return null;
  return { name: name.trim(), slideIds: slideIds as string[], createdAtMs, updatedAtMs };
}

export async function listSlideShows(): Promise<readonly SlideShowSummary[]> {
  const snapshot = await getDocs(tenantSlideShowsCollection(currentTenantConfig().id));
  return snapshot.docs
    .flatMap((item) => {
      const meta = parseShowMeta(item.data());
      return meta ? [{ id: item.id, name: meta.name, slideCount: meta.slideIds.length, updatedAtMs: meta.updatedAtMs }] : [];
    })
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs || a.name.localeCompare(b.name, "ko-KR"));
}

export async function getSlideShow(id: string): Promise<SlideShow> {
  const tenantId = currentTenantConfig().id;
  const [metaSnapshot, slidesSnapshot] = await Promise.all([
    getDoc(tenantSlideShowRef(tenantId, id)),
    getDocs(tenantSlideShowSlidesCollection(tenantId, id)),
  ]);
  const meta = metaSnapshot.exists() ? parseShowMeta(metaSnapshot.data()) : null;
  if (!meta) throw new Error("슬라이드쇼를 찾을 수 없거나 형식이 올바르지 않습니다.");
  const slides = new Map(slidesSnapshot.docs.flatMap((item) => {
    const slide = parseSlide(item.id, item.data());
    return slide ? [[slide.id, slide] as const] : [];
  }));
  const ordered = meta.slideIds.flatMap((slideId) => slides.get(slideId) ?? []);
  if (ordered.length === 0) throw new Error("슬라이드쇼에 읽을 수 있는 슬라이드가 없습니다.");
  return { id, name: meta.name, slides: ordered, createdAtMs: meta.createdAtMs, updatedAtMs: meta.updatedAtMs };
}

export interface SaveSlideShowInput {
  readonly id?: string;
  readonly name: string;
  readonly slides: readonly Slide[];
  readonly createdAtMs?: number;
  /** Slide ids stored by the previous save; slides no longer present are deleted. */
  readonly previousSlideIds?: readonly string[];
}

export async function saveSlideShow(input: SaveSlideShowInput): Promise<SlideShow> {
  const tenantId = currentTenantConfig().id;
  const id = input.id ?? crypto.randomUUID();
  const name = validateSlideShowName(input.name);
  const slides = validateSlides(input.slides);
  const now = Date.now();
  const createdAtMs = input.createdAtMs && input.createdAtMs > 0 ? input.createdAtMs : now;
  const slidesCollection = tenantSlideShowSlidesCollection(tenantId, id);
  const keptIds = new Set(slides.map((slide) => slide.id));
  await Promise.all(slides.map((slide) => setDoc(doc(slidesCollection, slide.id), {
    canvas: slide.canvas,
    engine: slide.engine,
    updatedAtMs: now,
  })));
  // Write the slide order last so a reader never sees ids without their documents.
  await setDoc(tenantSlideShowRef(tenantId, id), {
    name,
    schemaVersion: SLIDE_SHOW_SCHEMA_VERSION,
    slideIds: slides.map((slide) => slide.id),
    tenantId,
    createdAtMs,
    updatedAtMs: now,
    updatedAt: serverTimestamp(),
  });
  await Promise.all((input.previousSlideIds ?? []).filter((slideId) => !keptIds.has(slideId)).map((slideId) => deleteDoc(doc(slidesCollection, slideId))));
  return { id, name, slides, createdAtMs, updatedAtMs: now };
}

export async function deleteSlideShow(show: Pick<SlideShow, "id" | "slides">): Promise<void> {
  const tenantId = currentTenantConfig().id;
  const slidesCollection = tenantSlideShowSlidesCollection(tenantId, show.id);
  await deleteDoc(tenantSlideShowRef(tenantId, show.id));
  await Promise.all(show.slides.map((slide) => deleteDoc(doc(slidesCollection, slide.id))));
}
