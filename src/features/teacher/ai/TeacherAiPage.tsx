import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getAiProviderSettings, saveAiProviderSettings, sendAiTestMessage, testAiProviderConnection } from "../../../ai-admin/repository.ts";
import { type AiProviderSettings, type AiProviderSettingsInput, type AiSlot, type AiThinkingLevel } from "../../../ai-admin/types.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import styles from "./TeacherAiPage.module.css";

const slots: readonly AiSlot[] = ["ai1", "ai2"];

function AiSettingsCard({ slot, saved, apiKey, apiKeyConfigured, disabled, models, onSaved, onBusy, onError, onConnection }: {
  readonly slot: AiSlot;
  readonly saved: AiProviderSettings;
  readonly apiKey: string;
  readonly apiKeyConfigured: boolean;
  readonly disabled: boolean;
  readonly models: readonly string[];
  readonly onSaved: (slot: AiSlot, settings: AiProviderSettings) => void;
  readonly onBusy: (busy: string) => void;
  readonly onError: (error: string) => void;
  readonly onConnection: (slot: AiSlot) => Promise<void>;
}) {
  const [settings, setSettings] = useState<AiProviderSettingsInput>(saved);
  useEffect(() => setSettings(saved), [saved]);
  const update = <Key extends keyof AiProviderSettingsInput>(key: Key, value: AiProviderSettingsInput[Key]): void => {
    setSettings(current => ({ ...current, [key]: value }));
  };
  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    onBusy(`save-${slot}`);
    onError("");
    try {
      const next = await saveAiProviderSettings({ ...settings, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) }, slot);
      onSaved(slot, next);
    } catch (error: unknown) {
      onError(toErrorMessage(error, "AI 설정을 저장하지 못했습니다."));
    } finally { onBusy(""); }
  };
  return <Card as="form" className={styles.form} onSubmit={event => void save(event)} aria-label={`${slot.toUpperCase()} 설정`}>
    <h2>{slot.toUpperCase()}</h2>
    <label>모델<input list={`ollama-models-${slot}`} maxLength={120} value={settings.model} onChange={event => update("model", event.target.value)} disabled={disabled} required /></label>
    <datalist id={`ollama-models-${slot}`}>{models.map(model => <option value={model} key={model} />)}</datalist>
    <div className={styles.compactFields}>
      <label>Temperature<input type="number" min="0" max="2" step="0.1" value={settings.temperature} onChange={event => update("temperature", Number(event.target.value))} disabled={disabled} required /></label>
      <label>최대 출력 토큰<input type="number" min="16" max="16384" step="1" value={settings.maxOutputTokens} onChange={event => update("maxOutputTokens", Number(event.target.value))} disabled={disabled} required /></label>
      <label>응답 제한(초)<input type="number" min="10" max="300" step="1" value={settings.timeoutSeconds} onChange={event => update("timeoutSeconds", Number(event.target.value))} disabled={disabled} required /></label>
      <label>사고 수준<select value={settings.thinkingLevel} onChange={event => update("thinkingLevel", event.target.value as AiThinkingLevel)} disabled={disabled}><option value="off">사용 안 함</option><option value="low">낮음</option><option value="medium">중간</option><option value="high">높음</option><option value="max">최대</option></select></label>
    </div>
    <label className={styles.check}><input type="checkbox" checked={settings.enabled} onChange={event => update("enabled", event.target.checked)} disabled={disabled} /> 이 AI 사용</label>
    <p className={styles.meta}>{saved.updatedAtMs ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(saved.updatedAtMs) : "아직 저장되지 않음"}</p>
    <div className={styles.buttonRow}><Button type="submit" disabled={disabled}>저장</Button><Button variant="ghost" onClick={() => void onConnection(slot)} disabled={disabled || !apiKeyConfigured || !saved.enabled}>연결 테스트</Button></div>
  </Card>;
}

