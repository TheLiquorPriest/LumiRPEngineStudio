// The assistant's tools on a fake host: what an answer's header says was read is what the model
// reads, and long sources come back whole, in honest pieces.

import { describe, expect, test } from "bun:test";
import { newWorld } from "lumi-rp-engine/studio";
import type { HostCharacter } from "../src/backend/host";
import { startStudio } from "../src/backend/main";
import { booksFor, SourceReader } from "../src/backend/sources";
import { OUTPUT_LIMIT, runTool } from "../src/backend/tools";
import type { JsonObject } from "../src/shared/json";
import type { BookRef, DraftSource } from "../src/shared/protocol";
import { FakeHost } from "./support/fake-host";

const USER = "UserTools1";

/** Message `i`: `size` characters ending in its own marker, so a test can tell it arrived whole. */
function message(i: number, size: number): string {
  const end = ` <end ${i}>`;
  return `${`m${i} says `.repeat(Math.ceil(size / 8)).slice(0, size - end.length)}${end}`;
}

async function setup(options: { messages?: string[]; pasted?: string; lore?: { id: string; content: string }[]; card?: Partial<HostCharacter>; persona?: { id: string; name: string } } = {}) {
  const host = new FakeHost();
  const studio = startStudio(host);
  const messages = options.messages ?? Array.from({ length: 40 }, (_, i) => message(i, 1500));
  host.chatsById.set("chat-long", {
    id: "chat-long",
    owner: USER,
    name: "Long",
    characterId: "",
    metadata: {},
    messages: messages.map((content, i) => ({ id: `m${i}`, role: i % 2 === 0 ? ("assistant" as const) : ("user" as const), name: i % 2 === 0 ? "Narrator" : "Rhea", content })),
  });
  const books: BookRef[] = [];
  if (options.lore) {
    host.bookStore.set("book-1", { id: "book-1", owner: USER, name: "Lore", description: "", metadata: {}, entryList: options.lore.map((e) => ({ id: e.id, comment: e.id, keys: [], content: e.content, disabled: false, constant: false })) });
    books.push({ id: "book-1", name: "Lore", scope: "picked" });
  }
  const characterIds: string[] = [];
  if (options.card) {
    host.cards.set("char-1", { id: "char-1", owner: USER, name: "Silas", description: "", personality: "", scenario: "", firstMessage: "", exampleMessages: "", creatorNotes: "", alternateGreetings: [], tags: [], bookIds: [], ...options.card });
    characterIds.push("char-1");
  }
  const source: DraftSource = { kind: "chat", label: "Chat: Long", chatId: "chat-long", characterIds, books, pasted: options.pasted ? [{ title: "Notes", text: options.pasted }] : [], worldId: null, persona: options.persona ?? null };
  const draft = await studio.drafts.create(USER, { name: "Long", source, doc: newWorld("long", "Long"), link: null });
  const ctx = { userId: USER, draftId: draft.id, drafts: studio.drafts, reader: new SourceReader(host, USER, source), bridge: studio.bridge };
  return { host, studio, draft, ctx };
}

