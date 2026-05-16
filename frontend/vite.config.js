import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/analyze":      "http://localhost:8000",
      "/analyze-live": "http://localhost:8000",
      "/scales":       "http://localhost:8000",
    },
  },
});