import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type JSX } from "react";
import { getGame } from "../../../games/registry.ts";
import type { LearningSetSummary } from "../../../learning-sets/types.ts";
import { imageFileToDataUrl } from "../../../slide-canvas/imageFile.ts";
import { importPptxSlides } from "../../../slide-canvas/pptxImport.ts";
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

const ICON_PROPS = { viewBox: "0 0 24 24", "aria-hidden": true, fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const TEXT_ICON = <svg {...ICON_PROPS}><path d="M5 6V4h14v2M12 4v16M9 20h6" /></svg>;
const IMAGE_ICON = <svg {...ICON_PROPS}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></svg>;
const PPT_ICON = <svg {...ICON_PROPS}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M10 18v-6h2.5a2 2 0 0 1 0 4H10" /></svg>;
const ENGINE_ICON = <svg {...ICON_PROPS}><path d="M13 2 4 14h7l-1 8 9-12h-7Z" fill="currentColor" stroke="none" /></svg>;
const SHAPES: readonly { readonly kind: SlideShapeKind; readonly label: string; readonly icon: JSX.Element }[] = [
  { kind: "rect", label: "사각형", icon: <svg {...ICON_PROPS}><rect x="4" y="5" width="16" height="14" rx="2" /></svg> },
  { kind: "circle", label: "원", icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="8" /></svg> },
  { kind: "triangle", label: "삼각형", icon: <svg {...ICON_PROPS}><path d="M12 4 21 20H3Z" /></svg> },
  { kind: "line", label: "선", icon: <svg {...ICON_PROPS}><path d="M4 20 20 4" /></svg> },
];
const BACKGROUNDS = ["#ffffff", "#f3f5fa", "#fff6df", "#e7ebff", "#e5f7ec", "#ffe4ec", "#0f1846", "#2338b8", "#ffc933"] as const;
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
  const [importing, setImporting] = useState(false);
  const commitTimer = useRef<number | null>(null);
  const imageInput = useRef<HTMLInputElement | null>(null);
  const pptxInput = useRef<HTMLInputElement | null>(null);
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

  const importPptx = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const imported = (await importPptxSlides(file)).map((canvas): Slide => ({ id: crypto.randomUUID(), canvas, engine: null }));
      if (imported.length === 0) throw new Error("가져올 슬라이드가 없습니다.");
      if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
      commitTimer.current = null;
      const committed = captureCurrent(slides);
      // A brand-new show starts with one blank slide; the imported deck replaces it.
      const replace = committed.length === 1 && !committed[0]!.engine && (JSON.parse(committed[0]!.canvas) as { objects?: unknown[] }).objects?.length === 0;
      const next = replace ? imported : [...committed.slice(0, currentIndex + 1), ...imported, ...committed.slice(currentIndex + 1)];
      if (next.length > MAX_SLIDES) throw new Error(`슬라이드는 최대 ${MAX_SLIDES}장까지 만들 수 있습니다.`);
      setSlides(next);
      setCurrentIndex(replace ? 0 : currentIndex + 1);
      if (!name.trim()) setName(file.name.replace(/\.pptx$/i, "").slice(0, 80));
      setDirty(true);
    } catch (value: unknown) {
      setError(toErrorMessage(value, "PPTX 파일을 가져오지 못했습니다."));
    } finally {
      setImporting(false);
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

  const changeBackground = (color: string): void => {
    setBackground(color);
    controller?.setBackground(color);
  };

  return <div className={styles.editor}>
    <header className={styles.header}>
      <input className={styles.nameInput} aria-label="슬라이드쇼 이름" value={name} maxLength={80} placeholder="슬라이드쇼 이름" onChange={(event) => { setName(event.target.value); setDirty(true); }} disabled={busy} />
      <Button variant="accent" onClick={() => void save()} disabled={busy || Boolean(validationError) || !dirty}>{busy ? "저장 중…" : dirty ? "저장" : "저장됨"}</Button>
    </header>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {validationError && dirty ? <p className={styles.error}>{validationError}</p> : null}

    <div className={styles.toolbar} role="toolbar" aria-label="삽입">
      <button type="button" className={styles.tool} onClick={() => controller?.addText()} disabled={!controller}>{TEXT_ICON}<span>글상자</span></button>
      <i className={styles.divider} aria-hidden="true" />
      {SHAPES.map((shape) => <button type="button" className={styles.tool} key={shape.kind} onClick={() => controller?.addShape(shape.kind)} disabled={!controller}>{shape.icon}<span>{shape.label}</span></button>)}
      <i className={styles.divider} aria-hidden="true" />
      <button type="button" className={styles.tool} onClick={() => imageInput.current?.click()} disabled={!controller}>{IMAGE_ICON}<span>그림</span></button>
      <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => void insertImage(event)} />
      <button type="button" className={styles.tool} onClick={() => pptxInput.current?.click()} disabled={!controller || importing}>{PPT_ICON}<span>{importing ? "가져오는 중…" : "PPT 가져오기"}</span></button>
      <input ref={pptxInput} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden onChange={(event) => void importPptx(event)} />
      <span className={styles.spacer} />
      <button type="button" className={styles.engineButton} onClick={addEngine} disabled={!controller || Boolean(current?.engine)}>{ENGINE_ICON}<span>{current?.engine ? "문제 엔진 있음" : "문제 엔진 넣기"}</span></button>
    </div>

    <div className={styles.workspace}>
      <aside className={styles.railColumn}>
        <div className={styles.railActions}>
          <Button size="sm" onClick={addSlide} disabled={slides.length >= MAX_SLIDES}>+ 슬라이드</Button>
          <div className={styles.railIcons}>
            <button type="button" className={styles.iconButton} aria-label="복제" title="복제" onClick={duplicateSlide} disabled={slides.length >= MAX_SLIDES}><svg {...ICON_PROPS}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg></button>
            <button type="button" className={styles.iconButton} aria-label="위로 이동" title="위로 이동" onClick={() => moveSlide(-1)} disabled={currentIndex === 0}><svg {...ICON_PROPS}><path d="m6 14 6-6 6 6" /></svg></button>
            <button type="button" className={styles.iconButton} aria-label="아래로 이동" title="아래로 이동" onClick={() => moveSlide(1)} disabled={currentIndex >= slides.length - 1}><svg {...ICON_PROPS}><path d="m6 10 6 6 6-6" /></svg></button>
            <button type="button" className={styles.iconButton} data-danger="true" aria-label="삭제" title="삭제" onClick={removeSlide} disabled={slides.length <= 1}><svg {...ICON_PROPS}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></button>
          </div>
        </div>
        <SlideRail slides={slides} currentIndex={currentIndex} disabled={false} onSelect={selectSlide} />
      </aside>
      <main className={styles.stage}>
        <SlideEditorCanvas onReady={setController} onChange={scheduleCommit} onSelectionChange={setSelection} onEngineDelete={removeEngine} />
      </main>
      <aside className={styles.inspector}>
        <section className={styles.slidePanel} aria-label="슬라이드 배경">
          <h3><b>{currentIndex + 1}</b>슬라이드 배경</h3>
          <div className={styles.swatches}>
            {BACKGROUNDS.map((color) => <button type="button" key={color} className={styles.swatch} style={{ background: color }} aria-label={color} aria-pressed={background.toLowerCase() === color} onClick={() => changeBackground(color)} disabled={!controller} />)}
            <label className={styles.customColor} aria-label="직접 고르기"><input type="color" value={background} onChange={(event) => changeBackground(event.target.value)} disabled={!controller} /></label>
          </div>
        </section>
        {selection ? <ObjectStylePanel style={selection} onChange={(patch) => controller?.updateSelection(patch)} onArrange={(action) => controller?.arrange(action)} onDelete={() => controller?.deleteSelection()} /> : null}
        {current?.engine ? <SlideEnginePanel round={current.engine.round} sets={sets} disabled={busy} issue={engineIssue} onChange={setEngineRound} onRemove={removeEngine} /> : null}
      </aside>
    </div>
  </div>;
}
