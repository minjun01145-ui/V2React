import { fontStack } from "../../fonts/catalog.ts";
import type { SlideTemplate } from "./types.ts";

const JUA = fontStack("jua");
const PRETENDARD = fontStack("pretendard");

/** 레퍼런스 덱 4: 격자 노트 위 노란 라운드 카드, 초록 강조 상자. */
export const YELLOW_GRID: SlideTemplate = {
  id: "yellow-grid",
  name: "노랑 격자",
  cover: {
    background: "#FFEBA2",
    decorations: [
      { kind: "rect", x: 5, y: 5, w: 90, h: 90, radius: 20, color: "#FEFAE2" },
      { kind: "circle", x: 93, y: 95, diameter: 9, color: "#3B3826" },
      { kind: "circle", x: 14, y: 10, diameter: 5, color: "#FFD43B" },
      { kind: "rect", x: 60, y: 88, w: 26, h: 2, color: "#FFEBA2" },
    ],
    title: { fontFamily: JUA, color: "#3B3826", size: 8.5, align: "center", x: 12, y: 34, w: 76, h: 18 },
    body: { fontFamily: PRETENDARD, color: "#4A4438", size: 4, align: "center", x: 16, y: 58, w: 68, h: 10 },
  },
  content: {
    background: "#FEFAE2",
    decorations: [
      { kind: "rect", x: 0, y: 0, w: 100, h: 1.2, color: "#FFEBA2" },
      { kind: "rect", x: 0, y: 14, w: 100, h: 0.5, color: "#FFEBA2" },
      { kind: "rect", x: 0, y: 97, w: 100, h: 3, color: "#FFEBA2" },
      { kind: "rect", x: 0, y: 0, w: 2.5, h: 100, color: "#FFEBA2" },
      { kind: "rect", x: 97.5, y: 0, w: 2.5, h: 100, color: "#FFEBA2" },
      // 제목 글자 아래쪽 절반을 덮는 형광펜. 장식이 먼저 그려지므로 글자 뒤에 깔린다.
      { kind: "rect", x: 6, y: 25, w: 40, h: 4, radius: 2, color: "#FFD43B", opacity: 0.5 },
      // 본문 상자(x6~94, y34~94) 밖 모서리 장식.
      { kind: "rect", x: 94.5, y: 92, w: 4.5, h: 4, radius: 2, color: "#E6F1D5" },
    ],
    title: { fontFamily: JUA, color: "#3B3826", size: 7, x: 6, y: 18, w: 88, h: 13 },
    body: { fontFamily: PRETENDARD, color: "#4A4438", size: 3.6, x: 6, y: 34, w: 88, h: 60, lineHeight: 1.5 },
  },
};

/** 레퍼런스 덱 5: 아이보리 바탕, 위아래 분홍 띠, 올리브색 제목. */
export const CALM_GREEN: SlideTemplate = {
  id: "calm-green",
  name: "차분한 띠",
  cover: {
    background: "#FEFFF8",
    decorations: [
      { kind: "rect", x: 0, y: 0, w: 100, h: 8, color: "#FAF0F0" },
      { kind: "rect", x: 0, y: 92, w: 100, h: 8, color: "#FAF0F0" },
      { kind: "rect", x: 0, y: 7.4, w: 100, h: 0.4, color: "#E0D1CC" },
      { kind: "rect", x: 0, y: 92.2, w: 100, h: 0.4, color: "#E0D1CC" },
      { kind: "circle", x: 8, y: 50, diameter: 6, color: "#C8D0D5" },
      { kind: "circle", x: 92, y: 50, diameter: 6, color: "#C8D0D5" },
    ],
    title: { fontFamily: PRETENDARD, color: "#656D41", size: 8.5, weight: 700, align: "center", x: 12, y: 33, w: 76, h: 18 },
    body: { fontFamily: PRETENDARD, color: "#4A4F3A", size: 4, align: "center", x: 16, y: 58, w: 68, h: 10 },
  },
  content: {
    background: "#FEFFF8",
    decorations: [
      { kind: "rect", x: 0, y: 0, w: 100, h: 6, color: "#FAF0F0" },
      { kind: "rect", x: 0, y: 94, w: 100, h: 6, color: "#FAF0F0" },
      { kind: "rect", x: 6, y: 4, w: 10, h: 0.6, color: "#656D41" },
      { kind: "rect", x: 84, y: 4, w: 10, h: 0.6, color: "#B6B3B0" },
      { kind: "rect", x: 6, y: 95.4, w: 88, h: 0.4, color: "#E0D1CC" },
    ],
    title: { fontFamily: PRETENDARD, color: "#656D41", size: 6.5, weight: 700, x: 6, y: 10, w: 88, h: 12 },
    body: { fontFamily: PRETENDARD, color: "#4A4F3A", size: 3.6, x: 6, y: 27, w: 88, h: 65, lineHeight: 1.6 },
  },
};
