import { getDatabase, onChildAdded, onChildChanged, onChildRemoved, onValue, ref, serverTimestamp, update, type DataSnapshot, type Unsubscribe } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { firebaseApp, functions } from "../firebase/firebaseClient.ts";
import { currentTenantConfig } from "../tenant/config.ts";
import { livePathSegment } from "../live-world/paths.ts";
import { packPoints, parseStroke, type DrawingScope, type DrawingStroke } from "./model.ts";

interface DrawingHandlers {
  readonly onStroke: (stroke: DrawingStroke) => void;
  readonly onRemove: (id: string) => void;
  readonly onGeneration: (generation: number) => void;
  readonly onReady: () => void;
  readonly onConnected: (connected: boolean) => void;
  readonly onError: (error: Error) => void;
}

export interface DrawingConnection {
  commit(strokes: readonly DrawingStroke[], authorId: string): Promise<void>;
  erase(ids: readonly string[], generation: number, authorId: string): Promise<void>;
  close(): void;
}

export function connectDrawingBoard(scope: DrawingScope, handlers: DrawingHandlers): DrawingConnection {
  const database = getDatabase(firebaseApp);
  const path = `drawingBoards/v1/${currentTenantConfig().id}/${livePathSegment(scope.roomId, "roomId")}/${livePathSegment(scope.boardId, "boardId")}`;
  const board = ref(database, path);
  const strokes = ref(database, `${path}/strokes`);
  let closed = false;
  let generationReady = false;
  let strokesReady = false;
  const ready = () => { if (!closed && generationReady && strokesReady) handlers.onReady(); };
  const fail = (error: Error) => { if (!closed) handlers.onError(error); };
  const receive = (snapshot: DataSnapshot) => {
    if (closed || !snapshot.key) return;
    const stroke = parseStroke(snapshot.key, snapshot.val());
    if (stroke) handlers.onStroke(stroke);
    else fail(new Error("그림 데이터가 올바르지 않습니다."));
  };
  const subscriptions: Unsubscribe[] = [];
  void httpsCallable(functions, "joinDrawingBoard")(scope).then(() => {
    if (closed) return;
    subscriptions.push(
      onValue(ref(database, `${path}/generation`), (snapshot) => {
        const value: unknown = snapshot.val();
        if (value === null) handlers.onGeneration(0);
        else if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) handlers.onGeneration(value);
        else { fail(new Error("그림판 상태가 올바르지 않습니다.")); return; }
        generationReady = true;
        ready();
      }, fail),
      onValue(ref(database, ".info/connected"), (snapshot) => handlers.onConnected(snapshot.val() === true), fail),
      onChildAdded(strokes, receive, fail),
      onChildChanged(strokes, receive, fail),
      onChildRemoved(strokes, (snapshot) => { if (!closed && snapshot.key) handlers.onRemove(snapshot.key); }, fail),
      // Shares the cached query with child listeners; used for initial readiness.
      onValue(strokes, () => { strokesReady = true; ready(); }, fail, { onlyOnce: true }),
    );
  }).catch((reason: unknown) => fail(reason instanceof Error ? reason : new Error("그림판에 접속하지 못했습니다.")));
  return {
    async commit(batch, authorId) {
      if (closed) throw new Error("그림판이 닫혔습니다.");
      const changes: Record<string, unknown> = { [`writers/${livePathSegment(authorId, "authorId")}`]: { t: serverTimestamp(), g: batch[0]!.generation } };
      for (const stroke of batch) changes[`strokes/${stroke.id}`] = {
        by: stroke.authorId, s: stroke.slot, l: stroke.label, c: stroke.hue, w: stroke.width,
        p: packPoints(stroke.points), g: stroke.generation, t: serverTimestamp(),
      };
      await update(board, changes);
    },
    async erase(ids, generation, authorId) {
      if (closed) throw new Error("그림판이 닫혔습니다.");
      await update(board, { ...Object.fromEntries(ids.map((id) => [`strokes/${id}`, null])),
        [`writers/${livePathSegment(authorId, "authorId")}`]: { t: serverTimestamp(), g: generation } });
    },
    close() { closed = true; subscriptions.forEach((unsubscribe) => unsubscribe()); },
  };
}

export async function clearDrawingBoard(scope: DrawingScope): Promise<void> {
  await httpsCallable(functions, "clearDrawingBoard")(scope);
}
