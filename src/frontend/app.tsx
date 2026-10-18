// The "RPEngine Studio" drawer tab: drafts and where they start from, the assistant with its tool
// activity, the review of its proposal, the draft (counts, problems, an item's JSON) and the
// actions: Validate, Export, Import, and the three installs, which only offer the draft to
// LumiRPEngine. The backend does the work; this file routes clicks and shows what it sends.

import { useEffect, useRef, useState } from "preact/hooks";
import type { EngineWorldEntry } from "../shared/bridge";
import { INSTALLED_EVENT, OFFER_EVENT, OFFER_INBOUND, readInstalled, STATE_EVENT, STATE_REQUEST_EVENT } from "../shared/bridge";
import { isRecord } from "../shared/json";
import type { JsonValue } from "../shared/json";
import type { ChatInfo, ConnectionView, DraftSummary, DraftView, SourceSpec, StudioSettings } from "../shared/protocol";
import type { Client } from "./client";

export interface FrontendHost {
  /** The chat open in Lumiverse, if any. */
  activeChat(): string | null;
  /** Calls back when the open chat changes. */
  onChatChange(listener: () => void): () => void;
  download(fileName: string, text: string): void;
}

type Kind = SourceSpec["kind"];

const KIND_LABEL: Record<Kind, string> = { chat: "This chat", character: "A character", books: "Lore books", blank: "Blank", world: "A LumiRPEngine world" };

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function App(props: { client: Client; host: FrontendHost }) {
  const { client, host } = props;
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [connections, setConnections] = useState<ConnectionView[]>([]);
  const [engine, setEngine] = useState<{ version: string; offers: boolean } | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [chatId, setChatId] = useState<string | null>(host.activeChat());
  const open = useRef<string | null>(null);
  open.current = draft?.id ?? null;

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      setNotice({ text: message(error), error: true });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void act(async () => {
      const hello = await client.request({ type: "hello" });
      setDrafts(hello.drafts);
      setSettings(hello.settings);
      setConnections(hello.connections);
      const first = hello.drafts[0];
      if (first) setDraft((await client.request({ type: "draft.open", draftId: first.id })).draft);
      else setCreating(true);
    });
    const offPush = client.onPush((push) => {
      if (push.type === "drafts") setDrafts(push.drafts);
      else if (push.type === "draft") {
        if (push.draft.id === open.current) setDraft(push.draft);
      } else if (push.draftId === open.current) setDraft((d) => (d ? { ...d, chat: [...d.chat, push.line] } : d));
    });
    const onState = (event: Event) => {
      const detail: unknown = (event as CustomEvent).detail;
      if (isRecord(detail) && typeof detail.engineVersion === "string") setEngine({ version: detail.engineVersion, offers: Array.isArray(detail.inbound) && detail.inbound.includes(OFFER_INBOUND) });
    };
    const onInstalled = (event: Event) => {
      const installed = readInstalled((event as CustomEvent).detail);
      if (!installed) return;
      void client.request({ type: "installed", ...installed }).then((r) => {
        if (r.draft && r.draft.id === open.current) setDraft(r.draft);
        if (r.draft) setNotice({ text: `LumiRPEngine installed “${r.draft.name}”.`, error: false });
      });
    };
    window.addEventListener(STATE_EVENT, onState);
    window.addEventListener(INSTALLED_EVENT, onInstalled);
    window.dispatchEvent(new CustomEvent(STATE_REQUEST_EVENT, { detail: { version: 1 } }));
    const offChat = host.onChatChange(() => setChatId(host.activeChat()));
    return () => {
      offPush();
      offChat();
      window.removeEventListener(STATE_EVENT, onState);
      window.removeEventListener(INSTALLED_EVENT, onInstalled);
    };
  }, []);

  const openDraft = (id: string) =>
    act(async () => {
      setCreating(false);
      setDraft((await client.request({ type: "draft.open", draftId: id })).draft);
    });

  return (
    <div class="lres" data-lres>
      <div class="lres-card">
        <div class="lres-h">
          <span>RPEngine Studio</span>
          <span class="lres-muted">{engine ? `LumiRPEngine ${engine.version}${engine.offers ? "" : " (too old to install from the Studio)"}` : "LumiRPEngine not seen yet"}</span>
        </div>
        <div class="lres-row">
          <select class="lres-input lres-grow" aria-label="Draft" value={draft?.id ?? ""} onChange={(e) => e.currentTarget.value && void openDraft(e.currentTarget.value)}>
            <option value="">{drafts.length === 0 ? "No drafts yet" : "Open a draft…"}</option>
            {drafts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button type="button" class="lres-btn" onClick={() => setCreating(!creating)}>
            {creating ? "Close" : "New draft"}
          </button>
        </div>
        {settings ? (
          <div class="lres-row">
            <select class="lres-input lres-grow" aria-label="Connection" value={settings.connectionId ?? ""} onChange={(e) => void act(async () => setSettings((await client.request({ type: "settings.set", connectionId: e.currentTarget.value || null })).settings))}>
              <option value="">Your active connection</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.model ? ` · ${c.model}` : ""}
                </option>
              ))}
            </select>
            <label class="lres-muted">
              Model calls per message{" "}
              <input class="lres-input" style={{ width: "72px" }} type="number" min={1} max={120} value={settings.maxRounds} onChange={(e) => void act(async () => setSettings((await client.request({ type: "settings.set", maxRounds: Number(e.currentTarget.value) })).settings))} />
            </label>
          </div>
        ) : null}
      </div>
      {notice ? (
        <div class={notice.error ? "lres-banner error" : "lres-banner"} onClick={() => setNotice(null)}>
          {notice.text}
        </div>
      ) : null}
      {creating ? (
        <NewDraft
          client={client}
          chatId={chatId}
          busy={busy}
          act={act}
          created={(d) => {
            setCreating(false);
            setDraft(d);
            void client.request({ type: "draft.list" }).then((r) => setDrafts(r.drafts));
          }}
        />
      ) : null}
      {draft && !creating ? (
        <DraftPanel
          key={draft.id}
          client={client}
          host={host}
          draft={draft}
          chatId={chatId}
          busy={busy}
          act={act}
          setDraft={setDraft}
          notify={(text) => setNotice({ text, error: false })}
          deleted={(list) => {
            setDrafts(list);
            setDraft(null);
            setCreating(list.length === 0);
          }}
          renamed={() => void client.request({ type: "draft.list" }).then((r) => setDrafts(r.drafts))}
        />
      ) : null}
    </div>
  );
}

