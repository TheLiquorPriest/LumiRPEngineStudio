// The assistant: one tool-calling loop per message the user sends, on the connection they chose
// (Spindle quiet generation with tools). Each round the model reads the conversation, calls tools
// (reading the sources, patching its proposal, checking it with the engine), and the results go
// back as tool results; it ends when the model answers without calling one, when the user stops it,
// or after the round limit. Thinking models get their reasoning echoed on the continuation, as a
// tool-call continuation needs.

import { ENGINE_VERSION } from "../engine";
import type { EngineChatSummary } from "../shared/bridge";
import type { ChatLine } from "../shared/protocol";
import type { EngineBridge } from "./bridge";
import type { ChatEntry, Draft, DraftStore, StoredResult } from "./drafts";
import type { ModelMessage, ModelPart, StudioHost } from "./host";
import { jsonEqual } from "./pointer";
import type { SettingsStore } from "./settings";
import { SourceReader } from "./sources";
import { GUIDE } from "./texts";
import { runTool, TOOLS } from "./tools";

/** Room for a thinking model's reasoning and a large patch in one answer. */
const MAX_TOKENS = 8192;
const CALL_TIMEOUT_MS = 240_000;
/** The run's tool results sent back in full, newest first; older ones go back trimmed. */
const RUN_BUDGET = 160_000;
const TRIMMED = 600;

const INSTRUCTIONS = `You are the assistant of LumiRPEngine Studio. You build LumiRPEngine worlds (lre-world-v1 documents) in the user's draft: from scratch, or, above all, by converting a chat the user is already in, its character cards, its lore books and pasted text into a complete world whose start is the story's present. You also refine worlds that chats already play.

How you work:
- Read before you write: transcript_read and transcript_search for the chat, cards_read, lore_list, lore_search and lore_read for the lore, pasted_read for pasted text, and chat_state and engine_read when the chat already plays a world.
- Change the draft only with draft_patch. Your changes form a proposal the user reviews and accepts, so make them in sensible batches and keep going until the world is complete.
- After each batch run draft_check, and fix every error before you finish. Fix the warnings that matter.
- Look things up rather than guess: guide_lookup for how to convert, reference_lookup for kinds, fields, relation types, effects, formula functions and lint codes.
- Ids are lowercase snake_case, unique in their collection, and each item's "id" repeats its key.
- Never invent what the sources don't support; when you must assume, say so in your answer.
- Keep secrets secret: a truth lives in a secret track stage's "truth" or a secret lore entry with a gate, and no public text repeats it.
- You can't install anything. The user installs from the Studio and confirms in LumiRPEngine.
- When you finish, answer in a few sentences: what the world holds now, what you assumed, and what the user should check.`;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)} …[trimmed]` : text;
}

/** The draft and its sources as the model starts each round with them. */
export function systemPrompt(draft: Draft, sources: string, chatState: EngineChatSummary | null): string {
  const doc = draft.doc as unknown as Record<string, unknown>;
  const counts = Object.entries(doc)
    .flatMap(([key, value]) => (value && typeof value === "object" && !Array.isArray(value) && ["entities", "places", "routes", "maps", "tracks", "lore", "schedules", "rules", "actions", "classifications", "kinds"].includes(key) ? [`${key} ${Object.keys(value).length}`] : []))
    .join(", ");
  const state = chatState
    ? `\nThe source chat already plays LumiRPEngine world ${chatState.worldId} at revision ${chatState.revision}: the POV is at ${chatState.place?.name ?? "an unknown place"}, ${chatState.clock?.label ?? "at an unknown time"}${chatState.cash ? `, with ${chatState.cash}` : ""}; present: ${chatState.present.map((p) => p.name).join(", ") || "nobody"}; open quests: ${chatState.quests.map((q) => q.label).join(", ") || "none"}. Refine that world as a new revision (see the guide's "Refining a world in play").`
    : "";
  return [
    INSTRUCTIONS,
    `# The conversion guide\n\n${GUIDE}`,
    `# This draft\n\nDraft "${draft.name}": world "${draft.doc.name}" (id ${draft.doc.id}), POV ${draft.doc.pov}. Accepted collections: ${counts || "none"}.${draft.proposed ? " Your proposal is waiting for the user's review; you keep working on it." : ""}${draft.link ? ` It is linked to LumiRPEngine world ${draft.link.worldId}${draft.link.revision ? ` (revision ${draft.link.revision})` : ""}.` : ""}\n${sources}${state}\nEngine: LumiRPEngine studio API ${ENGINE_VERSION}.`,
  ].join("\n\n");
}

