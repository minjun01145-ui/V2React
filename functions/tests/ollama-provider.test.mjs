import assert from "node:assert/strict";
import { listOllamaCloudModels, sendOllamaCloudChat } from "../lib/ai/ollamaProvider.js";

const settings = {
  provider: "ollama-cloud",
  baseUrl: "https://ollama.com/api",
  model: "gpt-oss:120b",
  temperature: 0.3,
  maxOutputTokens: 256,
  thinkingLevel: "off",
  timeoutSeconds: 30,
  enabled: true,
  updatedAtMs: 0,
};

let capturedUrl = "";
let capturedInit = null;
const modelFetch = async (input, init) => {
  capturedUrl = String(input);
  capturedInit = init;
  return new Response(JSON.stringify({ models: [{ name: "qwen3.5" }, { name: "gpt-oss:120b" }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

const models = await listOllamaCloudModels(settings, "secret-key-value", modelFetch);
assert.equal(capturedUrl, "https://ollama.com/api/tags");
assert.equal(capturedInit?.headers?.Authorization, "Bearer secret-key-value");
assert.deepEqual(models.models, ["gpt-oss:120b", "qwen3.5"]);

const chatFetch = async (input, init) => {
  capturedUrl = String(input);
  capturedInit = init;
  return new Response(JSON.stringify({
    model: "gpt-oss:120b",
    message: { role: "assistant", content: "테스트 답변" },
    prompt_eval_count: 12,
    eval_count: 7,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};

const chat = await sendOllamaCloudChat(settings, "secret-key-value", [{ role: "user", content: "안녕" }], chatFetch);
const body = JSON.parse(String(capturedInit?.body));
assert.equal(capturedUrl, "https://ollama.com/api/chat");
assert.equal(body.model, "gpt-oss:120b");
assert.equal(body.stream, false);
assert.equal(body.think, false);
assert.equal(body.options.num_predict, 256);
assert.equal(chat.reply, "테스트 답변");
assert.equal(chat.promptTokenCount, 12);
assert.equal(chat.outputTokenCount, 7);

await assert.rejects(
  () => listOllamaCloudModels(settings, "bad-key", async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })),
  /401.*unauthorized/,
);

console.log("Ollama provider tests passed");
