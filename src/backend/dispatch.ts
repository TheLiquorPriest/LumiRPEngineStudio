// Request dispatch: every frontend request gets exactly one `result` or `error` with its `reqId`.
// Drafts start from a source (a chat, a character, books, nothing, or a LumiRPEngine world), the
// assistant works on a proposal the user reviews, and Install only offers the accepted draft to
// LumiRPEngine, where the player confirms it.

import { exportFile, newWorld, readWorldDoc } from "../engine";
import type { WorldDoc } from "../engine";
import type { StudioOffer } from "../shared/bridge";
import { isRecord, toJson } from "../shared/json";
import type { JsonValue } from "../shared/json";
import type { BackendToFrontend, BookRef, DraftSource, FrontendToBackend, ResultBodies, SourceSpec } from "../shared/protocol";
import { PROTOCOL } from "../shared/protocol";
import type { Assistant } from "./assistant";
import type { EngineBridge } from "./bridge";
import type { Draft, DraftStore } from "./drafts";
import { draftIdOk } from "./drafts";
import type { StudioHost } from "./host";
import { getAt, parsePointer } from "./pointer";
import { acceptChanges, changesBetween } from "./review";
import type { SettingsStore } from "./settings";
import { booksFor, cardsOf, chatCharacterIds, isEngineBook, ownChat } from "./sources";
import { draftView } from "./views";

const PASTED_CAP = 20;
const PASTED_TEXT_CAP = 500_000;

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "world";
}

function isRequest(raw: unknown): raw is FrontendToBackend {
  return isRecord(raw) && raw.studio === PROTOCOL && typeof raw.reqId === "string" && typeof raw.type === "string";
}

export class Dispatcher {
  constructor(
    private readonly host: StudioHost,
    private readonly drafts: DraftStore,
    private readonly settings: SettingsStore,
    private readonly bridge: EngineBridge,
    private readonly assistant: Assistant,
  ) {}

  start(): void {
    this.host.frontend.onMessage((message, userId) => void this.handle(message, userId));
  }

  private send(message: BackendToFrontend, userId: string): void {
    this.host.frontend.send(message, userId);
  }

  /** Pushes a draft's view (the assistant's rounds, a settled review, an install). */
  async push(userId: string, draftId: string): Promise<void> {
    const draft = await this.drafts.get(userId, draftId);
    if (draft) this.send({ studio: PROTOCOL, type: "draft", draft: draftView(draft, this.assistant.running(userId, draftId)) }, userId);
  }

  async handle(raw: unknown, userId: string): Promise<void> {
    if (!isRequest(raw)) return;
    try {
      const body = await this.route(raw, userId);
      this.send({ studio: PROTOCOL, type: "result", reqId: raw.reqId, request: raw.type, body }, userId);
    } catch (error) {
      this.send({ studio: PROTOCOL, type: "error", reqId: raw.reqId, message: error instanceof Error ? error.message : String(error) }, userId);
    }
  }

  private async draft(userId: string, draftId: unknown): Promise<Draft> {
    const draft = draftIdOk(draftId) ? await this.drafts.get(userId, draftId) : null;
    if (!draft) throw new Error("That draft is gone.");
    return draft;
  }

  private view(userId: string, draft: Draft) {
    return draftView(draft, this.assistant.running(userId, draft.id));
  }

