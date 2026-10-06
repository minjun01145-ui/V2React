import { useEffect, useRef } from "react";
import { imageFileToDataUrl } from "../../../slide-canvas/imageFile.ts";
import type { SlideEditorController } from "../../../slide-canvas/SlideEditorController.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";

/** A text field other than the slide's own text box (whose hidden textarea Fabric marks). */
function isOtherTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
    && target.getAttribute("data-fabric") !== "textarea";
}

/** Ctrl+V of a copied picture (e.g. "이미지 복사" in a browser) puts it on the slide, as in PowerPoint. */
export function useImagePaste(controller: SlideEditorController | null, onError: (message: string) => void): void {
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!controller) return undefined;
    const onPaste = (event: ClipboardEvent): void => {
      if (isOtherTextField(event.target)) return;
      const file = [...(event.clipboardData?.items ?? [])].find((item) => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
      if (!file) return;
      event.preventDefault();
      void imageFileToDataUrl(file)
        .then((dataUrl) => controller.addImage(dataUrl))
        .catch((cause: unknown) => onErrorRef.current(toErrorMessage(cause, "그림을 붙여넣지 못했습니다.")));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [controller]);
}
