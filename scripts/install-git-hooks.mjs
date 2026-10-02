import { execFileSync } from "node:child_process";
import { chmodSync } from "node:fs";

// CI only reads committed versions; no local hooks are needed there.
if (!process.env.CI) {
  let current = "";
  try {
    current = execFileSync("git", ["config", "--get", "core.hooksPath"], { encoding: "utf8" }).trim();
  } catch (error) {
    if (error.status !== 1) throw error;
  }
  if (current && current !== ".githooks") {
    throw new Error(`기존 Git hooksPath (${current})를 보존했습니다. pre-commit에서 node scripts/release-version.mjs commit을 호출해 주세요.`);
  }
  chmodSync(".githooks/pre-commit", 0o755);
  execFileSync("git", ["config", "core.hooksPath", ".githooks"]);
}