  private async route(r: FrontendToBackend, userId: string): Promise<ResultBodies[keyof ResultBodies]> {
    switch (r.type) {
      case "hello": {
        this.bridge.serve(userId);
        const connections = await this.host.models.connections(userId).catch(() => []);
        return { drafts: await this.drafts.list(userId), settings: await this.settings.get(userId), connections };
      }
      case "draft.list":
        return { drafts: await this.drafts.list(userId) };
      case "draft.create":
        return { draft: this.view(userId, await this.create(userId, r.name, r.source)) };
      case "draft.open":
        return { draft: this.view(userId, await this.draft(userId, r.draftId)) };
      case "draft.rename": {
        const name = r.name.trim();
        if (!name) throw new Error("Give the draft a name.");
        await this.draft(userId, r.draftId);
        return { draft: this.view(userId, await this.drafts.update(userId, r.draftId, (d) => void (d.name = name.slice(0, 120)))) };
      }
      case "draft.delete": {
        if (this.assistant.running(userId, r.draftId)) throw new Error("Stop the assistant before you delete this draft.");
        return { drafts: await this.drafts.remove(userId, r.draftId) };
      }
      case "draft.paste": {
        const text = r.text.trim();
        if (!text) throw new Error("Paste some text first.");
        await this.draft(userId, r.draftId);
        const draft = await this.drafts.update(userId, r.draftId, (d) => {
          if (d.source.pasted.length >= PASTED_CAP) throw new Error(`A draft holds at most ${PASTED_CAP} pasted texts.`);
          d.source.pasted.push({ title: r.title.trim().slice(0, 120) || `Pasted text ${d.source.pasted.length + 1}`, text: text.slice(0, PASTED_TEXT_CAP) });
        });
        return { draft: this.view(userId, draft) };
      }
      case "draft.unpaste": {
        await this.draft(userId, r.draftId);
        return { draft: this.view(userId, await this.drafts.update(userId, r.draftId, (d) => void d.source.pasted.splice(r.index, 1))) };
      }
      case "draft.item": {
        const draft = await this.draft(userId, r.draftId);
        const doc = r.proposed && draft.proposed ? draft.proposed : draft.doc;
        const value = getAt(doc as unknown as JsonValue, [r.collection, r.id]);
        if (value === undefined) throw new Error(`There is no ${r.collection} item ${r.id}.`);
        return { value };
      }
      case "draft.validate":
        return { draft: this.view(userId, await this.draft(userId, r.draftId)) };
      case "draft.export": {
        const draft = await this.draft(userId, r.draftId);
        const loaded = readWorldDoc(draft.doc);
        if (!loaded.ok) throw new Error(`The draft isn't a world LumiRPEngine can read yet: ${loaded.issues[0]?.message ?? "its shape is wrong"}.`);
        return { file: toJson(exportFile(loaded.world)), fileName: `${slug(draft.doc.name)}.lre-world.json` };
      }
      case "draft.import": {
        const loaded = readWorldDoc(r.file);
        if (!loaded.ok) throw new Error(`That file isn't a world LumiRPEngine can read: ${loaded.issues[0]?.message ?? "its shape is wrong"}.`);
        const name = r.name.trim() || loaded.world.name;
        const source: DraftSource = { kind: "file", label: `File: ${loaded.world.name}`, chatId: null, characterIds: [], books: [], pasted: [], worldId: null };
        return { draft: this.view(userId, await this.drafts.create(userId, { name, source, doc: loaded.world, link: null, note: `Imported from a file: ${loaded.world.name}.` })) };
      }
      case "review.accept": {
        await this.draft(userId, r.draftId);
        const draft = await this.drafts.update(userId, r.draftId, (d) => {
          if (!d.proposed) throw new Error("There is nothing to review.");
          const all = changesBetween(d.doc, d.proposed);
          const picked = r.keys === null ? all : all.filter((c) => r.keys?.includes(c.key));
          d.doc = acceptChanges(d.doc, d.proposed, r.keys === null ? null : picked.map((c) => c.key));
          d.proposed = null;
          const declined = all.filter((c) => !picked.includes(c));
          d.chat.push({ kind: "note", text: declined.length === 0 ? `You accepted all ${all.length} changes.` : `You accepted ${picked.length} of ${all.length} changes and declined: ${declined.map((c) => c.label).join("; ")}.`, at: Date.now() });
        });
        return { draft: this.view(userId, draft) };
      }
      case "review.discard": {
        await this.draft(userId, r.draftId);
        const draft = await this.drafts.update(userId, r.draftId, (d) => {
          if (!d.proposed) return;
          d.proposed = null;
          d.chat.push({ kind: "note", text: "You discarded the assistant's changes.", at: Date.now() });
        });
        return { draft: this.view(userId, draft) };
      }
      case "review.change": {
        // One change as the draft holds it and as the assistant proposes it, for the review's Compare.
        const draft = await this.draft(userId, r.draftId);
        if (!draft.proposed) throw new Error("There is nothing to review.");
        const at = parsePointer(r.key);
        return { before: getAt(toJson(draft.doc), at) ?? null, after: getAt(toJson(draft.proposed), at) ?? null };
      }
      case "assistant.send": {
        await this.draft(userId, r.draftId);
        await this.assistant.send(userId, r.draftId, r.text);
        await this.push(userId, r.draftId);
        return { started: true };
      }
      case "assistant.stop":
        return { stopped: this.assistant.stop(userId, r.draftId) };
      case "offer.withdraw": {
        const draft = await this.draft(userId, r.draftId);
        if (draft.offer) await this.bridge.withdraw(userId, draft.offer.offerId);
        const updated = await this.drafts.update(userId, r.draftId, (d) => {
          if (!d.offer) return;
          d.offer = null;
          d.chat.push({ kind: "note", text: "You withdrew the offer, so LumiRPEngine no longer sees it.", at: Date.now() });
        });
        return { draft: this.view(userId, updated) };
      }
      case "install":
        return this.install(userId, r.draftId, r.mode, r.worldId, r.attachChatId);
      case "installed": {
        const draftId = await this.bridge.withdraw(userId, r.offerId);
        if (!draftId) return { draft: null };
        const draft = await this.drafts.update(userId, draftId, (d) => {
          d.link = { worldId: r.worldId, revision: r.revision };
          d.offer = null;
          d.chat.push({ kind: "note", text: `LumiRPEngine installed it as ${r.mode === "new" ? "a new world" : "a new revision"} (world ${r.worldId}). The next install can be a new revision of it.`, at: Date.now() });
        });
        return { draft: this.view(userId, draft) };
      }
      case "pick.characters":
        return { items: await this.host.characters.list(userId) };
      case "pick.books":
        return { items: (await this.host.books.list(userId)).filter((b) => !isEngineBook(b.metadata)).map((b) => ({ id: b.id, name: b.name })) };
      case "pick.worlds":
        return { worlds: await this.bridge.worlds(userId) };
      case "pick.chat": {
        const chat = await ownChat(this.host, userId, r.chatId);
        const cards = await cardsOf(this.host, userId, chatCharacterIds(chat));
        return { chat: { id: chat.id, name: chat.name, messages: (await this.host.chats.messages(chat.id)).length, characters: cards.map((c) => c.name), books: await booksFor(this.host, userId, chat, cards), world: await this.bridge.chatState(userId, chat.id) } };
      }
      case "settings.set":
        return { settings: await this.settings.set(userId, { ...(r.connectionId !== undefined ? { connectionId: r.connectionId } : {}), ...(r.maxRounds !== undefined ? { maxRounds: r.maxRounds } : {}) }) };
    }
  }

