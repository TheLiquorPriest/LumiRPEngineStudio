// The assistant's loop on a fake host with a scripted model: how a run goes on and how it ends.

import { describe, expect, test } from "bun:test";
import { newWorld } from "lumi-rp-engine/studio";
import type { ModelReply, ModelRequest } from "../src/backend/host";
import { startStudio } from "../src/backend/main";
import type { DraftSource } from "../src/shared/protocol";
import { FakeHost } from "./support/fake-host";

const USER = "UserLoop1";

async function setup(script: (n: number, request: ModelRequest) => ModelReply, messages: string[] = []) {
  const host = new FakeHost();
  const studio = startStudio(host);
  host.model = (request, n) => script(n, request);
  const chatId = messages.length > 0 ? "chat-1" : null;
  if (chatId) host.chatsById.set(chatId, { id: chatId, owner: USER, name: "Harbor", characterId: "", metadata: {}, messages: messages.map((content, i) => ({ id: `m${i}`, role: i % 2 === 0 ? ("assistant" as const) : ("user" as const), name: i % 2 === 0 ? "Silas" : "Rhea", content })) });
  const source: DraftSource = { kind: chatId ? "chat" : "blank", label: chatId ? "Chat: Harbor" : "Blank", chatId, characterIds: [], books: [], pasted: [], worldId: null };
  const draft = await studio.drafts.create(USER, { name: "Loop", source, doc: newWorld("loop", "Loop"), link: null });
  return { host, studio, draft };
}

async function run(setupDone: Awaited<ReturnType<typeof setup>>, text = "Build it.") {
  await setupDone.studio.assistant.send(USER, setupDone.draft.id, text);
  await setupDone.studio.assistant.idle();
  return (await setupDone.studio.drafts.get(USER, setupDone.draft.id))?.chat ?? [];
}

const answer = (content: string, finishReason = "stop"): ModelReply => ({ content, reasoning: "", toolCalls: [], finishReason });