/** What the draft's sources hold, in a few lines. */
export async function describeSources(reader: SourceReader): Promise<string> {
  const s = reader.source;
  const lines = [`Sources: ${s.label}.`];
  if (s.chatId) lines.push(`The chat has ${(await reader.transcript().catch(() => [])).length} messages (0 is the first).`);
  const cards = await reader.cards().catch(() => []);
  if (cards.length > 0) lines.push(`Character cards: ${cards.map((c) => c.name).join(", ")}.`);
  if (s.books.length > 0) lines.push(`Lore books: ${s.books.map((b) => `${b.name} (${b.scope})`).join(", ")}.`);
  if (s.pasted.length > 0) lines.push(`Pasted texts: ${s.pasted.map((p, i) => `${i}: ${p.title} (${p.text.length} characters)`).join(", ")}.`);
  return lines.join("\n");
}

/**
 * The conversation as model messages: the run under way with its tool calls and results as they
 * were, earlier runs as plain text. A note made while tools ran waits until their results, which
 * must follow the call directly.
 */
export function modelMessages(system: string, chat: readonly ChatEntry[], run: number): ModelMessage[] {
  const out: ModelMessage[] = [{ role: "system", content: system }];
  const say = (role: "user" | "assistant", text: string): void => {
    const last = out[out.length - 1];
    if (last && last.role === role && typeof last.content === "string") last.content = `${last.content}\n\n${text}`;
    else out.push({ role, content: text });
  };
  // Newest results first get their full text, within the run's budget.
  const full = new Set<StoredResult>();
  let used = 0;
  for (let i = chat.length - 1; i >= 0; i--) {
    const e = chat[i];
    if (e?.kind !== "results" || e.run !== run) continue;
    for (const r of e.results) {
      if (used + r.content.length > RUN_BUDGET) continue;
      full.add(r);
      used += r.content.length;
    }
  }
  const waiting: string[] = [];
  let calling = false;
  for (const e of chat) {
    if (e.kind === "user" || e.kind === "note") {
      const text = e.kind === "note" ? `(Studio) ${e.text}` : e.text;
      if (calling) waiting.push(text);
      else say("user", text);
    } else if (e.kind === "assistant") {
      if (e.run !== run || e.calls.length === 0) {
        const used = e.calls.length > 0 ? `(I used ${[...new Set(e.calls.map((c) => c.name))].join(", ")}.)` : "";
        const text = [e.text, used].filter(Boolean).join(" ");
        if (text) say("assistant", text);
        continue;
      }
      const parts: ModelPart[] = [...(e.text ? [{ type: "text" as const, text: e.text }] : []), ...e.calls.map((c): ModelPart => ({ type: "tool_use", id: c.id, name: c.name, input: c.args, ...(c.signature ? { signature: c.signature } : {}) }))];
      out.push({ role: "assistant", content: parts, ...(e.reasoning ? { reasoning: e.reasoning } : {}) });
      calling = true;
    } else if (e.run === run && calling) {
      out.push({ role: "user", content: e.results.map((r): ModelPart => ({ type: "tool_result", toolUseId: r.id, content: full.has(r) ? r.content : clip(r.content, TRIMMED), isError: r.error })) });
      calling = false;
      for (const text of waiting.splice(0)) say("user", text);
    }
  }
  for (const text of waiting) say("user", text);
  return out;
}

export class Assistant {
  /** Runs under way per `user \0 draft`. */
  private readonly runs = new Map<string, { controller: AbortController; done: Promise<void> }>();

  constructor(
    private readonly host: StudioHost,
    private readonly drafts: DraftStore,
    private readonly settings: SettingsStore,
    private readonly bridge: EngineBridge,
    /** Pushes the draft's view to the user's frontend. */
    private readonly changed: (userId: string, draftId: string) => Promise<void>,
    /** Pushes one new line of the conversation. */
    private readonly activity: (userId: string, draftId: string, line: ChatLine) => void,
  ) {}

  running(userId: string, draftId: string): boolean {
    return this.runs.has(`${userId}\u0000${draftId}`);
  }

