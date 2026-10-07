/** What the slide AI helper sees: the slide (1280x720) as a short list of objects with ids o1, o2 … in stacking order. */
export interface AssistantObject {
  readonly id: string;
  readonly kind: "text" | "shape" | "line" | "image";
  readonly z: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly text?: string;
  readonly fill?: string;
  readonly fontSize?: number;
  readonly bold?: boolean;
  readonly textAlign?: string;
  readonly background?: string;
}

export interface AssistantSlide {
  readonly background: string;
  readonly objects: readonly AssistantObject[];
}

export type TextAlign = "left" | "center" | "right";

/** Edits the AI asks for; the server validates them and the editor applies them. */
export type AssistantOperation =
  | { readonly op: "move"; readonly id: string; readonly left: number; readonly top: number }
  | { readonly op: "resize"; readonly id: string; readonly width: number; readonly height?: number }
  | { readonly op: "style"; readonly id: string; readonly fill?: string; readonly fontSize?: number; readonly bold?: boolean; readonly textAlign?: TextAlign; readonly background?: string | null; readonly opacity?: number }
  | { readonly op: "setText"; readonly id: string; readonly text: string }
  | { readonly op: "delete"; readonly id: string }
  | { readonly op: "addText"; readonly text: string; readonly left: number; readonly top: number; readonly width: number; readonly fontSize?: number; readonly fill?: string; readonly bold?: boolean; readonly textAlign?: TextAlign; readonly background?: string | null }
  | { readonly op: "addShape"; readonly shape: "rect" | "circle" | "triangle"; readonly left: number; readonly top: number; readonly width: number; readonly height: number; readonly fill?: string }
  | { readonly op: "addImage"; readonly query: string; readonly left?: number; readonly top?: number; readonly width?: number }
  | { readonly op: "background"; readonly color: string };

export interface AssistantReply {
  readonly message: string;
  readonly operations: readonly AssistantOperation[];
}
