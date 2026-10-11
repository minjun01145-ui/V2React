import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../../../slide-show/types.ts";
import { SLIDE_TEMPLATES, type SlideTemplate, type TemplateVariant } from "../../../slide-canvas/slideTemplates.ts";
import Button from "../../../shared/ui/Button.tsx";
import styles from "./SlideTemplatePanel.module.css";

interface Props {
  readonly variant: TemplateVariant;
  readonly disabled: boolean;
  readonly onApply: (template: SlideTemplate, all: boolean) => void;
}

export default function SlideTemplatePanel({ variant, disabled, onApply }: Props) {
  return <section className={styles.panel} aria-label="양식">
    <h3>양식</h3>
    {SLIDE_TEMPLATES.map((template) => {
      const layout = template[variant];
      return <div className={styles.card} key={template.id}>
        <svg className={styles.preview} viewBox={`0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}`} role="img" aria-label={`${template.name} 미리보기`}>
          <rect width={SLIDE_WIDTH} height={SLIDE_HEIGHT} fill={layout.background} />
          {layout.decorations.map((shape, index) => shape.kind === "circle"
            ? <circle key={index} cx={shape.x * SLIDE_WIDTH / 100} cy={shape.y * SLIDE_HEIGHT / 100} r={shape.diameter * SLIDE_HEIGHT / 200} fill={shape.color} />
            : <rect key={index} x={shape.x * SLIDE_WIDTH / 100} y={shape.y * SLIDE_HEIGHT / 100} width={shape.w * SLIDE_WIDTH / 100} height={shape.h * SLIDE_HEIGHT / 100} rx={(shape.radius ?? 0) * SLIDE_HEIGHT / 100} fill={shape.color} opacity={shape.opacity ?? 1} />)}
          {[layout.title, layout.body].map((text, index) => <text key={index}
            x={(text.x + (text.align === "center" ? text.w / 2 : 0)) * SLIDE_WIDTH / 100}
            y={(text.y + text.size) * SLIDE_HEIGHT / 100}
            textAnchor={text.align === "center" ? "middle" : "start"}
            fontFamily={text.fontFamily} fontSize={text.size * SLIDE_HEIGHT / 100} fontWeight={text.weight ?? 400} fill={text.color}>
            {index === 0 ? "제목을 입력하세요" : variant === "cover" ? "부제목을 입력하세요" : "내용을 입력하세요"}
          </text>)}
        </svg>
        <h4>{template.name}</h4>
        <Button size="sm" disabled={disabled} onClick={() => onApply(template, false)}>이 슬라이드에 적용</Button>
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onApply(template, true)}>모든 슬라이드에 적용</Button>
      </div>;
    })}
  </section>;
}
