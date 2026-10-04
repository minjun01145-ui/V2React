import {
  MAX_SLIDE_CANVAS_BYTES,
  MAX_SLIDES,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type ActiveSlideEngine,
  type Slide,
  type SlideEngine,
  type SlideEngineRound,
  type SlideEngineSource,
  type SlideFrame,
  type SlideShowSessionState,
} from "./types.ts";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_FRAME_SIZE = 160;
const MAX_AWARD_TOTAL = 1_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function requiredText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maximum ? text : null;
}

function parseStringConfig(value: unknown): Readonly<Record<string, string>> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > 20 || entries.some(([key, item]) => !GAME_ID_PATTERN.test(key) || typeof item !== "string" || item.length > 200)) return null;
  return Object.freeze(Object.fromEntries(entries) as Record<string, string>);
}

export function isSlideId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

export function validateSlideShowName(value: string): string {
  const name = value.trim();
  if (name.length < 2 || name.length > 80) throw new Error("슬라이드쇼 이름은 2~80자로 입력해 주세요.");
  return name;
}

export function slideCanvasBytes(canvas: string): number {
  return new TextEncoder().encode(canvas).length;
}

export function validateSlideCanvas(canvas: string): string {
  if (slideCanvasBytes(canvas) > MAX_SLIDE_CANVAS_BYTES) throw new Error("슬라이드 용량이 너무 큽니다. 그림 수나 크기를 줄여 주세요.");
  try {
    if (!isRecord(JSON.parse(canvas))) throw new Error();
  } catch {
    throw new Error("슬라이드 내용 형식이 올바르지 않습니다.");
  }
  return canvas;
}

export function validateSlideFrame(frame: SlideFrame): SlideFrame {
  const values = [frame.x, frame.y, frame.width, frame.height];
  if (values.some((value) => !Number.isFinite(value))) throw new Error("문제 엔진 창 위치가 올바르지 않습니다.");
  const width = Math.round(Math.min(SLIDE_WIDTH, Math.max(MIN_FRAME_SIZE, frame.width)));
  const height = Math.round(Math.min(SLIDE_HEIGHT, Math.max(MIN_FRAME_SIZE, frame.height)));
  return {
    x: Math.round(Math.min(SLIDE_WIDTH - width, Math.max(0, frame.x))),
    y: Math.round(Math.min(SLIDE_HEIGHT - height, Math.max(0, frame.y))),
    width,
    height,
  };
}

export function validateSlideEngineRound(round: SlideEngineRound): SlideEngineRound {
  if (!GAME_ID_PATTERN.test(round.gameId)) throw new Error("문제 엔진 ID가 올바르지 않습니다.");
  if ((round.gameId === "free-response") !== (round.source.kind === "free-response")) throw new Error("자유 답변 엔진에는 자유 답변 질문이 필요합니다.");
  if (round.source.kind === "stored-set") {
    if (round.source.setId !== null && !ID_PATTERN.test(round.source.setId)) throw new Error("학습 세트 ID가 올바르지 않습니다.");
  } else if (round.source.kind === "free-response") {
    if (!requiredText(round.source.prompt, 1000)) throw new Error("자유 답변 질문은 1~1000자로 입력해 주세요.");
  } else {
    if (round.source.setType !== "vocabulary" && round.source.setType !== "reading-chunks") throw new Error("직접 출제 형식이 올바르지 않습니다.");
    if (round.source.items.length < 1 || round.source.items.length > 100) throw new Error("직접 출제 문항은 1~100개가 필요합니다.");
    for (const item of round.source.items) {
      if (!ID_PATTERN.test(item.id) || !item.sourceText.trim() || !item.meaning.trim() || item.sourceText.length > 500 || item.meaning.length > 500) throw new Error("직접 출제 문항을 확인해 주세요.");
      if (round.source.setType === "reading-chunks" && item.sourceText.split("/").filter((part) => part.trim()).length < 2) throw new Error("문장 만들기 문항은 문장 조각을 /로 2개 이상 나눠 주세요.");
    }
  }
  if (!Number.isInteger(round.durationSeconds) || round.durationSeconds < 10 || round.durationSeconds > 600) {
    throw new Error("문제 시간은 10~600초로 설정해 주세요.");
  }
  if (!parseStringConfig(round.gameConfig)) throw new Error("문제 엔진 설정이 올바르지 않습니다.");
  const source: SlideEngineSource = round.source.kind === "custom"
    ? { ...round.source, items: round.source.items.map((item) => ({ ...item, sourceText: item.sourceText.trim(), meaning: item.meaning.trim() })) }
    : round.source.kind === "free-response" ? { ...round.source, prompt: round.source.prompt.trim() } : { ...round.source };
  return { gameId: round.gameId, source, durationSeconds: round.durationSeconds, gameConfig: { ...round.gameConfig } };
}

export function validateSlide(slide: Slide): Slide {
  if (!ID_PATTERN.test(slide.id)) throw new Error("슬라이드 ID가 올바르지 않습니다.");
  return {
    id: slide.id,
    canvas: validateSlideCanvas(slide.canvas),
    engine: slide.engine ? { frame: validateSlideFrame(slide.engine.frame), round: validateSlideEngineRound(slide.engine.round) } : null,
  };
}

