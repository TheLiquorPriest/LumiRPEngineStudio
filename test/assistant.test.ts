// The assistant's loop on a fake host with a scripted model: how a run goes on and how it ends.

import { describe, expect, test } from "bun:test";
import { newWorld } from "lumi-rp-engine/studio";
import type { ModelReply, ModelRequest } from "../src/backend/host";
import { startStudio } from "../src/backend/main";
import type { DraftSource } from "../src/shared/protocol";
import { FakeHost } from "./support/fake-host";

const USER = "UserLoop1";

async function setup(script: (n: number, request: ModelRequest) => ModelReply) {
  const host = new FakeHost();
  const studio = startStudio(host);
  host.model = (request, n) => script(n, request);
  const source: DraftSource = { kind: "blank", label: "Blank", chatId: null, characterIds: [], books: [], pasted: [], worldId: null };
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
});
