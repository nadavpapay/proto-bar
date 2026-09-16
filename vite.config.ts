import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { notesFile } from "./vite-notes.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), notesFile()],
});
