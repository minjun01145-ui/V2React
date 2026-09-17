import { useEffect, useRef } from "react";
import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import { useSession } from "../../../multiplayer/hooks.ts";
import { teacherBgmCatalog } from "./catalog.ts";
import { pickRandomTrack, type TeacherBgmMode } from "./model.ts";

const TEACHER_BGM_VOLUME = 0.22;

function useTeacherBgmPlayer(mode: TeacherBgmMode): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = TEACHER_BGM_VOLUME;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const source = pickRandomTrack(teacherBgmCatalog[mode]);
    if (!source) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return undefined;
    }

    audio.src = source;
    const tryPlay = (): void => {
      void audio.play().catch(() => {
        // 브라우저 자동 재생 제한 시 아래 사용자 입력 리스너가 다시 시도합니다.
      });
    };

    tryPlay();
    window.addEventListener("pointerdown", tryPlay, { once: true });
    window.addEventListener("keydown", tryPlay, { once: true });

    return () => {
      window.removeEventListener("pointerdown", tryPlay);
      window.removeEventListener("keydown", tryPlay);
      audio.pause();
    };
  }, [mode]);
}

export default function TeacherBgm({ roomId }: { readonly roomId: string }) {
  const { session } = useSession(roomId);
  const mode: TeacherBgmMode = session?.status === SESSION_STATUS.PLAYING ? "game" : "lobby";
  useTeacherBgmPlayer(mode);
  return null;
}
