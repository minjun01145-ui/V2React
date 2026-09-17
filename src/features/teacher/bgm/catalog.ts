import { buildTeacherBgmCatalog } from "./model.ts";

// lobby1.mp3, lobby2.mp3, ... 또는 game1.mp3, game2.mp3, ... 파일을
// src/assets/bgm에 추가하면 별도 코드 수정 없이 다음 빌드부터 자동 포함됩니다.
const discoveredTracks = import.meta.glob<string>("/src/assets/bgm/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});

export const teacherBgmCatalog = buildTeacherBgmCatalog(discoveredTracks);
