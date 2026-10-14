import { fontStack } from "../../fonts/catalog.ts";
import type { SlideTemplate } from "./types.ts";

const PRETENDARD = fontStack("pretendard");

/** 레퍼런스 덱 2: 회색 바탕 위 흰 카드, 파랑 강조 제목과 검정 부제. */
export const CLEAN_TITLE: SlideTemplate = {
  id: "clean-title",
  name: "맑은 제목",
  cover: {
    background: "#DCDCDC",
    decorations: [
      { kind: "rect", x: 4, y: 6, w: 92, h: 88, color: "#FFFFFF" },
      { kind: "rect", x: 4, y: 6, w: 92, h: 0.8, color: "#EAF3FF" },
      { kind: "rect", x: 4, y: 93.2, w: 92, h: 0.8, color: "#EAF3FF" },
      { kind: "rect", x: 46, y: 60, w: 8, h: 0.5, color: "#0044AA" },
      { kind: "circle", x: 4, y: 6, diameter: 7, color: "#EAF3FF" },
    ],
    title: { fontFamily: PRETENDARD, color: "#0044AA", size: 8, weight: 800, align: "center", x: 12, y: 30, w: 76, h: 18 },
    body: { fontFamily: PRETENDARD, color: "#333333", size: 4, align: "center", x: 14, y: 66, w: 72, h: 10 },
  },
  content: {
    background: "#EAF3FF",
    decorations: [
      { kind: "rect", x: 0, y: 0, w: 100, h: 16, color: "#FFFFFF" },
      { kind: "rect", x: 0, y: 16, w: 100, h: 0.5, color: "#0044AA" },
      { kind: "rect", x: 5, y: 22, w: 90, h: 70, color: "#FFFFFF" },
      { kind: "rect", x: 6.6, y: 23.6, w: 86.8, h: 0.4, color: "#0044AA" },
      { kind: "rect", x: 6.6, y: 89.6, w: 86.8, h: 0.4, color: "#0044AA" },
      { kind: "rect", x: 6.6, y: 23.6, w: 0.22, h: 66.4, color: "#0044AA" },
      { kind: "rect", x: 93.2, y: 23.6, w: 0.22, h: 66.4, color: "#0044AA" },
    ],
    title: { fontFamily: PRETENDARD, color: "#0044AA", size: 6.5, weight: 700, x: 10, y: 4, w: 80, h: 11 },
    body: { fontFamily: PRETENDARD, color: "#333333", size: 3.6, x: 10, y: 27, w: 80, h: 62, lineHeight: 1.5 },
  },
};

/** 레퍼런스 덱 2의 여백 많은 마무리 페이지: 흰 바탕, 파랑 제목, 최소 장식. */
export const QUIET_NOTE: SlideTemplate = {
  id: "quiet-note",
  name: "여백 노트",
  cover: {
    background: "#FFFFFF",
    decorations: [
      { kind: "rect", x: 0, y: 0, w: 100, h: 2, color: "#0044AA" },
      { kind: "circle", x: 92, y: 14, diameter: 9, color: "#EAF3FF" },
      { kind: "circle", x: 8, y: 88, diameter: 12, color: "#EAF3FF" },
    ],
    title: { fontFamily: PRETENDARD, color: "#0044AA", size: 9, weight: 800, align: "center", x: 10, y: 24, w: 80, h: 20 },
    body: { fontFamily: PRETENDARD, color: "#333333", size: 4, align: "center", x: 14, y: 58, w: 72, h: 10 },
  },
  content: {
    background: "#FFFFFF",
    decorations: [
      { kind: "rect", x: 0, y: 0, w: 100, h: 1.4, color: "#0044AA" },
      { kind: "rect", x: 6, y: 9, w: 7, h: 0.7, color: "#0044AA" },
      { kind: "rect", x: 6, y: 96, w: 4, h: 0.4, color: "#C7D9EA" },
      { kind: "circle", x: 94, y: 94, diameter: 8, color: "#EAF3FF" },
    ],
    title: { fontFamily: PRETENDARD, color: "#0044AA", size: 6.5, weight: 700, x: 6, y: 15, w: 88, h: 12 },
    body: { fontFamily: PRETENDARD, color: "#333333", size: 3.6, x: 6, y: 32, w: 88, h: 62, lineHeight: 1.55 },
  },
};
