/**
 * Otto patch 14: xlsx → CSV conversion.
 * Verifies that Excel attachments are converted to readable CSV text before
 * being forwarded to the model, and that non-Excel / error paths degrade safely.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// --- module mocks (must be at top level) ---

vi.mock("node:fs", () => ({
  readFileSync: vi.fn().mockReturnValue(Buffer.from("fake-xlsx-bytes")),
}));

vi.mock("./runtime.js", () => ({
  getMSTeamsRuntime: vi.fn(),
}));

// Mutable sheet data — tests update this before calling the converter.
let mockSheetData: Record<string, string> = { Sheet1: "Name,Age\nAlice,30" };

// xlsx is CJS; dynamic import("xlsx") exposes its exports at the top level.
vi.mock("xlsx", () => {
  const Sheets: Record<string, { _name: string }> = {};
  const read = vi.fn(() => {
    const SheetNames = Object.keys(mockSheetData);
    for (const name of SheetNames) Sheets[name] = { _name: name };
    return { SheetNames, Sheets };
  });
  const utils = {
    sheet_to_csv: vi.fn((sheet: { _name: string }) => mockSheetData[sheet._name] ?? ""),
  };
  return { read, utils, default: { read, utils } };
});

// --- imports (after mocks) ---

import { readFileSync } from "node:fs";
import { getMSTeamsRuntime } from "./runtime.js";
import { convertXlsxMediaToText } from "./xlsx-converter.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";
const SAVED_CSV_PATH = "/tmp/saved.csv";

function makeRuntime(savedPath = SAVED_CSV_PATH) {
  return {
    channel: {
      media: {
        saveMediaBuffer: vi.fn().mockResolvedValue({ path: savedPath }),
      },
    },
  };
}

const noLog = { debug: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mockSheetData = { Sheet1: "Name,Age\nAlice,30" };
  vi.mocked(readFileSync).mockReturnValue(Buffer.from("fake-xlsx-bytes") as never);
});

describe("convertXlsxMediaToText (patch 14)", () => {
  it("passes non-Excel media through unchanged without loading xlsx", async () => {
    const media = [{ path: "/tmp/doc.pdf", contentType: "application/pdf" }];
    const result = await convertXlsxMediaToText(media, noLog);
    expect(result).toStrictEqual(media);
  });

  it("passes through when list has no Excel entries at all", async () => {
    const media = [{ path: "/tmp/img.png", contentType: "image/png" }];
    const result = await convertXlsxMediaToText(media, noLog);
    expect(result).toStrictEqual(media);
  });

  it("converts a single-sheet xlsx to text/csv", async () => {
    const runtime = makeRuntime();
    vi.mocked(getMSTeamsRuntime).mockReturnValue(runtime as never);
    mockSheetData = { Sheet1: "Name,Age\nAlice,30" };

    const media = [{ path: "/tmp/data.xlsx", contentType: XLSX_MIME }];
    const result = await convertXlsxMediaToText(media, noLog);

    expect(result).toHaveLength(1);
    expect(result[0].contentType).toBe("text/csv");
    expect(result[0].path).toBe(SAVED_CSV_PATH);
    expect(runtime.channel.media.saveMediaBuffer).toHaveBeenCalledOnce();
    const [buf, mime] = vi.mocked(runtime.channel.media.saveMediaBuffer).mock.calls[0];
    expect(mime).toBe("text/csv");
    expect(buf.toString()).toContain("Name,Age");
  });

  it("prefixes sheet name when workbook has multiple sheets", async () => {
    const runtime = makeRuntime();
    vi.mocked(getMSTeamsRuntime).mockReturnValue(runtime as never);
    mockSheetData = { Q1: "Rev,100", Q2: "Rev,200" };

    const media = [{ path: "/tmp/report.xlsx", contentType: XLSX_MIME }];
    await convertXlsxMediaToText(media, noLog);

    const [buf] = vi.mocked(runtime.channel.media.saveMediaBuffer).mock.calls[0];
    const text = buf.toString();
    expect(text).toContain("### Q1");
    expect(text).toContain("### Q2");
  });

  it("falls back to the original entry when workbook is empty", async () => {
    const runtime = makeRuntime();
    vi.mocked(getMSTeamsRuntime).mockReturnValue(runtime as never);
    mockSheetData = { Sheet1: "   " };

    const media = [{ path: "/tmp/empty.xlsx", contentType: XLSX_MIME }];
    const result = await convertXlsxMediaToText(media, noLog);

    expect(result).toStrictEqual(media);
    expect(runtime.channel.media.saveMediaBuffer).not.toHaveBeenCalled();
  });

  it("falls back to the original entry on read error", async () => {
    vi.mocked(getMSTeamsRuntime).mockReturnValue(makeRuntime() as never);
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const media = [{ path: "/tmp/bad.xlsx", contentType: XLSX_MIME }];
    const result = await convertXlsxMediaToText(media, noLog);
    expect(result).toStrictEqual(media);
  });

  it("handles .xls MIME type the same as .xlsx", async () => {
    const runtime = makeRuntime();
    vi.mocked(getMSTeamsRuntime).mockReturnValue(runtime as never);
    mockSheetData = { Sheet1: "a,b" };

    const media = [{ path: "/tmp/old.xls", contentType: XLS_MIME }];
    const result = await convertXlsxMediaToText(media, noLog);
    expect(result[0].contentType).toBe("text/csv");
  });

  it("preserves the placeholder field from the original entry", async () => {
    const runtime = makeRuntime();
    vi.mocked(getMSTeamsRuntime).mockReturnValue(runtime as never);
    mockSheetData = { Sheet1: "x,y" };

    const media = [{ path: "/tmp/x.xlsx", contentType: XLSX_MIME, placeholder: "[spreadsheet]" }];
    const result = await convertXlsxMediaToText(media, noLog);
    expect(result[0].placeholder).toBe("[spreadsheet]");
  });

  it("converts Excel entries while passing non-Excel entries through in a mixed list", async () => {
    const runtime = makeRuntime();
    vi.mocked(getMSTeamsRuntime).mockReturnValue(runtime as never);
    mockSheetData = { Sheet1: "col,val" };

    const pdf = { path: "/tmp/a.pdf", contentType: "application/pdf" };
    const xlsx = { path: "/tmp/b.xlsx", contentType: XLSX_MIME };
    const result = await convertXlsxMediaToText([pdf, xlsx], noLog);

    expect(result).toHaveLength(2);
    expect(result[0]).toStrictEqual(pdf);
    expect(result[1].contentType).toBe("text/csv");
  });
});
