import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        student: resolve(import.meta.dirname, "index.html"),
        teacher: resolve(import.meta.dirname, "teacher/index.html"),
        testStudent: resolve(import.meta.dirname, "test-student/index.html"),
      },
    },
  },
});
