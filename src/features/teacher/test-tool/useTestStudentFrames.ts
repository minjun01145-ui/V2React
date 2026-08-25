import { useCallback, useEffect, useRef, useState } from "react";
import {
  createTestStudentBootstrapMessage,
  parseTestStudentToParentMessage,
} from "../../../classroom-test/protocol.ts";
import type { MultiplayerTestSession, TestStudentClientState } from "../../../classroom-test/types.ts";

interface TestStudentFrames {
  readonly states: readonly TestStudentClientState[];
  readonly attachFrame: (slot: number, frame: HTMLIFrameElement | null) => void;
}

function initialStates(session: MultiplayerTestSession): TestStudentClientState[] {
  return session.students.map((student) => ({ slot: student.slot, status: "loading", message: "학생 앱을 불러오는 중입니다." }));
}

export function useTestStudentFrames(session: MultiplayerTestSession): TestStudentFrames {
  const [states, setStates] = useState<readonly TestStudentClientState[]>(() => initialStates(session));
  const frames = useRef(new Map<number, HTMLIFrameElement>());

  useEffect(() => {
    setStates(initialStates(session));
    const receiveStudentMessage = (event: MessageEvent<unknown>): void => {
      if (event.origin !== window.location.origin) return;
      const message = parseTestStudentToParentMessage(event.data);
      if (!message) return;
      const frame = frames.current.get(message.slot);
      if (!frame || event.source !== frame.contentWindow) return;

      if (message.type === "classroom-test/ready") {
        const student = session.students.find((item) => item.slot === message.slot);
        if (!student || !frame.contentWindow) return;
        setStates((current) => current.map((item) => item.slot === message.slot
          ? { ...item, status: "connecting", message: "임시 인증 정보를 전달했습니다." }
          : item));
        frame.contentWindow.postMessage(createTestStudentBootstrapMessage(session.runId, session.roomId, student), window.location.origin);
        return;
      }

      setStates((current) => current.map((item) => item.slot === message.slot
        ? { slot: message.slot, status: message.status, message: message.message }
        : item));
    };

    window.addEventListener("message", receiveStudentMessage);
    return () => window.removeEventListener("message", receiveStudentMessage);
  }, [session]);

  const attachFrame = useCallback((slot: number, frame: HTMLIFrameElement | null): void => {
    if (frame) frames.current.set(slot, frame);
    else frames.current.delete(slot);
  }, []);

  return { states, attachFrame };
}
