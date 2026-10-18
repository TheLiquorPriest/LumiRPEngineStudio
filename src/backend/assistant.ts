// The assistant: one tool-calling loop per message the user sends, on the connection they chose
// (Spindle quiet generation with tools). Each round the model reads the conversation, calls tools
// (reading the sources, patching its proposal, checking it with the engine), and the results go
// back as tool results; it ends when the model answers without calling one, when the user stops it,
// or after the round limit. Thinking models get their reasoning echoed on the continuation, as a
// tool-call continuation needs.

import type { StudioChatSummary } from "lumi-rp-engine/studio";
import { ENGINE_VERSION } from "../engine";
import { isRecord } from "../shared/json";
import type { JsonObject } from "../shared/json";
import type { ChatLine } from "../shared/protocol";
import type { EngineBridge } from "./bridge";
import type { ChatEntry, Draft, DraftStore, StoredResult } from "./drafts";
import type { ModelMessage, ModelPart, StudioHost } from "./host";
import { jsonEqual } from "./pointer";
import type { SettingsStore } from "./settings";
import { SourceReader } from "./sources";
import { GUIDE } from "./texts";
import { OUTPUT_LIMIT, runTool, TOOLS } from "./tools";

/** Room for a thinking model's reasoning and a large patch in one answer. */
const MAX_TOKENS = 8192;
const CALL_TIMEOUT_MS = 240_000;
/**
 * What a run's tool answers may take when they go back to the model. A round's answers always go
 * back whole, so the loop runs no call that might take its round past this; older rounds, which
 * the model read whole when they came, share what is left, newest first, and the rest go back
 * shortened, saying so.
 */
const RUN_BUDGET = 160_000;
/** How much of an older answer past the budget goes back. */
const TRIMMED = 600;
/** The run's latest assistant turns whose call arguments go back whole; older ones go back in short. */
const CALLS_KEPT = 2;
/** Arguments longer than this go back in short from an older turn. */
const ARGS_KEPT = 600;
/** Paths of an older patch listed when it goes back in short. */
const PATHS_KEPT = 40;
/** Finish reasons that mean the answer hit its token limit: OpenAI-compatible `length`, Anthropic `max_tokens`, Gemini `MAX_TOKENS`. */
const CUT_OFF = /^(length|max_tokens|max_output_tokens)$/i;
/** Cut-off answers in a row after which the run stops instead of asking again. */
const CUT_OFF_LIMIT = 3;
const CUT_OFF_NOTE = "The model's last answer ran past its length limit and was lost, with any tool call it was writing. Carry on in smaller steps: at most about 30 operations per draft_patch, and short thoughts.";

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

/** The draft and its sources as the model starts each round with them. */
export function systemPrompt(draft: Draft, sources: string, chatState: StudioChatSummary | null): string {
  const doc = draft.doc as unknown as Record<string, unknown>;
  const counts = Object.entries(doc)
    .flatMap(([key, value]) => (value && typeof value === "object" && !Array.isArray(value) && ["entities", "places", "routes", "maps", "tracks", "lore", "schedules", "rules", "actions", "classifications", "kinds"].includes(key) ? [`${key} ${Object.keys(value).length}`] : []))
    .join(", ");
  const state = chatState
    ? `\nThe source chat already plays LumiRPEngine world ${chatState.worldId} at revision ${chatState.revision}: the POV is at ${chatState.place?.name ?? "an unknown place"}, ${chatState.clock?.label ?? "at an unknown time"}${chatState.cash ? `, with ${chatState.cash}` : ""}; present: ${chatState.present.map((p) => (p.life ? `${p.name} (${p.life.toLowerCase()})` : p.name)).join(", ") || "nobody"}; open quests: ${chatState.quests.map((q) => q.label).join(", ") || "none"}.${draft.link?.worldId === chatState.worldId ? ' This draft started from that world: refine it as a new revision (see the guide\'s "Refining a world in play").' : " This draft didn't start from that world, so it builds a world of its own."}`
    : "";
  return [
    INSTRUCTIONS,
    `# The conversion guide\n\n${GUIDE}`,
    `# This draft\n\nDraft "${draft.name}": world "${draft.doc.name}" (id ${draft.doc.id}), POV ${draft.doc.pov}. Accepted collections: ${counts || "none"}.${draft.proposed ? " Your proposal is waiting for the user's review; you keep working on it." : ""}${draft.link ? ` It is linked to LumiRPEngine world ${draft.link.worldId}${draft.link.revision ? ` (revision ${draft.link.revision})` : ""}.` : ""}\n${sources}${state}\nEngine: LumiRPEngine studio API ${ENGINE_VERSION}.`,
  ].join("\n\n");
}

