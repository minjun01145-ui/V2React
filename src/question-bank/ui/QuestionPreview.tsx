import InlineText from "../../worksheet/ui/InlineText.tsx";
import { CHOICE_MARKS, type ExamQuestionContent } from "../types.ts";
import styles from "./QuestionPreview.module.css";

/** A compact on-screen view of one question with its answer marked, for reviewing before saving. */
export default function QuestionPreview({ content }: { readonly content: ExamQuestionContent }) {
  return <div className={styles.preview}>
    <p className={styles.prompt}><InlineText text={content.prompt} /></p>
    {content.context ? <div className={styles.context}><InlineText text={content.context} /></div> : null}
    {content.format === "choice"
      ? <ol className={styles.choices}>{content.choices.map((choice, index) => <li key={index} data-correct={index + 1 === content.correctChoice}>
        <span>{CHOICE_MARKS[index]}</span> <InlineText text={choice} />
      </li>)}</ol>
      : <p className={styles.answer}>정답: <InlineText text={content.answer} /></p>}
    {content.explanation ? <p className={styles.explanation}>{content.explanation}</p> : null}
  </div>;
}
