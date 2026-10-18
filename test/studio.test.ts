// The Studio on a fake host (no network, no models): the assistant converting a chat and its lore
// into a world through its tools, review then accept, Install through the LumiRPEngine bridge with
// the engine's side played by fake-engine.ts, and the guarantees around them (patches all or
// nothing, user scoping, the bridge answering only the engine, tool calls going back as they were).

import { describe, expect, test } from "bun:test";
import { newWorld, validate } from "lumi-rp-engine/studio";
import manifest from "../spindle.json";
import { modelMessages } from "../src/backend/assistant";
import type { ChatEntry } from "../src/backend/drafts";
import type { ModelReply, ModelRequest } from "../src/backend/host";
import { startStudio } from "../src/backend/main";
import { applyPatch, readOp } from "../src/backend/pointer";
import { acceptChanges, changesBetween } from "../src/backend/review";
import { channelId, ENGINE_EXTENSION, STUDIO_EXTENSION } from "../src/shared/bridge";
import { readWorldDoc } from "../src/engine";
import { isRecord } from "../src/shared/json";
import type { JsonObject, JsonValue } from "../src/shared/json";
import type { DraftView, ResultBodies, RequestType } from "../src/shared/protocol";
import { PROTOCOL } from "../src/shared/protocol";
import { FakeEngine } from "./support/fake-engine";
import { FakeHost } from "./support/fake-host";

const USER = "UserAbc123";

function rig() {
  const host = new FakeHost();
  const studio = startStudio(host);
  const engine = new FakeEngine(host.pool, USER);
  let req = 0;
  /** One request from the user's frontend, answered before it returns (the dispatcher replies as it finishes). */
  async function send<K extends RequestType>(type: K, body: Record<string, unknown> = {}, userId = USER): Promise<ResultBodies[K]> {
    const reqId = `r${++req}`;
    await studio.dispatch.handle({ studio: PROTOCOL, reqId, type, ...body }, userId);
    const reply = host.sent.find((s) => (s.message.type === "result" || s.message.type === "error") && s.message.reqId === reqId)?.message;
    if (reply?.type === "result") return reply.body as ResultBodies[K];
    throw new Error(reply?.type === "error" ? reply.message : `no reply to ${type}`);
  }
  return { host, studio, engine, send };
}

const call = (id: string, name: string, args: JsonObject) => ({ id, name, args });

/** The world a conversion of the harbor chat makes, as JSON Patch operations, the way the guide says. */
const CONVERSION: JsonObject[] = [
  { op: "replace", path: "/name", value: "Port Veil" },
  { op: "add", path: "/kinds/character", value: { id: "character", label: "Character", extends: "person", fields: { description: { type: "text", label: "Description" } } } },
  { op: "add", path: "/places/port_veil", value: { id: "port_veil", name: "Port Veil", fields: {} } },
  { op: "add", path: "/places/salt_quay", value: { id: "salt_quay", name: "Salt Quay", parent: "port_veil", fields: { description: "Tar-black pilings and fish crates." } } },
  { op: "add", path: "/places/guild_office", value: { id: "guild_office", name: "The guild office", parent: "port_veil", fields: {}, visibility: "discoverable" } },
  { op: "add", path: "/routes/quay_to_guild", value: { id: "quay_to_guild", from: "salt_quay", to: "guild_office", modes: { walk: { minutes: 6 } }, bidirectional: true } },
  { op: "add", path: "/entities/rhea", value: { id: "rhea", kind: "character", name: "Rhea Valen", tier: "principal", fields: { place: "salt_quay", description: "A courier who never reads what she carries." }, relations: [{ type: "regard", to: "silas", fields: { warmth: 20, trust: -10, respect: 30 } }, { type: "knows", to: "silas" }] } },
  { op: "add", path: "/entities/silas", value: { id: "silas", kind: "character", name: "Silas Crane", tier: "supporting", fields: { place: "salt_quay" }, relations: [{ type: "regard", to: "rhea", fields: { warmth: 35, trust: 15, respect: 20 } }] } },
  { op: "add", path: "/entities/rhea_purse", value: { id: "rhea_purse", kind: "account", name: "Rhea's purse", tier: "background", fields: { owner: "rhea", type: "cash", opening: 4250 }, relations: [] } },
  { op: "replace", path: "/pov", value: "rhea" },
  { op: "remove", path: "/entities/you" },
  { op: "replace", path: "/start", value: { place: "salt_quay", at: "2026-09-14T18:30" } },
  { op: "remove", path: "/places/home" },
  { op: "replace", path: "/calendar/epoch", value: "2026-09-14T00:00" },
  { op: "replace", path: "/realism/levels/money", value: 2 },
  {
    op: "add",
    path: "/tracks/lost_ledger",
    value: { id: "lost_ledger", kind: "quest", label: "The lost ledger", visibility: "public", start: "searching", stages: { searching: { label: "Searching for the ledger", cue: "Silas swears the ledger left the archive in May.", next: [{ to: "found", when: "flag('ledger_found')" }] }, found: { label: "The ledger is found", next: [] } } },
  },
  {
    op: "add",
    path: "/tracks/silas_debt",
    value: { id: "silas_debt", kind: "secret", label: "What Silas owes", visibility: "secret", owner: "silas", start: "rumor", stages: { rumor: { label: "Something is off", cue: "Silas flinches whenever the guild is mentioned.", next: [{ to: "known", when: "at(pov, 'guild_office')" }] }, known: { label: "Silas owes the guild", truth: "Silas borrowed the guild's harbor dues to pay a gambling debt.", next: [] } } },
  },
  { op: "add", path: "/lore/lore_port_veil", value: { id: "lore_port_veil", title: "Port Veil", content: "A salt-trading port of nine thousand people.", keys: ["Port Veil"], aliases: ["the Veil"], topics: ["places"], links: ["port_veil"] } },
  { op: "add", path: "/lore/silas_secret", value: { id: "silas_secret", title: "Silas's debt", content: "Silas borrowed the guild's harbor dues to pay a gambling debt.", keys: ["dues"], links: ["silas"], secret: true, gate: "stage('silas_debt') == 'known'", audience: ["npc.choose"] } },
  { op: "add", path: "/schedules/silas_days", value: { id: "silas_days", owner: "silas", target: "place", recurrence: { every: "week", weekdays: [1, 2, 3, 4, 5] }, slots: [{ start: "08:00", end: "17:00", value: "guild_office" }] } },
];