/**
 * A call's arguments as an older turn sends them back: a patch as the operations and paths it
 * applied (its values are in the draft, for draft_read), anything else long as its opening. A long
 * run would otherwise send every patch's full values back with each call.
 */
function shortArgs(name: string, args: JsonObject): JsonObject {
  if (name === "draft_patch" && Array.isArray(args.ops)) {
    const ops = args.ops.flatMap((op) => (isRecord(op) && typeof op.op === "string" && typeof op.path === "string" ? [`${op.op} ${op.path}`] : []));
    return { sent_in_short: `${ops.length} operation${ops.length === 1 ? "" : "s"}: ${ops.slice(0, PATHS_KEPT).join(", ")}${ops.length > PATHS_KEPT ? ", …" : ""}` };
  }
  const json = JSON.stringify(args);
  return json.length > ARGS_KEPT ? { sent_in_short: `${json.slice(0, ARGS_KEPT)}…` } : args;
}

/** What the draft's sources hold, in a few lines. */
export async function describeSources(reader: SourceReader): Promise<string> {
  const s = reader.source;
  const lines = [`Sources: ${s.label}.`];
  if (s.chatId) lines.push(`The chat has ${(await reader.transcript().catch(() => [])).length} messages (0 is the first).`);
  const cards = await reader.cards().catch(() => []);
  if (cards.length > 0) lines.push(`Character cards: ${cards.map((c) => c.name).join(", ")}.`);
  if (s.persona) lines.push(`The user's persona is ${s.persona.name} (cards_read name="${s.persona.name}"): who they play in the chat, usually the POV.`);
  if (s.books.length > 0) lines.push(`Lore books: ${s.books.map((b) => `${b.name} (${b.scope})`).join(", ")}.`);
  if (s.pasted.length > 0) lines.push(`Pasted texts: ${s.pasted.map((p, i) => `${i}: ${p.title} (${p.text.length} characters)`).join(", ")}.`);
  return lines.join("\n");
}

/**
 * The conversation as model messages: the run under way with its tool calls and results, earlier
 * runs as plain text. The newest round's answers go back whole; older calls' arguments go back in
 * short, and older answers past RUN_BUDGET shortened. A note made while tools ran waits until their
 * results, which must follow the call directly.
 */
