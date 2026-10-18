// StudioHost over the `spindle` global (`lumiverse-spindle-types` 0.6.49): the only backend file
// besides the entry that touches the host API. Host payloads are decoded into the port's shapes
// here, and every call passes the user, as an extension installed for the whole server must.

import type { LlmMessageDTO, LlmMessagePartDTO, SpindleAPI } from "lumiverse-spindle-types";
import { isRecord, toJson } from "../shared/json";
import type { JsonObject } from "../shared/json";
import type { HostBookEntry, ModelPart, ModelToolCall, StudioHost } from "./host";

declare const spindle: SpindleAPI;

const PAGE = 200;

function text(o: unknown, key: string): string {
  return isRecord(o) && typeof o[key] === "string" ? o[key] : "";
}

function object(value: unknown): JsonObject {
  const json = toJson(value);
  return isRecord(json) ? (json as JsonObject) : {};
}

function part(p: ModelPart): LlmMessagePartDTO {
  if (p.type === "text") return { type: "text", text: p.text };
  if (p.type === "tool_use") return { type: "tool_use", id: p.id, name: p.name, input: p.input, ...(p.signature ? { thought_signature: p.signature } : {}) };
  return { type: "tool_result", tool_use_id: p.toolUseId, content: p.content, ...(p.isError ? { is_error: true } : {}) };
}

export function createSpindleHost(): StudioHost {
  return {
    storage: {
      async read(path, userId) {
        if (!(await spindle.userStorage.exists(path, userId))) return null;
        return spindle.userStorage.read(path, userId);
      },
      write: (path, data, userId) => spindle.userStorage.write(path, data, userId),
      move: (from, to, userId) => spindle.userStorage.move(from, to, userId),
      remove: (path, userId) => spindle.userStorage.delete(path, userId),
    },
    chats: {
      async get(chatId, userId) {
        const chat = await spindle.chats.get(chatId, userId);
        return chat ? { id: chat.id, name: chat.name, characterId: chat.character_id, metadata: object(chat.metadata) } : null;
      },
      async messages(chatId) {
        const rows = await spindle.chat.getMessages(chatId);
        return rows.map((m) => ({ id: m.id, role: m.role, name: m.name, content: m.content }));
      },
    },
    characters: {
      async list(userId) {
        const out: { id: string; name: string }[] = [];
        for (let offset = 0; offset < 10_000; offset += PAGE) {
          const page = await spindle.characters.list({ limit: PAGE, offset, userId });
          for (const c of page.data) out.push({ id: c.id, name: c.name });
          if (page.data.length < PAGE || out.length >= page.total) break;
        }
        return out.sort((a, b) => a.name.localeCompare(b.name));
      },
      async get(characterId, userId) {
        const c = await spindle.characters.get(characterId, userId);
        if (!c) return null;
        return {
          id: c.id,
          name: c.name,
          description: c.description,
          personality: c.personality,
          scenario: c.scenario,
          firstMessage: c.first_mes,
          exampleMessages: c.mes_example,
          creatorNotes: c.creator_notes,
          alternateGreetings: [...c.alternate_greetings],
          tags: [...c.tags],
          bookIds: [...c.world_book_ids],
        };
      },
    },
    books: {
      async list(userId) {
        const out: { id: string; name: string; description: string; metadata: JsonObject }[] = [];
        for (let offset = 0; offset < 10_000; offset += PAGE) {
          const page = await spindle.world_books.list({ limit: PAGE, offset, userId });
          for (const b of page.data) out.push({ id: b.id, name: b.name, description: b.description, metadata: object(b.metadata) });
          if (page.data.length < PAGE || out.length >= page.total) break;
        }
        return out.sort((a, b) => a.name.localeCompare(b.name));
      },
      async get(bookId, userId) {
        const b = await spindle.world_books.get(bookId, userId);
        return b ? { id: b.id, name: b.name, description: b.description, metadata: object(b.metadata) } : null;
      },
      async entries(bookId, userId) {
        const out: HostBookEntry[] = [];
        for (let offset = 0; offset < 100_000; offset += PAGE) {
          const page = await spindle.world_books.entries.list(bookId, { limit: PAGE, offset, userId });
          for (const e of page.data) out.push({ id: e.id, comment: e.comment, keys: [...e.key], content: e.content, disabled: e.disabled, constant: e.constant });
          if (page.data.length < PAGE || out.length >= page.total) break;
        }
        return out;
      },
      global: (userId) => spindle.world_books.getGlobal(userId),
    },
    personas: {
      async activeBookId(userId) {
        return (await spindle.personas.getActive(userId))?.attached_world_book_id ?? null;
      },
    },
    models: {
      async generate(request, userId, signal) {
        const messages: LlmMessageDTO[] = request.messages.map((m) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : m.content.map(part),
          ...(m.reasoning ? { reasoning_content: m.reasoning } : {}),
        }));
        const raw = await spindle.generate.quiet({
          type: "quiet",
          messages,
          parameters: { max_tokens: request.maxTokens },
          ...(request.connectionId ? { connection_id: request.connectionId } : {}),
          ...(request.tools.length > 0 ? { tools: request.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) } : {}),
          userId,
          signal,
        });
        // `tool_calls` (`ToolCallDTO[]`): a call without a name is dropped; arguments that aren't an object read as none.
        const calls = isRecord(raw) && Array.isArray(raw.tool_calls) ? raw.tool_calls : [];
        const toolCalls: ModelToolCall[] = calls.flatMap((c, i): ModelToolCall[] => {
          if (!isRecord(c) || typeof c.name !== "string") return [];
          const signature = text(c, "thought_signature");
          return [{ id: text(c, "call_id") || `call_${i}`, name: c.name, args: object(c.args), ...(signature ? { signature } : {}) }];
        });
        return { content: text(raw, "content"), reasoning: text(raw, "reasoning"), toolCalls, finishReason: text(raw, "finish_reason") };
      },
      async connections(userId) {
        return (await spindle.connections.list(userId)).map((c) => ({ id: c.id, name: c.name, model: c.model || null }));
      },
    },
    rpc: {
      handle(channel, requires, handler) {
        spindle.rpcPool.handle(channel, ({ requesterExtensionId }) => handler(requesterExtensionId), { requires: [...requires] });
      },
      read: (endpoint) => spindle.rpcPool.read(endpoint),
    },
    frontend: {
      send(message, userId) {
        spindle.sendToFrontend(message, userId);
      },
      onMessage(handler) {
        spindle.onFrontendMessage(handler);
      },
    },
    log(level, message) {
      if (level === "error") spindle.log.error(message);
      else if (level === "warn") spindle.log.warn(message);
      else spindle.log.info(message);
    },
  };
}
