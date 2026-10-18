// This extension's side of the LumiRPEngine bridge (shared/bridge.ts; LumiRPEngine's
// docs/STUDIO.md "The Studio bridge"). It reads the user's engine worlds and world chats, and
// publishes the user's pending offer (`userStorage/offer.json`) on an endpoint only LumiRPEngine may
// read. Installing is LumiRPEngine's: the player reviews the offer there and confirms it.

import type { EngineChatSummary, EngineWorldEntry, EngineWorldRead, StudioOffer } from "../shared/bridge";
import { chatsEndpoint, ENGINE_EXTENSION, offerChannel, readChats, readWorld, readWorldList, worldEndpoint, worldsEndpoint } from "../shared/bridge";
import { isRecord } from "../shared/json";
import type { StudioHost } from "./host";

const OFFER_FILE = "offer.json";

/** The offer as stored: the offer itself and the draft it came from. */
interface StoredOffer {
  draftId: string;
  offer: StudioOffer;
}

function isStoredOffer(raw: unknown): raw is StoredOffer {
  return isRecord(raw) && typeof raw.draftId === "string" && isRecord(raw.offer) && typeof raw.offer.offerId === "string";
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
    this.host.rpc.handle(offerChannel(userId), [], async (requester) => {
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

  async worlds(userId: string): Promise<EngineWorldEntry[]> {
    let raw: unknown;
    try {
      raw = await this.host.rpc.read(worldsEndpoint(userId));
    } catch (error) {
      throw unreachable(error);
    }
    return readWorldList(raw);
  }

  async world(userId: string, worldId: string, revision?: string): Promise<EngineWorldRead> {
    let raw: unknown;
    try {
      raw = await this.host.rpc.read(worldEndpoint(userId, worldId, revision));
    } catch (error) {
      throw unreachable(error);
    }
    return readWorld(raw);
  }

  async chats(userId: string): Promise<EngineChatSummary[]> {
    let raw: unknown;
    try {
      raw = await this.host.rpc.read(chatsEndpoint(userId));
    } catch (error) {
      throw unreachable(error);
    }
    return readChats(raw);
  }

  /** The engine's summary of a chat, or null when it plays no world (or the engine can't say). */
  async chatState(userId: string, chatId: string): Promise<EngineChatSummary | null> {
    try {
      return (await this.chats(userId)).find((c) => c.chatId === chatId) ?? null;
    } catch {
      return null;
    }
  }
}
