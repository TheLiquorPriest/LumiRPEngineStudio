// The assistant's tools: reading the sources (the transcript, cards, lore, pasted text, the engine's
// view of the chat), reading and patching the draft, checking it with the engine, and looking
// things up in the conversion guide and LumiRPEngine's reference. Every patch goes to the proposal
// the user reviews, never straight to the draft. A tool's answer is plain text for the model, never
// longer than OUTPUT_LIMIT, and one line for the drawer.

import { readWorldDoc } from "../engine";
import type { WorldDoc } from "../engine";
import { hasOwn, isRecord } from "../shared/json";
import type { JsonObject, JsonValue } from "../shared/json";
import type { EngineBridge } from "./bridge";
import type { DraftStore } from "./drafts";
import type { HostCharacter, ModelTool } from "./host";
import { applyPatch, getAt, parsePointer, PatchError, readOp } from "./pointer";
import type { SourceReader } from "./sources";
import { lookupGuide, lookupReference } from "./texts";

export interface ToolContext {
  userId: string;
  draftId: string;
  drafts: DraftStore;
  reader: SourceReader;
  bridge: EngineBridge;
}

export interface ToolOutcome {
  content: string;
  error: boolean;
  /** One line for the drawer's activity list. */
  summary: string;
  /** Whether the proposal changed. */
  changed: boolean;
}

/**
 * The most one answer holds, header and notes included. The assistant keeps every answer whole
 * (assistant.ts), so the range a header names is what the model reads.
 */
export const OUTPUT_LIMIT = 24_000;
/** What an answer's body may take, leaving room for its header and notes. */
const BODY_LIMIT = OUTPUT_LIMIT - 1_000;
const MESSAGE_CLIP = 4000;
const ENTRY_CLIP = 8000;
const DRAFT_READ_LIMIT = 16_000;

const obj = (properties: JsonObject, required: string[] = []): JsonObject => ({ type: "object", properties, required, additionalProperties: false });

export const TOOLS: readonly ModelTool[] = [
  {
    name: "transcript_read",
    description: "Read a range of the source chat's messages, oldest first (0 is the first message). Each line is `#index [role] name: text`. The answer stops before a message that wouldn't fit, and says where to read on.",
    parameters: obj({ from: { type: "integer", minimum: 0, description: "Index of the first message" }, count: { type: "integer", minimum: 1, maximum: 60, description: "How many messages (at most 60)" } }, ["from"]),
  },
  {
    name: "transcript_search",
    description: "Search the source chat's messages for words or a phrase; returns the matching messages' indexes with a snippet each.",
    parameters: obj({ query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 30 } }, ["query"]),
  },
  {
    name: "cards_read",
    description: "Read the source's character cards (description, personality, scenario, greeting, examples, notes). Give a name to read one.",
    parameters: obj({ name: { type: "string" } }),
  },
  {
    name: "lore_list",
    description: "List the source's lore books (and how each applies: chat, character, persona, global or picked) with their entry counts; give a book's id or name to list its entries.",
    parameters: obj({ book: { type: "string" } }),
  },
  {
    name: "lore_search",
    description: "Search every source lore entry (titles, keys and text) for words; returns entry ids with snippets.",
    parameters: obj({ query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 30 } }, ["query"]),
  },
  {
    name: "lore_read",
    description: "Read lore entries in full by their ids (at most 12 at once). The answer stops before an entry that wouldn't fit, and says which to read next.",
    parameters: obj({ ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 12 } }, ["ids"]),
  },
  {
    name: "pasted_read",
    description: "Read text the user pasted into the draft's sources. Without an index, lists the pasted texts; with one, reads it from `offset` (characters) and says where to read on.",
    parameters: obj({ index: { type: "integer", minimum: 0 }, offset: { type: "integer", minimum: 0 }, length: { type: "integer", minimum: 200, maximum: BODY_LIMIT } }),
  },
  {
    name: "chat_state",
    description: "What LumiRPEngine shows the player of the source chat, when it already plays a world: the world and revision, the POV's place, the clock, cash, who is present and the open quests.",
    parameters: obj({}),
  },
  {
    name: "engine_read",
    description: "Read the LumiRPEngine world this draft is linked to, as installed: its head, or a revision by id (from chat_state). Give a JSON Pointer to read part of it.",
    parameters: obj({ revision: { type: "string" }, path: { type: "string" } }),
  },
  {
    name: "draft_read",
    description: 'Read the working draft (your proposal, else the accepted draft) at a JSON Pointer: "" for an outline of the whole world, "/entities/mara" for one item. Large values come back as an outline; read deeper paths.',
    parameters: obj({ path: { type: "string" } }, ["path"]),
  },
  {
    name: "draft_patch",
    description:
      'Change the working draft with JSON Patch operations (RFC 6902): add, remove, replace, move, copy and test, each with a JSON Pointer `path` ("/entities/mara", "/places/inn/fields/description", "/start"). "~1" stands for "/" and "~0" for "~" in a key. They apply all together or not at all, and the answer says what the engine finds wrong afterwards. The user reviews your changes before they reach the draft.',
    parameters: obj(
      {
        ops: {
          type: "array",
          minItems: 1,
          maxItems: 200,
          items: { type: "object", properties: { op: { type: "string", enum: ["add", "remove", "replace", "move", "copy", "test"] }, path: { type: "string" }, from: { type: "string" }, value: {} }, required: ["op", "path"] },
        },
      },
      ["ops"],
    ),
  },
  {
    name: "draft_check",
    description: "Check the working draft as LumiRPEngine will: the shape, then every lint rule of the engine and its packs. Errors block installing.",
    parameters: obj({}),
  },
  {
    name: "guide_lookup",
    description: "Look something up in the conversion guide (how to turn chats and lore into a world, and refine one in play).",
    parameters: obj({ query: { type: "string" } }, ["query"]),
  },
  {
    name: "reference_lookup",
    description: "Look something up in LumiRPEngine's reference: every kind and its fields, relation type, effect, formula function, action, data table and lint code.",
    parameters: obj({ query: { type: "string" } }, ["query"]),
  },
];

