import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

// Electron downloads its runtime on first use. Keep that cache in this folder too.
process.env.electron_config_cache = join(import.meta.dirname, ".cache", "electron");
delete process.env.ELECTRON_RUN_AS_NODE;
const executable = createRequire(import.meta.url)("electron");
const child = spawn(executable, process.argv.slice(2), {
  cwd: import.meta.dirname, stdio: "inherit",
});
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
