import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const historyPath = "release-history.json";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

export function nextVersion(version, kind) {
  if (!/^2\.\d{2}$/.test(version)) throw new Error(`유효하지 않은 V2 버전: ${version}`);
  if (!["patch", "feature"].includes(kind)) throw new Error(`유효하지 않은 업데이트 종류: ${kind}`);
  const current = Number(version.slice(2));
  const next = kind === "feature" ? (Math.floor(current / 10) + 1) * 10 : current + 1;
  if (next >= 100) throw new Error("v3.00 전환은 사용자의 별도 지시가 필요합니다. 자동으로 올리지 않습니다.");
  return `2.${String(next).padStart(2, "0")}`;
}

export function readHistory(source) {
  const history = JSON.parse(source);
  if (!history || !/^2\.\d{2}$/.test(history.version) || !Array.isArray(history.releases) || !history.releases.length) {
    throw new Error("버전 이력 형식이 올바르지 않습니다.");
  }
  const seen = new Set();
  for (const release of history.releases) {
    if (!release || !/^2\.\d{2}$/.test(release.version) || seen.has(release.version) ||
        !["baseline", "patch", "feature"].includes(release.kind) ||
        typeof release.message !== "string" || typeof release.date !== "string") {
      throw new Error("버전 이력 항목이 올바르지 않습니다.");
    }
    seen.add(release.version);
  }
  if (history.releases.at(-1).version !== history.version) throw new Error("현재 버전과 마지막 이력이 다릅니다.");
  return history;
}

function semver(version) {
  const digits = Number(version.slice(2));
  return `2.${Math.floor(digits / 10)}.${digits % 10}`;
}

function format(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function commitVersion() {
  if (!git("diff", "--cached", "--name-only")) return;
  let previous;
  // The installation commit establishes v2.00 without consuming an update.
  if (git("ls-tree", "HEAD", "--", historyPath)) {
    previous = readHistory(git("show", `HEAD:${historyPath}`));
  } else {
    readHistory(git("show", `:${historyPath}`));
    return;
  }
  const oldGames = new Set(git("ls-tree", "-r", "--name-only", "HEAD", "--", "src/games").split("\n").map((file) => file.split("/")[2]));
  const newGame = git("diff", "--cached", "--name-only", "--diff-filter=A", "--", "src/games").split("\n")
    .some((file) => file.startsWith("src/games/") && !oldGames.has(file.split("/")[2]));
  const override = process.env.V2R_RELEASE;
  if (override && !["patch", "feature"].includes(override)) throw new Error("V2R_RELEASE는 patch 또는 feature만 가능합니다.");
  const kind = newGame || override === "feature" ? "feature" : "patch";
  const version = nextVersion(previous.version, kind);
  const history = {
    version,
    releases: [...previous.releases, {
      version, kind, date: new Date().toISOString(),
      message: process.env.V2R_RELEASE_NOTE?.trim() || (kind === "feature" ? "게임·기능 추가 또는 큰 변경" : "일반 업데이트"),
    }],
  };

  // Read the index separately: a partially staged package.json must stay partially staged.
  const updates = [];
  for (const file of [historyPath, "package.json", "package-lock.json"]) {
    const staged = git("show", `:${file}`);
    const working = readFileSync(file, "utf8");
    if (file === historyPath && working.trim() !== staged.trim()) throw new Error("release-history.json의 변경을 먼저 stage해 주세요.");
    const update = (source) => {
      if (file === historyPath) return format(history);
      const value = JSON.parse(source);
      value.version = semver(version);
      if (file === "package-lock.json") value.packages[""].version = semver(version);
      return format(value);
    };
    updates.push({ file, staged: update(staged), working: update(working) });
  }
  for (const update of updates) {
    const hash = execFileSync("git", ["hash-object", "-w", "--stdin"], { input: update.staged, encoding: "utf8" }).trim();
    git("update-index", "--cacheinfo", `100644,${hash},${update.file}`);
    writeFileSync(update.file, update.working);
  }
  console.log(`v${previous.version} → v${version} (${kind})`);
}

export function recordRelease(event, status = "success", target = "") {
  if (!["push", "deploy"].includes(event) || !["success", "failure", "cancelled"].includes(status)) throw new Error("유효하지 않은 버전 기록 이벤트입니다.");
  const history = readHistory(readFileSync(historyPath, "utf8"));
  const record = {
    version: history.version,
    commit: git("rev-parse", "HEAD"),
    dirty: Boolean(git("status", "--porcelain", "--untracked-files=normal")),
    event, status, target,
    date: new Date().toISOString(),
    run: process.env.GITHUB_RUN_ID ?? null,
    attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    releases: history.releases,
  };
  mkdirSync(".release-records", { recursive: true });
  const output = `.release-records/${event}-${target || "repository"}-${record.run || Date.now()}-${record.attempt || "1"}.json`;
  writeFileSync(output, format(record));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### v${record.version}\n\n- Commit: \`${record.commit}\`\n- ${event}: ${status} (${target || "repository"})\n- Date: ${record.date}\n`);
  }
  console.log(`${output}: v${record.version} ${record.commit} ${event} ${status}`);
  return record;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === "commit") commitVersion();
    else if (command === "record") recordRelease(...args);
    else throw new Error("사용법: release-version.mjs commit | record <push|deploy> [success|failure|cancelled] [target]");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
