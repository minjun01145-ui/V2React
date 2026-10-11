import { newQuestion, OPTION_COLORS, OPTION_SYMBOLS } from "../../../slide-question/model.ts";
import type { QuestionSource, QuestionType } from "../../../slide-question/model.ts";
import Button from "../../../shared/ui/Button.tsx";
import Field from "../../../shared/ui/Field.tsx";
import Select from "../../../shared/ui/Select.tsx";
import styles from "./SlideEnginePanel.module.css";

export default function SlideQuestionSettings({ source, disabled, onChange }: { readonly source: QuestionSource; readonly disabled: boolean; readonly onChange: (value: QuestionSource) => void }) {
  const { question, grading } = source;
  const correct = grading && "correctOptions" in grading ? grading.correctOptions : [];
  const answer = grading && "answer" in grading ? grading.answer : "";
  return <div className={styles.items}>
    <Field label="유형"><Select value={question.type} disabled={disabled} onChange={(event) => { const next = newQuestion(event.target.value as QuestionType); onChange({ ...next, question: { ...next.question, prompt: question.prompt, doublePoints: question.doublePoints } }); }}>
      <option value="multiple-choice">객관식</option><option value="ox">OX형</option><option value="short-answer">단답형</option><option value="ai-short-answer">AI 단답형</option>
    </Select></Field>
    <Field label="문제"><textarea className={styles.textarea} value={question.prompt} maxLength={1000} rows={3} disabled={disabled} onChange={(event) => onChange({ ...source, question: { ...question, prompt: event.target.value } })} /></Field>
    <label><input type="checkbox" checked={question.doublePoints} disabled={disabled} onChange={(event) => onChange({ ...source, question: { ...question, doublePoints: event.target.checked } })} /> 점수 2배</label>
    {question.type === "multiple-choice" ? <>
      {question.options.map((option, index) => <div className={styles.questionOption} key={index}>
        <span className={styles.optionChip} style={{ backgroundColor: OPTION_COLORS[index] }}>{OPTION_SYMBOLS[index]}</span>
        <input className={styles.input} aria-label={`${index + 1}번 선택지`} value={option} maxLength={500} disabled={disabled} onChange={(event) => onChange({ ...source, question: { ...question, options: question.options.map((item, i) => i === index ? event.target.value : item) } })} />
        <label><input type="checkbox" aria-label={`${index + 1}번 정답`} checked={correct.includes(index)} disabled={disabled} onChange={(event) => onChange({ ...source, grading: { correctOptions: event.target.checked ? [...correct, index] : correct.filter((item) => item !== index) } })} /> 정답</label>
        {question.options.length > 2 ? <Button variant="quiet" size="sm" aria-label={`${index + 1}번 선택지 삭제`} disabled={disabled} onClick={() => onChange({ ...source, question: { ...question, options: question.options.filter((_, i) => i !== index) }, grading: { correctOptions: correct.filter((item) => item !== index).map((item) => item > index ? item - 1 : item) } })}>×</Button> : null}
      </div>)}
      {question.options.length < 5 ? <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange({ ...source, question: { ...question, options: [...question.options, ""] } })}>선택지 추가</Button> : null}
    </> : question.type === "ox" ? <Field label="정답"><Select value={answer} disabled={disabled} onChange={(event) => onChange({ ...source, grading: { answer: event.target.value } })}><option value="O">O</option><option value="X">X</option></Select></Field>
      : <Field label="정답"><input className={styles.input} value={answer} maxLength={500} disabled={disabled} onChange={(event) => onChange({ ...source, grading: { answer: event.target.value } })} /></Field>}
  </div>;
}
