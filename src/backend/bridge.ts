// This extension's side of the LumiRPEngine bridge, whose names and payloads are the pinned
// engine's (`lumi-rp-engine/studio`; LumiRPEngine's docs/STUDIO.md "The Studio bridge"). It reads
// the user's engine worlds and world chats, checking each payload before anything else uses it, and
// publishes the user's pending offer (`userStorage/offer.json`) on an endpoint only LumiRPEngine may
// read. Installing is LumiRPEngine's: the player reviews the offer there and confirms it.

import { chatsChannel, ENGINE_EXTENSION, engineEndpoint, offerEndpoint, STUDIO_EXTENSION, worldChannel, worldsChannel } from "lumi-rp-engine/studio";
import type { StudioChatSummary, StudioOffer, StudioWorldEntry, StudioWorldRead } from "lumi-rp-engine/studio";
import { isRecord } from "../shared/json";
import type { StudioHost } from "./host";

const OFFER_FILE = "offer.json";

/** The offer as stored: the offer itself and the draft it came from. */
interface StoredOffer {
  draftId: string;
  offer: StudioOffer;
}

/** An engine world as read (`StudioWorldRead`), its document still unchecked: `load` reads it before a draft takes it. */
type EngineWorld = Omit<StudioWorldRead, "v" | "world"> & { world: unknown };

function isStoredOffer(raw: unknown): raw is StoredOffer {
  return isRecord(raw) && typeof raw.draftId === "string" && isRecord(raw.offer) && typeof raw.offer.offerId === "string";
}

const str = (v: unknown): v is string => typeof v === "string";

/** The engine's world list (`StudioWorldList`); a malformed entry is left out. */
function readWorldList(value: unknown): StudioWorldEntry[] {
  if (!isRecord(value) || !Array.isArray(value.worlds)) throw new Error("LumiRPEngine sent a world list this Studio can't read");
  return value.worlds.flatMap((w): StudioWorldEntry[] => {
    if (!isRecord(w) || !str(w.id) || !str(w.name) || !str(w.head)) return [];
    const revisions = Array.isArray(w.revisions) ? w.revisions.filter(str) : [w.head];
    return [{ id: w.id, name: w.name, head: w.head, revisions, revisionCount: typeof w.revisionCount === "number" ? w.revisionCount : revisions.length }];
  });
}

/** One engine world (`StudioWorldRead`). */
function readWorld(value: unknown): EngineWorld {
  if (!isRecord(value) || !str(value.worldId) || !str(value.name) || !str(value.head) || !str(value.revision) || !isRecord(value.world)) throw new Error("LumiRPEngine sent a world this Studio can't read");
  return { worldId: value.worldId, name: value.name, head: value.head, revision: value.revision, world: value.world };
}

/** The engine's world chats (`StudioChats`), newest first; a malformed one is left out. */
function readChats(value: unknown): StudioChatSummary[] {
  if (!isRecord(value) || !Array.isArray(value.chats)) throw new Error("LumiRPEngine sent chat summaries this Studio can't read");
  return value.chats.flatMap((c): StudioChatSummary[] => {
    if (!isRecord(c) || !str(c.chatId) || !str(c.worldId) || !str(c.revision)) return [];
    const place = isRecord(c.place) && str(c.place.name) ? { id: str(c.place.id) ? c.place.id : null, name: c.place.name } : null;
    const clock = isRecord(c.clock) && typeof c.clock.minutes === "number" && str(c.clock.label) ? { minutes: c.clock.minutes, label: c.clock.label, dayPart: str(c.clock.dayPart) ? c.clock.dayPart : "" } : null;
    const present = Array.isArray(c.present) ? c.present.flatMap((p) => (isRecord(p) && str(p.id) && str(p.name) ? [{ id: p.id, name: p.name, label: str(p.label) ? p.label : p.name, ...(str(p.life) ? { life: p.life } : {}) }] : [])) : [];
    const quests = Array.isArray(c.quests)
      ? c.quests.flatMap((q) => (isRecord(q) && str(q.id) && str(q.label) ? [{ id: q.id, kind: str(q.kind) ? q.kind : "quest", label: q.label, stage: str(q.stage) ? q.stage : "", cue: str(q.cue) ? q.cue : null }] : []))
      : [];
    return [
      {
        chatId: c.chatId,
        worldId: c.worldId,
        revision: c.revision,
        ...(str(c.definitionsFrom) ? { definitionsFrom: c.definitionsFrom } : {}),
        status: c.status === "in_flight" || c.status === "paused" ? c.status : "idle",
        place,
        clock,
        cash: str(c.cash) ? c.cash : null,
        present,
        quests,
        at: typeof c.at === "number" ? c.at : 0,
      },
    ];
  });
}

