import assert from "node:assert/strict";
import { validateAiSettings, validateAiTestMessage } from "../src/ai-admin/validation.ts";

const validSettings = {
  model: "gpt-oss:120b",
  temperature: 0.3,
  maxOutputTokens: 512,
  thinkingLevel: "off" as const,
  timeoutSeconds: 60,
  enabled: true,
};

assert.doesNotThrow(() => validateAiSettings(validSettings));
assert.throws(() => validateAiSettings({ ...validSettings, model: "bad model" }), /모델 이름/);
assert.throws(() => validateAiSettings({ ...validSettings, temperature: 3 }), /Temperature/);
assert.throws(() => validateAiSettings({ ...validSettings, apiKey: "short" }), /API 키/);
assert.doesNotThrow(() => validateAiTestMessage({ systemPrompt: "한국어로 답변", prompt: "안녕하세요" }));
assert.throws(() => validateAiTestMessage({ systemPrompt: "", prompt: "" }), /테스트 메시지/);

console.log("AI admin validation tests passed");
