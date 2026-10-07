import { useEffect, useRef, useState, type FormEvent } from "react";
import { findSlideImage } from "../../../../slide-assistant/imageSearch.ts";
import { requestSlideAssist } from "../../../../slide-assistant/repository.ts";
import type { SlideEditorController } from "../../../../slide-canvas/SlideEditorController.ts";
import { toErrorMessage } from "../../../../shared/errors/errorMessage.ts";
import Button from "../../../../shared/ui/Button.tsx";
import styles from "./SlideAssistantPanel.module.css";

/**
 * AI helper for the slide being edited: the teacher asks in plain words ("줄 맞춰줘",
 * "어울리는 그림 넣어줘") and the AI's edits are applied as one undoable step.
 * Mounted per slide, so a reply that arrives after switching slides is dropped.
 */
export default function SlideAssistantPanel({ controller }: { readonly controller: SlideEditorController | null }) {
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const busy = Boolean(status);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const request = instruction.trim();
    if (!controller || !request || busy) return;
    setError("");
    setReply("");
    setStatus("AI가 생각하는 중…");
    try {
      const result = await requestSlideAssist(request, controller.describeForAssistant());
      if (!mounted.current) return;
      if (result.operations.some((operation) => operation.op === "addImage")) setStatus("그림 찾는 중…");
      const skipped = await controller.applyAssistantOperations(result.operations, findSlideImage);
      if (!mounted.current) return;
      setReply(result.operations.length === 0 ? result.message || "바꿀 것이 없었습니다." : skipped > 0 ? `${result.message} (${skipped}개 작업은 적용하지 못했습니다)` : result.message || "적용했습니다.");
      setInstruction("");
    } catch (cause: unknown) {
      if (mounted.current) setError(toErrorMessage(cause, "AI 작업을 완료하지 못했습니다."));
    } finally {
      if (mounted.current) setStatus("");
    }
  };

  return <form className={styles.panel} aria-label="AI 도우미" onSubmit={(event) => void submit(event)}>
    <h3>AI 도우미</h3>
    <textarea className={styles.input} rows={3} maxLength={500} value={instruction} aria-label="AI에게 부탁할 내용"
      onChange={(event) => setInstruction(event.target.value)} disabled={busy || !controller}
      onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) void submit(event); }} />
    <Button type="submit" variant="accent" size="sm" disabled={busy || !controller || !instruction.trim()}>{status || "실행"}</Button>
    {reply ? <p className={styles.reply} role="status">{reply}</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
  </form>;
}
