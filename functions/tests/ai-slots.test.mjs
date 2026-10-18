import assert from "node:assert/strict";
import { mock } from "node:test";
import { db } from "../lib/shared/firebase.js";
import { readAiProviderSettings, writeAiProviderSettings } from "../lib/ai/configRepository.js";
import { parseAiProviderSettings, parseAiSlot } from "../lib/ai/validation.js";

const ai1 = { provider: "ollama-cloud", baseUrl: "https://ollama.com/api", model: "deepseek-v4-flash", temperature: .3, maxOutputTokens: 4096, timeoutSeconds: 120, thinkingLevel: "high", enabled: true, updatedAtMs: 123 };
const documents = new Map([["ollama-cloud", ai1]]);
const dbMock = mock.method(db, "collection", name => {
  assert.equal(name, "aiProviderConfigs");
  return { doc: id => ({ get: async () => ({ exists: documents.has(id), data: () => documents.get(id) }), set: async data => { documents.set(id, data); } }) };
});
let sharedKey = "shared-existing-secret";
mock.module(new URL("../lib/ai/secretStore.js", import.meta.url), { namedExports: {
  readOllamaApiKey: async () => sharedKey, hasOllamaApiKey: async () => true, writeOllamaApiKey: async key => { sharedKey = key; },
} });
let selected;
mock.module(new URL("../lib/ai/ollamaProvider.js", import.meta.url), { namedExports: {
  sendOllamaCloudChat: async (settings, key) => { selected = { settings, key }; return { reply: "ok" }; },
  listOllamaCloudModels: async settings => ({ models: [settings.model], latencyMs: 1 }),
} });
const { generateAiReply, saveAdminAiSettings } = await import("../lib/ai/service.js");
try {
  assert.equal(parseAiSlot(undefined), "ai1"); assert.equal(parseAiSlot("ai2"), "ai2"); assert.throws(() => parseAiSlot("AI3"));
  assert.deepEqual(await readAiProviderSettings(), ai1);
  const ai2 = await readAiProviderSettings("ai2");
  assert.deepEqual(ai2, { ...ai1, thinkingLevel: "max", maxOutputTokens: 8192, timeoutSeconds: 300, updatedAtMs: 0 });
  assert.equal(documents.size, 1, "viewing defaults must not save a new document");
  await generateAiReply([{ role: "user", content: "test" }]);
  assert.equal(selected.settings.model, ai1.model); assert.equal(selected.settings.thinkingLevel, "high");
  await generateAiReply([{ role: "user", content: "test" }], { slot: "ai2" });
  assert.equal(selected.settings.thinkingLevel, "max"); assert.equal(selected.settings.maxOutputTokens, 8192);
  const saved = await saveAdminAiSettings({ ...ai2, model: "second-model", maxOutputTokens: 16384 }, "new-shared-secret", "teacher", "ai2");
  assert.equal(saved.model, "second-model");
  assert.equal((await readAiProviderSettings("ai1")).model, ai1.model);
  await writeAiProviderSettings({ ...ai1, model: "changed-ai1" }, "teacher");
  assert.equal((await readAiProviderSettings("ai2")).model, "second-model", "saved AI2 stops inheriting AI1");
  await generateAiReply([{ role: "user", content: "test" }]); assert.equal(selected.key, "new-shared-secret");
  assert.doesNotThrow(() => parseAiProviderSettings({ ...ai1, thinkingLevel: "max", maxOutputTokens: 16384, timeoutSeconds: 300 }));
  assert.throws(() => parseAiProviderSettings({ ...ai1, maxOutputTokens: 16385 }));
  assert.throws(() => parseAiProviderSettings({ ...ai1, timeoutSeconds: 301 }));
} finally { dbMock.mock.restore(); }
console.log("AI slot tests passed: inheritance, independence, shared key, defaults and expanded limits");
