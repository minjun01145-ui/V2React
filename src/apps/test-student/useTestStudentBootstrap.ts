import { signInWithCustomToken, signOut } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentIdentity } from "../../auth/types.ts";
import {
  createTestStudentStatusMessage,
  parseTestStudentBootstrapMessage,
} from "../../classroom-test/protocol.ts";
import { auth } from "../../firebase/firebaseClient.ts";

interface BootstrapState {
  readonly roomId: string;
  readonly identity: StudentIdentity;
}

interface BootstrapResult {
  readonly value: BootstrapState | null;
  readonly error: Error | null;
  readonly ended: boolean;
  readonly leave: () => Promise<void>;
}

function getSlot(): number {
  const raw = new URLSearchParams(window.location.search).get("slot") ?? "";
  const slot = Number(raw);
  return Number.isInteger(slot) && slot >= 1 && slot <= 3 ? slot : 0;
}

function postStatus(slot: number, status: "connecting" | "connected" | "error" | "left", message: string): void {
  window.parent.postMessage(createTestStudentStatusMessage(slot, status, message), window.location.origin);
}

export function useTestStudentBootstrap(): BootstrapResult {
  const slot = getSlot();
  const [value, setValue] = useState<BootstrapState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [ended, setEnded] = useState(false);
  const activeToken = useRef("");

  useEffect(() => {
    if (!slot || window.parent === window) {
      setError(new Error("테스트 학생 화면은 교사용 테스트 툴에서만 실행할 수 있습니다."));
      return undefined;
    }

    const receiveBootstrap = (event: MessageEvent<unknown>): void => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const message = parseTestStudentBootstrapMessage(event.data);
      if (!message || message.student.slot !== slot || activeToken.current === message.student.customToken) return;
      activeToken.current = message.student.customToken;
      setError(null);
      setEnded(false);
      postStatus(slot, "connecting", "임시 학생 계정으로 접속 중입니다.");
      void signInWithCustomToken(auth, message.student.customToken)
        .then((credential) => {
          if (credential.user.uid !== message.student.uid) throw new Error("테스트 학생 인증 정보가 일치하지 않습니다.");
          setValue({
            roomId: message.roomId,
            identity: {
              uid: message.student.uid,
              studentNumber: message.student.studentNumber,
              displayName: message.student.displayName,
            },
          });
          postStatus(slot, "connected", "실제 멀티플레이 세션에 연결되었습니다.");
        })
        .catch((reason: unknown) => {
          const nextError = reason instanceof Error ? reason : new Error("테스트 학생 인증에 실패했습니다.");
          activeToken.current = "";
          setError(nextError);
          postStatus(slot, "error", nextError.message);
        });
    };

    window.addEventListener("message", receiveBootstrap);
    window.parent.postMessage({ type: "classroom-test/ready", slot }, window.location.origin);
    return () => window.removeEventListener("message", receiveBootstrap);
  }, [slot]);

  const leave = useCallback(async (): Promise<void> => {
    await signOut(auth);
    setValue(null);
    setEnded(true);
    postStatus(slot, "left", "학생이 대기실에서 나갔습니다.");
  }, [slot]);

  return { value, error, ended, leave };
}
