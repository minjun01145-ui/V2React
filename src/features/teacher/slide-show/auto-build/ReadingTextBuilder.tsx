import { useState } from "react";
import { getLearningSet } from "../../../../learning-sets/readRepository.ts";
import { LEARNING_SET_TYPE, type LearningSetSummary } from "../../../../learning-sets/types.ts";
import type { ReadingTextSlidesResult } from "../../../../slide-builder/reading-text/buildReadingTextSlides.ts";
import { toErrorMessage } from "../../../../shared/errors/errorMessage.ts";
import Button from "../../../../shared/ui/Button.tsx";
import Card from "../../../../shared/ui/Card.tsx";
import Field from "../../../../shared/ui/Field.tsx";
import Select from "../../../../shared/ui/Select.tsx";
import type { SlideShowDraft } from "../SlideShowEditor.tsx";
import styles from "./ReadingTextBuilder.module.css";

interface Built {
  readonly draft: SlideShowDraft;
  readonly result: ReadingTextSlidesResult;
}

function draftFrom(name: string, result: ReadingTextSlidesResult): SlideShowDraft {
  return { name: `${name} 본문`.slice(0, 80), slides: result.canvases.map((canvas) => ({ id: crypto.randomUUID(), canvas, engine: null })) };
}

/** 본문 PPT: a reading-chunk set plus the textbook PDF become a page-and-box slide deck. */
export default function ReadingTextBuilder({ sets, onBuilt }: {
  readonly sets: readonly LearningSetSummary[];
  readonly onBuilt: (draft: SlideShowDraft) => void;
}) {
  const chunkSets = sets.filter((set) => set.type === LEARNING_SET_TYPE.READING_CHUNKS);
  const [setId, setSetId] = useState(chunkSets[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [built, setBuilt] = useState<Built | null>(null);
  const busy = Boolean(progress);

  const build = async (): Promise<void> => {
    if (!file || !setId || busy) return;
    setError("");
    setBuilt(null);
    setProgress("세트 불러오는 중…");
    try {
      const set = await getLearningSet(setId);
      // pdf.js is large, so it loads only when a deck is actually built.
      const { buildReadingTextSlides } = await import("../../../../slide-builder/reading-text/buildReadingTextSlides.ts");
      const result = await buildReadingTextSlides(file, set.items, setProgress);
      const draft = draftFrom(set.name, result);
      if (result.missingSentences.length === 0 && !result.truncated) onBuilt(draft);
      else setBuilt({ draft, result });
    } catch (value: unknown) {
      setError(toErrorMessage(value, "본문 슬라이드를 만들지 못했습니다."));
    } finally {
      setProgress("");
    }
  };

  const buttonLabel = chunkSets.length === 0 ? "끊어읽기 세트가 없습니다" : !file ? "PDF를 선택하세요" : progress || "만들기";
  return <Card className={styles.builder}>
    <h2>본문 PPT 만들기</h2>
    <Field label="끊어읽기 세트">
      <Select value={setId} onChange={(event) => setSetId(event.target.value)} disabled={busy || chunkSets.length === 0}>
        {chunkSets.map((set) => <option value={set.id} key={set.id}>{set.name} ({set.itemCount})</option>)}
      </Select>
    </Field>
    <Field label="교과서 PDF">
      <input className={styles.file} type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setBuilt(null); }} />
    </Field>
    <Button variant="accent" onClick={() => void build()} disabled={busy || !file || !setId}>{buttonLabel}</Button>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {built ? <section className={styles.result} aria-label="만들기 결과">
      <p>슬라이드 {built.draft.slides.length}장{built.result.truncated ? " (최대 장수까지만 만들었습니다)" : ""}</p>
      {built.result.missingSentences.length > 0 ? <>
        <p>PDF에서 찾지 못한 문장 {built.result.missingSentences.length}개</p>
        <ul>{built.result.missingSentences.map((sentence, index) => <li key={index}>{sentence}</li>)}</ul>
      </> : null}
      <Button onClick={() => onBuilt(built.draft)}>슬라이드 편집하기</Button>
    </section> : null}
  </Card>;
}