describe("the assistant's loop", () => {
  test("an answer cut off at the length limit isn't taken as the last word: the model is asked to carry on in smaller steps", async () => {
    const rig = await setup((n) => (n === 1 ? answer("I will now write the whole wor", "length") : answer("Done, in smaller steps.")));
    const chat = await run(rig);
    expect(rig.host.modelCalls).toHaveLength(2);
    expect(JSON.stringify(rig.host.modelCalls[1]?.messages.at(-1))).toContain("smaller steps");
    expect(chat.some((e) => e.kind === "note" && e.text.includes("length limit"))).toBe(true);
    expect(chat.at(-1)).toMatchObject({ kind: "assistant", text: "Done, in smaller steps." });
  });

  test("the calls a cut-off answer did finish still run, and the run goes on", async () => {
    const rig = await setup((n) => (n === 1 ? { content: "", reasoning: "", toolCalls: [{ id: "c1", name: "draft_check", args: {} }], finishReason: "max_tokens" } : answer("Checked.")));
    const chat = await run(rig);
    expect(rig.host.modelCalls).toHaveLength(2);
    expect(chat.some((e) => e.kind === "results" && e.results[0]?.name === "draft_check")).toBe(true);
    expect(chat.some((e) => e.kind === "note" && e.text.includes("length limit"))).toBe(true);
  });

  test("three cut-off answers in a row stop the run", async () => {
    const rig = await setup(() => answer("…", "MAX_TOKENS"));
    const chat = await run(rig);
    expect(rig.host.modelCalls).toHaveLength(3);
    expect(chat.at(-1)).toMatchObject({ kind: "note" });
  });

  test("a run's older calls go back to the model in short, its latest two whole", async () => {
    const long = "A long description of the place, written out in full. ".repeat(60);
    const patch = (n: number): ModelReply => ({ content: "", reasoning: "", toolCalls: [{ id: `c${n}`, name: "draft_patch", args: { ops: [{ op: "add", path: `/places/p${n}`, value: { id: `p${n}`, name: `Place ${n}`, fields: { description: long } } }] } }], finishReason: "tool_calls" });
    const rig = await setup((n) => (n <= 4 ? patch(n) : answer("Done.")));
    await run(rig);
    const inputs = (rig.host.modelCalls[4]?.messages ?? []).flatMap((m) => (Array.isArray(m.content) ? m.content : [])).flatMap((p) => (p.type === "tool_use" ? [JSON.stringify(p.input)] : []));
    expect(inputs.map((i) => i.includes(long))).toEqual([false, false, true, true]);
    // What an older patch touched still goes back, so the model knows what it did.
    expect(inputs[0]).toContain("/places/p1");
  });

  test("Stop ends the run: calls not yet run are skipped, and the model isn't called again", async () => {
    let stop = (): void => undefined;
    const rig = await setup(() => {
      stop();
      return { content: "", reasoning: "", toolCalls: [{ id: "c1", name: "draft_check", args: {} }], finishReason: "tool_calls" };
    });
    stop = () => void rig.studio.assistant.stop(USER, rig.draft.id);
    const chat = await run(rig);
    expect(rig.host.modelCalls).toHaveLength(1);
    expect(chat.find((e) => e.kind === "results")).toMatchObject({ results: [{ name: "draft_check", error: true }] });
    expect(chat.at(-1)).toMatchObject({ kind: "note" });
  });

  test("a run that never answers stops at the round limit", async () => {
    const rig = await setup(() => ({ content: "", reasoning: "", toolCalls: [{ id: "c1", name: "draft_check", args: {} }], finishReason: "tool_calls" }));
    const chat = await run(rig);
    const last = chat.at(-1);
    expect(last?.kind).toBe("note");
    expect(Number(/after (\d+) model calls/.exec(last?.kind === "note" ? last.text : "")?.[1])).toBe(rig.host.modelCalls.length);
  });

  test("a failed model call ends the run with what went wrong", async () => {
    const rig = await setup(() => {
      throw new Error("rate limited");
    });
    const chat = await run(rig);
    expect(chat.some((e) => e.kind === "assistant")).toBe(false);
    expect(chat.at(-1)).toMatchObject({ kind: "note" });
    expect(JSON.stringify(chat.at(-1))).toContain("rate limited");
  });

  test("every answer of a round reaches the model whole: calls that wouldn't fit in it aren't run, and say so", async () => {
    // 200 messages of about 1,500 characters: a read of 15 brings about 22,000, so eight in one round ask for more than the run's budget.
    const messages = Array.from({ length: 200 }, (_, i) => `<${i}> ${"The rain kept on over the harbor. ".repeat(45)}</${i}>`);
    const reads = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, name: "transcript_read", args: { from: i * 15, count: 15 } }));
    const rig = await setup((n) => (n === 1 ? { content: "", reasoning: "", toolCalls: reads, finishReason: "tool_calls" } : answer("Read.")), messages);
    await run(rig, "Convert this chat.");
    const results = (rig.host.modelCalls[1]?.messages ?? []).flatMap((m) => (Array.isArray(m.content) ? m.content : [])).flatMap((p) => (p.type === "tool_result" ? [p] : []));
    expect(results).toHaveLength(8);
    const read = results.filter((r) => r.isError !== true);
    const skipped = results.filter((r) => r.isError === true);
    expect([read.length > 4, skipped.length > 0]).toEqual([true, true]);
    // The calls that didn't fit are the last ones, and none of them read anything.
    expect(results.map((r) => r.isError === true)).toEqual([...read.map(() => false), ...skipped.map(() => true)]);
    for (const r of skipped) expect(r.content).not.toContain("<");
    // Every message an answer's header names is there, to its end.
    for (const r of read) {
      const [, a, b] = /^Messages (\d+)–(\d+) of 200/.exec(r.content) ?? [];
      expect(Number(b)).toBeGreaterThan(Number(a));
      for (let i = Number(a); i <= Number(b); i++) expect(r.content).toContain(`</${i}>`);
    }
  });
});
