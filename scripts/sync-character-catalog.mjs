import fs from "node:fs/promises";

// MapleStory.IO V3: https://maplestory.io/swagger/V3/swagger.json
// Commit this small metadata snapshot so browsing and purchases never need the external API.
const categories = { hair: "Hair", face: "Face", hat: "Hat", top: "Top", bottom: "Bottom", shoes: "Shoes", accessory: "Face Accessory", weapon: "One-Handed Sword" };
const items = [];
for (const [category, subCategory] of Object.entries(categories)) {
  const params = new URLSearchParams({ subCategoryFilter: subCategory, count: category === "hair" ? "400" : "80" });
  const response = await fetch(`https://maplestory.io/api/GMS/214/item?${params}`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${category}: HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(`${category}: invalid item list`);
  const valid = data.filter((item) => Number.isSafeInteger(item.id) && typeof item.name === "string" && item.name.trim()
    && item.typeInfo?.subCategory === subCategory && (category !== "hair" || item.id % 10 === 0));
  items.push(...valid.slice(0, 32).map((item) => ({ itemId: item.id, name: item.name, category })));
  if (valid.length < 16) throw new Error(`${category}: too few valid items`);
}
const output = new URL("../functions/src/cosmetics/catalog.ts", import.meta.url);
const previous = await fs.readFile(output, "utf8").catch((error) => { if (error.code === "ENOENT") return ""; throw error; });
const existing = previous ? JSON.parse(previous.slice(previous.indexOf("[")).replace(/\s+as const;\s*$/, "")) : [];
// Retain old IDs when the provider's listing changes: students keep purchases forever.
const merged = [...new Map([...existing, ...items].map((item) => [item.itemId, item])).values()];
const source = `// Generated from MapleStory.IO GMS/214; refresh with node scripts/sync-character-catalog.mjs.\nexport const MAPLE_CATALOG = ${JSON.stringify(merged, null, 2)} as const;\n`;
await fs.mkdir(new URL("../functions/src/cosmetics/", import.meta.url), { recursive: true });
await fs.writeFile(output, source);
console.log(`Saved ${merged.length} character items.`);
