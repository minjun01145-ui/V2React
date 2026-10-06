import { useEffect, useRef } from "react";
import { useSessionSubscription } from "../../../multiplayer/hooks.ts";
import { subscribeSlideShowSession } from "../../../slide-show/multiplayerService.ts";
import { teacherBgmCatalog } from "./catalog.ts";
import { pickRandomTrack, teacherBgmMode, type TeacherBgmMode } from "./model.ts";

const TEACHER_BGM_VOLUME = 0.22;

function useTeacherBgmPlayer(mode: TeacherBgmMode | null): void {
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

    const source = mode ? pickRandomTrack(teacherBgmCatalog[mode]) : null;
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
  // The slide show state rides on the session document, so one subscription gives both.
  const { value } = useSessionSubscription(roomId, subscribeSlideShowSession);
  useTeacherBgmPlayer(teacherBgmMode(value?.session.status ?? null, value?.slideShow ?? null));
  return null;
}
