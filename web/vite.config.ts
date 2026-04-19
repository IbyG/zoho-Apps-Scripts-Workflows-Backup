import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crmValidateApiPlugin } from "./vite-plugin-crm-validate";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), crmValidateApiPlugin()],
  server: {
    fs: {
      allow: [root, path.join(root, "..")],
    },
  },
});
