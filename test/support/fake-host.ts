// A pretend Lumiverse for tests: user storage, chats, cards, lore books and personas in memory, a
// scripted model, and the shared RPC pool both extensions use. A fake LumiRPEngine (fake-engine.ts)
// plays the engine's side of the bridge from LumiRPEngine's docs/STUDIO.md. No network, no models.

import type { HostBook, HostBookEntry, HostCharacter, HostChat, HostMessage, ModelReply, ModelRequest, StudioHost } from "../../src/backend/host";
import { ENGINE_EXTENSION, STUDIO_EXTENSION } from "../../src/shared/bridge";
import type { BackendToFrontend } from "../../src/shared/protocol";

const SEGMENT = /^[a-z0-9][a-z0-9_-]*$/;

/** The host's shared RPC pool: endpoint names checked as the host checks them, unregistered reads rejected, values cloned. */
export class FakeRpcPool {
  private readonly endpoints = new Map<string, { owner: string; requires: readonly string[]; handler: (requester: string) => Promise<unknown> }>();
  readonly reads: { endpoint: string; requester: string }[] = [];

  constructor(private readonly permissions: Record<string, readonly string[]>) {}

  handle(owner: string, channel: string, requires: readonly string[], handler: (requester: string) => Promise<unknown>): void {
    const endpoint = `${owner}.${channel}`;
    if (!endpoint.split(".").slice(1).every((s) => SEGMENT.test(s))) throw new Error(`Invalid shared RPC endpoint "${endpoint}"`);
    this.endpoints.set(endpoint, { owner, requires, handler });
  }

  async read(endpoint: string, requester: string): Promise<unknown> {
    this.reads.push({ endpoint, requester });
    const found = this.endpoints.get(endpoint);
    if (!found) throw new Error(`Shared RPC endpoint "${endpoint}" is not registered`);
    const missing = found.requires.filter((p) => !(this.permissions[requester] ?? []).includes(p) || !(this.permissions[found.owner] ?? []).includes(p));
    if (missing.length > 0) throw new Error(`Shared RPC endpoint "${endpoint}" requires requester "${requester}" permissions: ${missing.join(", ")}`);
    return structuredClone(await found.handler(requester));
  }
}

export interface FakeChatData extends HostChat {
  owner: string;
  messages: HostMessage[];
}

export class FakeHost implements StudioHost {
  readonly files = new Map<string, string>();
  readonly chatsById = new Map<string, FakeChatData>();
  readonly cards = new Map<string, HostCharacter & { owner: string }>();
  readonly bookStore = new Map<string, HostBook & { owner: string; entryList: HostBookEntry[] }>();
  readonly globalBooks = new Map<string, string[]>();
  readonly personaBook = new Map<string, string>();
  readonly sent: { userId: string; message: BackendToFrontend }[] = [];
  readonly modelCalls: ModelRequest[] = [];
  readonly logs: string[] = [];
  /** The scripted model; throwing plays a failed call. */
  model: ((request: ModelRequest, call: number) => ModelReply) | null = null;
  private frontendHandler: ((message: unknown, userId: string) => void) | null = null;

  constructor(readonly pool = new FakeRpcPool({ [ENGINE_EXTENSION]: ["generation", "chats", "chat_mutation", "world_books", "presets", "decisions", "ui_panels", "context_handler"], [STUDIO_EXTENSION]: ["generation", "chats", "chat_mutation", "characters", "world_books", "personas"] })) {}

  storage: StudioHost["storage"] = {
    read: async (path, userId) => this.files.get(`${userId}/${path}`) ?? null,
    write: async (path, data, userId) => void this.files.set(`${userId}/${path}`, data),
    move: async (from, to, userId) => {
      const data = this.files.get(`${userId}/${from}`);
      if (data === undefined) throw new Error(`no file ${from}`);
      this.files.set(`${userId}/${to}`, data);
      this.files.delete(`${userId}/${from}`);
    },
    remove: async (path, userId) => void this.files.delete(`${userId}/${path}`),
  };

  chats: StudioHost["chats"] = {
    // The host resolves a chat for its owner only.
    get: async (chatId, userId) => {
      const c = this.chatsById.get(chatId);
      return c && c.owner === userId ? { id: c.id, name: c.name, characterId: c.characterId, metadata: structuredClone(c.metadata) } : null;
    },
    messages: async (chatId) => structuredClone(this.chatsById.get(chatId)?.messages ?? []),
  };

  characters: StudioHost["characters"] = {
    list: async (userId) => [...this.cards.values()].filter((c) => c.owner === userId).map((c) => ({ id: c.id, name: c.name })),
    get: async (id, userId) => {
      const c = this.cards.get(id);
      if (!c || c.owner !== userId) return null;
      const { owner: _owner, ...card } = c;
      return structuredClone(card);
    },
  };

  books: StudioHost["books"] = {
    list: async (userId) => [...this.bookStore.values()].filter((b) => b.owner === userId).map((b) => ({ id: b.id, name: b.name, description: b.description, metadata: b.metadata })),
    get: async (id, userId) => {
      const b = this.bookStore.get(id);
      return b && b.owner === userId ? { id: b.id, name: b.name, description: b.description, metadata: b.metadata } : null;
    },
    entries: async (id, userId) => {
      const b = this.bookStore.get(id);
      return b && b.owner === userId ? structuredClone(b.entryList) : [];
    },
    global: async (userId) => this.globalBooks.get(userId) ?? [],
  };

  personas: StudioHost["personas"] = {
    activeBookId: async (userId) => this.personaBook.get(userId) ?? null,
  };

  models: StudioHost["models"] = {
    generate: async (request) => {
      this.modelCalls.push(structuredClone(request));
      if (!this.model) throw new Error("the fake host makes no model calls");
      return this.model(request, this.modelCalls.length);
    },
    connections: async () => [{ id: "conn-1", name: "Deepseek", model: "deepseek-v4-flash" }],
  };

  rpc: StudioHost["rpc"] = {
    handle: (channel, requires, handler) => this.pool.handle(STUDIO_EXTENSION, channel, requires, handler),
    read: (endpoint) => this.pool.read(endpoint, STUDIO_EXTENSION),
  };

  frontend: StudioHost["frontend"] = {
    send: (message, userId) => void this.sent.push({ userId, message: structuredClone(message) }),
    onMessage: (handler) => {
      this.frontendHandler = handler;
    },
  };

  log(level: "info" | "warn" | "error", message: string): void {
    this.logs.push(`${level}: ${message}`);
  }

  /** A message from the user's frontend. */
  fromFrontend(message: unknown, userId: string): void {
    this.frontendHandler?.(message, userId);
  }
}
