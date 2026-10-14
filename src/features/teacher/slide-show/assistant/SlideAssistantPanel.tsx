import { useEffect, useRef, useState, type FormEvent } from "react";
import { describeDeck } from "../../../../slide-assistant/deckContext.ts";
import { planDeckOperations, splitAssistantReply } from "../../../../slide-assistant/deckPlan.ts";
import { findSlideImage, imageCreditText } from "../../../../slide-assistant/imageSearch.ts";
import { requestSlideAssist } from "../../../../slide-assistant/repository.ts";
import { SLIDE_FONTS } from "../../../../slide-canvas/fonts.ts";
import type { SlideEditorController } from "../../../../slide-canvas/SlideEditorController.ts";
import type { Slide } from "../../../../slide-show/types.ts";
import { toErrorMessage } from "../../../../shared/errors/errorMessage.ts";
import Button from "../../../../shared/ui/Button.tsx";
import styles from "./SlideAssistantPanel.module.css";

/** Font families the AI helper may pick from, as the editor renders them. */
const FONT_FAMILIES = SLIDE_FONTS.map((font) => font.family);

/**
 * AI helper for the slide show: the teacher asks in plain words ("줄 맞춰줘", "오류 있는지 봐줘",
 * "버스 그림 하나 넣어줘") and the AI answers, optionally with edits that are applied as one
 * undoable step. Mounted per slide, so a reply that arrives after switching slides is dropped.
 */
export default function SlideAssistantPanel({ controller, slides, currentIndex, onApplyDeck }: {
  readonly controller: SlideEditorController | null;
  readonly slides: readonly Slide[];
  readonly currentIndex: number;
  readonly onApplyDeck: (slides: readonly Slide[], currentIndex: number) => void;
}) {
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
    setStatus("AI가 확인하는 중…");
    try {
      const currentSlide = slides[currentIndex];
      const described = controller.describeForAssistant();
      const result = await requestSlideAssist(request, describeDeck({
        slides, current: currentIndex + 1, currentSlide: described, fonts: FONT_FAMILIES,
      }));
      if (!mounted.current) return;

      const split = splitAssistantReply(result.operations, currentIndex + 1, described);
      // Pictures first: a searched picture becomes part of the slide being edited, and the slide
      // list is then captured from that same canvas.
      const credits: string[] = [];
      if (split.canvas.some((operation) => operation.op === "addImage")) setStatus("그림 찾는 중…");
      const skipped = await controller.applyAssistantOperations(split.canvas, async (query) => {
        const image = await findSlideImage(query);
        credits.push(imageCreditText(image.credit));
        return image;
      });
      if (!mounted.current) return;

      const plan = planDeckOperations({ slides, current: currentIndex + 1 }, split.deck);
      if (plan.count > 0) {
        const index = plan.slides.findIndex((slide) => slide.id === currentSlide?.id);
        onApplyDeck(plan.slides, index >= 0 ? index : Math.min(currentIndex, plan.slides.length - 1));
      }

      const notes = [
        result.message,
        skipped > 0 ? `${skipped}개 작업은 적용하지 못했습니다.` : "",
        result.dropped > 0 ? `${result.dropped}개 작업은 형식이 맞지 않아 건너뛰었습니다.` : "",
        ...credits.map((credit) => `그림 출처: ${credit}`),
      ].filter(Boolean);
      setReply(notes.length > 0 ? notes.join("\n") : "바꿀 것이 없었습니다.");
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
