import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { collectApplicationSourceFiles } from "./architecture-source-files.mjs";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const violations = [];
// Keep this checker focused on dependency direction and entry-point isolation.
// Implementation shape, naming and style belong in code review or focused tests.
const { javaScriptFiles, typeScriptFiles: sourceFiles } = collectApplicationSourceFiles(srcRoot);
const dependencyGraph = new Map(sourceFiles.map((file) => [file, []]));

for (const file of javaScriptFiles) {
  violations.push(`${relative(file)}: application source must use .ts/.tsx, not JavaScript`);
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

function concreteGameOwner(rel) {
  return /^src\/games\/([^/]+)\//.exec(rel)?.[1] ?? null;
}

for (const file of sourceFiles) {
  const rel = relative(file);

  const source = fs.readFileSync(file, "utf8");
  const imports = importsOf(source);

  for (const specifier of imports) {
    const resolved = resolveRelativeImport(file, specifier);
    if (resolved && !fs.existsSync(resolved)) {
      violations.push(`${rel}: relative import does not exist (${specifier})`);
    }
    if (resolved && dependencyGraph.has(resolved)) dependencyGraph.get(file).push(resolved);

    if (crossesRoleBoundary(rel, specifier)) {
      violations.push(`${rel}: student and teacher app/feature layers must not import each other (${specifier})`);
    }

    if (resolved) {
      const owner = concreteGameOwner(rel);
      const importedOwner = concreteGameOwner(relative(resolved));
      if (owner && importedOwner && owner !== importedOwner) {
        violations.push(`${rel}: concrete games must not import each other (${specifier})`);
      }
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
         rel.startsWith("src/game-engine/pair-matching/") ||
         rel.startsWith("src/game-engine/progress/") ||
         rel.startsWith("src/game-engine/scoring/") ||
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

    if (rel.startsWith("src/multiplayer/") && specifier.includes("/quiz-game/")) {
      violations.push(`${rel}: multiplayer base may not depend on quiz game (${specifier})`);
    }

    if (rel.startsWith("src/ai-admin/") && (specifier.includes("/apps/") || specifier.includes("/features/") || specifier.includes("/games/"))) {
      violations.push(`${rel}: AI admin domain must not depend on app, feature, or game UI layers (${specifier})`);
    }

    if (rel.startsWith("src/ai-tutor-engine/") &&
        (specifier.includes("/apps/") || specifier.includes("/features/") || specifier.includes("/games/") ||
         specifier.includes("/learning-sets/") || specifier.includes("/multiplayer/"))) {
      violations.push(`${rel}: AI tutor engine must remain reusable and independent from concrete games, sets, multiplayer, and UI features (${specifier})`);
    }

    if (rel.startsWith("src/learning-sets/") && (specifier.includes("/apps/") || specifier.includes("/features/") || specifier.includes("/games/") || specifier.includes("/multiplayer/"))) {
      violations.push(`${rel}: learning set domain must not depend on app, feature, game, or multiplayer layers (${specifier})`);
    }

    if (rel.startsWith("src/quiz-game/") && (specifier === "react" || specifier.includes("/apps/") || specifier.includes("/features/") || specifier.includes("/games/") || (rel !== "src/quiz-game/multiplayerService.ts" && specifier.includes("/multiplayer/")))) {
      violations.push(`${rel}: quiz game plan domain must not depend on React, app, feature, concrete game, or multiplayer layers (${specifier})`);
    }

    if (rel.startsWith("src/characters/") &&
        (specifier === "react" || specifier.startsWith("firebase/") || specifier.includes("/apps/") ||
         specifier.includes("/features/") || specifier.includes("/games/") || specifier.includes("/multiplayer/") ||
         specifier.includes("/student-data/") || specifier.includes("/auth/") || specifier.includes("/firebase/"))) {
      violations.push(`${rel}: character catalog must remain independent from UI, accounts, games, and persistence (${specifier})`);
    }

    if (rel.startsWith("src/student-data/cosmetics/") &&
        (specifier.includes("/apps/") || specifier.includes("/features/") || specifier.includes("/games/") || specifier.includes("/multiplayer/"))) {
      violations.push(`${rel}: student cosmetics data must not depend on app, feature, game, or multiplayer layers (${specifier})`);
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
if (!testStudentHtml.includes("/src/apps/test-student/main.tsx")) violations.push("test-student/index.html: must load the test student entry only");
if (testStudentHtml.includes("/src/apps/teacher/") || testStudentHtml.includes("/src/apps/student/main.tsx")) violations.push("test-student/index.html: must not load a normal student or teacher entry");

if (violations.length) {
  console.error("Architecture checks failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("architecture checks passed");
