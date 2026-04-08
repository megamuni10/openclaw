import type { StreamFn } from "@mariozechner/pi-agent-core";
import { describe, expect, it, vi } from "vitest";
import {
  createOpenRouterSessionGroupingWrapper,
  formatOpenRouterSessionId,
} from "./openrouter-session-stream.js";

describe("formatOpenRouterSessionId", () => {
  it("returns short keys unchanged", () => {
    expect(formatOpenRouterSessionId("agent:main:msteams:direct:abc")).toBe(
      "agent:main:msteams:direct:abc",
    );
  });

  it("hashes over-long keys into a stable oc:-prefixed id", () => {
    const long = `agent:main:${"x".repeat(400)}`;
    const a = formatOpenRouterSessionId(long);
    const b = formatOpenRouterSessionId(long);
    expect(a).toBe(b);
    expect(a.startsWith("oc:")).toBe(true);
    expect(a.length).toBeLessThan(long.length);
  });
});

describe("createOpenRouterSessionGroupingWrapper", () => {
  it("sets session_id on chat payloads for OpenRouter baseUrl", async () => {
    const mockUnderlying = vi.fn((_model, _context, options) => {
      const payload = { model: "openai/gpt-4o", messages: [] as unknown[] };
      void options?.onPayload?.(payload as never, _model as never);
      return {} as ReturnType<StreamFn>;
    });

    const wrapped = createOpenRouterSessionGroupingWrapper(mockUnderlying, "sess-office-test");
    await wrapped(
      {
        provider: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        api: "openai-completions",
      } as never,
      {} as never,
      {} as never,
    );

    expect(mockUnderlying).toHaveBeenCalledTimes(1);
    const callOpts = mockUnderlying.mock.calls[0]?.[2] as { onPayload?: (p: unknown) => void };
    const payload: Record<string, unknown> = { model: "x", messages: [] };
    callOpts?.onPayload?.(payload);
    expect(payload.session_id).toBe("sess-office-test");
  });

  it("does not set session_id for non-OpenRouter providers", async () => {
    const mockUnderlying = vi.fn((_model, _context, options) => {
      const payload = { model: "gpt-4o", messages: [] as unknown[] };
      void options?.onPayload?.(payload as never, _model as never);
      return {} as ReturnType<StreamFn>;
    });

    const wrapped = createOpenRouterSessionGroupingWrapper(mockUnderlying, "sess-office-test");
    await wrapped(
      {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        api: "openai-completions",
      } as never,
      {} as never,
      {} as never,
    );

    const callOpts = mockUnderlying.mock.calls[0]?.[2] as { onPayload?: (p: unknown) => void };
    const payload: Record<string, unknown> = { model: "x", messages: [] };
    callOpts?.onPayload?.(payload);
    expect(payload.session_id).toBeUndefined();
  });

  it("preserves an explicit session_id from a downstream onPayload hook", async () => {
    const mockUnderlying = vi.fn((_model, _context, options) => {
      const payload = { model: "openai/gpt-4o", messages: [] as unknown[] };
      void options?.onPayload?.(payload as never, _model as never);
      return {} as ReturnType<StreamFn>;
    });

    const wrapped = createOpenRouterSessionGroupingWrapper(mockUnderlying, "from-openclaw");
    await wrapped(
      {
        provider: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        api: "openai-completions",
      } as never,
      {} as never,
      {
        onPayload: (p: Record<string, unknown>) => {
          p.session_id = "preset";
          return p;
        },
      } as never,
    );

    const callOpts = mockUnderlying.mock.calls[0]?.[2] as { onPayload?: (p: unknown) => void };
    const payload: Record<string, unknown> = { model: "x", messages: [] };
    callOpts?.onPayload?.(payload);
    expect(payload.session_id).toBe("preset");
  });
});
