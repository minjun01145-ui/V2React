import { useEffect, useState } from "react";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../../../slide-show/types.ts";
import { SLIDE_TEMPLATES, type SlideTemplate, type TemplateVariant } from "../../../slide-canvas/slideTemplates/index.ts";
import { previewFamilyStack } from "../../../fonts/loader.ts";
import Button from "../../../shared/ui/Button.tsx";
import styles from "./SlideTemplatePanel.module.css";

interface Props {
  readonly variant: TemplateVariant;
  readonly disabled: boolean;
  readonly onApply: (template: SlideTemplate, all: boolean) => void;
}

/** 카드 미리보기에 쓰는 표본: 양식의 글꼴 성격이 카드에서 바로 보이도록 한다. */
const PREVIEW_TEXTS = ["제목 미리보기", "본문 미리보기"];

/** 양식 카드 그리드. 카드를 고르면 아래 버튼 한 쌍으로 이 슬라이드/모든 슬라이드에 적용한다. */
export default function SlideTemplatePanel({ variant, disabled, onApply }: Props) {
  const [selectedId, setSelectedId] = useState(SLIDE_TEMPLATES[0]?.id ?? "");
  const selected = SLIDE_TEMPLATES.find((template) => template.id === selectedId) ?? SLIDE_TEMPLATES[0];

  // 목록이 보이는 동안에만 미리보기 글꼴을 로드한다.
  useEffect(() => {
    void Promise.all(SLIDE_TEMPLATES.flatMap((template) => [template.cover, template.content].flatMap((layout) =>
      [layout.title.fontFamily, layout.body.fontFamily].map((family, index) => previewFamilyStack(family, PREVIEW_TEXTS[index] ?? "미리보기")))));
  }, []);

  return <section className={styles.panel} aria-label="양식">
    <h3>양식</h3>
    <div className={styles.grid}>
      {SLIDE_TEMPLATES.map((template) => {
        const layout = template[variant];
        return <button type="button" className={styles.card} key={template.id} aria-pressed={template.id === selected?.id}
          disabled={disabled} onClick={() => setSelectedId(template.id)}>
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
          <span className={styles.name}>{template.name}</span>
        </button>;
      })}
    </div>
    <div className={styles.actions}>
      <Button size="sm" disabled={disabled || !selected} onClick={() => selected && onApply(selected, false)}>이 슬라이드에 적용</Button>
      <Button size="sm" variant="ghost" disabled={disabled || !selected} onClick={() => selected && onApply(selected, true)}>모든 슬라이드에 적용</Button>
    </div>
  </section>;
}