const TOOL_NAMES: Record<string, true> = Object.fromEntries(TOOLS.map((t) => [t.name, true]));

function int(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : fallback;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)} …[${text.length - max} more characters]` : text;
}

function words(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 0))];
}

/** Where in `text` the query best shows, as a snippet of about 320 characters. */
function snippet(text: string, query: string): string {
  const lower = text.toLowerCase();
  const terms = words(query);
  const at = Math.max(0, Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0), lower.length));
  const start = Math.max(0, at - 140);
  return `${start > 0 ? "…" : ""}${text.slice(start, start + 320).replace(/\s+/g, " ")}${start + 320 < text.length ? "…" : ""}`;
}

function done(content: string, summary: string, changed = false): ToolOutcome {
  return { content, error: false, summary, changed };
}

function refused(content: string, summary: string): ToolOutcome {
  return { content, error: true, summary, changed: false };
}

/** A card as the model reads it, each field clipped. */
function cardText(c: HostCharacter): string {
  return [
    `# ${c.name} (${c.id})`,
    c.description && `Description:\n${clip(c.description, 8000)}`,
    c.personality && `Personality:\n${clip(c.personality, 3000)}`,
    c.scenario && `Scenario:\n${clip(c.scenario, 3000)}`,
    c.firstMessage && `Greeting:\n${clip(c.firstMessage, 4000)}`,
    c.alternateGreetings.length > 0 && `Other greetings: ${c.alternateGreetings.length}`,
    c.exampleMessages && `Example messages:\n${clip(c.exampleMessages, 3000)}`,
    c.creatorNotes && `Creator notes:\n${clip(c.creatorNotes, 2000)}`,
    c.tags.length > 0 && `Tags: ${c.tags.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** A value as the model reads it: itself when small, else an outline to read deeper from, within DRAFT_READ_LIMIT. */
function readable(value: JsonValue, path: string): string {
  const json = JSON.stringify(value, null, 1);
  if (json.length <= DRAFT_READ_LIMIT && path !== "") return json;
  if (Array.isArray(value)) return `${path || "The draft"} is a list of ${value.length}; read its items by index (${path}/0).`;
  if (!isRecord(value)) return clip(json, DRAFT_READ_LIMIT);
  const lines = [`Outline of ${path || "the draft"} (read a deeper path for an item):`];
  let used = lines[0]?.length ?? 0;
  const entries = Object.entries(value);
  for (const [i, [key, v]] of entries.entries()) {
    let line: string;
    if (isRecord(v)) {
      const ids = Object.keys(v);
      line = `- ${key}: ${ids.length} item${ids.length === 1 ? "" : "s"}${ids.length > 0 ? ` (${ids.slice(0, 80).join(", ")}${ids.length > 80 ? ", …" : ""})` : ""}`;
    } else if (Array.isArray(v)) line = `- ${key}: a list of ${v.length}`;
    else line = `- ${key}: ${clip(JSON.stringify(v), 300)}`;
    if (used + line.length > DRAFT_READ_LIMIT) {
      lines.push(`(${entries.length - i} more keys: read ${path}/<key>)`);
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}

function problemLines(world: WorldDoc, limit: number): { text: string; errors: number; warnings: number } {
  const issues = readWorldDoc(world).issues;
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const shown = issues.filter((i) => i.severity !== "info").slice(0, limit).map((i) => `- ${i.severity} at ${i.path || "(the world)"}: ${i.message} [${i.code}]`);
  return { text: [`${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}.`, ...shown, ...(issues.length > shown.length ? [`(${issues.length - shown.length} more; run draft_check for the full list)`] : [])].join("\n"), errors, warnings };
}

async function run(name: string, args: JsonObject, ctx: ToolContext): Promise<ToolOutcome> {
  const { reader } = ctx;
  switch (name) {
    case "transcript_read": {
      const messages = await reader.transcript();
      if (messages.length === 0) return refused("This draft has no chat to read.", "No chat in the sources");
      const from = int(args.from, 0, messages.length - 1, 0);
      const end = Math.min(messages.length, from + int(args.count, 1, 60, 30));
      const lines: string[] = [];
      let used = 0;
      for (let i = from; i < end; i++) {
        const m = messages[i];
        if (!m) break;
        const line = `#${i} [${m.role}] ${m.name}: ${clip(m.content, MESSAGE_CLIP)}`;
        if (lines.length > 0 && used + line.length > BODY_LIMIT) break;
        lines.push(line);
        used += line.length + 2;
      }
      // The header names only what this answer holds.
      const last = from + lines.length - 1;
      const more = last + 1 < end ? `\n\n(Stopped after #${last} to keep this answer whole; read on with from=${last + 1}.)` : "";
      return done(`Messages ${from}–${last} of ${messages.length} (0 is the first):\n\n${lines.join("\n\n")}${more}`, `Read messages ${from}–${last} of ${messages.length}`);
    }
    case "transcript_search": {
      const query = str(args.query);
      if (!query) return refused("Give words to search for.", "Empty search");
      const messages = await reader.transcript();
      const terms = words(query);
      const hits = messages.flatMap((m, i) => {
        const lower = m.content.toLowerCase();
        const found = terms.filter((t) => lower.includes(t)).length;
        return found > 0 ? [{ i, m, found }] : [];
      });
      const best = hits.sort((a, b) => b.found - a.found || a.i - b.i).slice(0, int(args.limit, 1, 30, 12));
      if (best.length === 0) return done(`No message mentions "${query}".`, `Searched the chat for "${query}": nothing`);
      return done(best.map(({ i, m }) => `#${i} [${m.role}] ${m.name}: ${snippet(m.content, query)}`).join("\n"), `Searched the chat for "${query}": ${hits.length} message${hits.length === 1 ? "" : "s"}`);
    }
    case "cards_read": {
      const name = str(args.name).toLowerCase();
      const cards = (await reader.cards()).filter((c) => !name || c.name.toLowerCase().includes(name));
      if (cards.length === 0) return refused(name ? `No source card is named like "${args.name}".` : "This draft has no character cards.", "No cards");
      const parts: string[] = [];
      const shown: string[] = [];
      let used = 0;
      for (const [i, c] of cards.entries()) {
        const text = cardText(c);
        if (parts.length > 0 && used + text.length > BODY_LIMIT) {
          const rest = cards.slice(i).map((x) => x.name);
          parts.push(`(Not shown, to keep this answer whole: ${rest.join(", ")}. Read each by name.)`);
          break;
        }
        parts.push(clip(text, BODY_LIMIT));
        shown.push(c.name);
        used += Math.min(text.length, BODY_LIMIT) + 2;
      }
      return done(parts.join("\n\n"), `Read ${shown.join(", ")}`);
    }
    case "lore_list": {
      const want = str(args.book).toLowerCase();
      const books = reader.source.books;
      if (books.length === 0) return refused("This draft reads no lore books.", "No lore books");
      if (!want) {
        const lines: string[] = [];
        for (const b of books) lines.push(`- ${b.name} [${b.id}] (${b.scope}): ${(await reader.entries(b.id)).length} entries`);
        return done(lines.join("\n"), `Listed ${books.length} book${books.length === 1 ? "" : "s"}`);
      }
      const book = books.find((b) => b.id.toLowerCase() === want) ?? books.find((b) => b.name.toLowerCase().includes(want));
      if (!book) return refused(`No source book matches "${args.book}".`, "No such book");
      const entries = await reader.entries(book.id);
      const lines: string[] = [];
      let used = 0;
      for (const e of entries) {
        const line = `- [${e.id}] ${e.comment || "(untitled)"}${e.keys.length > 0 ? ` (keys: ${e.keys.slice(0, 8).join(", ")})` : ""}, ${e.content.length} chars${e.disabled ? ", switched off" : ""}${e.constant ? ", always on" : ""}`;
        if (used + line.length > BODY_LIMIT) break;
        lines.push(line);
        used += line.length + 1;
      }
      const rest = entries.length - lines.length;
      return done(`${book.name}: ${entries.length} entries${rest > 0 ? `; the first ${lines.length} are listed here (find the other ${rest} with lore_search)` : ""}\n${lines.join("\n")}`, `Listed ${book.name} (${entries.length} entries)`);
    }
    case "lore_search": {
      const query = str(args.query);
      if (!query) return refused("Give words to search for.", "Empty search");
      const terms = words(query);
      const scored = (await reader.allEntries())
        .map(({ book, entry }) => {
          const head = `${entry.comment} ${entry.keys.join(" ")}`.toLowerCase();
          const body = entry.content.toLowerCase();
          const score = terms.reduce((s, t) => s + (head.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0), 0);
          return { book, entry, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      const best = scored.slice(0, int(args.limit, 1, 30, 12));
      if (best.length === 0) return done(`No lore entry mentions "${query}".`, `Searched the lore for "${query}": nothing`);
      return done(best.map(({ book, entry }) => `- [${entry.id}] ${entry.comment || "(untitled)"} · ${book.name}: ${snippet(entry.content, query)}`).join("\n"), `Searched the lore for "${query}": ${scored.length} entr${scored.length === 1 ? "y" : "ies"}`);
    }
    case "lore_read": {
      const ids = Array.isArray(args.ids) ? args.ids.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
      if (ids.length === 0) return refused("Give the ids of the entries to read (from lore_list or lore_search).", "No entries named");
      const all = await reader.allEntries();
      const parts: string[] = [];
      let used = 0;
      let read = 0;
      for (const [i, id] of ids.entries()) {
        const found = all.find((x) => x.entry.id === id);
        const text = found ? `# ${found.entry.comment || "(untitled)"} [${id}] · ${found.book.name}${found.entry.keys.length > 0 ? `\nKeys: ${found.entry.keys.join(", ")}` : ""}\n${clip(found.entry.content, ENTRY_CLIP)}` : `# [${id}]: not an entry of the source books`;
        if (parts.length > 0 && used + text.length > BODY_LIMIT) {
          parts.push(`(Not read, to keep this answer whole: ${ids.slice(i).join(", ")}. Read them in another call.)`);
          break;
        }
        parts.push(text);
        used += text.length + 2;
        read++;
      }
      return done(parts.join("\n\n"), `Read ${read} lore entr${read === 1 ? "y" : "ies"}`);
    }
    case "pasted_read": {
      const pasted = reader.source.pasted;
      if (pasted.length === 0) return refused("The user pasted no text into this draft.", "No pasted text");
      if (args.index === undefined) return done(pasted.map((p, i) => `- ${i}: ${p.title} (${p.text.length} characters)`).join("\n"), `Listed ${pasted.length} pasted text${pasted.length === 1 ? "" : "s"}`);
      const item = pasted[int(args.index, 0, pasted.length - 1, 0)];
      if (!item) return refused("No pasted text has that index.", "No such text");
      const offset = int(args.offset, 0, Math.max(0, item.text.length - 1), 0);
      const end = Math.min(item.text.length, offset + int(args.length, 200, BODY_LIMIT, BODY_LIMIT));
      const more = end < item.text.length ? `\n\n(Read on with offset=${end}.)` : "";
      return done(`${item.title}, characters ${offset}–${end} of ${item.text.length}:\n\n${item.text.slice(offset, end)}${more}`, `Read ${item.title}`);
    }
    case "chat_state": {
      const chatId = reader.source.chatId;
      if (!chatId) return refused("This draft has no chat.", "No chat");
      const state = await ctx.bridge.chatState(ctx.userId, chatId);
      if (!state) return done("The source chat plays no LumiRPEngine world (or LumiRPEngine hasn't shown it since it started).", "The chat plays no world");
      const lines = [
        `World ${state.worldId}, revision ${state.revision}${state.definitionsFrom ? ` (entity definitions still from ${state.definitionsFrom})` : ""}; status ${state.status}.`,
        state.place ? `The POV is at ${state.place.name}${state.place.id ? ` (${state.place.id})` : ""}.` : "The POV's place isn't shown.",
        state.clock ? `Clock: ${state.clock.label} (${state.clock.dayPart}, minute ${state.clock.minutes} of the calendar).` : "",
        state.cash ? `Cash: ${state.cash}.` : "",
        state.present.length > 0 ? `Present: ${state.present.map((p) => `${p.name} (${p.id})`).join(", ")}.` : "Nobody else is present.",
        state.quests.length > 0 ? `Open quests:\n${state.quests.map((q) => `- ${q.label} (${q.id}, ${q.kind}) at "${q.stage}"${q.cue ? `: ${q.cue}` : ""}`).join("\n")}` : "No open quests.",
      ];
      return done(lines.filter(Boolean).join("\n"), `Read the chat's state in ${state.worldId}`);
    }
    case "engine_read": {
      const draft = await ctx.drafts.get(ctx.userId, ctx.draftId);
      const worldId = draft?.link?.worldId ?? draft?.source.worldId ?? null;
      if (!worldId) return refused("This draft isn't linked to a LumiRPEngine world.", "No linked world");
      const revision = str(args.revision);
      const read = await ctx.bridge.world(ctx.userId, worldId, revision || undefined);
      const path = str(args.path);
      const value = getAt(read.world as JsonValue, parsePointer(path));
      if (value === undefined) return refused(`Nothing at ${path} in ${read.name}.`, "Nothing there");
      return done(`${read.name}, revision ${read.revision}${read.revision === read.head ? " (the head)" : ""}:\n${readable(value, path)}`, `Read ${read.name}${path ? ` at ${path}` : ""}`);
    }
    case "draft_read": {
      const draft = await ctx.drafts.get(ctx.userId, ctx.draftId);
      if (!draft) return refused("The draft is gone.", "No draft");
      const path = typeof args.path === "string" ? args.path : "";
      const value = getAt((draft.proposed ?? draft.doc) as unknown as JsonValue, parsePointer(path));
      if (value === undefined) return refused(`Nothing at ${path} in the draft.`, `Nothing at ${path}`);
      return done(readable(value, path), `Read the draft${path ? ` at ${path}` : ""}`);
    }
    case "draft_patch": {
      if (!Array.isArray(args.ops) || args.ops.length === 0) return refused("Give ops: a list of JSON Patch operations.", "No operations");
      const ops = args.ops.slice(0, 200).map((raw, i) => readOp(raw, i));
      let report = { text: "", errors: 0, warnings: 0 };
      await ctx.drafts.update(ctx.userId, ctx.draftId, (draft) => {
        // An unchecked cast: the patch can write anything, and the check below reads what it wrote.
        const next = applyPatch((draft.proposed ?? draft.doc) as unknown as JsonValue, ops) as unknown as WorldDoc;
        draft.proposed = next;
        report = problemLines(next, 12);
      });
      return done(`Applied ${ops.length} operation${ops.length === 1 ? "" : "s"} to your proposal. The engine now finds ${report.text}`, `Patched ${ops.length} · ${report.errors} error${report.errors === 1 ? "" : "s"}, ${report.warnings} warning${report.warnings === 1 ? "" : "s"}`, true);
    }
    case "draft_check": {
      const draft = await ctx.drafts.get(ctx.userId, ctx.draftId);
      if (!draft) return refused("The draft is gone.", "No draft");
      const report = problemLines(draft.proposed ?? draft.doc, 80);
      return done(`The engine finds ${report.text}`, `Checked: ${report.errors} error${report.errors === 1 ? "" : "s"}, ${report.warnings} warning${report.warnings === 1 ? "" : "s"}`);
    }
    case "guide_lookup": {
      const query = str(args.query);
      return done(lookupGuide(query), `Looked up "${query}" in the guide`);
    }
    case "reference_lookup": {
      const query = str(args.query);
      return done(lookupReference(query), `Looked up "${query}" in the reference`);
    }
  }
  throw new Error(`no tool ${name}`);
}

/** Runs one tool call; whatever goes wrong comes back to the model as the tool's error. */
export async function runTool(name: string, args: JsonObject, ctx: ToolContext): Promise<ToolOutcome> {
  if (!hasOwn(TOOL_NAMES, name)) return refused(`There is no tool called ${name}. The tools are: ${TOOLS.map((t) => t.name).join(", ")}.`, `Unknown tool ${name}`);
  let outcome: ToolOutcome;
  try {
    outcome = await run(name, args, ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outcome = refused(error instanceof PatchError ? `Nothing was changed: ${message}` : message, `${name} failed: ${clip(message, 120)}`);
  }
  // Every tool keeps within the limit; this holds the assistant's promise if one ever doesn't.
  return outcome.content.length <= OUTPUT_LIMIT ? outcome : { ...outcome, content: `${outcome.content.slice(0, OUTPUT_LIMIT - 100)}\n…[cut here: the answer passed ${OUTPUT_LIMIT} characters; ask for less]` };
}
