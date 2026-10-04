import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { getGame } from "../../../games/registry.ts";
import type { LearningSetSummary } from "../../../learning-sets/types.ts";
import { imageFileToDataUrl } from "../../../slide-canvas/imageFile.ts";
import SlideEditorCanvas from "../../../slide-canvas/SlideEditorCanvas.tsx";
import { emptySlideCanvas, type SlideEditorController, type SlideObjectStyle, type SlideShapeKind } from "../../../slide-canvas/SlideEditorController.ts";
import { MAX_SLIDES, type Slide, type SlideEngineRound } from "../../../slide-show/types.ts";
import { validateSlides, validateSlideShowName } from "../../../slide-show/validation.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import { engineSetIssue, newSlideEngine } from "./engineDraft.ts";
import ObjectStylePanel from "./ObjectStylePanel.tsx";
import SlideEnginePanel from "./SlideEnginePanel.tsx";
import SlideRail from "./SlideRail.tsx";
import styles from "./SlideShowEditor.module.css";

export interface SlideShowDraft {
  readonly name: string;
  readonly slides: readonly Slide[];
}

interface Props {
  readonly initial: SlideShowDraft;
  readonly sets: readonly LearningSetSummary[];
  readonly busy: boolean;
  readonly onSave: (draft: SlideShowDraft) => Promise<void>;
  readonly onDirtyChange: (dirty: boolean) => void;
}

export function newSlide(): Slide {
  return { id: crypto.randomUUID(), canvas: emptySlideCanvas(), engine: null };
}

const SHAPES: readonly { readonly kind: SlideShapeKind; readonly label: string }[] = [
  { kind: "rect", label: "사각형" },
  { kind: "circle", label: "원" },
  { kind: "triangle", label: "삼각형" },
  { kind: "line", label: "선" },
];
const COMMIT_DELAY_MS = 250;

function engineLabel(round: SlideEngineRound | undefined): string {
  return round ? getGame(round.gameId).title : "";
}

