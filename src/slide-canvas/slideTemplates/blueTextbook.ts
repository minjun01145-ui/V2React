import { fontStack } from "../../fonts/catalog.ts";
import type { SlideTemplate } from "./types.ts";

const PRETENDARD = fontStack("pretendard");

/** 레퍼런스 덱 1: 흰 바탕, 남색 테두리, 연한 파랑 머리띠와 왼쪽 레일. */
export const BLUE_TEXTBOOK: SlideTemplate = {
  id: "blue-textbook",
  name: "파랑 교재",
  cover: {
    background: "#1B4F88",
    decorations: [
      { kind: "rect", x: 5, y: 8, w: 90, h: 84, radius: 2.5, color: "#FFFFFF" },
      { kind: "rect", x: 7, y: 11, w: 86, h: 0.35, color: "#C7D9EA" },
      { kind: "circle", x: 5, y: 8, diameter: 9, color: "#94B6DA" },
      { kind: "circle", x: 95, y: 92, diameter: 14, color: "#94B6DA" },
      { kind: "rect", x: 0, y: 0, w: 100, h: 2.2, color: "#0E3A66" },
    ],
    title: { fontFamily: PRETENDARD, color: "#1B4F88", size: 9, weight: 700, align: "center", x: 12, y: 34, w: 76, h: 18 },
    body: { fontFamily: PRETENDARD, color: "#33475C", size: 4, align: "center", x: 14, y: 58, w: 72, h: 10 },
  },
  content: {
    background: "#FFFFFF",
    decorations: [
      { kind: "rect", x: 0, y: 0, w: 100, h: 20, color: "#EEF6FF" },
      { kind: "rect", x: 0, y: 20, w: 100, h: 0.5, color: "#1B4F88" },
      { kind: "rect", x: 1.4, y: 1.4, w: 97.2, h: 0.45, color: "#1B4F88" },
      { kind: "rect", x: 1.4, y: 98.15, w: 97.2, h: 0.45, color: "#1B4F88" },
      { kind: "rect", x: 1.4, y: 1.4, w: 0.25, h: 97.2, color: "#1B4F88" },
      { kind: "rect", x: 98.35, y: 1.4, w: 0.25, h: 97.2, color: "#1B4F88" },
      { kind: "rect", x: 86, y: 91, w: 11, h: 6, color: "#C7D9EA" },
    ],
    title: { fontFamily: PRETENDARD, color: "#1B4F88", size: 6.5, weight: 700, x: 6, y: 4.5, w: 88, h: 12 },
    body: { fontFamily: PRETENDARD, color: "#33475C", size: 3.6, x: 6, y: 25, w: 88, h: 66, lineHeight: 1.45 },
  },
};
