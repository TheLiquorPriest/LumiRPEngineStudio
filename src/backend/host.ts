// StudioHost: the narrow port between the backend and Lumiverse. Backend logic talks only to it;
// `spindle-host.ts` implements it over the `spindle` global, and `test/support/fake-host.ts` in
// memory. Every call names its user: the extension may be installed for the whole server, and one
// user's chats, cards, books and drafts never answer another's.

import type { JsonObject } from "../shared/json";
import type { BackendToFrontend } from "../shared/protocol";

export interface HostChat {
  id: string;
  name: string;
  characterId: string;
  metadata: JsonObject;
}

/** A chat message as the assistant reads it: the swipe shown, its author's role and name. */
export interface HostMessage {
  id: string;
  role: "user" | "assistant" | "system";
  name: string;
  content: string;
}

export interface HostCharacter {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  exampleMessages: string;
  creatorNotes: string;
  alternateGreetings: string[];
  tags: string[];
  bookIds: string[];
}

export interface HostBook {
  id: string;
  name: string;
  description: string;
  metadata: JsonObject;
}

export interface HostBookEntry {
  id: string;
  comment: string;
  keys: string[];
  content: string;
  disabled: boolean;
  constant: boolean;
}

/** A part of a model message: text, a tool call the model made, or a tool's result. */
export type ModelPart =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: JsonObject; signature?: string }
  | { type: "tool_result"; toolUseId: string; content: string; isError: boolean };

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string | ModelPart[];
  /** The reasoning of an assistant turn that called tools, echoed back as thinking models need on a tool-call continuation. */
  reasoning?: string;
}

export interface ModelTool {
  name: string;
  description: string;
  parameters: JsonObject;
}

export interface ModelRequest {
  messages: ModelMessage[];
  tools: ModelTool[];
  connectionId: string | null;
  maxTokens: number;
}

export interface ModelToolCall {
  id: string;
  name: string;
  args: JsonObject;
  /** The provider's signature for the call, echoed back on the continuation. */
  signature?: string;
}

export interface ModelReply {
  content: string;
  reasoning: string;
  toolCalls: ModelToolCall[];
  finishReason: string;
}

export interface StudioHost {
  storage: {
    read(path: string, userId: string): Promise<string | null>;
    write(path: string, data: string, userId: string): Promise<void>;
    move(from: string, to: string, userId: string): Promise<void>;
    remove(path: string, userId: string): Promise<void>;
  };
  chats: {
    /** The user's chat, or null when it isn't theirs or doesn't exist. */
    get(chatId: string, userId: string): Promise<HostChat | null>;
    /** The messages of a chat; callers check it is the user's first (`get`). */
    messages(chatId: string): Promise<HostMessage[]>;
  };
  characters: {
    list(userId: string): Promise<{ id: string; name: string }[]>;
    get(characterId: string, userId: string): Promise<HostCharacter | null>;
  };
  books: {
    list(userId: string): Promise<HostBook[]>;
    get(bookId: string, userId: string): Promise<HostBook | null>;
    entries(bookId: string, userId: string): Promise<HostBookEntry[]>;
    /** The ids of the books active in every chat of the user. */
    global(userId: string): Promise<string[]>;
  };
  personas: {
    /** The book attached to the user's active persona, if any. */
    activeBookId(userId: string): Promise<string | null>;
  };
  models: {
    /** One quiet generation with tools on the connection (null: the user's active one). */
    generate(request: ModelRequest, userId: string, signal: AbortSignal): Promise<ModelReply>;
    connections(userId: string): Promise<{ id: string; name: string; model: string | null }[]>;
  };
  /** The shared RPC pool: this extension's endpoints (the reader's id, a read policy), and reads of LumiRPEngine's. */
  rpc: {
    handle(channel: string, requires: readonly string[], handler: (requester: string) => Promise<unknown>): void;
    read(endpoint: string): Promise<unknown>;
  };
  frontend: {
    send(message: BackendToFrontend, userId: string): void;
    onMessage(handler: (message: unknown, userId: string) => void): void;
  };
  log(level: "info" | "warn" | "error", message: string): void;
}
