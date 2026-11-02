import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // The SSR bundle is copied into a dependency-free Node image, so bundle
  // every dependency instead of externalizing node_modules.
  ssr: {
    noExternal: true,
  },
});
