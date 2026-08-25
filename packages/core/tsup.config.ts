import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", register: "src/register.ts", recipes: "src/recipes.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
});
