import { fontStack } from "../../fonts/catalog.ts";
import type { SlideTemplate } from "./types.ts";

const PRETENDARD = fontStack("pretendard");
const JUA = fontStack("jua");

/** 따뜻한 크림 카드와 형광펜 포인트. 콘텐츠가 카드 안에서 슬라이드 대부분을 차지한다. */
export const WARM_NOTE: SlideTemplate = {
  id: "warm-note",
  name: "따뜻한 노트",
  content: {
    background: "#F4A259",
    decorations: [
      { kind: "rect", x: 3, y: 5, w: 94, h: 90, radius: 3, color: "#FFF8EC" },
      // 제목 아래쪽 절반을 덮는 형광펜. 장식이 먼저 그려지므로 글자 뒤에 깔린다.
      { kind: "rect", x: 8, y: 14, w: 42, h: 4, radius: 2, color: "#FFD43B", opacity: 0.55 },
      { kind: "circle", x: 95, y: 7, diameter: 9, color: "#FFD43B" },
      { kind: "circle", x: 4, y: 94, diameter: 7, color: "#E8833A" },
      { kind: "rect", x: 8, y: 92.4, w: 22, h: 0.5, color: "#F4A259" },
    ],
    title: { fontFamily: JUA, color: "#5C3D2E", size: 6.5, x: 8, y: 10, w: 84, h: 12 },
    body: { fontFamily: PRETENDARD, color: "#4A3B32", size: 3.6, x: 8, y: 26, w: 84, h: 62, lineHeight: 1.45 },
  },
  cover: {
    background: "#F4A259",
    decorations: [
      { kind: "rect", x: 5, y: 8, w: 90, h: 84, radius: 2.5, color: "#FFF8EC" },
      { kind: "circle", x: 11, y: 16, diameter: 7, color: "#FFD43B" },
      { kind: "circle", x: 89, y: 84, diameter: 9, color: "#E8833A" },
      { kind: "rect", x: 36, y: 56, w: 28, h: 0.6, color: "#F0C39A" },
    ],
    title: { fontFamily: JUA, color: "#5C3D2E", size: 8.5, align: "center", x: 12, y: 31, w: 76, h: 18 },
    body: { fontFamily: PRETENDARD, color: "#8A5A44", size: 3.8, align: "center", x: 14, y: 62, w: 72, h: 10 },
  },
};