export default function TeacherAiPage() {
  const [saved, setSaved] = useState<Record<AiSlot, AiProviderSettings> | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<readonly string[]>([]);
  const [testSlot, setTestSlot] = useState<AiSlot>("ai1");
  const [systemPrompt, setSystemPrompt] = useState("You are a concise classroom assistant. Reply in Korean unless the user requests another language.");
  const [prompt, setPrompt] = useState("중학생이 이해할 수 있도록 인공지능을 한 문장으로 설명해 줘.");
  const [reply, setReply] = useState("");
  const [replyMeta, setReplyMeta] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async (): Promise<void> => {
    setBusy("load"); setError("");
    try {
      const [ai1, ai2] = await Promise.all([getAiProviderSettings("ai1"), getAiProviderSettings("ai2")]);
      setSaved({ ai1, ai2 });
    } catch (value: unknown) { setError(toErrorMessage(value, "AI 설정을 불러오지 못했습니다.")); }
    finally { setBusy(""); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const testConnection = async (slot: AiSlot): Promise<void> => {
    setBusy("connection"); setError(""); setNotice("");
    try {
      const result = await testAiProviderConnection(slot);
      setModels(result.models);
      setNotice(`${slot.toUpperCase()} · Ollama Cloud 인증과 모델 목록 조회에 성공했습니다. ${result.latencyMs.toLocaleString()}ms · ${result.models.length}개`);
    } catch (value: unknown) { setError(toErrorMessage(value, "Ollama Cloud 연결 테스트에 실패했습니다.")); }
    finally { setBusy(""); }
  };
  const submitMessage = async (event: FormEvent): Promise<void> => {
    event.preventDefault(); setBusy("message"); setError(""); setNotice(""); setReply(""); setReplyMeta("");
    try {
      const result = await sendAiTestMessage({ systemPrompt, prompt }, testSlot);
      setReply(result.reply);
      setReplyMeta(`${testSlot.toUpperCase()} · ${result.model} · ${result.latencyMs.toLocaleString()}ms · 입력 ${result.promptTokenCount ?? "—"} / 출력 ${result.outputTokenCount ?? "—"}`);
    } catch (value: unknown) { setError(toErrorMessage(value, "AI 메시지 테스트에 실패했습니다.")); }
    finally { setBusy(""); }
  };
  const onSaved = (slot: AiSlot, next: AiProviderSettings): void => {
    setSaved(current => current ? { ...current, [slot]: next } : current);
    setApiKey(""); setNotice(`${slot.toUpperCase()} 설정을 안전하게 저장했습니다.`);
  };
  const apiKeyConfigured = Boolean(saved?.ai1.apiKeyConfigured || saved?.ai2.apiKeyConfigured);
  return <section className={styles.settings} aria-label="AI 설정">
    <header className={styles.header}><h2>AI 설정</h2><Button variant="ghost" onClick={() => void load()} disabled={Boolean(busy)}>새로고침</Button></header>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    <Card as="div" className={styles.form}><h2>Ollama Cloud</h2><label>API 키<input type="password" autoComplete="new-password" placeholder={apiKeyConfigured ? "변경할 때만 입력" : "Ollama API 키"} value={apiKey} onChange={event => setApiKey(event.target.value)} disabled={Boolean(busy)} /></label></Card>
    {saved ? <div className={styles.columns}>{slots.map(slot => <AiSettingsCard key={slot} slot={slot} saved={saved[slot]} apiKey={apiKey} apiKeyConfigured={apiKeyConfigured} disabled={Boolean(busy)} models={models} onSaved={onSaved} onBusy={value => { setBusy(value); setNotice(""); }} onError={setError} onConnection={testConnection} />)}</div> : busy ? <p role="status">불러오는 중…</p> : null}
    <Card as="form" className={styles.form} onSubmit={event => void submitMessage(event)}>
      <h2>메시지 전송</h2>
      <label>AI<select value={testSlot} onChange={event => setTestSlot(event.target.value as AiSlot)} disabled={Boolean(busy)}><option value="ai1">AI1</option><option value="ai2">AI2</option></select></label>
      <label>시스템 지시<textarea rows={3} maxLength={2000} value={systemPrompt} onChange={event => setSystemPrompt(event.target.value)} disabled={Boolean(busy)} /></label>
      <label>사용자 메시지<textarea rows={4} maxLength={4000} value={prompt} onChange={event => setPrompt(event.target.value)} disabled={Boolean(busy)} required /></label>
      <Button type="submit" disabled={!apiKeyConfigured || !saved?.[testSlot].enabled || Boolean(busy)}>{busy === "message" ? "응답 대기 중…" : "보내기"}</Button>
      {reply ? <div className={styles.response}><span>AI 응답</span><p>{reply}</p><small>{replyMeta}</small></div> : null}
    </Card>
  </section>;
}
