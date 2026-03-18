import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm"],
  dts: true,
  // CSS is built separately by Tailwind CLI; don't wipe dist before component build
  clean: false,
  platform: "neutral",
  external: ["react", "react-dom"],
});