  /** A new draft from its source: the world it starts from and what its assistant may read. */
  private async create(userId: string, name: string, spec: SourceSpec): Promise<Draft> {
    const title = name.trim().slice(0, 120);
    const empty: DraftSource = { kind: spec.kind, label: "Blank", chatId: null, characterIds: [], books: [], pasted: [], worldId: null };
    switch (spec.kind) {
      case "blank": {
        const world = title || "New world";
        return this.drafts.create(userId, { name: world, source: empty, doc: newWorld(slug(world), world), link: null });
      }
      case "chat": {
        const chat = await ownChat(this.host, userId, spec.chatId);
        // A chat that plays a world refines that world: its draft starts from the world's head, linked.
        const playing = await this.bridge.chatState(userId, chat.id).catch(() => null);
        if (playing) return this.create(userId, name, { kind: "world", worldId: playing.worldId, chatId: chat.id });
        const ids = chatCharacterIds(chat);
        const cards = await cardsOf(this.host, userId, ids);
        const books = await booksFor(this.host, userId, chat, cards);
        const world = title || chat.name || "New world";
        const persona = await this.host.personas.active(userId).catch(() => null);
        const source: DraftSource = { ...empty, label: `Chat: ${chat.name}`, chatId: chat.id, characterIds: ids, books, persona: persona ? { id: persona.id, name: persona.name } : null };
        return this.drafts.create(userId, { name: world, source, doc: newWorld(slug(world), world), link: null, note: `Started from the chat “${chat.name}”${cards.length > 0 ? ` with ${cards.map((c) => c.name).join(", ")}` : ""}${books.length > 0 ? `, reading ${books.length} lore book${books.length === 1 ? "" : "s"}` : ""}.` });
      }
      case "character": {
        const card = await this.host.characters.get(spec.characterId, userId);
        if (!card) throw new Error("That character isn't one of yours, or it's gone.");
        const books = await booksFor(this.host, userId, null, [card]);
        const world = title || card.name;
        const source: DraftSource = { ...empty, label: `Character: ${card.name}`, characterIds: [card.id], books };
        return this.drafts.create(userId, { name: world, source, doc: newWorld(slug(world), world), link: null, note: `Started from ${card.name}'s card.` });
      }
      case "books": {
        const books: BookRef[] = [];
        for (const id of spec.bookIds) {
          const book = await this.host.books.get(id, userId);
          if (book && !isEngineBook(book.metadata) && !books.some((b) => b.id === id)) books.push({ id, name: book.name, scope: "picked" });
        }
        if (books.length === 0) throw new Error("Pick at least one of your lore books.");
        const world = title || books[0]?.name || "New world";
        const source: DraftSource = { ...empty, label: `Books: ${books.map((b) => b.name).join(", ")}`, books };
        return this.drafts.create(userId, { name: world, source, doc: newWorld(slug(world), world), link: null });
      }
      case "world": {
        const read = await this.bridge.world(userId, spec.worldId);
        const loaded = readWorldDoc(read.world);
        if (!loaded.ok) throw new Error(`LumiRPEngine's copy of ${read.name} can't be read: ${loaded.issues[0]?.message ?? "its shape is wrong"}.`);
        let source: DraftSource = { ...empty, label: `World: ${read.name}`, worldId: read.worldId };
        if (spec.chatId) {
          const chat = await ownChat(this.host, userId, spec.chatId);
          const ids = chatCharacterIds(chat);
          const cards = await cardsOf(this.host, userId, ids);
          const persona = await this.host.personas.active(userId).catch(() => null);
          source = { ...source, label: `World: ${read.name}, played in “${chat.name}”`, chatId: chat.id, characterIds: ids, books: await booksFor(this.host, userId, chat, cards), persona: persona ? { id: persona.id, name: persona.name } : null };
        }
        return this.drafts.create(userId, { name: title || read.name, source, doc: loaded.world, link: { worldId: read.worldId, revision: read.head }, note: `Started from LumiRPEngine's ${read.name} at its head revision ${read.head.slice(0, 8)}.` });
      }
    }
  }

