import type { CSSProperties } from "react";
import { worksheetFitScale } from "../fit.ts";
import type { SentenceRow, WorksheetBlock, WorksheetDocument, WorksheetQuestion } from "../types.ts";
import InlineText from "./InlineText.tsx";
import styles from "./Worksheet.module.css";

const CHOICE_MARKS = ["①", "②", "③", "④", "⑤"];

function ChunkedText({ text }: { readonly text: string }) {
  return text.split("/").map((chunk, index) => <span key={index}>{index ? <span className={styles.slash}> / </span> : null}{chunk.trim()}</span>);
}

/** Answer lines grow with the expected answer but stay readable. */
function answerWidth(answerLength: number): string {
  return `${Math.min(90, Math.max(22, answerLength * 2.1))}mm`;
}

/** Short choices share one row like a printed exam; long ones get a line each. */
function choiceLayout(choices: readonly string[]): string {
  const longest = Math.max(...choices.map((choice) => choice.length));
  return (longest <= 12 ? styles.shortChoices : longest > 45 ? styles.longChoices : "") ?? "";
}

function Question({ question }: { readonly question: WorksheetQuestion }) {
  const parts = question.type === "blank" ? question.text.split("{{blank}}") : [question.text];
  return <li className={styles.question}>
    <div className={styles.questionPrompt}>
      <strong>{question.number}.</strong>
      <div>
        {parts.map((part, index) => <span key={index}>{index ? <span className={styles.blank} style={{ width: answerWidth(question.type === "blank" ? question.answerLength : 0) }} aria-label="빈칸" /> : null}<InlineText text={part} /></span>)}
        {question.type === "line" ? <span className={styles.answerLine}>→ <span className={styles.blank} style={{ width: answerWidth(question.answerLength) }} aria-label="답" /></span> : null}
      </div>
    </div>
    {question.context ? <div className={styles.context}><InlineText text={question.context} /></div> : null}
    {question.type === "choice" ? <ol className={`${styles.choices} ${choiceLayout(question.choices)}`}>{question.choices.map((choice, index) => <li key={index}><span>{CHOICE_MARKS[index]}</span> <InlineText text={choice} /></li>)}</ol> : null}
    {question.type === "written" ? <div className={styles.writingLines} aria-label="답안 작성란">{Array.from({ length: question.lines }, (_, index) => <div key={index} />)}</div> : null}
  </li>;
}

function SentenceCell({ row, column, blank }: { readonly row: SentenceRow; readonly column: "english" | "meaning"; readonly blank: boolean }) {
  return <td className={styles[column]}>{blank ? <div className={styles.sentenceBlank} aria-label={`${row.number}번 작성란`} /> : <ChunkedText text={row[column]} />}</td>;
}

function Block({ block }: { readonly block: WorksheetBlock }) {
  switch (block.type) {
    case "notice": return <aside className={styles.notice}>{block.text}</aside>;
    case "sentences": return <table className={styles.sentenceTable}>
      <colgroup><col className={styles.numberColumn} /><col /><col className={styles.meaningColumn} /></colgroup>
      <thead><tr><th scope="col">번호</th><th scope="col">영어 문장</th><th scope="col">뜻</th></tr></thead>
      <tbody>{block.rows.map((row) => <tr key={row.number}>
        <td>{row.number}</td>
        <SentenceCell row={row} column="english" blank={block.blank === "english"} />
        <SentenceCell row={row} column="meaning" blank={block.blank === "meaning"} />
      </tr>)}</tbody>
    </table>;
    case "questions": return <ol className={styles.questions}>{block.questions.map((question) => <Question key={question.number} question={question} />)}</ol>;
    case "answers": {
      const noted = block.entries.some((entry) => entry.note);
      return <div className={`${styles.answers} ${noted ? styles.notedAnswers : ""}`}>{block.entries.map((entry) => <div key={entry.number} data-avoid-break="">
        <strong>{entry.number}.</strong> {entry.answer}{entry.note ? <span className={styles.answerNote}>{entry.note}</span> : null}
      </div>)}</div>;
    }
  }
}

export default function WorksheetView({ document }: { readonly document: WorksheetDocument }) {
  let headingNumber = 0;
  return <article className={styles.paper} data-worksheet="" aria-label={document.title} style={{ "--fit": worksheetFitScale(document) } as CSSProperties}>
    <header className={styles.header}><h1>{document.title}</h1><div className={styles.identity}>학번 <span /> 이름 <span /></div></header>
    {document.sections.map((section, index) => <section key={index} className={`${styles.section} ${section.newPage ? styles.newPage : ""}`} data-new-page={section.newPage ? "" : undefined}>
      {section.title ? <h2 className={styles.sectionTitle}><span>{(headingNumber += 1)}</span>{section.title}</h2> : null}
      {section.blocks.map((block, blockIndex) => <Block key={blockIndex} block={block} />)}
    </section>)}
    <footer className={styles.footer}>{document.footer}</footer>
  </article>;
}
