// Drafts, per user in user storage:
//
//   drafts/index.json      the user's drafts: id, name, when it changed, how it started
//   drafts/<id>.json       one draft: its source, the accepted world, the assistant's proposal
//                          awaiting review, its link to a LumiRPEngine world and the conversation
//
// Writes go to a temp file, then move. Changes to one draft run one at a time, so the assistant
// and a click never write over each other.

import type { WorldDoc } from "../engine";
import { isRecord } from "../shared/json";
import type { JsonObject } from "../shared/json";
import type { DraftSource, DraftSummary } from "../shared/protocol";
import type { StudioHost } from "./host";

/** A tool call the assistant made, as the conversation keeps it. */
export interface StoredCall {
  id: string;
  name: string;
  args: JsonObject;
  signature?: string;
}

/** A tool's answer: what the model read (`content`) and the one line the drawer shows (`summary`). */
export interface StoredResult {
  id: string;
  name: string;
  content: string;
  error: boolean;
  summary: string;
}

/**
 * The conversation. `run` numbers the assistant's runs (one per message sent), so the run under
 * way goes back to the model with its tool calls as they were, and earlier runs as plain text.
 */
export type ChatEntry =
  | { kind: "user"; text: string; at: number }
  | { kind: "assistant"; text: string; at: number; run: number; calls: StoredCall[]; reasoning?: string }
  | { kind: "results"; at: number; run: number; results: StoredResult[] }
  | { kind: "note"; text: string; at: number };

export interface Draft {
  v: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  source: DraftSource;
  /** The world as the user has accepted it: what Validate, Export and Install use. */
  doc: WorldDoc;
  /** The assistant's working copy, waiting for review; null when it has proposed nothing. */
  proposed: WorldDoc | null;
  /** The LumiRPEngine world a revision goes to. */
  link: { worldId: string; revision: string | null } | null;
  chat: ChatEntry[];
  runs: number;
  /** The offer this draft has waiting in LumiRPEngine. */
  offer: { offerId: string; mode: "new" | "revision"; createdAt: number } | null;
}

/** The conversation kept per draft; older entries go first. */
const CHAT_CAP = 600;
const DRAFT_ID = /^d_[0-9a-f]{16}$/;

export function draftIdOk(id: unknown): id is string {
  return typeof id === "string" && DRAFT_ID.test(id);
}

function isDraft(raw: unknown): raw is Draft {
  return isRecord(raw) && raw.v === 1 && draftIdOk(raw.id) && typeof raw.name === "string" && isRecord(raw.doc) && isRecord(raw.source) && Array.isArray(raw.chat);
}

export function summaryOf(draft: Draft): DraftSummary {
  return { id: draft.id, name: draft.name, updatedAt: draft.updatedAt, kind: draft.source.kind };
}

export class DraftStore {
  /** The change under way per `user \0 draft`, and per `user` for the index. */
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(private readonly host: StudioHost) {}

  /** Runs `work` after whatever is already running under `key`. */
  private locked<T>(key: string, work: () => Promise<T>): Promise<T> {
    const run = (this.locks.get(key) ?? Promise.resolve()).then(work);
    const settled = run.catch(() => undefined);
    this.locks.set(key, settled);
    void settled.then(() => {
      if (this.locks.get(key) === settled) this.locks.delete(key);
    });
    return run;
  }

  private async readJson(path: string, userId: string): Promise<unknown> {
    const text = await this.host.storage.read(path, userId);
    if (text === null) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      this.host.log("warn", `[LumiRPEngine Studio] ${path} isn't JSON; it is ignored`);
      return null;
    }
  }

  private async writeJson(path: string, value: unknown, userId: string): Promise<void> {
    await this.host.storage.write(`${path}.tmp`, JSON.stringify(value), userId);
    await this.host.storage.move(`${path}.tmp`, path, userId);
  }

  async list(userId: string): Promise<DraftSummary[]> {
    const raw = await this.readJson("drafts/index.json", userId);
    if (!isRecord(raw) || !Array.isArray(raw.drafts)) return [];
    return raw.drafts.flatMap((d): DraftSummary[] => (isRecord(d) && draftIdOk(d.id) && typeof d.name === "string" && typeof d.updatedAt === "number" && typeof d.kind === "string" ? [d as unknown as DraftSummary] : [])).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(userId: string, id: string): Promise<Draft | null> {
    if (!draftIdOk(id)) return null;
    const raw = await this.readJson(`drafts/${id}.json`, userId);
    return isDraft(raw) ? raw : null;
  }

  async create(userId: string, init: { name: string; source: DraftSource; doc: WorldDoc; link: Draft["link"]; note?: string }): Promise<Draft> {
    const now = Date.now();
    const draft: Draft = {
      v: 1,
      id: `d_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      name: init.name,
      createdAt: now,
      updatedAt: now,
      source: init.source,
      doc: init.doc,
      proposed: null,
      link: init.link,
      chat: init.note ? [{ kind: "note", text: init.note, at: now }] : [],
      runs: 0,
      offer: null,
    };
    await this.save(userId, draft);
    return draft;
  }

  /** Changes one draft, after any change already under way to it; returns the draft as saved. */
  update(userId: string, id: string, change: (draft: Draft) => void | Promise<void>): Promise<Draft> {
    return this.locked(`${userId}\u0000${id}`, async () => {
      const draft = await this.get(userId, id);
      if (!draft) throw new Error("That draft is gone.");
      await change(draft);
      draft.updatedAt = Date.now();
      if (draft.chat.length > CHAT_CAP) draft.chat = draft.chat.slice(-CHAT_CAP);
      await this.save(userId, draft);
      return draft;
    });
  }

  async remove(userId: string, id: string): Promise<DraftSummary[]> {
    if (!draftIdOk(id)) return this.list(userId);
    await this.locked(`${userId}\u0000${id}`, () => this.host.storage.remove(`drafts/${id}.json`, userId).catch(() => undefined));
    return this.locked(userId, async () => {
      const drafts = (await this.list(userId)).filter((d) => d.id !== id);
      await this.writeJson("drafts/index.json", { v: 1, drafts }, userId);
      return drafts;
    });
  }

  private async save(userId: string, draft: Draft): Promise<void> {
    await this.writeJson(`drafts/${draft.id}.json`, draft, userId);
    await this.locked(userId, async () => {
      const drafts = [summaryOf(draft), ...(await this.list(userId)).filter((d) => d.id !== draft.id)];
      await this.writeJson("drafts/index.json", { v: 1, drafts }, userId);
    });
  }
}
