import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { test } from "node:test";
import { nextVersion, readHistory } from "../scripts/release-version.mjs";

test("updates follow hundredths and the next tenth, without crossing into v3", () => {
  assert.equal(nextVersion("2.00", "patch"), "2.01");
  assert.equal(nextVersion("2.09", "patch"), "2.10");
  assert.equal(nextVersion("2.05", "feature"), "2.10");
  assert.equal(nextVersion("2.10", "feature"), "2.20");
  assert.equal(nextVersion("2.89", "feature"), "2.90");
  assert.throws(() => nextVersion("2.99", "patch"), /별도 지시/);
  assert.throws(() => nextVersion("2.90", "feature"), /별도 지시/);
  assert.throws(() => nextVersion("2.5", "patch"), /유효하지/);
  assert.throws(() => nextVersion("2.00", "major"), /유효하지/);
});

test("invalid or inconsistent history is rejected", () => {
  assert.throws(() => readHistory("null"), /형식/);
  assert.throws(() => readHistory('{"version":"2.00","releases":[]}'), /형식/);
  assert.throws(() => readHistory('{"version":"2.01","releases":[{"version":"2.00","kind":"baseline","date":"2026-10-02","message":"start"}]}'), /마지막/);
});

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "v2r-version-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env, V2R_RELEASE: "", V2R_RELEASE_NOTE: "", CI: "" };
  const git = (...args) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  const write = (file, value) => writeFileSync(join(cwd, file), typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
  const read = (file) => JSON.parse(readFileSync(join(cwd, file), "utf8"));
  git("init");
  git("config", "user.name", "Version test");
  git("config", "user.email", "version-test@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "core.autocrlf", "false");
  write("app.txt", "existing app\n");
  git("add", "app.txt");
  git("-c", "core.hooksPath=", "commit", "-m", "initial app");
  mkdirSync(join(cwd, "scripts"));
  mkdirSync(join(cwd, ".githooks"));
  copyFileSync(resolve("scripts/release-version.mjs"), join(cwd, "scripts/release-version.mjs"));
  copyFileSync(resolve(".githooks/pre-commit"), join(cwd, ".githooks/pre-commit"));
  chmodSync(join(cwd, ".githooks/pre-commit"), 0o755);
  git("config", "core.hooksPath", ".githooks");
  write("release-history.json", { version: "2.00", releases: [{ version: "2.00", kind: "baseline", date: "2026-10-02", message: "start" }] });
  write("package.json", { name: "fixture", version: "2.0.0", scripts: { dev: "vite" } });
  write("package-lock.json", { version: "2.0.0", packages: { "": { version: "2.0.0" } } });
  git("add", ".");
  git("commit", "-m", "chore: establish v2.00");
  return { cwd, git, write, read, env };
}

test("real commits keep the baseline and record each patch and feature", (t) => {
  const { git, write, read, env } = fixture(t);
  assert.equal(read("release-history.json").version, "2.00");
  for (let i = 1; i <= 5; i++) {
    write("app.txt", `fix ${i}\n`);
    git("add", "app.txt");
    git("commit", "-m", `fix: update ${i}`);
  }
  assert.equal(read("release-history.json").version, "2.05");
  write("app.txt", "new feature\n");
  git("add", "app.txt");
  env.V2R_RELEASE = "feature";
  env.V2R_RELEASE_NOTE = "new feature";
  git("commit", "-m", "feat(settings): new feature");
  const history = read("release-history.json");
  assert.equal(history.version, "2.10");
  assert.equal(history.releases.length, 7);
  assert.equal(history.releases.at(-1).message, "new feature");
  assert.equal(read("package.json").version, "2.1.0");
  assert.equal(read("package-lock.json").packages[""].version, "2.1.0");
  assert.equal(git("status", "--porcelain"), "");
});

test("adding a new game bumps a tenth; editing an existing game is a patch", (t) => {
  const { cwd, git, write, read } = fixture(t);
  mkdirSync(join(cwd, "src/games/new-game"), { recursive: true });
  write("src/games/new-game/game.ts", "export const score = 1;\n");
  git("add", "src");
  git("commit", "-m", "add a game");
  assert.equal(read("release-history.json").version, "2.10");
  write("src/games/new-game/game.ts", "export const score = 2;\n");
  git("add", "src");
  git("commit", "-m", "fix game scoring");
  assert.equal(read("release-history.json").version, "2.11");
});

test("a user-pinned earlier version preserves published history and avoids reusing a version", (t) => {
  const { git, write, read } = fixture(t);
  write("app.txt", "first patch\n");
  git("add", "app.txt");
  git("commit", "-m", "fix: first patch");
  const history = read("release-history.json");
  const baseline = history.releases.shift();
  history.version = baseline.version;
  history.releases.push(baseline);
  write("release-history.json", history);
  const pkg = read("package.json");
  pkg.version = "2.0.0";
  write("package.json", pkg);
  const lock = read("package-lock.json");
  lock.version = lock.packages[""].version = pkg.version;
  write("package-lock.json", lock);
  git("add", "release-history.json", "package.json", "package-lock.json");
  git("-c", "core.hooksPath=", "commit", "-m", "chore: user-pinned version");
  write("app.txt", "next patch\n");
  git("add", "app.txt");
  git("commit", "-m", "fix: next patch");
  const next = readHistory(JSON.stringify(read("release-history.json")));
  assert.equal(next.version, "2.02");
  assert.deepEqual(next.releases.slice(0, 2), history.releases);
  assert.equal(read("package.json").version, "2.0.2");
  assert.equal(read("package-lock.json").packages[""].version, "2.0.2");
});

test("partially staged package changes remain unstaged after versioning", (t) => {
  const { git, write, read } = fixture(t);
  const stagedPackage = read("package.json");
  stagedPackage.scripts.test = "node tests.mjs";
  write("package.json", stagedPackage);
  git("add", "package.json");
  stagedPackage.scripts.dev = "vite --host";
  write("package.json", stagedPackage);
  git("commit", "-m", "fix: package command");
  const committed = JSON.parse(git("show", "HEAD:package.json"));
  assert.equal(committed.version, "2.0.1");
  assert.equal(committed.scripts.test, "node tests.mjs");
  assert.equal(committed.scripts.dev, "vite");
  assert.equal(read("package.json").scripts.dev, "vite --host");
  assert.equal(read("package.json").version, "2.0.1");
});

test("push and deployment records use the committed version without incrementing", (t) => {
  const { cwd, git, read, env } = fixture(t);
  const commit = git("rev-parse", "HEAD");
  for (const event of ["push", "deploy"]) {
    execFileSync(process.execPath, ["scripts/release-version.mjs", "record", event, "success", "test"], {
      cwd, env: { ...env, GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1", GITHUB_STEP_SUMMARY: "" },
    });
    const record = read(`.release-records/${event}-test-123-1.json`);
    assert.equal(record.version, "2.00");
    assert.equal(record.commit, commit);
    assert.equal(record.status, "success");
  }
  assert.equal(read("release-history.json").version, "2.00");
});

test("manual deployment records success and failure and stops when build fails", (t) => {
  const { cwd, write, read, env } = fixture(t);
  copyFileSync(resolve("scripts/deploy.mjs"), join(cwd, "scripts/deploy.mjs"));
  const bin = join(cwd, "fake-bin");
  mkdirSync(bin);
  write("fake-cli.mjs", `
    import { appendFileSync } from "node:fs";
    const command = process.argv[2];
    appendFileSync("commands.jsonl", JSON.stringify(process.argv.slice(2)) + "\\n");
    process.exit(Number(command === "npm" ? process.env.BUILD_STATUS : process.env.DEPLOY_STATUS));
  `);
  for (const command of ["npm", "firebase"]) {
    const windows = process.platform === "win32";
    const entry = join(bin, `${command}${windows ? ".cmd" : ""}`);
    writeFileSync(entry, windows
      ? `@echo off\r\n"${process.execPath}" "${join(cwd, "fake-cli.mjs")}" ${command} %*\r\n`
      : `#!/bin/sh\nexec '${process.execPath}' '${join(cwd, "fake-cli.mjs")}' ${command} "$@"\n`);
    chmodSync(entry, 0o755);
  }
  // Windows environment names are case-insensitive; preserve the existing PATH spelling.
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
  const deploymentEnv = { ...env, [pathKey]: `${bin}${delimiter}${env[pathKey]}`, GITHUB_RUN_ID: "456", GITHUB_RUN_ATTEMPT: "1", GITHUB_STEP_SUMMARY: "" };
  for (const [target, only] of [["hosting", "hosting"], ["functions", "functions:jurye-v2"], ["rules", "firestore:rules"]]) {
    write("commands.jsonl", "");
    const result = spawnSync(process.execPath, ["scripts/deploy.mjs", target], {
      cwd, env: { ...deploymentEnv, BUILD_STATUS: "0", DEPLOY_STATUS: "0" }, encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const commands = readFileSync(join(cwd, "commands.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(commands.at(-1), ["firebase", "deploy", "--only", only]);
    assert.equal(commands.length, target === "rules" ? 1 : 2);
    assert.equal(read(`.release-records/deploy-${target}-local-456-1.json`).status, "success");
  }
  const failed = spawnSync(process.execPath, ["scripts/deploy.mjs", "hosting"], {
    cwd, env: { ...deploymentEnv, BUILD_STATUS: "0", DEPLOY_STATUS: "7" }, encoding: "utf8",
  });
  assert.equal(failed.status, 7, failed.stderr);
  assert.equal(read(".release-records/deploy-hosting-local-456-1.json").status, "failure");
  write("commands.jsonl", "");
  const failedBuild = spawnSync(process.execPath, ["scripts/deploy.mjs", "hosting"], {
    cwd, env: { ...deploymentEnv, BUILD_STATUS: "9", DEPLOY_STATUS: "0", GITHUB_RUN_ID: "789" }, encoding: "utf8",
  });
  assert.equal(failedBuild.status, 9, failedBuild.stderr);
  assert.equal(readFileSync(join(cwd, "commands.jsonl"), "utf8").trim().split("\n").length, 1);
  assert.equal(existsSync(join(cwd, ".release-records/deploy-hosting-local-789-1.json")), false);
});