describe("LumiRPEngine Studio", () => {
  test("the assistant reads a chat and its lore, builds a world that passes validate and lint, and it installs through the bridge and attaches to the chat", async () => {
    const { host, studio, engine, send } = rig();
    host.chatsById.set("chat-1", {
      id: "chat-1",
      owner: USER,
      name: "Evening on Salt Quay",
      characterId: "char-silas",
      metadata: { chat_world_book_ids: ["book-veil", "book-engine"] },
      messages: [
        { id: "m1", role: "assistant", name: "Silas", content: "Silas waves you over at Salt Quay. 'The ledger left the archive in May, I swear it.'" },
        { id: "m2", role: "user", name: "Rhea", content: "I count my purse: forty-two fifty left after the ferry." },
        { id: "m3", role: "assistant", name: "Silas", content: "He flinches when you mention the guild. The lamps come on; it's half past six." },
      ],
    });
    host.cards.set("char-silas", { id: "char-silas", owner: USER, name: "Silas", description: "A nervous harbor clerk.", personality: "evasive", scenario: "Port Veil", firstMessage: "Over here!", exampleMessages: "", creatorNotes: "", alternateGreetings: [], tags: [], bookIds: [] });
    host.bookStore.set("book-veil", { id: "book-veil", owner: USER, name: "Veil Lore", description: "", metadata: {}, entryList: [{ id: "e-guild", comment: "The harbor guild", keys: ["guild"], content: "The guild collects harbor dues every quarter.", disabled: false, constant: false }] });
    host.bookStore.set("book-engine", { id: "book-engine", owner: USER, name: "LumiRPEngine · Old", description: "", metadata: { lumi_rp_engine: true }, entryList: [] });
    const script: ModelReply[] = [
      { content: "", reasoning: "Start with the chat.", toolCalls: [call("c1", "transcript_read", { from: 0, count: 40 }), call("c2", "lore_search", { query: "guild dues" })], finishReason: "tool_calls" },
      { content: "", reasoning: "Now the details.", toolCalls: [call("c3", "lore_read", { ids: ["e-guild"] }), call("c4", "cards_read", {})], finishReason: "tool_calls" },
      { content: "Writing the world.", reasoning: "", toolCalls: [call("c5", "draft_patch", { ops: CONVERSION })], finishReason: "tool_calls" },
      { content: "", reasoning: "", toolCalls: [call("c6", "draft_check", {})], finishReason: "tool_calls" },
      { content: "Port Veil is ready: Rhea at Salt Quay at 18:30 with $42.50, Silas, the ledger quest and his secret debt.", reasoning: "", toolCalls: [], finishReason: "stop" },
    ];
    host.model = (_request: ModelRequest, n: number) => {
      const reply = script[n - 1];
      if (!reply) throw new Error("the script ran out");
      return reply;
    };

    expect((await send("hello")).drafts).toEqual([]);
    const created = (await send("draft.create", { name: "", source: { kind: "chat", chatId: "chat-1" } })).draft;
    // The engine's own book holds sections, not lore: it isn't a source.
    expect(created.source.books.map((b) => b.id)).toEqual(["book-veil"]);
    await send("assistant.send", { draftId: created.id, text: "Convert this chat into a world whose start is the story's present." });
    await studio.assistant.idle();

    expect(host.modelCalls).toHaveLength(5);
    const second = JSON.stringify(host.modelCalls[1]?.messages);
    expect(second).toContain("forty-two fifty");
    expect(second).toContain("collects harbor dues");
    // Each tool call goes back as it was, with the reasoning a thinking model needs echoed.
    const turn = host.modelCalls[1]?.messages.find((m) => m.role === "assistant" && Array.isArray(m.content));
    expect(turn?.reasoning).toBe("Start with the chat.");

    let draft = (await send("draft.open", { draftId: created.id })).draft;
    expect(draft.review?.errors).toBe(0);
    expect(draft.review?.changes.map((c) => c.key)).toContain("/entities/rhea");
    expect(draft.world.name).toBe(created.world.name);
    draft = (await send("review.accept", { draftId: created.id, keys: null })).draft;
    expect([draft.review, draft.errors, draft.world.pov, draft.world.name]).toEqual([null, 0, "rhea", "Port Veil"]);

    const exported = await send("draft.export", { draftId: created.id });
    const file = exported.file;
    const world = isRecord(file) ? file.world : null;
    expect(validate(world)).toEqual([]);
    const read = readWorldDoc(world);
    expect([read.ok, read.issues.filter((i) => i.severity === "error")]).toEqual([true, []]);

    const offered = await send("install", { draftId: created.id, mode: "new", worldId: null, attachChatId: "chat-1" });
    const installed = await engine.install();
    expect(installed.offerId).toBe(offered.offerId);
    expect(engine.worlds.get(installed.worldId)?.revisions.at(-1)?.doc.pov).toBe("rhea");
    expect(engine.attached.get("chat-1")?.worldId).toBe(installed.worldId);
    const linked = (await send("installed", { ...installed })).draft;
    expect(linked?.link).toEqual({ worldId: installed.worldId, revision: installed.revision });
    expect(linked?.offer).toBeNull();
    // With the offer taken, the engine finds nothing waiting.
    expect(await host.pool.read(`${STUDIO_EXTENSION}.offer.${channelId(USER)}`, ENGINE_EXTENSION)).toBeNull();
  });

  test("a revision of an engine world keeps the world's id, and reads of the engine go through its endpoints", async () => {
    const { engine, send } = rig();
    const base = newWorld("w_harbor", "Harbor");
    engine.addWorld(base);
    expect((await send("pick.worlds")).worlds.map((w) => w.id)).toEqual(["w_harbor"]);
    const draft = (await send("draft.create", { name: "", source: { kind: "world", worldId: "w_harbor" } })).draft;
    expect(draft.link?.worldId).toBe("w_harbor");
    await send("install", { draftId: draft.id, mode: "revision", worldId: null, attachChatId: null });
    const installed = await engine.install();
    expect([installed.mode, installed.worldId, engine.worlds.get("w_harbor")?.revisions.length]).toEqual(["revision", "w_harbor", 2]);
  });

  test("the offer answers LumiRPEngine only, and a user reads only their own chats and drafts", async () => {
    const { host, send } = rig();
    host.chatsById.set("chat-x", { id: "chat-x", owner: "someone_else", name: "Not yours", characterId: "", metadata: {}, messages: [] });
    await expect(send("draft.create", { name: "", source: { kind: "chat", chatId: "chat-x" } })).rejects.toThrow("isn't one of yours");
    const draft = (await send("draft.create", { name: "Mine", source: { kind: "blank" } })).draft;
    await send("install", { draftId: draft.id, mode: "new", worldId: null, attachChatId: null });
    await expect(host.pool.read(`${STUDIO_EXTENSION}.offer.${channelId(USER)}`, "another_ext")).rejects.toThrow(ENGINE_EXTENSION);
    expect((await send("draft.list", {}, "OtherUser9")).drafts).toEqual([]);
    await expect(send("draft.open", { draftId: draft.id }, "OtherUser9")).rejects.toThrow("gone");
  });

  test("a proposal reaches the draft only as accepted, and nothing installs while one waits", async () => {
    const { studio, send } = rig();
    const draft = (await send("draft.create", { name: "Review", source: { kind: "blank" } })).draft;
    await studio.drafts.update(USER, draft.id, (d) => {
      d.proposed = { ...structuredClone(d.doc), places: { ...d.doc.places, pier: { id: "pier", name: "Pier", fields: {} }, dock: { id: "dock", name: "Dock", fields: {} } } };
    });
    await expect(send("install", { draftId: draft.id, mode: "new", worldId: null, attachChatId: null })).rejects.toThrow("Accept or discard");
    const view: DraftView = (await send("review.accept", { draftId: draft.id, keys: ["/places/pier"] })).draft;
    expect([view.counts.places, view.review]).toEqual([2, null]);
    expect(view.chat.at(-1)?.kind === "note" && view.chat.at(-1)).toBeTruthy();
  });

  test("a patch applies all of its operations or none, and says which one failed", () => {
    const doc: JsonValue = { a: { "x/y": 1, list: [1, 2] } };
    const next = applyPatch(doc, [readOp({ op: "add", path: "/a/list/-", value: 3 }, 0), readOp({ op: "move", from: "/a/x~1y", path: "/b" }, 1), readOp({ op: "test", path: "/b", value: 1 }, 2)]);
    expect(next).toEqual({ a: { list: [1, 2, 3] }, b: 1 });
    expect(() => applyPatch(doc, [readOp({ op: "remove", path: "/a/list/0" }, 0), readOp({ op: "replace", path: "/missing", value: 1 }, 1)])).toThrow("operation 2");
    expect(doc).toEqual({ a: { "x/y": 1, list: [1, 2] } });
    expect(() => readOp({ op: "add", path: "/x" }, 0)).toThrow("needs a value");
  });

  test("a review lists item changes, and accepting some takes only those", () => {
    const doc = newWorld("w", "W");
    const proposed = structuredClone(doc);
    proposed.places.pier = { id: "pier", name: "Pier", fields: {} };
    proposed.entities.you = { ...proposed.entities.you, name: "Rhea" } as typeof proposed.entities.you;
    const changes = changesBetween(doc, proposed);
    expect(changes.map((c) => [c.key, c.kind])).toEqual([
      ["/entities/you", "changed"],
      ["/places/pier", "added"],
    ]);
    const taken = acceptChanges(doc, proposed, ["/places/pier"]);
    expect([Object.keys(taken.places).sort(), taken.entities.you?.name]).toEqual([["home", "pier"], "You"]);
  });

  test("earlier runs go back to the model as text, and a note made while tools ran waits for their results", () => {
    const chat: ChatEntry[] = [
      { kind: "user", text: "First", at: 1 },
      { kind: "assistant", text: "", at: 2, run: 1, calls: [{ id: "a", name: "draft_check", args: {} }] },
      { kind: "results", at: 3, run: 1, results: [{ id: "a", name: "draft_check", content: "0 errors", error: false, summary: "Checked" }] },
      { kind: "assistant", text: "Done.", at: 4, run: 1, calls: [] },
      { kind: "user", text: "Second", at: 5 },
      { kind: "assistant", text: "", at: 6, run: 2, calls: [{ id: "b", name: "draft_read", args: { path: "" } }], reasoning: "thinking" },
      { kind: "note", text: "You accepted all 2 changes.", at: 7 },
      { kind: "results", at: 8, run: 2, results: [{ id: "b", name: "draft_read", content: "Outline", error: false, summary: "Read" }] },
    ];
    const messages = modelMessages("system", chat, 2);
    expect(messages.map((m) => [m.role, typeof m.content === "string" ? m.content : m.content.map((p) => p.type).join(",")])).toEqual([
      ["system", "system"],
      ["user", "First"],
      ["assistant", "(I used draft_check.)\n\nDone."],
      ["user", "Second"],
      ["assistant", "tool_use"],
      ["user", "tool_result"],
      ["user", "(Studio) You accepted all 2 changes."],
    ]);
    expect(messages[4]?.reasoning).toBe("thinking");
  });

  test("the manifest declares the identifier and the permissions the README explains", async () => {
    // The manifest the host installs from.
    expect(manifest.identifier).toBe(STUDIO_EXTENSION);
    expect([...manifest.permissions].sort()).toEqual(["characters", "chat_mutation", "chats", "generation", "personas", "world_books"]);
  });
});

