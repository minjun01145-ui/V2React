import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  getAiProviderSettings,
  saveAiProviderSettings,
  sendAiTestMessage,
  testAiProviderConnection,
} from "../../../ai-admin/repository.ts";
import { AI_PROVIDER_ID, OLLAMA_CLOUD_ENDPOINT, type AiProviderSettings, type AiThinkingLevel } from "../../../ai-admin/types.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import PageShell from "../../../shared/PageShell.tsx";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Eyebrow, Muted } from "../../../shared/ui/Typography.tsx";
import styles from "./TeacherAiPage.module.css";

interface EditableSettings {
  readonly model: string;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  readonly thinkingLevel: AiThinkingLevel;
  readonly timeoutSeconds: number;
  readonly enabled: boolean;
}

const defaults: EditableSettings = {
  model: "gpt-oss:120b",
  temperature: 0.3,
  maxOutputTokens: 512,
  thinkingLevel: "off",
  timeoutSeconds: 60,
  enabled: true,
};

function editable(settings: AiProviderSettings): EditableSettings {
  return {
    model: settings.model,
    temperature: settings.temperature,
    maxOutputTokens: settings.maxOutputTokens,
    thinkingLevel: settings.thinkingLevel,
    timeoutSeconds: settings.timeoutSeconds,
    enabled: settings.enabled,
  };
}

function formatUpdatedAt(value: number): string {
  return value > 0 ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(value) : "아직 저장되지 않음";
}

