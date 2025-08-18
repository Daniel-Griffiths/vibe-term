import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              external: ["@lydell/node-pty"],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, "electron/preload.ts"),
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
