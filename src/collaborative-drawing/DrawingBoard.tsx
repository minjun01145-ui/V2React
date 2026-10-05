import { useEffect, useState } from "react";
import Button from "../shared/ui/Button.tsx";
import { usePopup } from "../shared/popup/index.ts";
import DrawingCanvas, { type DrawingTool } from "./DrawingCanvas.tsx";
import { authorHue, BRUSH_WIDTHS, INK_COLORS, inkColor, MAX_PENDING_STROKES, MAX_STROKES_PER_AUTHOR, type DrawingAuthor, type DrawingScope } from "./model.ts";
import { clearDrawingBoard } from "./repository.ts";
import { useDrawingBoard } from "./useDrawingBoard.ts";
import styles from "./DrawingBoard.module.css";

interface Props {
  readonly scope: DrawingScope;
  readonly author?: DrawingAuthor | null;
  readonly participants: readonly DrawingAuthor[];
  readonly canClearBoard?: boolean;
  readonly onExit: () => void;
}

export default function DrawingBoard({ scope, author = null, participants, canClearBoard = false, onExit }: Props) {
  const board = useDrawingBoard(scope, author);
  const [width, setWidth] = useState<number>(6);
  const [tool, setTool] = useState<DrawingTool>(author ? "pen" : "inspect");
  const [color, setColor] = useState<number | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { requestConfirmation } = usePopup();
  useEffect(() => { setSelectedAuthor(null); setActionError(null); }, [board.generation]);
  const ownStrokes = board.strokes.filter((stroke) => stroke.authorId === author?.id);
  const hue = author ? authorHue(author.id) : 220;
  const penColor = color === null ? inkColor(hue) : INK_COLORS[color]!.value;
  const canDraw = Boolean(author && board.ready && board.connected && !board.error && !working && ownStrokes.length < MAX_STROKES_PER_AUTHOR && board.pendingCount < MAX_PENDING_STROKES);
  const canErase = Boolean(author && board.ready && board.connected && !board.error && !working && ownStrokes.length > 0);
  const savedAuthors = new Map(board.strokes.map((stroke) => [stroke.authorId, { id: stroke.authorId, label: stroke.label }]));
  for (const participant of participants) savedAuthors.set(participant.id, participant);
  if (author) savedAuthors.set(author.id, author);
  const authors = [...savedAuthors.values()];

  const run = async (operation: () => Promise<void>) => {
    setWorking(true);
    setActionError(null);
    try { await operation(); } catch (reason) { setActionError(reason instanceof Error ? reason.message : "작업을 완료하지 못했습니다."); }
    finally { setWorking(false); }
  };
  const exit = async () => {
    if (!board.pendingCount) { onExit(); return; }
    if (!board.connected || board.error) {
      const discard = await requestConfirmation({ title: "아직 저장하지 못한 그림이 있습니다", message: "저장하지 않은 선을 버리고 대기실로 돌아갈까요?", confirmLabel: "버리고 나가기", cancelLabel: "계속 그리기", tone: "warning" });
      if (discard) onExit();
      return;
    }
    await run(async () => { if (await board.flush()) onExit(); });
  };
  const clearOwn = async () => {
    const confirmed = await requestConfirmation({ title: "내 그림을 지울까요?", message: "내가 그린 선이 모두 지워집니다.", confirmLabel: "내 그림 지우기", cancelLabel: "취소", tone: "warning" });
    if (confirmed) await run(() => board.erase(ownStrokes.map((stroke) => stroke.id)));
  };
  const clearAll = async () => {
    const confirmed = await requestConfirmation({ title: "그림판을 모두 비울까요?", message: "모든 학생의 그림이 지워집니다.", confirmLabel: "전체 지우기", cancelLabel: "취소", tone: "warning" });
    if (confirmed) await run(() => clearDrawingBoard(scope));
  };
  const penLabel = !board.ready ? "그림 불러오는 중" : !board.connected ? "연결 대기 중" : ownStrokes.length >= MAX_STROKES_PER_AUTHOR ? "내 그림 한도 도달" : board.pendingCount >= MAX_PENDING_STROKES ? "저장 대기 중" : "펜";
  const status = board.error ?? actionError ?? (!board.ready ? "그림판을 불러오는 중…" : !board.connected ? "연결이 끊겼습니다. 다시 연결되면 저장을 이어갑니다." : null);

  return <section className={styles.board} aria-label="그림그리기">
    <header className={styles.header}>
      <div className={styles.heading}><span className={styles.titleIcon} aria-hidden="true">✎</span><h2>그림그리기</h2></div>
      <Button variant="ghost" size="sm" disabled={working} onClick={() => void exit()}>{working ? "처리 중…" : "대기실로"}</Button>
    </header>
    <div className={styles.toolbar}>
      <div className={styles.toolGroup}>
        {author ? <>
          <button className={styles.tool} type="button" aria-pressed={tool === "pen"} disabled={!canDraw} onClick={() => setTool("pen")}><span aria-hidden="true">✎</span>{penLabel}</button>
          <button className={styles.tool} type="button" aria-pressed={tool === "eraser"} disabled={!canErase} onClick={() => setTool("eraser")}><span aria-hidden="true">⌫</span>지우개</button>
        </> : null}
        <button className={styles.tool} type="button" aria-pressed={tool === "inspect"} onClick={() => setTool("inspect")}>작성자 보기</button>
      </div>
      {author ? <div className={styles.toolGroup} aria-label="펜 색">
        <button type="button" className={styles.swatch} aria-label="내 색" aria-pressed={color === null} onClick={() => { setColor(null); setTool("pen"); }}><span style={{ background: inkColor(hue) }} /></button>
        {INK_COLORS.map((ink, index) => <button key={ink.value} type="button" className={styles.swatch} aria-label={ink.label} aria-pressed={color === index} onClick={() => { setColor(index); setTool("pen"); }}>
          <span style={{ background: ink.value }} />
        </button>)}
      </div> : null}
      {author ? <div className={styles.toolGroup} aria-label="펜 굵기">
        {BRUSH_WIDTHS.map((brush, index) => <button key={brush} type="button" className={styles.brush} aria-label={["가장 얇은 펜", "아주 얇은 펜", "얇은 펜", "보통 펜", "굵은 펜"][index]} aria-pressed={width === brush} onClick={() => { setWidth(brush); setTool("pen"); }}>
          <span style={{ width: brush + 5, height: brush + 5, background: penColor }} />
        </button>)}
      </div> : null}
      <div className={styles.actions}>
        {author ? <>
          <Button variant="quiet" size="sm" disabled={working || !board.connected || !board.ready || ownStrokes.length === 0 || board.pendingCount > 0} onClick={() => void run(() => board.erase([ownStrokes.at(-1)!.id]))}>되돌리기</Button>
          <Button variant="quiet" size="sm" disabled={working || !board.connected || !board.ready || ownStrokes.length === 0 || board.pendingCount > 0} onClick={() => void clearOwn()}>내 그림 지우기</Button>
        </> : null}
        {canClearBoard ? <Button variant="danger" size="sm" disabled={working || !board.ready || !board.connected} onClick={() => void clearAll()}>전체 지우기</Button> : null}
      </div>
    </div>
    <div className={styles.paper}>
      <DrawingCanvas strokes={board.strokes} generation={board.generation} tool={tool} canDraw={canDraw} canErase={canErase} color={penColor} width={width}
        eraserAuthorId={author?.id ?? null} selectedAuthor={selectedAuthor} onSelectAuthor={setSelectedAuthor}
        onStroke={(points, brush) => { if (!board.addStroke(points, brush, color)) setActionError("이 선을 저장하지 못했습니다. 연결과 내 그림 한도를 확인해 주세요."); }}
        onErase={(ids) => run(() => board.erase(ids))} />
      {!board.ready ? <div className={styles.loading}>그림판 불러오는 중…</div> : null}
    </div>
    <footer className={styles.footer}>
      <div className={styles.authors} aria-label="그림 작성자">
        {authors.map((participant) => <button key={participant.id} type="button" className={styles.author} aria-pressed={selectedAuthor === participant.id}
          onClick={() => setSelectedAuthor(selectedAuthor === participant.id ? null : participant.id)}>
          <span className={styles.colorDot} style={{ background: inkColor(authorHue(participant.id)) }} />
          <span>{participant.label}</span>{participant.id === author?.id ? <strong>나</strong> : null}
        </button>)}
      </div>
      {author ? <output className={styles.counter} aria-label="내 그림 저장 상태">{board.pendingCount ? `${board.pendingCount}개 저장 중` : `${ownStrokes.length} / ${MAX_STROKES_PER_AUTHOR}`}</output> : null}
    </footer>
    {status ? <div className={styles.status} role={board.error || actionError ? "alert" : "status"}>{status}
      {board.canRetry ? <Button variant="ghost" size="sm" disabled={working || !board.connected} onClick={() => void run(async () => { await board.flush(); })}>저장 재시도</Button> : null}
    </div> : null}
  </section>;
}