function NewDraft(props: { client: Client; chatId: string | null; busy: boolean; act(work: () => Promise<void>): Promise<void>; created(draft: DraftView): void }) {
  const { client } = props;
  const [kind, setKind] = useState<Kind>(props.chatId ? "chat" : "blank");
  const [name, setName] = useState("");
  const [chat, setChat] = useState<ChatInfo | null>(null);
  const [characters, setCharacters] = useState<{ id: string; name: string }[] | null>(null);
  const [books, setBooks] = useState<{ id: string; name: string }[] | null>(null);
  const [worlds, setWorlds] = useState<EngineWorldEntry[] | null>(null);
  const [pick, setPick] = useState<string>("");
  const [picked, setPicked] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setProblem(null);
    setPick("");
    const load = async () => {
      if (kind === "chat" && props.chatId) setChat((await client.request({ type: "pick.chat", chatId: props.chatId })).chat);
      if (kind === "character" && !characters) setCharacters((await client.request({ type: "pick.characters" })).items);
      if (kind === "books" && !books) setBooks((await client.request({ type: "pick.books" })).items);
      if (kind === "world" && !worlds) setWorlds((await client.request({ type: "pick.worlds" })).worlds);
    };
    load().catch((error: unknown) => setProblem(message(error)));
  }, [kind, props.chatId]);

  const spec = (): SourceSpec | null => {
    if (kind === "chat") return props.chatId ? { kind, chatId: props.chatId } : null;
    if (kind === "character") return pick ? { kind, characterId: pick } : null;
    if (kind === "books") return picked.length > 0 ? { kind, bookIds: picked } : null;
    if (kind === "world") return pick ? { kind, worldId: pick, ...(props.chatId && chat?.world?.worldId === pick ? { chatId: props.chatId } : {}) } : null;
    return { kind: "blank" };
  };
  const ready = spec();
  return (
    <div class="lres-card" data-lres-new>
      <div class="lres-h">New draft</div>
      <input class="lres-input" placeholder="Name (optional)" aria-label="Draft name" value={name} onInput={(e) => setName(e.currentTarget.value)} />
      <div class="lres-row">
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
          <button key={k} type="button" class={k === kind ? "lres-btn primary" : "lres-btn"} disabled={k === "chat" && !props.chatId} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {problem ? <div class="lres-banner error">{problem}</div> : null}
      {kind === "chat" && chat ? (
        <div class="lres-muted">
          “{chat.name}”: {chat.messages} messages{chat.characters.length > 0 ? ` with ${chat.characters.join(", ")}` : ""}
          {chat.books.length > 0 ? `; lore: ${chat.books.map((b) => `${b.name} (${b.scope})`).join(", ")}` : "; no lore books"}.
          {chat.world ? ` It already plays a LumiRPEngine world: pick “A LumiRPEngine world” to refine that world against this chat.` : ""}
        </div>
      ) : null}
      {kind === "chat" && chat?.world ? (
        <button type="button" class="lres-btn" onClick={() => (setKind("world"), setPick(chat.world?.worldId ?? ""))}>
          Refine this chat's world instead
        </button>
      ) : null}
      {kind === "character" && characters ? (
        <select class="lres-input" aria-label="Character" value={pick} onChange={(e) => setPick(e.currentTarget.value)}>
          <option value="">Choose a character…</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : null}
      {kind === "books" && books ? (
        <div class="lres-chips">
          {books.map((b) => (
            <label key={b.id} class="lres-chip">
              <input type="checkbox" checked={picked.includes(b.id)} onChange={(e) => setPicked(e.currentTarget.checked ? [...picked, b.id] : picked.filter((x) => x !== b.id))} /> {b.name}
            </label>
          ))}
        </div>
      ) : null}
      {kind === "world" && worlds ? (
        <select class="lres-input" aria-label="LumiRPEngine world" value={pick} onChange={(e) => setPick(e.currentTarget.value)}>
          <option value="">Choose a world…</option>
          {worlds.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.revisionCount} revision{w.revisionCount === 1 ? "" : "s"})
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="button"
        class="lres-btn primary"
        disabled={!ready || props.busy}
        onClick={() =>
          void props.act(async () => {
            if (ready) props.created((await client.request({ type: "draft.create", name, source: ready })).draft);
          })
        }
      >
        Start
      </button>
    </div>
  );
}

function DraftPanel(props: {
  client: Client;
  host: FrontendHost;
  draft: DraftView;
  chatId: string | null;
  busy: boolean;
  act(work: () => Promise<void>): Promise<void>;
  setDraft(draft: DraftView): void;
  notify(text: string): void;
  deleted(drafts: DraftSummary[]): void;
  renamed(): void;
}) {
  const { client, draft, act } = props;
  const [text, setText] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [declined, setDeclined] = useState<string[]>([]);
  const [item, setItem] = useState<{ collection: string; id: string; proposed: boolean; value: JsonValue | null }>({ collection: "", id: "", proposed: false, value: null });
  const [worlds, setWorlds] = useState<EngineWorldEntry[] | null>(null);
  const [target, setTarget] = useState<string>(draft.link?.worldId ?? "");
  const fileInput = useRef<HTMLInputElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => chatEnd.current?.scrollIntoView({ block: "nearest" }), [draft.chat.length]);
  useEffect(() => setDeclined([]), [draft.review?.changes.length]);

  const show = (collection: string, id: string, proposed: boolean) =>
    act(async () => {
      const r = await client.request({ type: "draft.item", draftId: draft.id, collection, id, proposed });
      setItem({ collection, id, proposed, value: r.value });
    });
  const install = (mode: "new" | "revision", attach: boolean) =>
    act(async () => {
      if (attach && !props.chatId) throw new Error("Open the chat to attach it to first.");
      const r = await client.request({ type: "install", draftId: draft.id, mode, worldId: mode === "revision" ? target || null : null, attachChatId: attach ? props.chatId : null });
      window.dispatchEvent(new CustomEvent(OFFER_EVENT, { detail: { offerId: r.offerId } }));
      props.setDraft((await client.request({ type: "draft.open", draftId: draft.id })).draft);
      props.notify("Offered to LumiRPEngine: review it in its Build tab and tap Install there.");
    });
  const firstItem = Object.entries(draft.ids)[0];
  return (
    <>
      <div class="lres-card" data-lres-source>
        <div class="lres-h">
          <span>{draft.name}</span>
          <span class="lres-row">
            <button
              type="button"
              class="lres-btn"
              onClick={() => {
                const name = window.prompt("Rename the draft", draft.name);
                if (name) void act(async () => (props.setDraft((await client.request({ type: "draft.rename", draftId: draft.id, name })).draft), props.renamed()));
              }}
            >
              Rename
            </button>
            <button type="button" class="lres-btn danger" disabled={draft.running} onClick={() => window.confirm(`Delete the draft “${draft.name}”?`) && void act(async () => props.deleted((await client.request({ type: "draft.delete", draftId: draft.id })).drafts))}>
              Delete
            </button>
          </span>
        </div>
        <div class="lres-muted">
          {draft.source.label}
          {draft.source.books.length > 0 ? ` · lore: ${draft.source.books.map((b) => `${b.name} (${b.scope})`).join(", ")}` : ""}
          {draft.link ? ` · LumiRPEngine world ${draft.link.worldId}` : ""}
        </div>
        {draft.source.pasted.map((p, i) => (
          <div key={i} class="lres-row">
            <span class="lres-chip">{p.title}</span>
            <span class="lres-muted">{p.text.length} characters</span>
            <button type="button" class="lres-btn" onClick={() => void act(async () => props.setDraft((await client.request({ type: "draft.unpaste", draftId: draft.id, index: i })).draft))}>
              Remove
            </button>
          </div>
        ))}
        <details>
          <summary class="lres-muted">Paste text for the assistant to read</summary>
          <input class="lres-input" placeholder="Title" value={pasteTitle} onInput={(e) => setPasteTitle(e.currentTarget.value)} />
          <textarea class="lres-input" placeholder="Setting notes, a history, character sheets…" value={pasteText} onInput={(e) => setPasteText(e.currentTarget.value)} />
          <button
            type="button"
            class="lres-btn"
            disabled={!pasteText.trim()}
            onClick={() =>
              void act(async () => {
                props.setDraft((await client.request({ type: "draft.paste", draftId: draft.id, title: pasteTitle, text: pasteText })).draft);
                setPasteText("");
                setPasteTitle("");
              })
            }
          >
            Add to sources
          </button>
        </details>
      </div>

      <div class="lres-card" data-lres-assistant>
        <div class="lres-h">
          <span>Assistant</span>
          {draft.running ? <span class="lres-muted">working…</span> : null}
        </div>
        <div class="lres-chat">
          {draft.chat.map((line, i) => (
            <div key={i} class={`lres-line ${line.kind}${line.kind === "tool" && line.error ? " error" : ""}`}>
              {line.kind === "tool" ? `${line.error ? "✗" : "✓"} ${line.summary}` : line.text}
            </div>
          ))}
          <div ref={chatEnd} />
        </div>
        <textarea
          class="lres-input"
          aria-label="Message to the assistant"
          placeholder={draft.source.chatId ? "Convert this chat into a world whose start is the story's present." : "Describe the world you want."}
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
        />
        <div class="lres-row">
          <button
            type="button"
            class="lres-btn primary"
            disabled={draft.running || !text.trim()}
            onClick={() =>
              void act(async () => {
                await client.request({ type: "assistant.send", draftId: draft.id, text });
                setText("");
              })
            }
          >
            Send
          </button>
          <button type="button" class="lres-btn" disabled={!draft.running} onClick={() => void act(async () => void (await client.request({ type: "assistant.stop", draftId: draft.id })))}>
            Stop
          </button>
        </div>
      </div>

      {draft.review ? (
        <div class="lres-card" data-lres-review>
          <div class="lres-h">
            <span>Review the assistant's changes ({draft.review.changes.length})</span>
            <span class="lres-muted">
              {draft.review.errors} errors · {draft.review.warnings} warnings
            </span>
          </div>
          <div class="lres-chat">
            {draft.review.changes.map((c) => (
              <ChangeRow key={c.key} change={c} ticked={!declined.includes(c.key)} toggle={(ticked) => setDeclined(ticked ? declined.filter((k) => k !== c.key) : [...declined, c.key])} compare={() => client.request({ type: "review.change", draftId: draft.id, key: c.key })} />
            ))}
          </div>
          <div class="lres-row">
            <button type="button" class="lres-btn primary" disabled={draft.running} onClick={() => void act(async () => props.setDraft((await client.request({ type: "review.accept", draftId: draft.id, keys: declined.length === 0 ? null : draft.review?.changes.filter((c) => !declined.includes(c.key)).map((c) => c.key) ?? [] })).draft))}>
              {declined.length === 0 ? "Accept all" : "Accept the ticked ones"}
            </button>
            <button type="button" class="lres-btn danger" disabled={draft.running} onClick={() => void act(async () => props.setDraft((await client.request({ type: "review.discard", draftId: draft.id })).draft))}>
              Discard
            </button>
          </div>
        </div>
      ) : null}

      <div class="lres-card" data-lres-draft>
        <div class="lres-h">
          <span>
            {draft.world.name} <span class="lres-muted">({draft.world.id}, POV {draft.world.pov})</span>
          </span>
          <span class="lres-muted">
            {draft.errors} errors · {draft.warnings} warnings
          </span>
        </div>
        <div class="lres-chips">
          {Object.entries(draft.counts).map(([c, n]) => (
            <button key={c} type="button" class="lres-chip" onClick={() => draft.ids[c]?.[0] && void show(c, draft.ids[c][0], false)}>
              {c} {n}
            </button>
          ))}
        </div>
        {draft.issues.filter((i) => i.severity !== "info").slice(0, 40).map((i, n) => (
          <div key={n} class={`lres-issue ${i.severity}`}>
            {i.severity}: {i.message} <span class="lres-muted">{i.path}</span>
          </div>
        ))}
        <div class="lres-row">
          <select class="lres-input lres-grow" aria-label="Collection" value={item.collection || firstItem?.[0] || ""} onChange={(e) => setItem({ ...item, collection: e.currentTarget.value, id: "", value: null })}>
            {Object.keys(draft.ids).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select class="lres-input lres-grow" aria-label="Item" value={item.id} onChange={(e) => e.currentTarget.value && void show(item.collection || firstItem?.[0] || "", e.currentTarget.value, item.proposed)}>
            <option value="">Item…</option>
            {(draft.ids[item.collection || firstItem?.[0] || ""] ?? []).map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          {draft.review ? (
            <label class="lres-muted">
              <input type="checkbox" checked={item.proposed} onChange={(e) => setItem({ ...item, proposed: e.currentTarget.checked })} /> proposed
            </label>
          ) : null}
        </div>
        {item.value !== null ? <pre class="lres-json">{JSON.stringify(item.value, null, 2)}</pre> : null}
      </div>

      <div class="lres-card" data-lres-actions>
        <div class="lres-h">Actions</div>
        {draft.offer ? <div class="lres-banner">Offered to LumiRPEngine ({draft.offer.mode === "new" ? "a new world" : "a new revision"}): review and install it in LumiRPEngine's Build tab.</div> : null}
        <div class="lres-row">
          <button type="button" class="lres-btn" onClick={() => void act(async () => (props.setDraft((await client.request({ type: "draft.validate", draftId: draft.id })).draft), props.notify("Checked with the engine: the problems are listed under the draft.")))}>
            Validate
          </button>
          <button type="button" class="lres-btn" onClick={() => void act(async () => {
            const r = await client.request({ type: "draft.export", draftId: draft.id });
            props.host.download(r.fileName, JSON.stringify(r.file, null, 2));
          })}>
            Export file
          </button>
          <button type="button" class="lres-btn" onClick={() => fileInput.current?.click()}>
            Import file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (file)
                void act(async () => {
                  let parsed: unknown;
                  try {
                    parsed = JSON.parse(await file.text());
                  } catch {
                    throw new Error("That file isn't JSON.");
                  }
                  props.setDraft((await client.request({ type: "draft.import", name: "", file: parsed as JsonValue })).draft);
                  props.renamed();
                });
            }}
          />
        </div>
        <div class="lres-row">
          <button type="button" class="lres-btn primary" disabled={props.busy || draft.running} onClick={() => void install("new", false)}>
            Install as new world
          </button>
          <button type="button" class="lres-btn" disabled={props.busy || draft.running || !props.chatId} onClick={() => void install("new", true)}>
            Install and attach to this chat
          </button>
        </div>
        <div class="lres-row">
          <select class="lres-input lres-grow" aria-label="World to revise" value={target} onFocus={() => !worlds && void act(async () => setWorlds((await client.request({ type: "pick.worlds" })).worlds))} onChange={(e) => setTarget(e.currentTarget.value)}>
            <option value="">{draft.link ? `World ${draft.link.worldId}` : "Choose the world to revise…"}</option>
            {(worlds ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button type="button" class="lres-btn" disabled={props.busy || draft.running || (!target && !draft.link)} onClick={() => void install("revision", false)}>
            Install as new revision
          </button>
        </div>
      </div>
    </>
  );
}

/** One change under review: tick it in or out, and compare the item as the draft holds it with what the assistant proposes. */
function ChangeRow(props: { change: NonNullable<DraftView["review"]>["changes"][number]; ticked: boolean; toggle(ticked: boolean): void; compare(): Promise<{ before: JsonValue | null; after: JsonValue | null }> }) {
  const { change } = props;
  const [shown, setShown] = useState<{ before: JsonValue | null; after: JsonValue | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const toggleCompare = () => {
    if (shown) {
      setShown(null);
      return;
    }
    setProblem(null);
    props.compare().then(setShown, (error: unknown) => setProblem(error instanceof Error ? error.message : String(error)));
  };
  const json = (value: JsonValue | null, none: string) => <pre style={{ whiteSpace: "pre-wrap", fontSize: "11px", maxHeight: "260px", overflow: "auto", margin: 0 }}>{value === null ? none : JSON.stringify(value, null, 2)}</pre>;
  return (
    <div>
      <div class="lres-row">
        <input type="checkbox" aria-label={`Take ${change.label}`} checked={props.ticked} onChange={(e) => props.toggle(e.currentTarget.checked)} />
        <span class="lres-chip">{change.kind}</span>
        <span class="lres-grow">{change.label}</span>
        <button type="button" class="lres-btn" onClick={toggleCompare}>
          {shown ? "Hide" : "Compare"}
        </button>
      </div>
      {problem ? <div class="lres-muted">{problem}</div> : null}
      {shown ? (
        <div class="lres-row" style={{ alignItems: "flex-start" }}>
          <div class="lres-grow">
            <div class="lres-muted">Now</div>
            {json(shown.before, "(not in the draft yet)")}
          </div>
          <div class="lres-grow">
            <div class="lres-muted">Proposed</div>
            {json(shown.after, "(removed)")}
          </div>
        </div>
      ) : null}
    </div>
  );
}
