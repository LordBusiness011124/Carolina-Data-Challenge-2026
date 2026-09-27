import { defineConfig } from "vitest/config";
import path from "node:path";

// Calibration against real data: requires the dev server (npm run dev) on BASE_URL.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["tests/calibration.ts"], testTimeout: 600000 },
});
