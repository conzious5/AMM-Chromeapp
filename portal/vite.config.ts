import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          icons: ["lucide-react"]
        }
      }
    }
  },
  server: { proxy: { "/api": "http://localhost:3000", "/auth": "http://localhost:3000" } }
});
