import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  define: { "process.env": {} },
  build: { target: "es2022", chunkSizeWarningLimit: 900 },
});
