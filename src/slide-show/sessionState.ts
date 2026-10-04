import type { Slide, SlideEnginePhase, SlideShow, SlideShowSessionState } from "./types.ts";

const nextPhase: Readonly<Record<SlideEnginePhase, SlideEnginePhase | null>> = Object.freeze({
  answering: "submissions",
  submissions: "results",
  results: null,
});

export const MAX_AWARD_POINTS = 1_000;

export function createSlideShowSessionState(show: SlideShow, runId: string): SlideShowSessionState {
  if (show.slides.length === 0) throw new Error("재생할 슬라이드가 없습니다.");
  return {
    runId,
    showId: show.id,
    name: show.name,
    slideIds: show.slides.map((slide) => slide.id),
    currentSlideIndex: 0,
    engine: null,
    scoredRoundIds: [],
    awards: {},
  };
}

export function goToSlide(state: SlideShowSessionState, index: number): SlideShowSessionState {
  if (state.engine) throw new Error("문제를 마친 뒤 슬라이드를 넘겨 주세요.");
  if (!Number.isInteger(index) || index < 0 || index >= state.slideIds.length) throw new Error("이동할 슬라이드가 없습니다.");
  return { ...state, currentSlideIndex: index };
}

export function startSlideEngine(state: SlideShowSessionState, slide: Slide, roundId: string): SlideShowSessionState {
  if (state.engine) throw new Error("이미 진행 중인 문제가 있습니다.");
  if (state.slideIds[state.currentSlideIndex] !== slide.id) throw new Error("현재 슬라이드의 문제만 시작할 수 있습니다.");
  if (!slide.engine) throw new Error("이 슬라이드에는 문제 엔진이 없습니다.");
  return {
    ...state,
    engine: { slideId: slide.id, roundId, phase: "answering", frame: slide.engine.frame, round: slide.engine.round },
    scoredRoundIds: [...state.scoredRoundIds, roundId],
  };
}

export function advanceSlideEnginePhase(state: SlideShowSessionState, phase: SlideEnginePhase): SlideShowSessionState {
  if (!state.engine) throw new Error("진행 중인 문제가 없습니다.");
  if (nextPhase[state.engine.phase] !== phase) throw new Error(`허용되지 않은 문제 단계 전환입니다: ${state.engine.phase} → ${phase}`);
  return { ...state, engine: { ...state.engine, phase } };
}

/** Returning to the slide is allowed at any phase so a teacher can abandon a question. */
export function closeSlideEngine(state: SlideShowSessionState): SlideShowSessionState {
  if (!state.engine) throw new Error("진행 중인 문제가 없습니다.");
  return { ...state, engine: null };
}

export function awardShowPoints(state: SlideShowSessionState, playerIds: readonly string[], points: number): SlideShowSessionState {
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > MAX_AWARD_POINTS) throw new Error("부여할 점수가 올바르지 않습니다.");
  if (playerIds.length === 0) throw new Error("점수를 줄 학생을 선택해 주세요.");
  const awards = { ...state.awards };
  for (const playerId of new Set(playerIds)) awards[playerId] = (awards[playerId] ?? 0) + points;
  return { ...state, awards };
}
