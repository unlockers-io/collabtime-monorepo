import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  platform: "node",
  fixedExtension: false,
  exports: false,
  deps: { onlyBundle: false },
});
