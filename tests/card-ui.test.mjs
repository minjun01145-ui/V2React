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
  server: { middlewareMode: true, watch: { ignored: ["**/external-test-browser/**"] } },
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

  const { default: GamePicker } = await server.ssrLoadModule("/src/features/teacher/room-control/GamePicker.tsx");
  const { listGames } = await server.ssrLoadModule("/src/games/registry.ts");
  const pickerProps = { games: listGames().filter((game) => game.supportedSetTypes.length > 0), selectedId: "matching-all", onSelect: () => {}, disabled: false };
  const picker = renderToStaticMarkup(createElement(GamePicker, pickerProps));
  const groups = [...picker.matchAll(/<section\b[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)];
  assert.deepEqual(groups.map((group) => group[1]), ["학습", "타자", "게임"]);
  const expectedLabels = [
    ["AI 문답", "객관식 퀴즈", "짝 맞추기(모든 카드)", "짝 맞추기(일부 카드)", "문장 만들기"],
    ["문장 타자", "산성비", "무궁화 탈출"],
    ["학습 점프타워", "1:1 배틀", "단어 우노", "커플 문장 만들기", "포켓몬 잡기", "달리기", "벽돌 팡팡", "플랫포머 문장 만들기", "점프 문장 만들기"],
  ];
  groups.forEach((group, index) => {
    const labels = [...group[2].matchAll(/<button\b[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span><\/button>/g)].map((match) => match[1]);
    assert.deepEqual(labels, expectedLabels[index], "teacher picker preserves the requested groups and order");
  });
  // Regression: brick-smash was registered but never offered, so teachers could not start it.
  assert.equal((picker.match(/<button\b/g) ?? []).length, pickerProps.games.filter((game) => game.id !== "placeholder").length, "every playable registered game is offered in the picker");
  const selectedButtons = [...picker.matchAll(/<button[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.equal(selectedButtons.length, 1);
  assert.ok(selectedButtons[0][1].includes("짝 맞추기(모든 카드)"), "the renamed choice retains its original game id selection");
  const disabledPicker = renderToStaticMarkup(createElement(GamePicker, { ...pickerProps, disabled: true }));
  assert.equal((disabledPicker.match(/ disabled=""/g) ?? []).length, expectedLabels.flat().length, "all game choices remain disabled while starting");
  const subset = renderToStaticMarkup(createElement(GamePicker, { ...pickerProps, games: pickerProps.games.filter((game) => game.id === "typing") }));
  assert.equal((subset.match(/<section\b/g) ?? []).length, 1, "unavailable games and empty groups are omitted");
  const newGame = { ...pickerProps.games[0], id: "new-playable-game", title: "새 학습 게임" };
  for (const games of [[...pickerProps.games, newGame], [newGame]]) {
    const markup = renderToStaticMarkup(createElement(GamePicker, {
      ...pickerProps, games, selectedId: newGame.id, disabled: true,
    }));
    assert.equal((markup.match(/<button\b/g) ?? []).length, games.length, "ungrouped games are offered exactly once");
    const defaultGroup = markup.match(/<section\b[^>]*aria-label="게임"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(defaultGroup?.includes(newGame.title), "new games use their registry title in the default group");
    assert.match(defaultGroup, /<button[^>]*aria-pressed="true"[^>]*disabled=""[^>]*>[\s\S]*새 학습 게임/, "new games preserve selection and disabled state");
  }
  console.log("Teacher game picker grouping regression tests passed");
} finally {
  await server.close();
}
