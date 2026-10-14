import type { Slide } from "../../slide-show/types.ts";

export type TemplateVariant = "cover" | "content";

/**
 * 양식 장식 도형. 모든 수치는 슬라이드 대비 퍼센트이며, 원의 지름·모서리 반경은 슬라이드 높이 기준이다.
 * 양식은 레퍼런스의 이미지·로고·글자를 복사하지 않고 도형·색·글꼴 데이터만으로 재현한다.
 */
export type TemplateDecoration =
  | { readonly kind: "rect"; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly color: string; readonly radius?: number; readonly opacity?: number }
  | { readonly kind: "circle"; readonly x: number; readonly y: number; readonly diameter: number; readonly color: string };

export interface TemplateText {
  readonly fontFamily: string;
  readonly color: string;
  readonly size: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly weight?: number;
  readonly align?: "left" | "center";
  readonly lineHeight?: number;
}

export interface TemplateLayout {
  readonly background: string;
  readonly decorations: readonly TemplateDecoration[];
  readonly title: TemplateText;
  readonly body: TemplateText;
}

export interface SlideTemplate {
  readonly id: string;
  readonly name: string;
  readonly cover: TemplateLayout;
  readonly content: TemplateLayout;
}

export type { Slide };
