// The LumiRPEngine bridge as LumiRPEngine's docs/STUDIO.md ("The Studio bridge") defines it: the
// endpoint names, the window events between the two frontends, the offer this extension publishes
// and the payloads it reads. A shared RPC read carries no request and no user, so LumiRPEngine
// publishes per-user endpoints only this extension may read, this extension publishes the user's
// pending offer only LumiRPEngine may read, and nothing installs until the player confirms it in
// LumiRPEngine. Everything read from the engine is checked here before anything else uses it.

import { isRecord } from "./json";
import type { JsonValue } from "./json";

export const ENGINE_EXTENSION = "lumi_rp_engine";
export const STUDIO_EXTENSION = "lumi_rp_engine_studio";

/** LumiRPEngine's announcement (`{engineVersion, worldFormat, packs, inbound}`), and the request that has it announced again. */
export const STATE_EVENT = "lre-state-v1";
export const STATE_REQUEST_EVENT = "lre-state-request-v1";
/** This extension's frontend saying an offer is waiting (`{offerId}`); LumiRPEngine's saying one was installed. */
export const OFFER_EVENT = "lre-studio-offer-v1";
export const INSTALLED_EVENT = "lre-studio-installed-v1";
/** What LumiRPEngine lists in `inbound` when it reads this extension's offers. */
export const OFFER_INBOUND = `rpc:${STUDIO_EXTENSION}.offer`;

const encoder = new TextEncoder();

/**
 * An id as one channel segment: its UTF-8 bytes in lowercase hex. A segment takes only
 * `[a-z0-9_-]`, and user and world ids are mixed case, so lowercasing them would merge two ids.
 */
export function channelId(id: string): string {
  let out = "";
  for (const byte of encoder.encode(id)) out += byte.toString(16).padStart(2, "0");
  return out;
}

/** This extension's channel for the user's pending offer (served as `lumi_rp_engine_studio.offer.<user>`). */
export function offerChannel(userId: string): string {
  return `offer.${channelId(userId)}`;
}

export function worldsEndpoint(userId: string): string {
  return `${ENGINE_EXTENSION}.studio-worlds.${channelId(userId)}`;
}

export function chatsEndpoint(userId: string): string {
  return `${ENGINE_EXTENSION}.studio-chats.${channelId(userId)}`;
}

/** One of the user's engine worlds: its head, or one revision (32 hex digits, a segment as it is). */
export function worldEndpoint(userId: string, worldId: string, revision?: string): string {
  return `${ENGINE_EXTENSION}.studio-world.${channelId(userId)}.${channelId(worldId)}${revision === undefined ? "" : `.${revision}`}`;
}

/** What this extension offers LumiRPEngine: a world document as a new world, or as the next revision of `worldId`. */
export interface StudioOffer {
  offerId: string;
  doc: JsonValue;
  mode: "new" | "revision";
  worldId?: string;
  /** A chat to attach the world to once installed (LumiRPEngine asks first). */
  attachChatId?: string;
  createdAt: number;
}

/** LumiRPEngine's `lre-studio-installed-v1` detail: which offer became which world revision. */
export interface StudioInstalled {
  offerId: string;
  mode: "new" | "revision";
  worldId: string;
  revision: string;
}

export interface EngineWorldEntry {
  id: string;
  name: string;
  head: string;
  revisions: string[];
  revisionCount: number;
}

export interface EngineWorldRead {
  worldId: string;
  name: string;
  head: string;
  revision: string;
  /** The document as the engine keeps it; `load` checks it before a draft takes it. */
  world: unknown;
}

/** A world chat as its player sees it (LumiRPEngine builds it from the view it last pushed to the chat). */
export interface EngineChatSummary {
  chatId: string;
  worldId: string;
  revision: string;
  definitionsFrom: string | null;
  status: string;
  place: { id: string | null; name: string } | null;
  clock: { minutes: number; label: string; dayPart: string } | null;
  cash: string | null;
  present: { id: string; name: string; label: string }[];
  quests: { id: string; kind: string; label: string; stage: string; cue: string | null }[];
  at: number;
}

const str = (v: unknown): v is string => typeof v === "string";

export function readInstalled(value: unknown): StudioInstalled | null {
  if (!isRecord(value) || !str(value.offerId) || !str(value.worldId) || !str(value.revision)) return null;
  if (value.mode !== "new" && value.mode !== "revision") return null;
  return { offerId: value.offerId, mode: value.mode, worldId: value.worldId, revision: value.revision };
}

/** The engine's world list (`StudioWorldList`); a malformed entry is left out. */
export function readWorldList(value: unknown): EngineWorldEntry[] {
  if (!isRecord(value) || !Array.isArray(value.worlds)) throw new Error("LumiRPEngine sent a world list this Studio can't read");
  return value.worlds.flatMap((w): EngineWorldEntry[] => {
    if (!isRecord(w) || !str(w.id) || !str(w.name) || !str(w.head)) return [];
    const revisions = Array.isArray(w.revisions) ? w.revisions.filter(str) : [w.head];
    return [{ id: w.id, name: w.name, head: w.head, revisions, revisionCount: typeof w.revisionCount === "number" ? w.revisionCount : revisions.length }];
  });
}

/** One engine world (`StudioWorldRead`). */
export function readWorld(value: unknown): EngineWorldRead {
  if (!isRecord(value) || !str(value.worldId) || !str(value.name) || !str(value.head) || !str(value.revision) || !isRecord(value.world)) throw new Error("LumiRPEngine sent a world this Studio can't read");
  return { worldId: value.worldId, name: value.name, head: value.head, revision: value.revision, world: value.world };
}

/** The engine's world chats (`StudioChats`), newest first; a malformed one is left out. */
export function readChats(value: unknown): EngineChatSummary[] {
  if (!isRecord(value) || !Array.isArray(value.chats)) throw new Error("LumiRPEngine sent chat summaries this Studio can't read");
  return value.chats.flatMap((c): EngineChatSummary[] => {
    if (!isRecord(c) || !str(c.chatId) || !str(c.worldId) || !str(c.revision)) return [];
    const place = isRecord(c.place) && str(c.place.name) ? { id: str(c.place.id) ? c.place.id : null, name: c.place.name } : null;
    const clock = isRecord(c.clock) && typeof c.clock.minutes === "number" && str(c.clock.label) ? { minutes: c.clock.minutes, label: c.clock.label, dayPart: str(c.clock.dayPart) ? c.clock.dayPart : "" } : null;
    const present = Array.isArray(c.present) ? c.present.flatMap((p) => (isRecord(p) && str(p.id) && str(p.name) ? [{ id: p.id, name: p.name, label: str(p.label) ? p.label : p.name }] : [])) : [];
    const quests = Array.isArray(c.quests)
      ? c.quests.flatMap((q) => (isRecord(q) && str(q.id) && str(q.label) ? [{ id: q.id, kind: str(q.kind) ? q.kind : "quest", label: q.label, stage: str(q.stage) ? q.stage : "", cue: str(q.cue) ? q.cue : null }] : []))
      : [];
    return [{ chatId: c.chatId, worldId: c.worldId, revision: c.revision, definitionsFrom: str(c.definitionsFrom) ? c.definitionsFrom : null, status: str(c.status) ? c.status : "idle", place, clock, cash: str(c.cash) ? c.cash : null, present, quests, at: typeof c.at === "number" ? c.at : 0 }];
  });
}
