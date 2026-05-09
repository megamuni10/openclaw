/**
 * Otto patch 15: coalesce consecutive text-only messages into a single bubble.
 * Prevents N separate "Running the scan now..." bubbles when the model emits
 * a status message before each tool call.
 */

import { describe, expect, it } from "vitest";
import { coalesceTextOnlyMessages } from "./reply-dispatcher.js";
import type { MSTeamsRenderedMessage } from "./messenger.js";

function textMsg(text: string, extra?: Partial<MSTeamsRenderedMessage>): MSTeamsRenderedMessage {
  return { text, ...extra } as MSTeamsRenderedMessage;
}

function mediaMsg(text: string, mediaUrl: string): MSTeamsRenderedMessage {
  return { text, mediaUrl } as MSTeamsRenderedMessage;
}

describe("coalesceTextOnlyMessages (patch 15)", () => {
  it("returns an empty array unchanged", () => {
    expect(coalesceTextOnlyMessages([])).toStrictEqual([]);
  });

  it("returns a single message unchanged", () => {
    const msgs = [textMsg("Hello")];
    expect(coalesceTextOnlyMessages(msgs)).toStrictEqual(msgs);
  });

  it("merges two consecutive text-only messages with double newline", () => {
    const result = coalesceTextOnlyMessages([textMsg("Step 1"), textMsg("Step 2")]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Step 1\n\nStep 2");
  });

  it("merges three consecutive text-only messages into one", () => {
    const result = coalesceTextOnlyMessages([
      textMsg("Running scan…"),
      textMsg("Found 3 items"),
      textMsg("Done"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Running scan…\n\nFound 3 items\n\nDone");
  });

  it("does not merge a message that has a mediaUrl", () => {
    const result = coalesceTextOnlyMessages([
      textMsg("Here is the file:"),
      mediaMsg("attachment", "https://example.com/file.pdf"),
      textMsg("Let me know if you need anything else."),
    ]);
    expect(result).toHaveLength(3);
  });

  it("merges runs separated by a media message correctly", () => {
    const result = coalesceTextOnlyMessages([
      textMsg("A"),
      textMsg("B"),
      mediaMsg("img", "https://example.com/img.png"),
      textMsg("C"),
      textMsg("D"),
    ]);
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe("A\n\nB");
    expect(result[1].mediaUrl).toBe("https://example.com/img.png");
    expect(result[2].text).toBe("C\n\nD");
  });

  it("does not merge when the previous message has no text", () => {
    const noText = { mediaUrl: "https://x.com/x" } as MSTeamsRenderedMessage;
    const result = coalesceTextOnlyMessages([noText, textMsg("hi")]);
    expect(result).toHaveLength(2);
  });

  it("does not mutate the input array", () => {
    const input = [textMsg("A"), textMsg("B")];
    const inputCopy = input.map((m) => ({ ...m }));
    coalesceTextOnlyMessages(input);
    expect(input[0].text).toBe(inputCopy[0].text);
    expect(input[1].text).toBe(inputCopy[1].text);
  });
});
