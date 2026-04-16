/**
 * Convert Excel (.xlsx / .xls) files in the inbound media list to CSV text
 * so the model can read their contents. xlsx files are classified as binary
 * by the core media-understanding pipeline and silently dropped; this step
 * runs before the payload is forwarded to the agent and replaces each Excel
 * entry with a text/csv file containing the sheet data.
 */

import { readFileSync } from "node:fs";
import { getMSTeamsRuntime } from "./runtime.js";

const EXCEL_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
]);

type MediaEntry = { path: string; contentType?: string; placeholder?: string };

/**
 * Returns a copy of the media list with any Excel entries converted to CSV.
 * Non-Excel entries are passed through unchanged.
 * On any error the original entry is preserved (safe degradation).
 */
export async function convertXlsxMediaToText(
  mediaList: MediaEntry[],
  log: { debug?: (msg: string) => void },
): Promise<MediaEntry[]> {
  if (!mediaList.some((m) => m.contentType && EXCEL_MIMES.has(m.contentType))) {
    return mediaList;
  }

  // Lazy import — only loaded when an Excel file is actually present.
  let XLSX: typeof import("xlsx");
  try {
    XLSX = await import("xlsx");
  } catch {
    log.debug?.("xlsx converter: xlsx package unavailable, skipping conversion");
    return mediaList;
  }

  const result: MediaEntry[] = [];
  const runtime = getMSTeamsRuntime();

  for (const media of mediaList) {
    if (!media.contentType || !EXCEL_MIMES.has(media.contentType)) {
      result.push(media);
      continue;
    }

    try {
      const buffer = readFileSync(media.path);
      const workbook = XLSX.read(buffer, { type: "buffer" });

      const parts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          continue;
        }
        const csv = XLSX.utils.sheet_to_csv(sheet, { skipHidden: false });
        const trimmed = csv.trim();
        if (trimmed) {
          parts.push(workbook.SheetNames.length > 1 ? `### ${sheetName}\n${trimmed}` : trimmed);
        }
      }

      if (parts.length === 0) {
        log.debug?.(`xlsx converter: workbook empty, keeping original: ${media.path}`);
        result.push(media);
        continue;
      }

      const csvText = parts.join("\n\n");
      const saved = await runtime.channel.media.saveMediaBuffer(
        Buffer.from(csvText, "utf-8"),
        "text/csv",
        "inbound",
        10 * 1024 * 1024,
      );
      log.debug?.(`xlsx converter: ${media.path} → ${saved.path} (${csvText.length} chars)`);
      result.push({
        path: saved.path,
        contentType: "text/csv",
        placeholder: media.placeholder,
      });
    } catch (err) {
      log.debug?.(`xlsx converter: failed for ${media.path}: ${String(err)}`);
      result.push(media);
    }
  }

  return result;
}
