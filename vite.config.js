import { copyFileSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [{
    name: "copy-service-worker",
    closeBundle() {
      copyFileSync("sw.js", "dist/sw.js");
    }
  }],
  build: {
    target: "es2022"
  }
});