  /** Adds the user's message and starts a run on it; the run reports through pushes. */
  async send(userId: string, draftId: string, text: string): Promise<void> {
    const key = `${userId}\u0000${draftId}`;
    if (this.runs.has(key)) throw new Error("The assistant is still working on this draft. Stop it, or wait for its answer.");
    const message = text.trim();
    if (message === "") throw new Error("Write something for the assistant first.");
    const controller = new AbortController();
    const started = this.drafts.update(userId, draftId, (d) => {
      d.runs += 1;
      // Earlier runs go back as text only, so their results are kept as one-line summaries.
      d.chat = d.chat.map((e) => (e.kind === "results" ? { ...e, results: e.results.map((r) => ({ ...r, content: "" })) } : e));
      d.chat.push({ kind: "user", text: message, at: Date.now() });
    });
    const done = started
      .then((draft) => this.loop(userId, draft, controller.signal))
      .catch((error: unknown) => this.host.log("error", `[LumiRPEngine Studio] assistant: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`))
      .finally(() => {
        this.runs.delete(key);
        return this.changed(userId, draftId).catch(() => undefined);
      });
    this.runs.set(key, { controller, done });
    await started;
  }

  stop(userId: string, draftId: string): boolean {
    const run = this.runs.get(`${userId}\u0000${draftId}`);
    run?.controller.abort();
    return run !== undefined;
  }

  /** Waits for every run under way (tests; shutdown). */
  async idle(): Promise<void> {
    while (this.runs.size > 0) await Promise.all([...this.runs.values()].map((r) => r.done));
  }

  private async note(userId: string, draftId: string, text: string): Promise<void> {
    const at = Date.now();
    await this.drafts.update(userId, draftId, (d) => {
      d.chat.push({ kind: "note", text, at });
    });
    this.activity(userId, draftId, { kind: "note", text, at });
  }

  private async loop(userId: string, first: Draft, signal: AbortSignal): Promise<void> {
    const draftId = first.id;
    const run = first.runs;
    const settings = await this.settings.get(userId);
    const reader = new SourceReader(this.host, userId, first.source);
    const sources = await describeSources(reader);
    const chatState = first.source.chatId ? await this.bridge.chatState(userId, first.source.chatId) : null;
    const ctx = { userId, draftId, drafts: this.drafts, reader, bridge: this.bridge };
    for (let round = 0; ; round++) {
      if (signal.aborted) {
        await this.note(userId, draftId, "You stopped the assistant.");
        break;
      }
      if (round >= settings.maxRounds) {
        await this.note(userId, draftId, `The assistant stopped after ${settings.maxRounds} model calls. Send "continue" to let it carry on.`);
        break;
      }
      const draft = await this.drafts.get(userId, draftId);
      if (!draft) return;
      let reply;
      try {
        reply = await this.host.models.generate({ messages: modelMessages(systemPrompt(draft, sources, chatState), draft.chat, run), tools: [...TOOLS], connectionId: settings.connectionId, maxTokens: MAX_TOKENS }, userId, AbortSignal.any([signal, AbortSignal.timeout(CALL_TIMEOUT_MS)]));
      } catch (error) {
        await this.note(userId, draftId, signal.aborted ? "You stopped the assistant." : `The model call failed: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
      const text = reply.content.trim();
      const calls = reply.toolCalls;
      const at = Date.now();
      await this.drafts.update(userId, draftId, (d) => {
        d.chat.push({ kind: "assistant", text, at, run, calls: calls.map((c) => ({ id: c.id, name: c.name, args: c.args, ...(c.signature ? { signature: c.signature } : {}) })), ...(calls.length > 0 && reply.reasoning ? { reasoning: reply.reasoning } : {}) });
      });
      if (text) this.activity(userId, draftId, { kind: "assistant", text, at });
      if (calls.length === 0) {
        if (!text) await this.note(userId, draftId, "The model answered with nothing. Try again, or pick another connection in the Studio's settings.");
        break;
      }
      const results: StoredResult[] = [];
      for (const call of calls) {
        const outcome = signal.aborted ? { content: "The user stopped the assistant before this ran.", error: true, summary: "Stopped", changed: false } : await runTool(call.name, call.args, ctx);
        // Kept whole: a tool's answer never passes OUTPUT_LIMIT (tools.ts), so the model reads what its header says.
        results.push({ id: call.id, name: call.name, content: outcome.content, error: outcome.error, summary: outcome.summary });
        this.activity(userId, draftId, { kind: "tool", name: call.name, summary: outcome.summary, error: outcome.error, at: Date.now() });
      }
      await this.drafts.update(userId, draftId, (d) => {
        d.chat.push({ kind: "results", at: Date.now(), run, results });
      });
      await this.changed(userId, draftId);
    }
    // A proposal that came back to the accepted draft proposes nothing.
    await this.drafts.update(userId, draftId, (d) => {
      if (d.proposed && jsonEqual(d.proposed, d.doc)) d.proposed = null;
    });
  }
}
