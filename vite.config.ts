import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readHistory } from "./scripts/release-version.mjs";

export default defineConfig({
  base: "./",
  plugins: [react(), {
    name: "release-manifest",
    generateBundle() {
      const history = readHistory(readFileSync(resolve(import.meta.dirname, "release-history.json"), "utf8"));
      let commit: string | null = process.env.GITHUB_SHA ?? null;
      let dirty: boolean | null = null;
      try {
        commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
        dirty = Boolean(execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim());
      } catch { /* Source archives can be built without Git metadata. */ }
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ ...history, commit, dirty, builtAt: new Date().toISOString() }, null, 2),
      });
    },
  }],
  build: {
    rollupOptions: {
      input: {
        student: resolve(import.meta.dirname, "index.html"),
        teacher: resolve(import.meta.dirname, "teacher/index.html"),
      },
    },
  },
});
