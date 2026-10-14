import { fontStack } from "../../fonts/catalog.ts";
import type { SlideTemplate } from "./types.ts";

const PRETENDARD = fontStack("pretendard");

/** 기본 양식: 남색 배경/포인트의 단정한 강의용 레이아웃. */
export const CLASSIC_BLUE: SlideTemplate = {
  id: "classic-blue",
  name: "클래식 블루",
  content: {
    background: "#F7F8FC",
    decorations: [
      { kind: "rect", x: 0, y: 0, w: 1.6, h: 100, color: "#3B5BDB" },
      { kind: "rect", x: 7, y: 21, w: 10, h: 0.8, color: "#3B5BDB" },
      { kind: "rect", x: 92, y: 92, w: 4, h: 0.8, color: "#BAC8FF" },
    ],
    title: { fontFamily: PRETENDARD, color: "#1F2A44", size: 6.5, weight: 700, x: 7, y: 8, w: 86, h: 12 },
    body: { fontFamily: PRETENDARD, color: "#343A40", size: 3.6, x: 7, y: 27, w: 86, h: 60, lineHeight: 1.4 },
  },
  cover: {
    background: "#3B5BDB",
    decorations: [
      { kind: "circle", x: 88, y: 85, diameter: 45, color: "#4C6EF5" },
      { kind: "circle", x: 8, y: 10, diameter: 18, color: "#364FC7" },
      { kind: "rect", x: 40, y: 58, w: 20, h: 0.8, color: "#FFFFFF" },
    ],
    title: { fontFamily: PRETENDARD, color: "#FFFFFF", size: 9, weight: 700, align: "center", x: 10, y: 36, w: 80, h: 18 },
    body: { fontFamily: PRETENDARD, color: "#E7EEFF", size: 4, align: "center", x: 15, y: 63, w: 70, h: 10 },
  },
};
