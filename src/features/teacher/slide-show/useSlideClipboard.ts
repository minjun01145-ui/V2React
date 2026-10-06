import { useEffect, useRef } from "react";
import { imageFileToDataUrl } from "../../../slide-canvas/imageFile.ts";
import type { SlideEditorController } from "../../../slide-canvas/SlideEditorController.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";

/**
 * Marks the system clipboard as holding slide objects copied in this editor. Whatever was copied
 * last wins: copying a picture elsewhere replaces the mark, and copying an object replaces the picture.
 */
const SLIDE_OBJECTS_TYPE = "application/x-v2r-slide-objects";

/** A text field other than the slide's own text box (whose hidden textarea Fabric marks). */
function isOtherTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
    && target.getAttribute("data-fabric") !== "textarea";
}

/** Text typed into a slide text box keeps the browser's own copy and paste. */
function isEditingSlideText(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.getAttribute("data-fabric") === "textarea";
}

/**
 * Ctrl+C / Ctrl+V of slide objects (within and across slides), and Ctrl+V of a picture copied
 * elsewhere (e.g. "이미지 복사" in a browser), as in PowerPoint.
 */
export function useSlideClipboard(controller: SlideEditorController | null, onError: (message: string) => void): void {
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!controller) return undefined;
    const onCopy = (event: ClipboardEvent): void => {
      if (isOtherTextField(event.target) || isEditingSlideText(event.target) || !event.clipboardData) return;
      if (!controller.copySelection()) return;
      event.preventDefault();
      event.clipboardData.setData(SLIDE_OBJECTS_TYPE, "1");
    };
    const onPaste = (event: ClipboardEvent): void => {
      if (isOtherTextField(event.target)) return;
      const data = event.clipboardData;
      if (data?.types.includes(SLIDE_OBJECTS_TYPE) && !isEditingSlideText(event.target) && controller.hasCopied()) {
        event.preventDefault();
        void controller.pasteCopied().catch((cause: unknown) => onErrorRef.current(toErrorMessage(cause, "붙여넣지 못했습니다.")));
        return;
      }
      const file = [...(data?.items ?? [])].find((item) => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
      if (!file) return;
      event.preventDefault();
      void imageFileToDataUrl(file)
        .then((dataUrl) => controller.addImage(dataUrl))
        .catch((cause: unknown) => onErrorRef.current(toErrorMessage(cause, "그림을 붙여넣지 못했습니다.")));
    };
    window.addEventListener("copy", onCopy);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("paste", onPaste);
    };
  }, [controller]);
}
