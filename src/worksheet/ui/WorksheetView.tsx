import type { WorksheetBlock, WorksheetDocument, WorksheetQuestion } from "../types.ts";
import styles from "./Worksheet.module.css";

function ChunkedText({ text }: { readonly text: string }) {
  return text.split("/").map((chunk, index) => <span key={index}>{index ? <span className={styles.slash}> / </span> : null}{chunk.trim()}</span>);
}

function Question({ question }: { readonly question: WorksheetQuestion }) {
  const parts = question.type === "blank" ? question.text.split("{{blank}}") : [question.text];
  return <li className={styles.question}>
    <div className={styles.questionPrompt}><strong>{question.number}.</strong><div>{parts.map((part, index) => <span key={index}>{index && question.type === "blank" ? <span className={styles.blank} style={{ width: `${Math.min(90, Math.max(22, question.answerLength * 2.1))}mm` }} aria-label="빈칸" /> : null}{part}</span>)}</div></div>
    {question.type === "choice" ? <ol className={`${styles.choices} ${question.choices.some(choice => choice.length > 45) ? styles.longChoices : ""}`}>{question.choices.map((choice, index) => <li key={index}><span>{["①", "②", "③", "④", "⑤"][index]}</span> {choice}</li>)}</ol> : null}
    {question.type === "written" ? <div className={styles.writingLines} aria-label="답안 작성란">{Array.from({ length: question.lines }, (_, index) => <div key={index} />)}</div> : null}
  </li>;
}

function Block({ block }: { readonly block: WorksheetBlock }) {
  switch (block.type) {
    case "notice": return <aside className={styles.notice}>{block.text}</aside>;
    case "sentences": return <table className={styles.sentenceTable}><colgroup><col className={styles.numberColumn} /><col /><col className={styles.meaningColumn} /></colgroup><thead><tr><th scope="col">번호</th><th scope="col">영어 문장</th><th scope="col">뜻</th></tr></thead><tbody>{block.rows.map(row => <tr key={row.number}><td>{row.number}</td><td className={styles.english}>{block.writing ? <div className={styles.sentenceBlank} aria-label={`${row.number}번 영어 작성란`} /> : <ChunkedText text={row.english} />}</td><td className={styles.meaning}><ChunkedText text={row.meaning} /></td></tr>)}</tbody></table>;
    case "questions": return <ol className={styles.questions}>{block.questions.map(question => <Question key={question.number} question={question} />)}</ol>;
    case "answers": return <div className={styles.answers}>{block.entries.map(entry => <div key={entry.number}><strong>{entry.number}.</strong> {entry.answer}</div>)}</div>;
  }
}

export default function WorksheetView({ document }: { readonly document: WorksheetDocument }) {
  return <article className={styles.paper} data-worksheet="" aria-label={document.title}>
    <header className={styles.header}><div><h1>{document.title}</h1><p>{document.subtitle}</p></div><div className={styles.identity}>학번 <span /> 이름 <span /></div></header>
    {document.sections.map((section, index) => <section key={index} className={`${styles.section} ${section.newPage ? styles.newPage : ""}`}>
      <h2 className={styles.sectionTitle}><span>{index + 1}</span>{section.title}</h2>
      {section.blocks.map((block, blockIndex) => <Block key={blockIndex} block={block} />)}
    </section>)}
    <footer className={styles.footer}>{document.subtitle} · {document.kind}</footer>
  </article>;
}
