// The Spindle adapter on a fake `spindle` global: what the Studio sends the host, and how it reads
// the host's answers back.

import { describe, expect, test } from "bun:test";
import type { ModelRequest } from "../src/backend/host";
import { createSpindleHost } from "../src/backend/spindle-host";

/** Installs a fake `spindle` global holding only what a test calls. */
function fakeSpindle(api: Record<string, unknown>): void {
  Object.assign(globalThis, { spindle: api });
}

/** A host list endpoint over `total` rows, recording the offset of each page asked for. */
function paged<T>(total: number, make: (i: number) => T, offsets: number[]) {
  return ({ limit, offset }: { limit: number; offset: number }) => {
    offsets.push(offset);
    return Promise.resolve({ data: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => make(offset + i)), total });
  };
}

describe("the Spindle adapter", () => {
  test("a model call sends reasoning, signatures and tool results as the host expects, and reads the answer back", async () => {
    const sent: unknown[] = [];
    fakeSpindle({
      generate: {
        quiet: async (input: unknown) => {
          sent.push(input);
          return { content: "Done.", reasoning: "Thought.", finish_reason: "tool_calls", tool_calls: [{ call_id: "call-7", name: "draft_check", args: { a: 1 }, thought_signature: "sig-1" }, { name: 42 }] };
        },
      },
    });
    const request: ModelRequest = {
      messages: [
        { role: "system", content: "Rules." },
        { role: "assistant", content: [{ type: "tool_use", id: "c1", name: "draft_read", input: { path: "" }, signature: "sig-0" }], reasoning: "Earlier thought." },
        { role: "user", content: [{ type: "tool_result", toolUseId: "c1", content: "Outline.", isError: true }] },
      ],
      tools: [],
      connectionId: null,
      maxTokens: 100,
    };
    const reply = await createSpindleHost().models.generate(request, "UserA", new AbortController().signal);
    // A call without a name is dropped.
    expect(reply).toEqual({ content: "Done.", reasoning: "Thought.", finishReason: "tool_calls", toolCalls: [{ id: "call-7", name: "draft_check", args: { a: 1 }, signature: "sig-1" }] });
    expect(sent[0]).toMatchObject({
      messages: [
        { role: "system", content: "Rules." },
        { role: "assistant", reasoning_content: "Earlier thought.", content: [{ type: "tool_use", id: "c1", name: "draft_read", input: { path: "" }, thought_signature: "sig-0" }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "c1", content: "Outline.", is_error: true }] },
      ],
      userId: "UserA",
    });
  });

  test("cards and lore entries are read past the host's page of 200", async () => {
    const characterOffsets: number[] = [];
    const entryOffsets: number[] = [];
    const entries = paged(401, (i) => ({ id: `e${i}`, comment: "", key: ["k"], content: "x", disabled: false, constant: false }), entryOffsets);
    fakeSpindle({
      characters: { list: paged(450, (i) => ({ id: `c${i}`, name: `Card ${String(i).padStart(3, "0")}` }), characterOffsets) },
      world_books: { entries: { list: (_bookId: string, page: { limit: number; offset: number }) => entries(page) } },
    });
    const host = createSpindleHost();
    expect([(await host.characters.list("UserA")).length, (await host.books.entries("book-1", "UserA")).length]).toEqual([450, 401]);
    expect([characterOffsets, entryOffsets]).toEqual([
      [0, 200, 400],
      [0, 200, 400],
    ]);
  });
});