/** Reads a long text piece by piece, following each answer's `offset=` hint, checking every header names what its piece holds. */
async function readAll(read: (offset: number) => Promise<string>, whole: string, first: string): Promise<number> {
  let offset = Number(/offset=(\d+)/.exec(first)?.[1]);
  expect(first).toContain(whole.slice(0, offset));
  let pieces = 1;
  while (offset < whole.length && pieces < 10) {
    const next = await read(offset);
    const [, a, b] = /characters (\d+)–(\d+) of/i.exec(next) ?? [];
    expect([Number(a), next.length <= OUTPUT_LIMIT]).toEqual([offset, true]);
    expect(next).toContain(whole.slice(Number(a), Number(b)));
    offset = Number(b);
    pieces++;
  }
  expect(offset).toBe(whole.length);
  return pieces;
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

  test("a message longer than one answer is read whole, piece by piece", async () => {
    const long = message(3, 50_000);
    const { ctx } = await setup({ messages: [message(0, 500), message(1, 500), message(2, 5000), long, message(4, 500)] });
    // A 5,000-character message is no longer cut short.
    expect((await runTool("transcript_read", { from: 2, count: 1 }, ctx)).content).toContain(message(2, 5000));
    const first = await runTool("transcript_read", { from: 3 }, ctx);
    expect(first.content).toContain("Message 3 of 5, in part");
    const pieces = await readAll(async (offset) => (await runTool("transcript_read", { from: 3, offset }, ctx)).content, long, first.content);
    expect(pieces).toBe(3);
  });

  test("a long lore entry and a long card field are read whole", async () => {
    const entry = `${"The guild's charter runs on. ".repeat(1100)}<end of charter>`;
    const description = `${"Silas keeps the harbor books. ".repeat(400)}<end of description>`;
    const { ctx } = await setup({ lore: [{ id: "charter", content: entry }, { id: "short", content: `${"Short. ".repeat(1500)}<end of short>` }], card: { description } });
    // An entry of 10,500 characters is no longer cut at 8,000.
    expect((await runTool("lore_read", { ids: ["short"] }, ctx)).content).toContain("<end of short>");
    const first = await runTool("lore_read", { ids: ["charter", "short"] }, ctx);
    expect(first.content).toContain("Not read, to keep this answer whole: short");
    await readAll(async (offset) => (await runTool("lore_read", { ids: ["charter"], offset }, ctx)).content, entry, first.content);
    const overview = await runTool("cards_read", {}, ctx);
    expect(overview.content).toContain('cards_read name="Silas" field="description" offset=6000');
    const field = await runTool("cards_read", { name: "Silas", field: "description" }, ctx);
    expect(field.content).toContain(description);
  });

  test("a patch of more than 200 operations is refused whole, not cut short", async () => {
    const { ctx, studio, draft } = await setup();
    const ops = Array.from({ length: 201 }, (_, i) => ({ op: "add", path: `/places/p${i}`, value: { id: `p${i}`, name: `Place ${i}`, fields: {} } }));
    const out = await runTool("draft_patch", { ops }, ctx);
    expect(out.error).toBe(true);
    expect((await studio.drafts.get(USER, draft.id))?.proposed ?? null).toBeNull();
  });

  test("the user's persona is read as a card of its own, and its lore book applies", async () => {
    const { host, ctx } = await setup({ persona: { id: "persona-1", name: "Rhea" } });
    host.personaList.set("persona-1", { owner: USER, active: true, persona: { id: "persona-1", name: "Rhea", description: "A harbor pilot with a debt of her own.", bookId: "book-p" } });
    expect((await runTool("cards_read", { name: "Rhea" }, ctx)).content).toContain("A harbor pilot with a debt of her own.");
    host.bookStore.set("book-p", { id: "book-p", owner: USER, name: "Rhea's past", description: "", metadata: {}, entryList: [] });
    expect((await booksFor(host, USER, null, [])).map((b) => [b.id, b.scope])).toEqual([["book-p", "persona"]]);
  });

  test("every answer stays within OUTPUT_LIMIT, however big the sources", async () => {
    const big = (size: number) => "word ".repeat(size / 5);
    const lore = Array.from({ length: 1000 }, (_, i) => ({ id: `entry_${i}`, content: i < 12 ? big(20_000) : "short" }));
    const card = { description: big(50_000), personality: big(50_000), scenario: big(50_000), firstMessage: big(50_000), exampleMessages: big(50_000), creatorNotes: big(50_000), alternateGreetings: [big(50_000)] };
    const { ctx } = await setup({ lore, card });
    const answers = [await runTool("lore_list", { book: "book-1" }, ctx), await runTool("lore_read", { ids: lore.slice(0, 12).map((e) => e.id) }, ctx), await runTool("cards_read", {}, ctx), await runTool("transcript_search", { query: "says", limit: 30 }, ctx)];
    for (const answer of answers) expect(answer.content.length).toBeLessThanOrEqual(OUTPUT_LIMIT);
    // A list too long for one answer says how to find the rest.
    expect(answers[0]?.content).toContain("lore_search");
  });

  test("draft_check reports mistakes in the keys the guide asks for: life, lifeKnownBy and cues", async () => {
    const { ctx } = await setup();
    const ghost = { id: "ghost", kind: "person", name: "Old Tom", tier: "background", life: "vanished", lifeKnownBy: ["nobody"], cues: [{ text: "" }], fields: { place: "home" }, relations: [] };
    await runTool("draft_patch", { ops: [{ op: "add", path: "/entities/ghost", value: ghost }] }, ctx);
    const out = await runTool("draft_check", {}, ctx);
    for (const path of ["entities.ghost.life", "entities.ghost.lifeKnownBy", "entities.ghost.cues.0.text"]) expect(out.content).toContain(`error at ${path}:`);
  });

  test("a draft with a flow, a holding and a minds config checks clean, and a misspelt flow party draws the engine's warning", async () => {
    const { ctx } = await setup();
    const entity = (id: string, kind: string, fields: JsonObject) => ({ op: "add", path: `/entities/${id}`, value: { id, kind, name: id, tier: "background", fields, relations: [] } });
    const owners = [{ party: "you", role: "owner" }];
    const world = (from: string): JsonObject[] => [
      { op: "add", path: "/realism/levels/money", value: 3 },
      { op: "add", path: "/packs/economy", value: { version: 1, config: { assets: { glix: { label: "Great Lakes Index Fund", class: "fund", symbol: "GLIX", price: 11240 } } } } },
      { op: "add", path: "/minds", value: { secrecy: "brief", thresholds: { live: 60, near: 35, far: 15 }, memory: { notes: { show: 10, keep: 30 } } } },
      entity("acct_checking", "account", { owners, product: "checking", opening: 182000 }),
      entity("acct_brokerage", "account", { owners, product: "brokerage", opening: 0 }),
      entity("hold_glix", "holding", { account: "acct_brokerage", asset: "glix", lots: [{ qty: 20, cost: 196000, at: "2025-03-02" }], route: "reinvest" }),
      entity("flow_rent", "flow", { flow_kind: "rent", from, to: "Harbor Lets", amount_cents: 95000, every: "month", days: [1] }),
    ];
    expect((await runTool("draft_patch", { ops: world("acct_checking") }, ctx)).error).toBe(false);
    expect((await runTool("draft_check", {}, ctx)).content).not.toMatch(/^- (error|warning) /m);
    await runTool("draft_patch", { ops: [{ op: "replace", path: "/entities/flow_rent/fields/from", value: "acct_chequing" }] }, ctx);
    expect((await runTool("draft_check", {}, ctx)).content).toContain("warning at entities.flow_rent.fields.from:");
  });

  test("money in an older shape, which the engine converts as it loads, is reported until it's written the current way", async () => {
    const { ctx } = await setup();
    const purse = (fields: JsonObject) => ({ id: "purse", kind: "account", name: "Rhea's purse", tier: "background", fields, relations: [] });
    await runTool("draft_patch", { ops: [{ op: "add", path: "/entities/purse", value: purse({ owner: "you", type: "cash", opening: 4250 }) }] }, ctx);
    const old = (await runTool("draft_check", {}, ctx)).content;
    expect(old).toContain("warning at entities.purse:");
    expect(old).toContain('"fields.owners":[{"party":"you","role":"owner"}]');
    await runTool("draft_patch", { ops: [{ op: "replace", path: "/entities/purse", value: purse({ owners: [{ party: "you", role: "owner" }], product: "cash", opening: 4250 }) }] }, ctx);
    expect((await runTool("draft_check", {}, ctx)).content).not.toContain("entities.purse");
  });
});
