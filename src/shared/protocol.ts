// Frontend ↔ backend messages over Spindle messaging (`ctx.sendToBackend` / `spindle.sendToFrontend`,
// routed by user). Every message is `{studio: 1, type, …}`. A request carries a `reqId` the
// frontend picks and gets exactly one `result` or `error` with it; drafts and the assistant's
// activity arrive unasked as pushes.

import type { EngineChatSummary, EngineWorldEntry } from "./bridge";
import type { JsonValue } from "./json";

export const PROTOCOL = 1;

/** How a draft started. */
export type SourceKind = "chat" | "character" | "books" | "blank" | "world" | "file";

/** What a new draft starts from. */
export type SourceSpec =
  | { kind: "chat"; chatId: string }
  | { kind: "character"; characterId: string }
  | { kind: "books"; bookIds: string[] }
  | { kind: "blank" }
  /** One of the user's LumiRPEngine worlds; with `chatId`, a chat that plays it, to refine the world against. */
  | { kind: "world"; worldId: string; chatId?: string };

/** A lore book a draft reads, and how it came into the source. */
export interface BookRef {
  id: string;
  name: string;
  scope: "chat" | "character" | "persona" | "global" | "picked";
}

export interface PastedText {
  title: string;
  text: string;
}

/** What a draft's assistant may read, as the draft keeps it. */
export interface DraftSource {
  kind: SourceKind;
  /** A one-line description: "Chat: Evening at the Harbor". */
  label: string;
  chatId: string | null;
  characterIds: string[];
  books: BookRef[];
  pasted: PastedText[];
  /** The LumiRPEngine world it started from, if any. */
  worldId: string | null;
  /** The user's active persona when the draft started from a chat: who they play there, usually the POV. */
  persona?: { id: string; name: string } | null;
}

export interface Issue {
  severity: "error" | "warning" | "info";
  path: string;
  code: string;
  message: string;
}

/** A line of the assistant conversation as the drawer shows it. */
export type ChatLine =
  | { kind: "user"; text: string; at: number }
  | { kind: "assistant"; text: string; at: number }
  | { kind: "tool"; name: string; summary: string; error: boolean; at: number }
  | { kind: "note"; text: string; at: number };

/** One change the assistant made, as the review lists it: an item, a part or a top-level field. */
export interface ChangeView {
  key: string;
  label: string;
  kind: "added" | "changed" | "removed";
}

/** The assistant's proposal, reviewed before it reaches the draft. */
export interface ReviewView {
  changes: ChangeView[];
  counts: Record<string, number>;
  errors: number;
  warnings: number;
}

export interface DraftSummary {
  id: string;
  name: string;
  updatedAt: number;
  kind: SourceKind;
}

export interface DraftView {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  source: DraftSource;
  /** The LumiRPEngine world a revision goes to: the one it started from, or the one it was installed as. */
  link: { worldId: string; revision: string | null } | null;
  world: { id: string; name: string; pov: string };
  /** Items per collection of the accepted draft. */
  counts: Record<string, number>;
  /** Item ids per collection (at most 400 each), for the item viewer. */
  ids: Record<string, string[]>;
  /** `validate` and the engine's lint of the accepted draft, errors first. */
  issues: Issue[];
  errors: number;
  warnings: number;
  review: ReviewView | null;
  chat: ChatLine[];
  running: boolean;
  /** The offer this draft has waiting in LumiRPEngine, if any. */
  offer: { offerId: string; mode: "new" | "revision"; createdAt: number } | null;
}

export interface StudioSettings {
  /** The connection the assistant runs on; null: the user's active connection. */
  connectionId: string | null;
  /** Model calls one message may take before the assistant stops and waits. */
  maxRounds: number;
}

export interface ConnectionView {
  id: string;
  name: string;
  model: string | null;
}

export type FrontendToBackend = { studio: typeof PROTOCOL; reqId: string } & (
  | { type: "hello" }
  | { type: "draft.list" }
  | { type: "draft.create"; name: string; source: SourceSpec }
  | { type: "draft.open"; draftId: string }
  | { type: "draft.rename"; draftId: string; name: string }
  | { type: "draft.delete"; draftId: string }
  | { type: "draft.paste"; draftId: string; title: string; text: string }
  | { type: "draft.unpaste"; draftId: string; index: number }
  | { type: "draft.item"; draftId: string; collection: string; id: string; proposed: boolean }
  | { type: "draft.validate"; draftId: string }
  | { type: "draft.export"; draftId: string }
  | { type: "draft.import"; name: string; file: JsonValue }
  | { type: "review.accept"; draftId: string; keys: string[] | null }
  | { type: "review.discard"; draftId: string }
  | { type: "review.change"; draftId: string; key: string }
  | { type: "assistant.send"; draftId: string; text: string }
  | { type: "assistant.stop"; draftId: string }
  | { type: "install"; draftId: string; mode: "new" | "revision"; worldId: string | null; attachChatId: string | null }
  | { type: "installed"; offerId: string; mode: "new" | "revision"; worldId: string; revision: string }
  | { type: "pick.characters" }
  | { type: "pick.books" }
  | { type: "pick.worlds" }
  | { type: "pick.chat"; chatId: string }
  | { type: "settings.set"; connectionId?: string | null; maxRounds?: number }
);

export type RequestType = FrontendToBackend["type"];

/** What "This chat" holds, for the source picker. */
export interface ChatInfo {
  id: string;
  name: string;
  messages: number;
  characters: string[];
  books: BookRef[];
  /** Its LumiRPEngine state, when it plays a world. */
  world: EngineChatSummary | null;
}

export interface ResultBodies {
  hello: { drafts: DraftSummary[]; settings: StudioSettings; connections: ConnectionView[] };
  "draft.list": { drafts: DraftSummary[] };
  "draft.create": { draft: DraftView };
  "draft.open": { draft: DraftView };
  "draft.rename": { draft: DraftView };
  "draft.delete": { drafts: DraftSummary[] };
  "draft.paste": { draft: DraftView };
  "draft.unpaste": { draft: DraftView };
  "draft.item": { value: JsonValue };
  "draft.validate": { draft: DraftView };
  "draft.export": { file: JsonValue; fileName: string };
  "draft.import": { draft: DraftView };
  "review.accept": { draft: DraftView };
  "review.discard": { draft: DraftView };
  "review.change": { before: JsonValue | null; after: JsonValue | null };
  "assistant.send": { started: true };
  "assistant.stop": { stopped: boolean };
  install: { offerId: string; mode: "new" | "revision" };
  installed: { draft: DraftView | null };
  "pick.characters": { items: { id: string; name: string }[] };
  "pick.books": { items: { id: string; name: string }[] };
  "pick.worlds": { worlds: EngineWorldEntry[] };
  "pick.chat": { chat: ChatInfo };
  "settings.set": { settings: StudioSettings };
}

export type BackendToFrontend = { studio: typeof PROTOCOL } & (
  | { type: "result"; reqId: string; request: RequestType; body: ResultBodies[RequestType] }
  | { type: "error"; reqId: string; message: string }
  /** A draft changed (the assistant patched it, a review was settled, an offer was made). */
  | { type: "draft"; draft: DraftView }
  /** A line the running assistant added to a draft's conversation. */
  | { type: "activity"; draftId: string; line: ChatLine }
  | { type: "drafts"; drafts: DraftSummary[] }
);
