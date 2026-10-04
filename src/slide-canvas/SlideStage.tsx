import "./fabricSetup.ts";
import { StaticCanvas } from "fabric";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../slide-show/types.ts";
import { collectSlideTexts, loadSlideFonts } from "./fonts.ts";
import styles from "./SlideStage.module.css";

interface Props {
  /** Fabric canvas JSON of the slide. */
  readonly canvas: string;
  readonly className?: string | undefined;
  /** Content laid over the slide; receives the slide-unit → pixel scale. */
  readonly overlay?: ((scale: number) => ReactNode) | undefined;
}

function useFittedSize(): [RefObject<HTMLDivElement | null>, { readonly width: number; readonly height: number }] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const fittedWidth = Math.min(width, height * SLIDE_WIDTH / SLIDE_HEIGHT);
      setSize({ width: Math.floor(fittedWidth), height: Math.floor(fittedWidth * SLIDE_HEIGHT / SLIDE_WIDTH) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

/** Read-only slide renderer that letterboxes a 16:9 slide into whatever space it is given. */
export default function SlideStage({ canvas, className, overlay }: Props) {
  const [containerRef, size] = useFittedSize();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const staticCanvasRef = useRef<StaticCanvas | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    // A fresh element per mount: Fabric refuses to re-initialize a disposed element.
    const element = document.createElement("canvas");
    host.appendChild(element);
    const staticCanvas = new StaticCanvas(element, { renderOnAddRemove: false });
    staticCanvasRef.current = staticCanvas;
    return () => {
      staticCanvasRef.current = null;
      void staticCanvas.dispose().finally(() => element.remove());
    };
  }, []);

  useEffect(() => {
    const staticCanvas = staticCanvasRef.current;
    if (!staticCanvas || size.width === 0) return;
    staticCanvas.setDimensions({ width: size.width, height: size.height });
    staticCanvas.setZoom(size.width / SLIDE_WIDTH);
    staticCanvas.requestRenderAll();
  }, [size.height, size.width]);

  useEffect(() => {
    const staticCanvas = staticCanvasRef.current;
    if (!staticCanvas) return undefined;
    const controller = new AbortController();
    let parsed: unknown;
    try {
      parsed = JSON.parse(canvas);
    } catch {
      return undefined;
    }
    void loadSlideFonts(collectSlideTexts(parsed))
      .then(() => staticCanvas.loadFromJSON(parsed as Record<string, unknown>, undefined, { signal: controller.signal }))
      .then(() => { if (!controller.signal.aborted) staticCanvas.requestRenderAll(); })
      .catch((error: unknown) => { if (!controller.signal.aborted) console.error(error); });
    return () => controller.abort();
  }, [canvas]);

  const scale = size.width / SLIDE_WIDTH;
  return <div ref={containerRef} className={[styles.container, className ?? ""].filter(Boolean).join(" ")}>
    <div className={styles.slide} style={{ width: size.width, height: size.height }}>
      <div ref={hostRef} className={styles.canvasHost} />
      {overlay && size.width > 0 ? <div className={styles.overlay}>{overlay(scale)}</div> : null}
    </div>
  </div>;
}