export default function SlideShowEditor({ initial, sets, busy, onSave, onDirtyChange }: Props) {
  const [name, setName] = useState(initial.name);
  const [slides, setSlides] = useState<readonly Slide[]>(initial.slides);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [controller, setController] = useState<SlideEditorController | null>(null);
  const [selection, setSelection] = useState<SlideObjectStyle | null>(null);
  const [background, setBackground] = useState("#ffffff");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const commitTimer = useRef<number | null>(null);
  const imageInput = useRef<HTMLInputElement | null>(null);
  const current = slides[currentIndex];
  const currentId = current?.id;

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  /** Copies the canvas (and engine frame position) from Fabric into the given slide list. */
  const captureCurrent = useCallback((list: readonly Slide[]): readonly Slide[] => {
    if (!controller || !currentId) return list;
    const canvas = controller.serialize();
    const frame = controller.getEngineFrame();
    return list.map((slide) => slide.id !== currentId ? slide : {
      ...slide,
      canvas,
      engine: slide.engine && frame ? { ...slide.engine, frame } : slide.engine,
    });
  }, [controller, currentId]);

  const commitCanvas = useCallback((): void => {
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    commitTimer.current = null;
    setSlides(captureCurrent);
  }, [captureCurrent]);

  const scheduleCommit = useCallback((): void => {
    setDirty(true);
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(commitCanvas, COMMIT_DELAY_MS);
  }, [commitCanvas]);

  useEffect(() => () => { if (commitTimer.current !== null) window.clearTimeout(commitTimer.current); }, []);

  // Load the selected slide into the editor whenever the slide (not its content) changes.
  useEffect(() => {
    if (!controller || !current) return;
    void controller.load(current.canvas, current.engine?.frame ?? null, engineLabel(current.engine?.round))
      .then(() => setBackground(controller.background))
      .catch((value: unknown) => setError(toErrorMessage(value, "슬라이드를 불러오지 못했습니다.")));
    // Reload only on slide switch; edits made in Fabric must not reload the canvas.
  }, [controller, currentId]);

  const updateSlides = (update: (slides: readonly Slide[]) => readonly Slide[], nextIndex?: number): void => {
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    commitTimer.current = null;
    setSlides((list) => update(captureCurrent(list)));
    if (nextIndex !== undefined) setCurrentIndex(nextIndex);
    setDirty(true);
  };

  const selectSlide = (index: number): void => {
    if (index === currentIndex) return;
    commitCanvas();
    setCurrentIndex(index);
  };

  const addSlide = (): void => updateSlides((list) => [...list.slice(0, currentIndex + 1), newSlide(), ...list.slice(currentIndex + 1)], currentIndex + 1);
  const duplicateSlide = (): void => updateSlides((list) => {
    const source = list[currentIndex];
    return source ? [...list.slice(0, currentIndex + 1), { ...source, id: crypto.randomUUID() }, ...list.slice(currentIndex + 1)] : list;
  }, currentIndex + 1);
  const removeSlide = (): void => updateSlides((list) => list.filter((_, index) => index !== currentIndex), Math.max(0, currentIndex - 1));
  const moveSlide = (offset: -1 | 1): void => updateSlides((list) => {
    const target = currentIndex + offset;
    if (target < 0 || target >= list.length) return list;
    const next = [...list];
    [next[currentIndex], next[target]] = [next[target]!, next[currentIndex]!];
    return next;
  }, Math.min(slides.length - 1, Math.max(0, currentIndex + offset)));

  const setEngineRound = (round: SlideEngineRound | null): void => {
    if (!currentId) return;
    if (round) controller?.setEngineLabel(engineLabel(round));
    setSlides((list) => list.map((slide) => slide.id !== currentId ? slide : { ...slide, engine: round && slide.engine ? { ...slide.engine, round } : null }));
    setDirty(true);
  };

  const addEngine = (): void => {
    if (!currentId || current?.engine) return;
    const engine = newSlideEngine(sets);
    controller?.setEngineFrame(engine.frame, engineLabel(engine.round));
    setSlides((list) => list.map((slide) => slide.id === currentId ? { ...slide, engine } : slide));
    setDirty(true);
  };

  const removeEngine = (): void => {
    controller?.setEngineFrame(null, "");
    setEngineRound(null);
  };

  const insertImage = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !controller) return;
    try {
      await controller.addImage(await imageFileToDataUrl(file));
    } catch (value: unknown) {
      setError(toErrorMessage(value, "그림을 넣지 못했습니다."));
    }
  };

  const engineIssue = current?.engine ? engineSetIssue(current.engine.round, sets) : null;
  const validationError = useMemo(() => {
    try {
      validateSlideShowName(name);
      validateSlides(slides);
      const index = slides.findIndex((slide) => slide.engine && engineSetIssue(slide.engine.round, sets));
      if (index >= 0) return `${index + 1}번 슬라이드 문제 엔진: ${engineSetIssue(slides[index]!.engine!.round, sets)}`;
      return "";
    } catch (value: unknown) {
      return toErrorMessage(value, "슬라이드쇼 설정을 확인해 주세요.");
    }
  }, [name, sets, slides]);

  const save = async (): Promise<void> => {
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    commitTimer.current = null;
    const committed = captureCurrent(slides);
    setSlides(committed);
    setError("");
    try {
      await onSave({ name, slides: committed });
      setDirty(false);
    } catch (value: unknown) {
      setError(toErrorMessage(value, "슬라이드쇼를 저장하지 못했습니다."));
    }
  };

  return <div className={styles.editor}>
    <header className={styles.topBar}>
      <input className={styles.nameInput} aria-label="슬라이드쇼 이름" value={name} maxLength={80} placeholder="슬라이드쇼 이름" onChange={(event) => { setName(event.target.value); setDirty(true); }} disabled={busy} />
      <Button variant="accent" onClick={() => void save()} disabled={busy || Boolean(validationError) || !dirty}>{busy ? "저장 중…" : dirty ? "저장" : "저장됨"}</Button>
    </header>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {validationError && dirty ? <p className={styles.error}>{validationError}</p> : null}

    <div className={styles.toolbar} role="toolbar" aria-label="삽입">
      <Button variant="ghost" size="sm" onClick={() => controller?.addText()} disabled={!controller}>글상자</Button>
      {SHAPES.map((shape) => <Button variant="ghost" size="sm" key={shape.kind} onClick={() => controller?.addShape(shape.kind)} disabled={!controller}>{shape.label}</Button>)}
      <Button variant="ghost" size="sm" onClick={() => imageInput.current?.click()} disabled={!controller}>그림</Button>
      <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => void insertImage(event)} />
      <label className={styles.background}>배경<input type="color" value={background} onChange={(event) => { setBackground(event.target.value); controller?.setBackground(event.target.value); }} disabled={!controller} /></label>
      <span className={styles.spacer} />
      <Button size="sm" onClick={addEngine} disabled={!controller || Boolean(current?.engine)}>문제 엔진 넣기</Button>
    </div>

    <div className={styles.workspace}>
      <aside className={styles.railColumn}>
        <div className={styles.railActions}>
          <Button size="sm" onClick={addSlide} disabled={slides.length >= MAX_SLIDES}>+ 슬라이드</Button>
          <Button variant="ghost" size="sm" onClick={duplicateSlide} disabled={slides.length >= MAX_SLIDES}>복제</Button>
          <Button variant="ghost" size="sm" aria-label="위로 이동" onClick={() => moveSlide(-1)} disabled={currentIndex === 0}>↑</Button>
          <Button variant="ghost" size="sm" aria-label="아래로 이동" onClick={() => moveSlide(1)} disabled={currentIndex >= slides.length - 1}>↓</Button>
          <Button variant="quiet" size="sm" onClick={removeSlide} disabled={slides.length <= 1}>삭제</Button>
        </div>
        <SlideRail slides={slides} currentIndex={currentIndex} disabled={false} onSelect={selectSlide} />
      </aside>
      <main className={styles.stage}>
        <SlideEditorCanvas onReady={setController} onChange={scheduleCommit} onSelectionChange={setSelection} />
      </main>
      <aside className={styles.inspector}>
        {selection ? <ObjectStylePanel style={selection} onChange={(patch) => controller?.updateSelection(patch)} onArrange={(action) => controller?.arrange(action)} onDelete={() => controller?.deleteSelection()} /> : null}
        {current?.engine ? <SlideEnginePanel round={current.engine.round} sets={sets} disabled={busy} issue={engineIssue} onChange={setEngineRound} onRemove={removeEngine} /> : null}
      </aside>
    </div>
  </div>;
}
