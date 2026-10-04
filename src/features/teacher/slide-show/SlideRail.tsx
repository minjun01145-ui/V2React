import SlideStage from "../../../slide-canvas/SlideStage.tsx";
import type { Slide } from "../../../slide-show/types.ts";
import SlideFrameBox from "../../../slide-canvas/SlideFrameBox.tsx";
import styles from "./SlideRail.module.css";

interface Props {
  readonly slides: readonly Slide[];
  readonly currentIndex: number;
  readonly disabled: boolean;
  readonly onSelect: (index: number) => void;
}

export default function SlideRail({ slides, currentIndex, disabled, onSelect }: Props) {
  return <ol className={styles.rail} aria-label="슬라이드 목록">
    {slides.map((slide, index) => <li key={slide.id}>
      <button type="button" className={styles.item} aria-current={index === currentIndex ? "true" : undefined} aria-label={`${index + 1}번 슬라이드`} disabled={disabled} onClick={() => onSelect(index)}>
        <span className={styles.number}>{index + 1}</span>
        <SlideStage className={styles.thumb} canvas={slide.canvas} overlay={slide.engine ? (scale) => <SlideFrameBox className={styles.engineOutline} frame={slide.engine!.frame} scale={scale} /> : undefined} />
      </button>
    </li>)}
  </ol>;
}