  /** Offers the accepted draft to LumiRPEngine; the player reviews and installs it there. */
  private async install(userId: string, draftId: string, mode: "new" | "revision", requested: string | null, attachChatId: string | null): Promise<ResultBodies["install"]> {
    const draft = await this.draft(userId, draftId);
    if (draft.proposed) throw new Error("Accept or discard the assistant's changes first: only what you've accepted is installed.");
    const loaded = readWorldDoc(draft.doc);
    const errors = loaded.issues.filter((i) => i.severity === "error").length;
    if (!loaded.ok || errors > 0) throw new Error(`The draft has ${Math.max(1, errors)} error${errors === 1 ? "" : "s"} to fix first; Validate lists them.`);
    const worldId = mode === "revision" ? (requested ?? draft.link?.worldId ?? null) : null;
    if (mode === "revision" && !worldId) throw new Error("Choose the LumiRPEngine world this is a revision of.");
    if (attachChatId) await ownChat(this.host, userId, attachChatId);
    const doc: WorldDoc = worldId ? { ...loaded.world, id: worldId } : loaded.world;
    const offer: StudioOffer = { offerId: `o_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`, doc: toJson(doc), mode, ...(worldId ? { worldId } : {}), ...(worldId && worldId === draft.link?.worldId && draft.link.revision ? { baseRevision: draft.link.revision } : {}), ...(attachChatId ? { attachChatId } : {}), createdAt: Date.now() };
    const replaced = await this.bridge.pending(userId);
    await this.bridge.publish(userId, draftId, offer);
    // The new offer replaces any other: the draft that made that one no longer has it waiting.
    if (replaced && replaced.draftId !== draftId) {
      await this.drafts
        .update(userId, replaced.draftId, (d) => {
          if (d.offer?.offerId !== replaced.offer.offerId) return;
          d.offer = null;
          d.chat.push({ kind: "note", text: "Another draft's offer replaced this one in LumiRPEngine.", at: Date.now() });
        })
        .catch(() => undefined);
    }
    await this.drafts.update(userId, draftId, (d) => {
      d.offer = { offerId: offer.offerId, mode, createdAt: offer.createdAt };
      d.chat.push({ kind: "note", text: `Offered to LumiRPEngine as ${mode === "new" ? "a new world" : `a new revision of world ${worldId}`}${attachChatId ? ", to attach to a chat" : ""}. Review and install it in LumiRPEngine's Build tab.`, at: offer.createdAt });
    });
    return { offerId: offer.offerId, mode };
  }
}
