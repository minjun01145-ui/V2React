import type { SlideArrangeAction, SlideObjectStyle, SlideObjectStylePatch } from "../../../slide-canvas/SlideEditorController.ts";
import Button from "../../../shared/ui/Button.tsx";
import styles from "./ObjectStylePanel.module.css";

interface Props {
  readonly style: SlideObjectStyle;
  readonly onChange: (patch: SlideObjectStylePatch) => void;
  readonly onArrange: (action: SlideArrangeAction) => void;
  readonly onDelete: () => void;
}

const TITLES: Readonly<Record<SlideObjectStyle["kind"], string>> = {
  text: "글상자", shape: "도형", line: "선", image: "그림", engine: "문제 엔진 창",
};

function ColorField({ label, value, onChange }: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void }) {
  return <label className={styles.field}><span>{label}</span><input className={styles.color} type="color" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberField({ label, value, min, max, onChange }: { readonly label: string; readonly value: number; readonly min: number; readonly max: number; readonly onChange: (value: number) => void }) {
  return <label className={styles.field}><span>{label}</span><input className={styles.number} type="number" min={min} max={max} value={Math.round(value)} onChange={(event) => {
    const next = Number(event.target.value);
    if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
  }} /></label>;
}

export default function ObjectStylePanel({ style, onChange, onArrange, onDelete }: Props) {
  if (style.kind === "engine") return null;
  const hasFill = style.kind === "text" || style.kind === "shape";
  const hasStroke = style.kind !== "text";
  return <section className={styles.panel} aria-label={`${TITLES[style.kind]} 서식`}>
    <h3>{TITLES[style.kind]}</h3>
    <div className={styles.grid}>
      {hasFill ? <ColorField label={style.kind === "text" ? "글씨 색" : "채우기 색"} value={style.fill} onChange={(fill) => onChange({ fill })} /> : null}
      {style.kind === "text" ? <NumberField label="글씨 크기" value={style.fontSize} min={8} max={240} onChange={(fontSize) => onChange({ fontSize })} /> : null}
      {style.kind === "text" ? <label className={styles.field}><span>굵게</span><button type="button" className={styles.toggle} aria-pressed={style.bold} onClick={() => onChange({ bold: !style.bold })}>B</button></label> : null}
      {hasStroke ? <ColorField label={style.kind === "line" ? "선 색" : "테두리 색"} value={style.stroke} onChange={(stroke) => onChange({ stroke })} /> : null}
      {hasStroke ? <NumberField label={style.kind === "line" ? "선 두께" : "테두리 두께"} value={style.strokeWidth} min={0} max={40} onChange={(strokeWidth) => onChange({ strokeWidth })} /> : null}
      <label className={`${styles.field} ${styles.wide}`}><span>투명도 {Math.round((1 - style.opacity) * 100)}%</span><input type="range" min={0} max={90} step={5} value={Math.round((1 - style.opacity) * 100)} onChange={(event) => onChange({ opacity: 1 - Number(event.target.value) / 100 })} /></label>
    </div>
    <div className={styles.arrange}>
      <Button variant="ghost" size="sm" onClick={() => onArrange("front")}>맨 앞</Button>
      <Button variant="ghost" size="sm" onClick={() => onArrange("forward")}>앞으로</Button>
      <Button variant="ghost" size="sm" onClick={() => onArrange("backward")}>뒤로</Button>
      <Button variant="ghost" size="sm" onClick={() => onArrange("back")}>맨 뒤</Button>
      <Button variant="danger" size="sm" onClick={onDelete}>삭제</Button>
    </div>
  </section>;
}
