// The assistant's tools on a fake host: what an answer's header says was read is what the model
// reads, and long sources come back in honest pieces.

import { describe, expect, test } from "bun:test";
import { newWorld } from "lumi-rp-engine/studio";
import { startStudio } from "../src/backend/main";
import { SourceReader } from "../src/backend/sources";
import { OUTPUT_LIMIT, runTool } from "../src/backend/tools";
import type { DraftSource } from "../src/shared/protocol";
import { FakeHost } from "./support/fake-host";

const USER = "UserTools1";

/** Message `i` of a long chat: `size` characters ending in its own marker, so a test can tell it arrived whole. */
function message(i: number, size: number): string {
  const end = ` <end ${i}>`;
  return `${`m${i} says `.repeat(Math.ceil(size / 8)).slice(0, size - end.length)}${end}`;
}

async function setup(options: { messages?: number; size?: number; pasted?: string } = {}) {
  const host = new FakeHost();
  const studio = startStudio(host);
  const count = options.messages ?? 40;
  host.chatsById.set("chat-long", {
    id: "chat-long",
    owner: USER,
    name: "Long",
    characterId: "",
    metadata: {},
    messages: Array.from({ length: count }, (_, i) => ({ id: `m${i}`, role: i % 2 === 0 ? ("assistant" as const) : ("user" as const), name: i % 2 === 0 ? "Narrator" : "Rhea", content: message(i, options.size ?? 1500) })),
  });
  const source: DraftSource = { kind: "chat", label: "Chat: Long", chatId: "chat-long", characterIds: [], books: [], pasted: options.pasted ? [{ title: "Notes", text: options.pasted }] : [], worldId: null };
  const draft = await studio.drafts.create(USER, { name: "Long", source, doc: newWorld("long", "Long"), link: null });
  const ctx = { userId: USER, draftId: draft.id, drafts: studio.drafts, reader: new SourceReader(host, USER, source), bridge: studio.bridge };
  return { host, studio, draft, ctx };
}

describe("tool answers", () => {
  test("a transcript read names exactly the messages it holds, each whole, and says where to read on", async () => {
    const { ctx } = await setup();
    const out = await runTool("transcript_read", { from: 0, count: 60 }, ctx);
    expect(out.content.length).toBeLessThanOrEqual(OUTPUT_LIMIT);
    const last = Number(/^Messages 0–(\d+) of 40/.exec(out.content)?.[1]);
    // More than the eight messages an answer cut at 12,000 characters used to keep.
    expect(last).toBeGreaterThan(8);
    for (let i = 0; i <= last; i++) expect(out.content).toContain(message(i, 1500));
    expect(out.content).not.toContain(`<end ${last + 1}>`);
    expect(out.content).toContain(`read on with from=${last + 1}`);
  });

  test("the model receives a tool's answer whole, so what its header names is what it reads", async () => {
    const { host, studio, draft } = await setup();
    host.model = (_request, n) =>
      n === 1 ? { content: "", reasoning: "", toolCalls: [{ id: "c1", name: "transcript_read", args: { from: 0, count: 60 } }], finishReason: "tool_calls" } : { content: "Read it.", reasoning: "", toolCalls: [], finishReason: "stop" };
    await studio.assistant.send(USER, draft.id, "Read the chat.");
    await studio.assistant.idle();
    const parts = host.modelCalls[1]?.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])) ?? [];
    const result = parts.find((p) => p.type === "tool_result");
    const text = result?.type === "tool_result" ? result.content : "";
    const last = Number(/^Messages 0–(\d+) of 40/.exec(text)?.[1]);
    expect(last).toBeGreaterThan(8);
    expect(text).toContain(message(last, 1500));
  });

  test("pasted text comes back in pieces whose header names the characters each holds", async () => {
    const pasted = Array.from({ length: 6000 }, (_, i) => `[${i}]`).join(" ");
    const { ctx } = await setup({ pasted });
    const first = await runTool("pasted_read", { index: 0 }, ctx);
    const [, a, b] = /characters (\d+)–(\d+) of/.exec(first.content) ?? [];
    expect([Number(a), first.content.length <= OUTPUT_LIMIT]).toEqual([0, true]);
    expect(first.content).toContain(`${pasted.slice(0, Number(b))}\n\n(Read on with offset=${b}.)`);
    const second = await runTool("pasted_read", { index: 0, offset: Number(b) }, ctx);
    expect(second.content).toContain(pasted.slice(Number(b), Number(b) + 200));
  });
});
