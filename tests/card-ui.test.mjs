import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const server = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-card-tests",
  plugins: [react()],
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { default: Card } = await server.ssrLoadModule("/src/shared/ui/Card.tsx");
  const classes = (markup) => markup.match(/class="([^"]+)"/)?.[1].split(/\s+/) ?? [];
  const baseClasses = classes(renderToStaticMarkup(createElement(Card, null, "내용")));
  assert.ok(baseClasses.length > 0, "Card supplies its own surface styling.");
  for (const as of ["section", "div", "form", "button"]) {
    const markup = renderToStaticMarkup(createElement(Card, { as, className: "layout-only", "aria-label": "검증 카드" }, "내용"));
    const renderedClasses = classes(markup);
    assert.ok(baseClasses.every((name) => renderedClasses.includes(name)), `${as}: adding layout classes must preserve Card styling.`);
    assert.ok(renderedClasses.includes("layout-only"));
    assert.ok(markup.startsWith(`<${as} `));
    assert.ok(markup.includes('aria-label="검증 카드"'));
  }
  console.log("Card UI composition regression tests passed");
} finally {
  await server.close();
}
