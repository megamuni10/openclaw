import { defineConfig } from "vitest/config";

/** No OpenClaw runtime setup — keeps this file's tests fast to collect. */
export default defineConfig({
  test: {
    name: "openrouter-session",
    environment: "node",
    pool: "forks",
    maxWorkers: 1,
    setupFiles: [],
    include: ["src/agents/pi-embedded-runner/openrouter-session-stream.test.ts"],
  },
});
