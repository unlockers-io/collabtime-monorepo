import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm"],
  dts: true,
  // CSS is built separately by Tailwind CLI; don't wipe dist before component build
  clean: false,
  outDir: "dist",
  platform: "neutral",
  // Hoist "use client" to the bundle so Next.js treats the whole package as a
  // client module. Without this, Radix UI's createContext calls at module
  // evaluation time crash in the RSC runtime.
  banner: '"use client"',
  exports: false,
  deps: { neverBundle: ["react", "react-dom"], onlyBundle: false },
});