export function validateSlides(slides: readonly Slide[]): readonly Slide[] {
  if (slides.length < 1 || slides.length > MAX_SLIDES) throw new Error(`슬라이드는 1~${MAX_SLIDES}장이 필요합니다.`);
  const validated = slides.map(validateSlide);
  if (new Set(validated.map((slide) => slide.id)).size !== validated.length) throw new Error("슬라이드 ID가 중복되었습니다.");
  return validated;
}

function parseSource(value: unknown): SlideEngineSource | null {
  if (!isRecord(value)) return null;
  if (value.kind === "stored-set") {
    const setId = value.setId === null ? null : requiredText(value.setId, 128);
    return setId !== null || value.setId === null ? { kind: "stored-set", setId } : null;
  }
  if (value.kind === "free-response") {
    const prompt = requiredText(value.prompt, 1000);
    return prompt ? { kind: "free-response", prompt } : null;
  }
  if (value.kind !== "custom" || (value.setType !== "vocabulary" && value.setType !== "reading-chunks") || !Array.isArray(value.items)) return null;
  const items = value.items.map((item) => {
    if (!isRecord(item)) return null;
    const id = requiredText(item.id, 128);
    const sourceText = requiredText(item.sourceText, 500);
    const meaning = requiredText(item.meaning, 500);
    return id && sourceText && meaning ? { id, sourceText, meaning } : null;
  });
  if (items.some((item) => item === null)) return null;
  return { kind: "custom", setType: value.setType, items: items.filter((item): item is NonNullable<typeof item> => item !== null) };
}

function parseFrame(value: unknown): SlideFrame | null {
  if (!isRecord(value)) return null;
  const { x, y, width, height } = value;
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof height !== "number") return null;
  try {
    return validateSlideFrame({ x, y, width, height });
  } catch {
    return null;
  }
}

function parseEngineRound(value: unknown): SlideEngineRound | null {
  if (!isRecord(value)) return null;
  const gameId = requiredText(value.gameId, 80);
  const durationSeconds = finiteInteger(value.durationSeconds);
  const gameConfig = parseStringConfig(value.gameConfig);
  const source = parseSource(value.source);
  if (!gameId || !source || durationSeconds === null || !gameConfig) return null;
  try {
    return validateSlideEngineRound({ gameId, source, durationSeconds, gameConfig });
  } catch {
    return null;
  }
}

function parseEngine(value: unknown): SlideEngine | null {
  if (!isRecord(value)) return null;
  const frame = parseFrame(value.frame);
  const round = parseEngineRound(value.round);
  return frame && round ? { frame, round } : null;
}

/** Slide documents come from Firestore; anything malformed is skipped by the caller. */
export function parseSlide(id: string, value: unknown): Slide | null {
  if (!ID_PATTERN.test(id) || !isRecord(value) || typeof value.canvas !== "string") return null;
  if (value.engine !== null && value.engine !== undefined && !parseEngine(value.engine)) return null;
  try {
    return validateSlide({ id, canvas: value.canvas, engine: parseEngine(value.engine) });
  } catch {
    return null;
  }
}

function parseActiveEngine(value: unknown): ActiveSlideEngine | null {
  if (!isRecord(value)) return null;
  const engine = parseEngine(value);
  const slideId = requiredText(value.slideId, 128);
  const roundId = requiredText(value.roundId, 128);
  const phase = value.phase;
  if (!engine || !slideId || !ID_PATTERN.test(slideId) || !roundId || !ID_PATTERN.test(roundId)) return null;
  if (phase !== "answering" && phase !== "submissions" && phase !== "results") return null;
  return { slideId, roundId, phase, frame: engine.frame, round: engine.round };
}

function parseAwards(value: unknown): Readonly<Record<string, number>> | null {
  if (value === undefined) return {};
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.some(([playerId, points]) => !ID_PATTERN.test(playerId) || typeof points !== "number" || !Number.isInteger(points) || Math.abs(points) > MAX_AWARD_TOTAL)) return null;
  return Object.freeze(Object.fromEntries(entries) as Record<string, number>);
}

export function parseSlideShowSessionState(value: unknown): SlideShowSessionState | null {
  if (!isRecord(value)) return null;
  const runId = requiredText(value.runId, 128);
  const showId = requiredText(value.showId, 128);
  const name = requiredText(value.name, 80);
  const currentSlideIndex = finiteInteger(value.currentSlideIndex);
  const slideIds = Array.isArray(value.slideIds) && value.slideIds.every(isSlideId) ? value.slideIds as string[] : null;
  const scoredRoundIds = Array.isArray(value.scoredRoundIds) && value.scoredRoundIds.every(isSlideId) ? value.scoredRoundIds as string[] : null;
  const engine = value.engine === null ? null : parseActiveEngine(value.engine);
  const awards = parseAwards(value.awards);
  if (!runId || !ID_PATTERN.test(runId) || !showId || !ID_PATTERN.test(showId) || !name || !slideIds || slideIds.length < 1 || slideIds.length > MAX_SLIDES) return null;
  if (currentSlideIndex === null || currentSlideIndex < 0 || currentSlideIndex >= slideIds.length || !scoredRoundIds || !awards) return null;
  if (value.engine !== null && !engine) return null;
  return { runId, showId, name, slideIds, currentSlideIndex, engine, scoredRoundIds, awards };
}
