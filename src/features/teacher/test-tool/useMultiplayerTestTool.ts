import { useCallback, useEffect, useRef, useState } from "react";
import {
  createMultiplayerTestSession,
  stopMultiplayerTestSession,
} from "../../../classroom-test-admin/repository.ts";
import type { MultiplayerTestSession } from "../../../classroom-test/types.ts";

export type MultiplayerTestPhase = "off" | "starting" | "running" | "stopping" | "error";

interface ToolState {
  readonly phase: MultiplayerTestPhase;
  readonly session: MultiplayerTestSession | null;
  readonly error: Error | null;
}

interface MultiplayerTestTool extends ToolState {
  readonly setEnabled: (enabled: boolean) => void;
}

const initialState: ToolState = { phase: "off", session: null, error: null };

export function useMultiplayerTestTool(): MultiplayerTestTool {
  const [state, setState] = useState<ToolState>(initialState);
  const operation = useRef(0);
  const sessionRef = useRef<MultiplayerTestSession | null>(null);

  const start = useCallback((): void => {
    const generation = ++operation.current;
    setState({ phase: "starting", session: null, error: null });
    void createMultiplayerTestSession()
      .then(async (session) => {
        if (operation.current !== generation) {
          await stopMultiplayerTestSession(session.runId).catch(() => undefined);
          return;
        }
        sessionRef.current = session;
        setState({ phase: "running", session, error: null });
      })
      .catch((reason: unknown) => {
        if (operation.current !== generation) return;
        const error = reason instanceof Error ? reason : new Error("멀티플레이 테스트 세션을 만들지 못했습니다.");
        setState({ phase: "error", session: null, error });
      });
  }, []);

  const stop = useCallback((): void => {
    const generation = ++operation.current;
    const current = sessionRef.current;
    if (!current) {
      setState(initialState);
      return;
    }
    setState({ phase: "stopping", session: current, error: null });
    void stopMultiplayerTestSession(current.runId)
      .then(() => {
        if (operation.current !== generation) return;
        sessionRef.current = null;
        setState(initialState);
      })
      .catch((reason: unknown) => {
        if (operation.current !== generation) return;
        const error = reason instanceof Error ? reason : new Error("멀티플레이 테스트 세션을 종료하지 못했습니다.");
        setState({ phase: "error", session: current, error });
      });
  }, []);

  useEffect(() => () => {
    operation.current += 1;
    const current = sessionRef.current;
    sessionRef.current = null;
    if (current) void stopMultiplayerTestSession(current.runId).catch(() => undefined);
  }, []);

  const setEnabled = useCallback((enabled: boolean): void => {
    if (enabled) start();
    else stop();
  }, [start, stop]);

  return { ...state, setEnabled };
}