export function modelMessages(system: string, chat: readonly ChatEntry[], run: number): ModelMessage[] {
  const out: ModelMessage[] = [{ role: "system", content: system }];
  const say = (role: "user" | "assistant", text: string): void => {
    const last = out[out.length - 1];
    if (last && last.role === role && typeof last.content === "string") last.content = `${last.content}\n\n${text}`;
    else out.push({ role, content: text });
  };
  // The newest round is what the model hasn't read yet: whole, always (the loop keeps a round within
  // RUN_BUDGET). Older rounds share what is left, newest first; from the first answer that doesn't
  // fit, the older ones are shortened.
  const rounds = chat.filter((e): e is Extract<ChatEntry, { kind: "results" }> => e.kind === "results" && e.run === run);
  const full = new Set<StoredResult>(rounds.at(-1)?.results);
  let left = RUN_BUDGET - [...full].reduce((n, r) => n + r.content.length, 0);
  for (const r of rounds.slice(0, -1).reverse().flatMap((e) => e.results)) {
    if (r.content.length > left) break;
    full.add(r);
    left -= r.content.length;
  }
  const whole = new Set<ChatEntry>(chat.filter((e) => e.kind === "assistant" && e.run === run && e.calls.length > 0).slice(-CALLS_KEPT));
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
      const parts: ModelPart[] = [...(e.text ? [{ type: "text" as const, text: e.text }] : []), ...e.calls.map((c): ModelPart => ({ type: "tool_use", id: c.id, name: c.name, input: whole.has(e) ? c.args : shortArgs(c.name, c.args), ...(c.signature ? { signature: c.signature } : {}) }))];
      out.push({ role: "assistant", content: parts, ...(e.reasoning ? { reasoning: e.reasoning } : {}) });
      calling = true;
    } else if (e.run === run && calling) {
      out.push({ role: "user", content: e.results.map((r): ModelPart => ({ type: "tool_result", toolUseId: r.id, content: full.has(r) || r.content.length <= TRIMMED ? r.content : `${r.content.slice(0, TRIMMED)} …[the rest of this earlier answer is left out to save room; you read it whole when it came]`, isError: r.error })) });
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
    let cutOffs = 0;
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
      // An answer cut off at the token limit is neither the last word nor complete: the host drops
      // the tool call it was writing, so the model is asked to carry on in smaller steps.
      const cutOff = CUT_OFF.test(reply.finishReason);
      cutOffs = cutOff ? cutOffs + 1 : 0;
      const text = reply.content.trim();
      const calls = reply.toolCalls;
      const at = Date.now();
      await this.drafts.update(userId, draftId, (d) => {
        d.chat.push({ kind: "assistant", text, at, run, calls: calls.map((c) => ({ id: c.id, name: c.name, args: c.args, ...(c.signature ? { signature: c.signature } : {}) })), ...(calls.length > 0 && reply.reasoning ? { reasoning: reply.reasoning } : {}) });
      });
      if (text) this.activity(userId, draftId, { kind: "assistant", text, at });
      if (cutOff && cutOffs >= CUT_OFF_LIMIT) {
        await this.note(userId, draftId, `The model ran past its length limit ${CUT_OFF_LIMIT} times in a row, so the assistant stopped. Ask for less at a time, or use a connection that allows longer answers.`);
        break;
      }
      if (calls.length === 0) {
        if (cutOff) {
          await this.note(userId, draftId, CUT_OFF_NOTE);
          continue;
        }
        if (!text) await this.note(userId, draftId, "The model answered with nothing. Try again, or pick another connection in the Studio's settings.");
        break;
      }
      const results: StoredResult[] = [];
      // A round's answers all go back to the model whole, so a round takes at most RUN_BUDGET: once
      // the next answer might not fit, that call and the rest aren't run, and say so.
      let room = RUN_BUDGET;
      for (const call of calls) {
        const outcome = signal.aborted
          ? { content: "The user stopped the assistant before this ran.", error: true, summary: "Stopped", changed: false }
          : room < OUTPUT_LIMIT
            ? { content: `Not run: this round's calls asked for more than can come back to you at once. Call ${call.name} again on its own.`, error: true, summary: "Not run: the round asked for too much", changed: false }
            : await runTool(call.name, call.args, ctx);
        room -= outcome.content.length;
        // Kept whole: a tool's answer never passes OUTPUT_LIMIT (tools.ts), so the model reads what its header says.
        results.push({ id: call.id, name: call.name, content: outcome.content, error: outcome.error, summary: outcome.summary });
        this.activity(userId, draftId, { kind: "tool", name: call.name, summary: outcome.summary, error: outcome.error, at: Date.now() });
      }
      await this.drafts.update(userId, draftId, (d) => {
        d.chat.push({ kind: "results", at: Date.now(), run, results });
      });
      // The calls that came through ran; the one the cut-off answer was writing is lost.
      if (cutOff) await this.note(userId, draftId, CUT_OFF_NOTE);
      await this.changed(userId, draftId);
    }
    // A proposal that came back to the accepted draft proposes nothing.
    await this.drafts.update(userId, draftId, (d) => {
      if (d.proposed && jsonEqual(d.proposed, d.doc)) d.proposed = null;
    });
  }
}
