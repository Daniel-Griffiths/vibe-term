/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test-setup.ts"],
    css: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    alias: {
      "@": path.resolve(__dirname, "./client"),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
    },
  },
});
