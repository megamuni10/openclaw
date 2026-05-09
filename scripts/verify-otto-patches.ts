#!/usr/bin/env tsx
/**
 * Otto patch verification script.
 *
 * Checks that every otto-patches commit survived the latest upstream merge and
 * build. Run this after `pnpm build` as the final step of any upgrade:
 *
 *   pnpm otto:verify
 *
 * Each patch has:
 *   - A unique string to grep for (resilient to minification / bundle-name churn)
 *   - The file or glob to search
 *   - A short description for the error message
 *
 * Exit code 0 = all patches present.
 * Exit code 1 = one or more patches missing — do NOT deploy.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const PI_AI = join(ROOT, "node_modules/@mariozechner/pi-ai/dist");

// ─── helpers ─────────────────────────────────────────────────────────────────

function readAll(dir: string, ext = ".js"): string {
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}

function check(label: string, haystack: string, needle: string): boolean {
  const found = haystack.includes(needle);
  const icon = found ? "✓" : "✗";
  console.log(`  ${icon}  ${label}`);
  if (!found) {
    console.log(`       missing: ${JSON.stringify(needle)}`);
  }
  return found;
}

// ─── main ────────────────────────────────────────────────────────────────────

console.log("\nOtto patch verification\n");

const dist = readAll(DIST);
const piaiValidation = readFileSync(join(PI_AI, "utils/validation.js"), "utf8");
const piaiCompletions = readFileSync(join(PI_AI, "providers/openai-completions.js"), "utf8");

let allOk = true;

console.log("Source patches (dist/):");

allOk =
  check(
    "Patch 5  — DM routing uses conversation ID",
    dist,
    "conversation:",
  ) && allOk;

allOk =
  check(
    "Patch 7  — stream retry storm guard (streamFailed bail-early)",
    dist,
    "streamFailed",
  ) && allOk;

allOk =
  check(
    "Patch 9  — empty-content fallback message",
    dist,
    "wasn't able to generate a response",
  ) && allOk;

allOk =
  check(
    "Patch 10 — history poisoning repair placeholder",
    dist,
    "No response was generated for this turn",
  ) && allOk;

allOk =
  check(
    "Patch 11b — sessionsspawn tool name alias",
    dist,
    "sessionsspawn",
  ) && allOk;

allOk =
  check(
    "Patch 14 — xlsx→CSV attachment converter (EXCEL_MIMES)",
    dist,
    "vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ) && allOk;

allOk =
  check(
    "Patch 15 — coalesce consecutive text-only messages",
    dist,
    // The coalesceTextOnlyMessages function always produces this join pattern
    "\\n\\n",
  ) && allOk;

console.log("\n@mariozechner/pi-ai patches (node_modules):");

allOk =
  check(
    "Patch 11a — fuzzy tool name matching in pi-ai validation",
    piaiValidation,
    "Fuzzy fallback",
  ) && allOk;

allOk =
  check(
    "Patch 12  — thinking-only response promotion in pi-ai",
    piaiCompletions,
    "Patch 12",
  ) && allOk;

console.log();

if (allOk) {
  console.log("All patches verified ✓\n");
  process.exit(0);
} else {
  console.error(
    "One or more patches are missing from the build.\n" +
    "Re-apply them before deploying. See CLAUDE.md for each patch's source file.\n",
  );
  process.exit(1);
}
