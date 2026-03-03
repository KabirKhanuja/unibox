import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  target: "node18",
  splitting: false,
  treeshake: true,
  minify: false,
  external: [
    "axios",
    "google-auth-library",
    "@azure/msal-node",
    "@microsoft/microsoft-graph-client",
    "isomorphic-fetch",
    "express",
  ],
});
