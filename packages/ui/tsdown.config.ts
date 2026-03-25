import { defineConfig } from "tsdown";

export default defineConfig({
  // CSS is built separately by Tailwind CLI; don't wipe dist before component build
  clean: false,
  deps: {
    neverBundle: ["react", "react-dom"],
  },
  dts: true,
  entry: ["./src/index.ts"],
  format: ["esm"],
  platform: "neutral",
});
