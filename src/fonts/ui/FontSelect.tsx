import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { FONT_CATALOG, FONT_GROUPS } from "../catalog.ts";
import { previewFont } from "../loader.ts";
import styles from "./FontSelect.module.css";

interface Props {
  readonly value: string;
  readonly onChange: (family: string) => void;
  readonly label?: string;
  readonly ariaLabel?: string;
}

/** 이름 미리보기에 쓰는 짧은 표본: 로드 용량을 줄이면서 글꼴 성격이 드러나게 한다. */
const PREVIEW_TEXT = "가나다 ABC";

/**
 * 글꼴 선택기. 분류별로 묶고 각 항목을 해당 글꼴로 보여 준다.
 * 목록을 여는 순간에만 미리보기 글꼴을 로드하므로 화면에 안 쓰는 글꼴은 받지 않는다.
 */
export default function FontSelect({ value, onChange, label = "글꼴", ariaLabel = "글꼴" }: Props) {
  const [opened, setOpened] = useState(false);
  const loading = useRef(false);

  useEffect(() => {
    if (!opened || loading.current) return;
    loading.current = true;
    void Promise.all(FONT_CATALOG.map((font) => previewFont(font, PREVIEW_TEXT)));
  }, [opened]);

  // 저장된 슬라이드에 카탈로그 밖 글꼴(예전 덱, PPT 가져오기)이 있으면 그 값을 잃지 않도록 항목을 남긴다.
  const known = FONT_CATALOG.some((font) => font.family === value);

  return <label className={styles.field}>
    <span>{label}</span>
    <select className={styles.select} aria-label={ariaLabel} value={value} style={{ fontFamily: value }}
      onFocus={() => setOpened(true)} onPointerDown={() => setOpened(true)}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}>
      {known ? null : <option value={value} style={{ fontFamily: value }}>{value}</option>}
      {FONT_GROUPS.map((group) => <optgroup key={group.category} label={group.category}>
        {group.fonts.map((font) => <option key={font.id} value={font.family} style={{ fontFamily: font.family }}>{font.label}</option>)}
      </optgroup>)}
    </select>
  </label>;
}
