// <key>.webp 파일을 src/assets/covers에 넣으면 별도 코드 수정 없이 그 이미지가 자동으로 표시됩니다.
const images = import.meta.glob<string>("/src/assets/covers/*.webp", { eager: true, query: "?url", import: "default" });

export interface CoverArt {
  readonly image: string | null;
  readonly emoji: string;
  readonly color: string;
}

const PLACEHOLDERS = {
  "typing-escape": { emoji: "🌺", color: "#e8456b" },
  "ai-tutor": { emoji: "🤖", color: "#6c4ee8" },
  "pokemon-catch": { emoji: "⚡", color: "#f2a900" },
  "sentence-builder": { emoji: "🧩", color: "#0a9bf0" },
  "cooperative-sentence-builder": { emoji: "💞", color: "#f0559b" },
  "one-on-one-battle": { emoji: "⚔️", color: "#ff5a36" },
  "word-uno": { emoji: "🃏", color: "#e23b3b" },
  "simple-quiz": { emoji: "❓", color: "#2f5bff" },
  "typing": { emoji: "⌨️", color: "#0fb3a3" },
  "acid-rain": { emoji: "☔", color: "#5cb82e" },
  "matching": { emoji: "🎴", color: "#ff9a1f" },
  "matching-all": { emoji: "🧠", color: "#f26b1d" },
  "meaning-dash": { emoji: "🏃", color: "#07b0d6" },
  "brick-smash": { emoji: "🧱", color: "#e0562a" },
  "chunk-line-up": { emoji: "🍄", color: "#8b4ff0" },
  "chunk-jump-race": { emoji: "🐸", color: "#12b07a" },
  "learning-jump-tower": { emoji: "🚀", color: "#3b6cf6" },
  "lobby-platformer": { emoji: "🦘", color: "#0e9be0" },
  "solo": { emoji: "🎧", color: "#a24ff0" },
  "drawing": { emoji: "🎨", color: "#7954d8" },
} as const satisfies Record<string, { readonly emoji: string; readonly color: string }>;

export type CoverKey = keyof typeof PLACEHOLDERS;

export function isCoverKey(value: string): value is CoverKey {
  return Object.hasOwn(PLACEHOLDERS, value);
}

export function coverArt(key: CoverKey): CoverArt {
  return { image: images[`/src/assets/covers/${key}.webp`] ?? null, ...PLACEHOLDERS[key] };
}