export default function TeacherAiPage({ roomId }: { readonly roomId: string }) {
  const [settings, setSettings] = useState<EditableSettings>(defaults);
  const [saved, setSaved] = useState<AiProviderSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<readonly string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("You are a concise classroom assistant. Reply in Korean unless the user requests another language.");
  const [prompt, setPrompt] = useState("중학생이 이해할 수 있도록 인공지능을 한 문장으로 설명해 줘.");
  const [reply, setReply] = useState("");
  const [replyMeta, setReplyMeta] = useState("");
  const [connectionMeta, setConnectionMeta] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (): Promise<void> => {
    setBusy("load");
    setError("");
    try {
      const next = await getAiProviderSettings();
      setSaved(next);
      setSettings(editable(next));
    } catch (value: unknown) {
      setError(toErrorMessage(value, "AI 설정을 불러오지 못했습니다."));
    } finally {
      setBusy("");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = <Key extends keyof EditableSettings>(key: Key, value: EditableSettings[Key]): void => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const submitSettings = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const next = await saveAiProviderSettings({ ...settings, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) });
      setSaved(next);
      setSettings(editable(next));
      setApiKey("");
      setNotice("Ollama Cloud 설정을 안전하게 저장했습니다.");
    } catch (value: unknown) {
      setError(toErrorMessage(value, "AI 설정을 저장하지 못했습니다."));
    } finally {
      setBusy("");
    }
  };

  const testConnection = async (): Promise<void> => {
    setBusy("connection");
    setError("");
    setNotice("");
    setConnectionMeta("");
    try {
      const result = await testAiProviderConnection();
      setModels(result.models);
      setConnectionMeta(`${result.latencyMs.toLocaleString()}ms · 사용 가능 모델 ${result.models.length}개`);
      setNotice("Ollama Cloud 인증과 모델 목록 조회에 성공했습니다.");
    } catch (value: unknown) {
      setError(toErrorMessage(value, "Ollama Cloud 연결 테스트에 실패했습니다."));
    } finally {
      setBusy("");
    }
  };

  const submitMessage = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy("message");
    setError("");
    setNotice("");
    setReply("");
    setReplyMeta("");
    try {
      const result = await sendAiTestMessage({ systemPrompt, prompt });
      setReply(result.reply);
      const tokens = [result.promptTokenCount === null ? null : `입력 ${result.promptTokenCount}`, result.outputTokenCount === null ? null : `출력 ${result.outputTokenCount}`].filter(Boolean).join(" · ");
      setReplyMeta(`${result.model} · ${result.latencyMs.toLocaleString()}ms${tokens ? ` · ${tokens}` : ""}`);
      setNotice("실제 메시지 전송과 응답 수신에 성공했습니다.");
    } catch (value: unknown) {
      setError(toErrorMessage(value, "AI 메시지 테스트에 실패했습니다."));
    } finally {
      setBusy("");
    }
  };

  const readyForTest = Boolean(saved?.apiKeyConfigured && saved.enabled && !busy);
  const statusLabel = saved?.apiKeyConfigured ? (saved.enabled ? "사용 가능" : "비활성화") : "API 키 필요";
  const modelOptions = useMemo(() => models.includes(settings.model) ? models : [settings.model, ...models], [models, settings.model]);

  return (
    <PageShell eyebrow="AI PROVIDER" title="AI API 관리" roomId={roomId} actions={<Button variant="ghost" onClick={() => void load()} disabled={Boolean(busy)}>새로고침</Button>}>
      <div className={styles.statusGrid}>
        <Card as="div"><span>공급자</span><strong>Ollama Cloud</strong><small>{AI_PROVIDER_ID}</small></Card>
        <Card as="div"><span>상태</span><strong>{statusLabel}</strong></Card>
        <Card as="div"><span>마지막 저장</span><strong className={styles.date}>{formatUpdatedAt(saved?.updatedAtMs ?? 0)}</strong></Card>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      <div className={styles.columns}>
        <Card as="form" className={styles.form} onSubmit={(event) => void submitSettings(event)}>
          <div><Eyebrow>PROVIDER SETTINGS</Eyebrow><h2>Ollama Cloud</h2><Muted>API 키는 Google Secret Manager에 저장됩니다.</Muted></div>
          <label>API 엔드포인트<input value={OLLAMA_CLOUD_ENDPOINT} readOnly /></label>
          <label>API 키<input type="password" autoComplete="new-password" placeholder={saved?.apiKeyConfigured ? "변경할 때만 입력" : "Ollama API 키"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={Boolean(busy)} /></label>
          <label>모델<input list="ollama-models" maxLength={120} value={settings.model} onChange={(event) => update("model", event.target.value)} disabled={Boolean(busy)} required /></label>
          <datalist id="ollama-models">{modelOptions.map((model) => <option value={model} key={model} />)}</datalist>
          <div className={styles.compactFields}>
            <label>Temperature<input type="number" min="0" max="2" step="0.1" value={settings.temperature} onChange={(event) => update("temperature", Number(event.target.value))} disabled={Boolean(busy)} required /></label>
            <label>최대 출력 토큰<input type="number" min="16" max="4096" step="1" value={settings.maxOutputTokens} onChange={(event) => update("maxOutputTokens", Number(event.target.value))} disabled={Boolean(busy)} required /></label>
            <label>응답 제한(초)<input type="number" min="10" max="120" step="1" value={settings.timeoutSeconds} onChange={(event) => update("timeoutSeconds", Number(event.target.value))} disabled={Boolean(busy)} required /></label>
            <label>사고 수준<select value={settings.thinkingLevel} onChange={(event) => update("thinkingLevel", event.target.value as AiThinkingLevel)} disabled={Boolean(busy)}><option value="off">사용 안 함</option><option value="low">낮음</option><option value="medium">중간</option><option value="high">높음</option></select></label>
          </div>
          <label className={styles.check}><input type="checkbox" checked={settings.enabled} onChange={(event) => update("enabled", event.target.checked)} disabled={Boolean(busy)} /> 이 AI 공급자 사용</label>
          <div className={styles.buttonRow}>
            <Button type="submit" disabled={Boolean(busy)}>{busy === "save" ? "저장 중…" : "저장"}</Button>
            <Button variant="ghost" onClick={() => void testConnection()} disabled={!readyForTest}>{busy === "connection" ? "연결 중…" : "연결 테스트"}</Button>
          </div>
          {connectionMeta ? <p className={styles.meta}>{connectionMeta}</p> : null}
        </Card>

        <Card as="form" className={styles.form} onSubmit={(event) => void submitMessage(event)}>
          <div><Eyebrow>MESSAGE TEST</Eyebrow><h2>메시지 전송</h2></div>
          <label>시스템 지시<textarea rows={4} maxLength={2000} value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} disabled={Boolean(busy)} /></label>
          <label>사용자 메시지<textarea rows={6} maxLength={4000} value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={Boolean(busy)} required /></label>
          <Button type="submit" disabled={!readyForTest}>{busy === "message" ? "응답 대기 중…" : "보내기"}</Button>
          {reply ? <div className={styles.response}><span>AI 응답</span><p>{reply}</p>{replyMeta ? <small>{replyMeta}</small> : null}</div> : null}
        </Card>
      </div>
    </PageShell>
  );
}
