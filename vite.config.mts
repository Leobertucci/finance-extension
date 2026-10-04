import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = process.cwd();

export default defineConfig({
  root: resolve(root, "extension"),
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@/lib/finance-client": resolve(
        root,
        "src/lib/extension-finance-client.ts",
      ),
    },
  },
  build: {
    outDir: resolve(root, "dist"),
    emptyOutDir: true,
  },
});
