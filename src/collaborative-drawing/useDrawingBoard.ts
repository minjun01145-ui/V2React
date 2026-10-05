import { useEffect, useRef, useState } from "react";
import { availableSlot, authorHue, DRAWING_BATCH_MS, MAX_PENDING_STROKES, packPoints, simplifyStroke, sortStrokes, strokeId, unpackPoints, type DrawingAuthor, type DrawingPoint, type DrawingScope, type DrawingStroke } from "./model.ts";
import { connectDrawingBoard } from "./repository.ts";

interface BoardState {
  readonly strokes: readonly DrawingStroke[];
  readonly generation: number;
  readonly ready: boolean;
  readonly connected: boolean;
  readonly pendingCount: number;
  readonly error: string | null;
  readonly canRetry: boolean;
}

const initialState: BoardState = { strokes: [], generation: 0, ready: false, connected: false, pendingCount: 0, error: null, canRetry: false };

export function useDrawingBoard(scope: DrawingScope, author: DrawingAuthor | null) {
  const [state, setState] = useState<BoardState>(initialState);
  const authorRef = useRef(author);
  authorRef.current = author;
  const actions = useRef<{
    add(points: readonly DrawingPoint[], width: number, color: number | null): boolean;
    flush(): Promise<boolean>;
    erase(ids: readonly string[]): Promise<void>;
  } | null>(null);

  useEffect(() => {
    let closed = false;
    let disposing = false;
    let generation = 0;
    let ready = false;
    let connected = false;
    let error: string | null = null;
    let canRetry = false;
    let frame = 0;
    let lastCommitAt = 0;
    let sending: Promise<boolean> | null = null;
    const stored = new Map<string, DrawingStroke>();
    const pending = new Map<string, DrawingStroke>();
    const visible = () => {
      const merged = new Map([...stored].filter(([, stroke]) => stroke.generation === generation));
      for (const [id, stroke] of pending) merged.set(id, stroke);
      return sortStrokes([...merged.values()]);
    };
    const notify = () => {
      if (closed || disposing || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!closed && !disposing) setState({ strokes: visible(), generation, ready, connected, pendingCount: pending.size, error, canRetry });
      });
    };
    setState(initialState);
    const connection = connectDrawingBoard(scope, {
      onStroke(stroke) { stored.set(stroke.id, stroke); notify(); },
      onRemove(id) { stored.delete(id); notify(); },
      onGeneration(next) {
        if (next !== generation) {
          generation = next;
          pending.clear();
          error = null;
          canRetry = false;
        }
        notify();
      },
      onReady() { ready = true; notify(); },
      onConnected(next) { connected = next; notify(); },
      onError(reason) { error = reason.message; ready = false; canRetry = false; notify(); },
    });

    const flush = (): Promise<boolean> => {
      if (sending) return sending;
      if (!pending.size) return Promise.resolve(true);
      if (!connected || !ready) return Promise.resolve(false);
      const batch = [...pending.values()];
      const batchGeneration = generation;
      const waitMs = Math.max(0, DRAWING_BATCH_MS - (Date.now() - lastCommitAt));
      error = null;
      canRetry = false;
      sending = (async () => {
        try {
          if (waitMs) await new Promise((resolve) => window.setTimeout(resolve, waitMs));
          if (closed || batchGeneration !== generation) return false;
          lastCommitAt = Date.now();
          await connection.commit(batch, batch[0]!.authorId);
          for (const stroke of batch) if (pending.get(stroke.id) === stroke) pending.delete(stroke.id);
          return true;
        } catch {
          if (batchGeneration === generation && !closed) {
            // The SDK rolls back rejected optimistic events. Keep our bounded local
            // batch visible and let the student explicitly retry it.
            error = "그림을 저장하지 못했습니다. 연결과 그림판 권한을 확인해 주세요.";
            canRetry = true;
          }
          return false;
        } finally {
          sending = null;
          notify();
        }
      })();
      notify();
      return sending;
    };

    actions.current = {
      add(points, width, color) {
        const currentAuthor = authorRef.current;
        if (!currentAuthor || !ready || !connected || error || pending.size >= MAX_PENDING_STROKES) return false;
        const slot = availableSlot(visible(), currentAuthor.id);
        if (slot === null) return false;
        // Render exactly the quantized geometry that every other client receives.
        const compact = unpackPoints(packPoints(simplifyStroke(points)))!;
        const stroke: DrawingStroke = {
          id: strokeId(currentAuthor.id, slot), authorId: currentAuthor.id, slot,
          label: currentAuthor.label.trim().slice(0, 40) || "학생", hue: authorHue(currentAuthor.id),
          color, width, points: compact, generation, createdAt: Date.now(),
        };
        pending.set(stroke.id, stroke);
        notify();
        return true;
      },
      flush,
      async erase(ids) {
        // Wait for just-drawn strokes to save so they can be erased right away.
        if (pending.size || sending) await flush();
        if (pending.size || sending) await flush();
        if (!connected || !ready || pending.size || sending) throw new Error("그림 저장이 끝난 후 다시 시도해 주세요.");
        await connection.erase(ids, generation, authorRef.current!.id);
        lastCommitAt = Date.now();
      },
    };
    const timer = window.setInterval(() => { if (!error) void flush(); }, DRAWING_BATCH_MS);
    return () => {
      disposing = true;
      actions.current = null;
      window.clearInterval(timer);
      window.cancelAnimationFrame(frame);
      const close = () => { closed = true; connection.close(); };
      if (!connected || error) { close(); return; }
      // A game can replace the lobby without pressing Exit. Drain the last local
      // batch too, and bound how long an unmounted board keeps its listeners.
      const deadline = window.setTimeout(close, 5000);
      void flush().then(() => pending.size && !error ? flush() : true).finally(() => {
        window.clearTimeout(deadline);
        close();
      });
    };
  }, [scope.roomId, scope.boardId]);

  return {
    ...state,
    addStroke: (points: readonly DrawingPoint[], width: number, color: number | null) => actions.current?.add(points, width, color) ?? false,
    flush: () => actions.current?.flush() ?? Promise.resolve(false),
    erase: (ids: readonly string[]) => actions.current?.erase(ids) ?? Promise.reject(new Error("그림판 연결을 기다려 주세요.")),
  };
}
