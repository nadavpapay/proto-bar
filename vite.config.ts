import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { notesFile } from "./vite-notes.ts";
import { handoff } from "./vite-handoff.ts";
import handoffConfig from "./handoff.config.ts";

// Two demos: the review bar at /, the handoff bar at /handoff/.
export default defineConfig({
  plugins: [react(), tailwindcss(), notesFile(), handoff(handoffConfig)],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        handoff: resolve(import.meta.dirname, "handoff/index.html"),
      },
    },
  },
});
