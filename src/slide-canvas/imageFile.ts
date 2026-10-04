import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../slide-show/types.ts";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const QUALITY = 0.82;

/**
 * Inserted pictures are embedded in the slide document, so they are downscaled to the
 * slide size and re-encoded before they ever reach Firestore.
 */
export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error("PNG, JPG, WEBP, GIF 그림만 넣을 수 있습니다.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("15MB 이하의 그림만 넣을 수 있습니다.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, SLIDE_WIDTH / bitmap.width, SLIDE_HEIGHT / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("그림을 처리하지 못했습니다.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL("image/webp", QUALITY);
    // Browsers without WebP encoding fall back to PNG; JPEG is far smaller for photos.
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", QUALITY);
  } finally {
    bitmap.close();
  }
}
