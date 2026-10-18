# LumiRPEngine Studio

An assistant for [LumiRPEngine](https://github.com/TheLiquorPriest/LumiRPEngine) worlds, as a [Lumiverse](https://lumiverse.chat) extension. It builds a world from scratch, and above all it converts a chat you are already in, with its character cards and lore books, into a complete LumiRPEngine world whose start is the story's present: the POV, the people with their tiers, places and routes, money with today's balances, the calendar set to the story's "now", relations and regard, quests and secrets as tracks, lore with its audiences, and schedules. It also refines a world a chat already plays, as a new revision you then Upgrade in LumiRPEngine.

Nothing is installed without you: the assistant's changes wait for your review in the Studio, and LumiRPEngine shows you what the Studio offers and installs it only when you tap **Install** there.

## Install in Lumiverse

1. In Lumiverse, open **Extensions**, tap **Add Extension** and choose **Install from Source**.
2. Enter `https://github.com/TheLiquorPriest/LumiRPEngineStudio` and install. The built files (`dist/`) are in the repository.
3. Grant the permissions below. LumiRPEngine itself must be installed and enabled for Install and for starting from one of your worlds; everything else works without it.

| Permission | Why |
|---|---|
| `generation` | The assistant's model calls, with tools, on the connection you pick, and the list of your connections |
| `chats` | Finding the chat you have open, checking a chat is yours before reading it, the books attached to it, and reading LumiRPEngine's summary of your world chats |
| `chat_mutation` | Reading a chat's messages: the transcript the assistant converts. The Studio never writes to a chat |
| `characters` | Reading character cards (description, personality, scenario, greetings) and the books attached to them |
| `world_books` | Reading your lore books: those attached to the chat, its characters and globally, or ones you pick |
| `personas` | Reading your active persona (who you play in the chat, usually the world's POV) and the lore book attached to it |

The drawer tab and the link to LumiRPEngine (its shared RPC endpoints and window events) need no permission.

## Use it

1. Open the **RPEngine Studio** tab in the drawer. The top line says which LumiRPEngine it found.
2. Pick the assistant's connection (your active one by default) and how many model calls one message may take.
3. **New draft**, then where it starts:
   - **This chat**: the open chat's transcript, its character cards and the lore that applies to it (the chat's books, its characters', your persona's and your global ones). LumiRPEngine's own section books are left out. Your active persona comes in too, as a card of its own. If the chat already plays a LumiRPEngine world, the draft starts from that world as it is now, to refine it.
   - **A character**: a card and its lore.
   - **Lore books**: books you pick.
   - **Blank**: nothing but what you tell it.
   - **A LumiRPEngine world**: one of your worlds, at its latest revision. When the open chat plays that world, the draft also reads the chat and LumiRPEngine's view of where the story stands (place, time, cash, who's present, open quests).

   You can add pasted text to any draft (setting notes, a history, character sheets).
4. Talk to the assistant: "Convert this chat into a world whose start is the story's present." It reads the transcript and the lore, writes the world piece by piece and checks it with LumiRPEngine's own lint. Each tool it uses shows as a line; **Stop** stops it.
5. **Review** what it proposes: every person, place, quest, lore entry or part it added, changed or removed, with the engine's problem count. **Compare** shows an item as the draft holds it beside what the assistant proposes. Untick what you don't want, then **Accept**, or **Discard** it all. Only accepted changes reach the draft.
6. The draft shows its counts per collection, its problems, and any item's JSON.
7. Actions:
   - **Validate** checks the draft as LumiRPEngine will.
   - **Export file** saves an `lre-world-export-v1` file; **Import file** starts a draft from one.
   - **Install as new world**, **Install and attach to this chat** and **Install as new revision** (of the world the draft came from or was installed as, or one you pick) offer the accepted draft to LumiRPEngine. Its Build tab opens on the offer: what it is, what it holds, its problems and macros. Tap **Install** there. A new world installs as an import does; a revision lands on its world, whose chats stay on their revisions until you Upgrade them in **Settings → Pins and upgrade**. With **attach**, LumiRPEngine asks whether to attach the new world to the open chat, starting from its current message. One offer waits at a time: a new one replaces the last, and **Withdraw** takes it back. If the world changed in Build since the draft was taken from it, LumiRPEngine warns you, and **Install** becomes **Install anyway**.

Drafts are kept per user in the Studio's own storage, with their conversations. A draft with errors, or with changes still waiting for review, can't be installed.

## Known limits

- **Reasoning on other providers.** A thinking model that calls tools needs its reasoning sent back with the next call. Lumiverse's quiet generation with tools carries only DeepSeek's kind (`reasoning_content`); it drops Anthropic's thinking blocks and OpenRouter's `reasoning_details`, so the Studio can't send those back. With Anthropic extended thinking on, or an OpenRouter reasoning model, the assistant's second model call fails. DeepSeek works; for the others, turn thinking off on the connection the Studio uses.

## How it fits LumiRPEngine

The Studio uses LumiRPEngine's studio API (`lumi-rp-engine/studio`, bundled into `dist/backend.js`) to make, migrate, lint and export worlds, so a world checks the same in both. The two extensions meet through Lumiverse's shared RPC pool, as LumiRPEngine's [`docs/STUDIO.md`](https://github.com/TheLiquorPriest/LumiRPEngine/blob/main/docs/STUDIO.md) ("The Studio bridge") defines: LumiRPEngine publishes, per user, your worlds and its view of your world chats, readable only by the Studio; the Studio publishes your pending offer, readable only by LumiRPEngine. A read there carries no request, so neither side can make the other do anything: you confirm every install in LumiRPEngine.

The assistant works from [`docs/ASSISTANT-GUIDE.md`](docs/ASSISTANT-GUIDE.md), the conversion guide, which is also the heart of its instructions, and looks things up in LumiRPEngine's reference (`assets/REFERENCE.md`).

## Development

```bash
bun install
bun test                     # the suite, on a fake host: no network, no models
bunx tsc --noEmit -p .       # types
bun run build                # dist/backend.js and dist/frontend.js
bun run reference            # copy the pinned engine's REFERENCE.md to assets/ (`-- --check` to compare)
```

- LumiRPEngine is a pinned Git dependency (`github:TheLiquorPriest/LumiRPEngine#<sha>`). Its authoring API (`lumi-rp-engine/studio`) comes in through `src/engine.ts`, in the backend only. After moving the pin, run `bun run reference` and the suite.
- The bridge's names and payloads are the pinned engine's, as its STUDIO.md defines them: the backend imports them from `lumi-rp-engine/studio`, and the frontend from `lumi-rp-engine/studio-bridge`, which holds the contract alone, so the frontend doesn't bundle the engine.
- `src/backend/host.ts` is the port to Lumiverse; `src/backend/spindle-host.ts` implements it over `spindle`, and `test/support/fake-host.ts` in memory, with `test/support/fake-engine.ts` playing LumiRPEngine's side of the bridge.