/** Why an engine read failed, worded for the player. */
function unreachable(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`LumiRPEngine didn't answer (${detail}). Make sure it is installed and enabled, and open its drawer tab once so it serves you.`);
}

export class EngineBridge {
  /** Users whose offer endpoint is registered. */
  private readonly served = new Set<string>();

  constructor(private readonly host: StudioHost) {}

  /** Registers the user's offer endpoint, answering LumiRPEngine only; later calls do nothing. */
  serve(userId: string): void {
    if (this.served.has(userId)) return;
    this.served.add(userId);
    // The host serves a channel under this extension's id: the endpoint LumiRPEngine reads, less that prefix.
    this.host.rpc.handle(offerEndpoint(userId).slice(STUDIO_EXTENSION.length + 1), [], async (requester) => {
      if (requester !== ENGINE_EXTENSION) throw new Error(`only ${ENGINE_EXTENSION} may read this endpoint`);
      return (await this.pending(userId))?.offer ?? null;
    });
  }

  /** The user's pending offer and the draft it came from, if any. */
  async pending(userId: string): Promise<StoredOffer | null> {
    const text = await this.host.storage.read(OFFER_FILE, userId);
    if (text === null) return null;
    try {
      const raw: unknown = JSON.parse(text);
      return isStoredOffer(raw) ? raw : null;
    } catch {
      return null;
    }
  }

  /** Makes the offer the user's pending one (replacing any other) and serves it. */
  async publish(userId: string, draftId: string, offer: StudioOffer): Promise<void> {
    const stored: StoredOffer = { draftId, offer };
    await this.host.storage.write(`${OFFER_FILE}.tmp`, JSON.stringify(stored), userId);
    await this.host.storage.move(`${OFFER_FILE}.tmp`, OFFER_FILE, userId);
    this.serve(userId);
  }

  /** Withdraws the pending offer when it is `offerId`; returns the draft it came from. */
  async withdraw(userId: string, offerId: string): Promise<string | null> {
    const stored = await this.pending(userId);
    if (!stored || stored.offer.offerId !== offerId) return null;
    await this.host.storage.remove(OFFER_FILE, userId);
    return stored.draftId;
  }

  async worlds(userId: string): Promise<StudioWorldEntry[]> {
    let raw: unknown;
    try {
      raw = await this.host.rpc.read(engineEndpoint(worldsChannel(userId)));
    } catch (error) {
      throw unreachable(error);
    }
    return readWorldList(raw);
  }

  async world(userId: string, worldId: string, revision?: string): Promise<EngineWorld> {
    let raw: unknown;
    try {
      raw = await this.host.rpc.read(engineEndpoint(worldChannel(userId, worldId, revision)));
    } catch (error) {
      throw unreachable(error);
    }
    return readWorld(raw);
  }

  async chats(userId: string): Promise<StudioChatSummary[]> {
    let raw: unknown;
    try {
      raw = await this.host.rpc.read(engineEndpoint(chatsChannel(userId)));
    } catch (error) {
      throw unreachable(error);
    }
    return readChats(raw);
  }

  /** The engine's summary of a chat, or null when it plays no world (or the engine can't say). */
  async chatState(userId: string, chatId: string): Promise<StudioChatSummary | null> {
    try {
      return (await this.chats(userId)).find((c) => c.chatId === chatId) ?? null;
    } catch {
      return null;
    }
  }
}
