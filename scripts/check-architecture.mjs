import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const violations = [];
const globalCssEntries = new Set([
  "src/apps/student/main.tsx",
  "src/apps/teacher/main.tsx",
  "src/apps/test-student/main.tsx",
]);
const sourceFiles = walk(srcRoot).filter((file) => /\.(ts|tsx)$/.test(file));
const dependencyGraph = new Map(sourceFiles.map((file) => [file, []]));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function importsOf(source) {
  const values = [];
  const pattern = /(?:import\s+(?:[^"']+?\s+from\s+)?|import\s*\()\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) values.push(match[1]);
  return values;
}

function containsExplicitAny(source) {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  return /:\s*any\b|\bas\s+any\b|<\s*any\s*>|\bany\s*\[\s*\]/.test(withoutComments);
}

function resolveRelativeImport(file, specifier) {
  if (!specifier.startsWith(".")) return null;
  return path.resolve(path.dirname(file), specifier);
}

function crossesRoleBoundary(rel, specifier) {
  const isStudentOwner = rel.startsWith("src/apps/student/") || rel.startsWith("src/features/student/");
  const isTeacherOwner = rel.startsWith("src/apps/teacher/") || rel.startsWith("src/features/teacher/");
  const importsStudent = specifier.includes("/apps/student/") || specifier.includes("/features/student/") || specifier.startsWith("../../features/student") || specifier.startsWith("../../../features/student");
  const importsTeacher = specifier.includes("/apps/teacher/") || specifier.includes("/features/teacher/") || specifier.startsWith("../../features/teacher") || specifier.startsWith("../../../features/teacher");
  return (isStudentOwner && importsTeacher) || (isTeacherOwner && importsStudent);
}

for (const file of sourceFiles) {
  const rel = relative(file);

  if (/\.(js|jsx)$/.test(file)) {
    violations.push(`${rel}: application source must use .ts/.tsx, not JavaScript`);
    continue;
  }
  if (!/\.(ts|tsx)$/.test(file)) continue;

  const source = fs.readFileSync(file, "utf8");
  const imports = importsOf(source);

  if (containsExplicitAny(source)) {
    violations.push(`${rel}: explicit 'any' is not allowed; use a real type or unknown + validation`);
  }

  for (const specifier of imports) {
    const resolved = resolveRelativeImport(file, specifier);
    if (resolved && !fs.existsSync(resolved)) {
      violations.push(`${rel}: relative import does not exist (${specifier})`);
    }
    if (resolved && dependencyGraph.has(resolved)) dependencyGraph.get(file).push(resolved);

    const isGlobalCss = specifier.endsWith(".css") && !specifier.endsWith(".module.css");
    if (isGlobalCss && !globalCssEntries.has(rel)) {
      violations.push(`${rel}: global CSS import '${specifier}' is only allowed in app entry points`);
    }

    if (crossesRoleBoundary(rel, specifier)) {
      violations.push(`${rel}: student and teacher app/feature layers must not import each other (${specifier})`);
    }

    if (rel.startsWith("src/games/") && (specifier.includes("/firebase/") || specifier.startsWith("firebase/"))) {
      violations.push(`${rel}: game modules must not access Firebase directly (${specifier})`);
    }

    if (rel.startsWith("src/games/") && specifier.includes("/ai-admin/")) {
      violations.push(`${rel}: game modules must use a game-specific server AI contract, not the teacher AI admin client (${specifier})`);
    }

    if (rel.startsWith("src/games/") && (specifier.includes("/apps/") || specifier.includes("/features/"))) {
      violations.push(`${rel}: game modules must not depend on app/feature UI layers (${specifier})`);
    }

    if ((rel.startsWith("src/game-engine/core/") ||
         rel === "src/game-engine/timed-game/config.ts" ||
         rel === "src/game-engine/timed-game/clock.ts" ||
         (rel.startsWith("src/game-engine/question-engine/") && !rel.endsWith("useQuestionEngine.ts") && !rel.includes("/multiplayer/"))) &&
        (specifier === "react" || specifier.startsWith("firebase/") || specifier.includes("/games/") || specifier.includes("/learning-sets/") || specifier.includes("/multiplayer/"))) {
      violations.push(`${rel}: pure engine code may not depend on React, Firebase, concrete games, learning sets, or app multiplayer (${specifier})`);
    }

    if (rel.startsWith("src/shared/ui/") &&
        (specifier.includes("/games/") || specifier.includes("/features/") || specifier.includes("/multiplayer/") ||
         specifier.includes("/auth/") || specifier.includes("/firebase/") || specifier.includes("/game-engine/"))) {
      violations.push(`${rel}: shared UI primitives must stay domain-neutral (${specifier})`);
    }

    if (rel.startsWith("src/shared/popup/") &&
        (specifier.includes("/apps/") || specifier.includes("/features/") || specifier.includes("/games/") ||
         specifier.includes("/auth/") || specifier.includes("/firebase/") || specifier.includes("/multiplayer/"))) {
      violations.push(`${rel}: popup engine must remain domain-neutral (${specifier})`);
    }

    if (rel.startsWith("src/multiplayer/") && specifier.includes("/games/")) {
      violations.push(`${rel}: multiplayer base may not depend on a concrete game (${specifier})`);
    }

    if (rel.startsWith("src/ai-admin/") && (specifier.includes("/apps/") || specifier.includes("/features/") || specifier.includes("/games/"))) {
      violations.push(`${rel}: AI admin domain must not depend on app, feature, or game UI layers (${specifier})`);
    }

    if (rel.startsWith("src/learning-sets/") && (specifier.includes("/apps/") || specifier.includes("/features/") || specifier.includes("/games/") || specifier.includes("/multiplayer/"))) {
      violations.push(`${rel}: learning set domain must not depend on app, feature, game, or multiplayer layers (${specifier})`);
    }

    if (rel.startsWith("src/classroom-test/") &&
        (specifier === "react" || specifier.startsWith("firebase/") || specifier.includes("/apps/") || specifier.includes("/features/") ||
         specifier.includes("/games/") || specifier.includes("/multiplayer/") || specifier.includes("/firebase/"))) {
      violations.push(`${rel}: classroom test model must remain pure and isolated (${specifier})`);
    }

    if (rel.startsWith("src/classroom-test-admin/") &&
        (specifier.includes("/apps/") || specifier.includes("/features/") || specifier.includes("/games/") || specifier.includes("/multiplayer/"))) {
      violations.push(`${rel}: classroom test admin transport must not depend on app, feature, game, or multiplayer layers (${specifier})`);
    }

    if (rel.startsWith("src/features/teacher/test-tool/") &&
        (specifier.startsWith("firebase/") || specifier.includes("/features/student/") || specifier.includes("/multiplayer/") ||
         specifier.includes("/firebase/") || specifier.includes("/auth/") || specifier.includes("/games/"))) {
      violations.push(`${rel}: teacher test tool must not access real student, auth, game, Firebase, or multiplayer state (${specifier})`);
    }
  }
}

const visiting = new Set();
const visited = new Set();
function visitDependency(file, trail) {
  if (visiting.has(file)) {
    violations.push(`circular dependency: ${[...trail, file].map(relative).join(" -> ")}`);
    return;
  }
  if (visited.has(file)) return;
  visiting.add(file);
  for (const dependency of dependencyGraph.get(file) ?? []) visitDependency(dependency, [...trail, file]);
  visiting.delete(file);
  visited.add(file);
}
for (const file of sourceFiles) visitDependency(file, []);

const studentHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const teacherHtml = fs.readFileSync(path.join(root, "teacher/index.html"), "utf8");
const testStudentHtml = fs.readFileSync(path.join(root, "test-student/index.html"), "utf8");
if (!studentHtml.includes("/src/apps/student/main.tsx")) violations.push("index.html: must load the student entry only");
if (studentHtml.includes("/src/apps/teacher/")) violations.push("index.html: must not load teacher app code");
if (!teacherHtml.includes("/src/apps/teacher/main.tsx")) violations.push("teacher/index.html: must load the teacher entry only");
if (teacherHtml.includes("/src/apps/student/")) violations.push("teacher/index.html: must not load student app code");
if (/\sstyle\s*=/.test(studentHtml)) violations.push("index.html: visual styling belongs in React CSS modules, not the HTML entry");
if (/\sstyle\s*=/.test(teacherHtml)) violations.push("teacher/index.html: visual styling belongs in React CSS modules, not the HTML entry");
if (!testStudentHtml.includes("/src/apps/test-student/main.tsx")) violations.push("test-student/index.html: must load the test student entry only");
if (testStudentHtml.includes("/src/apps/teacher/") || testStudentHtml.includes("/src/apps/student/main.tsx")) violations.push("test-student/index.html: must not load a normal student or teacher entry");
if (/\sstyle\s*=/.test(testStudentHtml)) violations.push("test-student/index.html: visual styling belongs in React CSS modules, not the HTML entry");

const registrySource = fs.readFileSync(path.join(srcRoot, "games/registry.ts"), "utf8");
if (!registrySource.includes("loadStudent:") || !registrySource.includes("loadTeacher:")) {
  violations.push("src/games/registry.ts: every game registry must use role-specific loadStudent/loadTeacher entries");
}

for (const entry of fs.readdirSync(path.join(srcRoot, "games"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const gameDir = path.join(srcRoot, "games", entry.name);
  const filenames = fs.readdirSync(gameDir);
  const hasPureGameLogic = filenames.includes("evaluator.ts") || filenames.some((name) => /Adapter\.ts$/.test(name)) || filenames.includes("adapter.ts");
  if (hasPureGameLogic) {
    const expectedTest = path.join(root, "tests", "games", `${entry.name}.test.ts`);
    if (!fs.existsSync(expectedTest)) {
      violations.push(`src/games/${entry.name}: evaluator/adapter logic requires tests/games/${entry.name}.test.ts`);
    }
  }
}

if (fs.existsSync(path.join(srcRoot, "game-engine/hooks")) || fs.existsSync(path.join(srcRoot, "game-engine/multiplayer"))) {
  violations.push("src/game-engine: question-style hooks/persistence must live under question-engine, not generic game-engine folders");
}

if (violations.length) {
  console.error("Architecture checks failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("architecture checks passed");
