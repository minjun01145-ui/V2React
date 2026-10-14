/**
 * 글꼴 지연 로더.
 *
 * 카탈로그의 선언을 실제 웹폰트 요청으로 바꾸되, 한 번 로드한 것은 다시 요청하지 않는다.
 * 시작 시점에 모든 글꼴을 받지 않고, 화면에 실제로 필요한 글꼴만 그때 등록·로드한다.
 * - Google Fonts: css2 스타일시트를 넣고, 유니코드 슬라이스 덕분에 쓰는 글자 조각만 내려받는다.
 *   미리보기는 `text=` 서브셋을 써서 이름 몇 글자만 받는다.
 * - 그 밖의 폰트: FontFace로 등록하고 실제 쓰일 때 파일을 받는다.
 * 반환하는 Promise는 해당 글꼴이 측정 가능해진 시점(로드 완료)을 뜻한다.
 */

import { fontForFamilyStack, type FontDefinition, type FontFaceFile } from "./catalog.ts";

/** 캔버스 기본 렌더링에 필요한 굵기: normal, bold, 템플릿 제목 굵기. */
export const DEFAULT_FONT_WEIGHTS: readonly number[] = [400, 700, 800];

const stylesheets = new Map<string, Promise<void>>();
const faces = new Map<string, Promise<void>>();

function addStylesheet(key: string, href: string): Promise<void> {
  const cached = stylesheets.get(key);
  if (cached) return cached;
  const promise = new Promise<void>((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    // 실패해도 fallback 글꼴로 계속 그린다. 재시도는 다음 로드 요청이 담당한다.
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener("error", () => resolve(), { once: true });
    document.head.append(link);
  });
  stylesheets.set(key, promise);
  return promise;
}

function addFaces(font: FontDefinition, files: readonly FontFaceFile[]): Promise<void> {
  return Promise.all(files.map((file) => {
    const key = `${font.id}:${file.weight}`;
    const cached = faces.get(key);
    if (cached) return cached;
    const promise = new FontFace(font.cssFamily, `url("${file.url}") format("${file.format}")`, { weight: String(file.weight), display: "swap" })
      .load()
      .then((face) => { document.fonts.add(face); })
      .catch(() => undefined);
    faces.set(key, promise);
    return promise;
  })).then(() => undefined);
}

function googleUrl(font: FontDefinition, weights: readonly number[], text?: string): string {
  const axis = weights.length === 1 && weights[0] === 400 ? "" : `:wght@${weights.join(";")}`;
  const subset = text ? `&text=${encodeURIComponent(text)}` : "";
  return `https://fonts.googleapis.com/css2?family=${font.cssFamily.replaceAll(" ", "+")}${axis}&display=swap${subset}`;
}

/** 서브셋 미리보기에 쓸 굵기: 본문/굵게 두 가지만 받아 용량을 줄인다. */
function previewWeights(weights: readonly number[]): readonly number[] {
  const preferred = weights.filter((weight) => weight === 400 || weight === 700);
  return preferred.length ? preferred : [weights[0] ?? 400];
}

/** 카탈로그 항목의 스타일시트/@font-face를 (한 번만) 등록한다. */
export function registerFont(font: FontDefinition): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  switch (font.source.kind) {
    case "google": return addStylesheet(`google:${font.id}`, googleUrl(font, font.source.weights));
    case "stylesheet": return addStylesheet(`stylesheet:${font.id}`, font.source.url);
    case "faces": return addFaces(font, font.source.faces);
  }
}

/**
 * 실제 콘텐츠에 쓰이는 글꼴을 로드한다. font stack 목록을 받아 카탈로그에 있으면 등록까지 처리한다.
 * 카탈로그에 없는 로컬 글꼴(Arial, PPT 가져오기 등)은 이전과 같이 document.fonts.load만 시도한다.
 */
export async function loadFonts(families: readonly string[], text: string, weights: readonly number[] = DEFAULT_FONT_WEIGHTS): Promise<void> {
  if (!text || typeof document === "undefined" || !document.fonts) return;
  const unique = [...new Set(families)];
  await Promise.all(unique.map((family) => {
    const font = fontForFamilyStack(family);
    return font ? registerFont(font) : Promise.resolve();
  }));
  await Promise.all(unique.flatMap((family) => weights.map((weight) =>
    document.fonts.load(`${weight} 32px ${family}`, text).catch(() => undefined))));
}

/** 드롭다운·양식 카드처럼 이름만 보여 주는 자리의 가벼운 로드. */
export function previewFont(font: FontDefinition, text: string): Promise<void> {
  if (!text || typeof document === "undefined" || !document.fonts) return Promise.resolve();
  if (font.source.kind === "google") {
    const weights = previewWeights(font.source.weights);
    return addStylesheet(`google-preview:${font.id}:${text}`, googleUrl(font, weights, text))
      .then(() => document.fonts.load(`${weights[0]} 32px ${font.family}`, text).catch(() => undefined))
      .then(() => undefined);
  }
  // 미리보기에는 굵기 하나만 있으면 되므로 전체 굵기를 받지 않는다.
  const files = font.source.kind === "faces" ? [font.source.faces.find((file) => file.weight === 400) ?? font.source.faces[0]!] : [];
  const register = font.source.kind === "faces" ? addFaces(font, files) : registerFont(font);
  return register
    .then(() => document.fonts.load(`400 32px ${font.family}`, text).catch(() => undefined))
    .then(() => undefined);
}

/** 캔버스 font stack 기준 미리보기 로드. 카탈로그에 없는 글꼴은 건너뛴다. */
export function previewFamilyStack(stack: string, text: string): Promise<void> {
  const font = fontForFamilyStack(stack);
  return font ? previewFont(font, text) : Promise.resolve();
}

/** 글꼴 로드가 끝날 때마다 호출된다(캔버스 측정 캐시 재계산용). */
export function onFontsLoaded(listener: () => void): () => void {
  if (typeof document === "undefined" || !document.fonts) return () => undefined;
  document.fonts.addEventListener("loadingdone", listener);
  return () => document.fonts.removeEventListener("loadingdone", listener);
}
