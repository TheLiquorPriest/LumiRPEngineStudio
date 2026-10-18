# Converting chats and lore into a LumiRPEngine world

This guide is what the Studio's assistant works from, and what you can read to know what it does. A LumiRPEngine world is one JSON document (`lre-world-v1`). Collections are objects keyed by id, and each item's `id` repeats its key. Money is in integer minor units of the world's currency (cents for dollars), and times are ISO local date-times (`2026-09-14T18:30`). Kinds, fields, relation types, effects and formula functions are all in the reference (`reference_lookup`); this guide says how to use them for a conversion.

## The goal

A converted world starts where the story is now. When the chat attaches it, the engine begins at the chat's latest message: the POV stands where the story left them, the clock reads the story's present, balances are what they are today, people stand where they last were (the dead where they lie), everyone who has met the POV knows them, quests sit at the stage the story reached, and secrets the POV has learned are revealed on the first turn (see [Quests and secrets as tracks](#quests-and-secrets-as-tracks)). Nothing that already happened is replayed. The world only has to be true from now on.

## Working order

1. Read the sources first: skim the transcript from the start (`transcript_read` in ranges of 30 to 60), search it for names, places, money and dates (`transcript_search`), read the cards (`cards_read`) and list and read the lore (`lore_list`, `lore_search`, `lore_read`). Read the end of the chat closely: it is the present.
2. Decide the POV, the places and the cast before writing anything, then write in batches with `draft_patch`: places and routes, then people and their accounts, then relations, then tracks, lore, schedules, and last the start and calendar.
3. Run `draft_check` after each batch and fix every error. Keep ids stable: other items refer to them.
4. Finish with a short answer: what the world holds, what you assumed, what the user should look at.

## The POV

`pov` names the entity the player plays: the chat's user persona, the one the transcript calls "you" or the user's character. A new draft has a POV `you` at a place `home`; rename it by writing your own entity and setting `/pov` to its id (then remove `you`), or keep `you` and give it the real name. The POV is a `person` (or a kind that extends `person`) on a lead tier, and never capped by realism.

```json
{ "id": "rhea", "kind": "person", "name": "Rhea Valen", "tier": "principal", "fields": { "place": "salt_quay", "wealth": "modest" }, "relations": [] }
```

## People, tiers and classifications

- **Who goes in.** Everyone the story names who could matter again: a lead, a recurring face, someone owed money or a favor. Leave out passers-by; the engine introduces new people as the story does.
- **Tiers** say how deeply someone is simulated. The default tiers are `principal` (Leads), `supporting` and `background`. Put the POV and the people the story turns on in `principal`, recurring characters in `supporting`, shopkeepers and the like in `background`. Set `"agent": true` on someone who pursues their own goals off-screen (a rival, a schemer).
- **Fields** a person can carry (see `reference_lookup person`): `place` (where they are now), `home` (a place id), `activity` (what they're doing: "tending bar"), `wealth` (a band at Money 1: `broke`, `poor`, `modest`, `comfortable`, `rich` or `wealthy`), `occupation`, `employer`, and the sheet stats `might`, `agility`, `wits`, `charm`, `grit` (3 to 18) when the story gives them meaning. Description and personality belong in lore entries linked to the person, or in fields your own kind defines.
- **Your own kinds.** When the cast needs fields the packs don't define (a description, a role, an age), add a kind that extends `person` and use it for the cast:

```json
{ "id": "character", "label": "Character", "extends": "person", "fields": { "description": { "type": "text", "label": "Description" }, "role": { "type": "text", "label": "Role" } } }
```

- **Classifications** sort people for rules and for the GM: a facet with values, optionally nested. Keep a facet hidden (no `"shown": true`) when its values would spoil the story ("villain").

```json
{ "id": "role", "label": "Story role", "multiple": false, "values": { "ally": { "label": "Ally" }, "antagonist": { "label": "Antagonist" }, "villain": { "label": "Villain", "parent": "antagonist" } } }
```

An entity holds values in `class` (`"class": { "role": ["ally"] }`) and free tags in `tags`.

- **Groups** are entities of kind `group`, `faction`, `family`, `household` or `company`; members hold `{ "type": "member_of", "to": "harbor_guild", "fields": { "role": "Quartermaster" } }`.
- **Life and death.** Everyone is alive unless the story says otherwise; set each person's `life` as it is at the present. Someone the story left dying is `"dying"`, someone who died is `"dead"`. Keep the dead in the world, with `fields.place` where the body lies: it stays there to be found, and someone who doesn't act keeps no routine or plans, so give them no schedule. A state the story needs beyond those three goes in `/lifeStates` (`{ "unconscious": { "label": "Unconscious", "acts": false, "reads": "lies unconscious" } }`) and an entity names it in `life`; never redefine `alive`, `dying` or `dead`.

```json
{ "id": "old_bram", "kind": "person", "name": "Old Bram", "tier": "supporting", "life": "dead", "fields": { "place": "net_loft" }, "relations": [] }
```

- **Cues** are what the narrator sees someone do while a secret of theirs stays hidden. Each cue stands for exactly one secret: a secret `track` (while it hides something), a secret `lore` entry (until its gate holds) or a story `flag` (until it is set). Write behaviour, never the secret, and name no one the POV doesn't know.

```json
"cues": [{ "text": "Changes the subject whenever the guild comes up.", "track": "silas_debt" }]
```

## Places, routes and maps

- **Places** form a tree with `parent`: a region holds a town, a town its streets and buildings, a building its rooms. Give each a `name`, and a `fields.description` when the story describes it. A place the POV hasn't heard of yet gets `"visibility": "discoverable"`; a hidden one `"secret"`.

```json
{ "id": "salt_quay", "name": "Salt Quay", "parent": "port_veil", "fields": { "description": "Tar-black pilings and fish crates." } }
```

- **Routes** join places the story travels between, with minutes per mode (`walk`, `road`, `offroad`, `water`). Estimate from the story: a few minutes across a town, an hour on foot between villages.

```json
{ "id": "quay_to_market", "from": "salt_quay", "to": "market_row", "modes": { "walk": { "minutes": 6 } }, "bidirectional": true }
```

- **Maps** draw a place's inside. A grid map's `layout` rows use `#` for walls, `.` for floor, `+` for doors and legend letters for rooms; a node map lists `places` and `links`. Draw one only when the story's space matters (a house, a ship, a dungeon). A map owns the places, grid and routes it compiles: edit the map, never what it made. `guide_lookup map` and `reference_lookup lre-map` for the details.

## Money

- **The currency.** Set `/currency` when the story doesn't use US dollars: `{ "code": "GP", "symbol": "gp", "minorUnit": "copper", "decimals": 2, "format": "{sign}{amount} gp" }`. Amounts are always integer minor units.
- **At Money 1** a person's `wealth` band is all there is. Set it from how the story treats them.
- **Accounts** hold real balances (Money 2 and up): one entity per purse, wallet, bank account or card, owned by its holder. Its `opening` is the balance **now**, at the story's present, not when the story began. Read the transcript for the last mention of money: what they paid, what they were paid, what they have left.

```json
{ "id": "rhea_purse", "kind": "account", "name": "Rhea's purse", "tier": "background", "fields": { "owner": "rhea", "type": "cash", "opening": 4250 }, "relations": [] }
```

`type` is `cash`, `checking`, `savings`, `card`, `loan` or `brokerage`. A debt is a `loan` (or a `card`) whose opening is what is owed, as a negative amount.

## Calendar and the start

- `/start` is where and when play begins: `{ "place": "salt_quay", "at": "2026-09-14T18:30" }`, the POV's place and the story's present. Put the POV's `fields.place` at the same place.
- `/calendar/epoch` is the zero of the game clock: midnight of the start day, or earlier. Keep `timeZone` to the setting's (`America/New_York`, or `Etc/UTC` for an invented world).
- Read the present from the transcript: the last date, weekday, time of day or season it states, or what the events imply ("the next morning" after a night scene). If the story never says, pick a plausible date and say so.
- An invented calendar uses `"system": "custom"` with `custom: { monthLengths, monthNames, weekdayNames }`, and dates in its own years (`0412-08-25T07:30`).
- `dayParts` name the parts of the day (`{ "id": "morning", "label": "Morning", "start": "06:00" }`).

## Relations and regard

- **Regard** is how one person feels about another, one directed relation with three axes from −100 to 100: `warmth`, `trust` and `respect`. Write both directions when both matter; they differ more often than not. Calibrate from the story: 0 is a stranger, ±20 an acquaintance's lean, ±50 strong feeling, ±80 and beyond for the defining bonds and feuds.

```json
{ "type": "regard", "to": "rhea", "fields": { "warmth": 35, "trust": 10, "respect": 40 } }
```

- **Knowledge.** `{ "type": "knows", "to": "harbor_guild" }` on the POV marks what they know of: people they've met, places they've heard of, a secret they've learned. The POV knows everyone the chat has introduced to them.
- **Who knows the POV.** Everyone who has met the POV holds a `knows` toward the POV (`{ "type": "knows", "to": "rhea" }`), or a `regard` toward them. LumiRPEngine tells the narrator how each person present stands toward the POV, and reads someone with neither as a stranger ("Silas doesn't know you."), so a person the POV spent the chat with would greet them as one.
- **Kinship and bonds:** `parent_of`/`child_of` (each other's inverse), `sibling_of`, `spouse_of`, `partner_of` (symmetric). Write both sides.
- **Things** are where they are: `fields.place` for something lying somewhere, `{ "type": "in", "to": "rhea" }` for something carried. Whose a thing is lives in its `fields.owner` (the owner's id): that puts it on their gear, a vehicle in their garage, and lets them drive it. An `owns` relation only changes how the Journal words it, so set `fields.owner` on everything someone owns.

## Quests and secrets as tracks

A track is a small state machine: `start` names its first stage, and each stage's `next` lists `{ "to": stage, "when": formula }`. Formulas read the world: `at(pov, 'archive')`, `stage(track)`, `knows(pov, 'silas')`, `flag('vault_opened')`, `balance('rhea_purse') >= 5000`, `hour >= 18`. `reference_lookup formula` lists them all.

- **Quests** are what the POV is pursuing. Start the track at the stage the story has **reached**, not at its beginning; earlier stages can stay for completeness, but `start` is today's stage. Give that stage a `cue` (what the player knows now) and `objectives` (`{ "label": "Find the ledger", "when": "flag('ledger_found')" }`). A quest whose stage has no `next` is finished.

```json
{ "id": "lost_ledger", "kind": "quest", "label": "The lost ledger", "visibility": "public", "start": "searching", "stages": {
  "searching": { "label": "Searching the archive", "cue": "Silas swears the ledger left the archive in May.", "next": [{ "to": "found", "when": "flag('ledger_found')" }] },
  "found": { "label": "The ledger is found", "next": [] } } }
```

- **Secrets** are what the story hides. A secret track's stages carry a `cue` (what the POV can notice: the hint the narrator may use) and a `truth` (what is really so, kept from the player until the stage is reached). Cue versus truth is the whole point: the cue never states the truth. Secrets advance only by their conditions, so write conditions the story can meet. Give the person who keeps the secret a cue for it (see Cues above).

```json
{ "id": "silas_debt", "kind": "secret", "label": "What Silas owes", "visibility": "secret", "owner": "silas", "start": "rumor", "stages": {
  "rumor": { "label": "Something is off", "cue": "Silas flinches whenever the guild is mentioned.", "next": [{ "to": "known", "when": "at(pov, 'guild_office')" }] },
  "known": { "label": "Silas owes the guild", "truth": "Silas borrowed the guild's harbor dues to pay a gambling debt.", "next": [] } } }
```

- **A secret the POV has already learned** must still be revealed in play. A track starts with nothing revealed, and the engine records a reveal only when a stage is entered, so a track that starts on its truth stage stays hidden: the Journal never shows it, and the narrator is kept from saying what the player already knows. Start it one stage earlier instead, and make that stage move on at once: `"next": [{ "to": "known", "when": "true" }]`. The first turn enters the truth stage and reveals it. Never start a secret track on a stage that has a `truth`.

```json
{ "id": "silas_debt", "kind": "secret", "label": "What Silas owes", "visibility": "secret", "owner": "silas", "start": "rumor", "stages": {
  "rumor": { "label": "Something is off", "next": [{ "to": "known", "when": "true" }] },
  "known": { "label": "Silas owes the guild", "truth": "Silas borrowed the guild's harbor dues to pay a gambling debt.", "next": [] } } }
```

- **Puzzles** take attempts and answers; **agendas** are an agent's plans (`owner`, stages with `priority`).

## Lore entries with audiences

Lore is what the world knows, for the engine's helpers: places' histories, people's backgrounds, customs, factions. Convert each useful lore-book entry and each fact the chat established into an entry with a title, the text, `keys`, `aliases` (other names), `topics`, and `links` (the ids of the people and places it is about).

```json
{ "id": "lore_port_veil", "title": "Port Veil", "content": "A salt-trading port of nine thousand…", "keys": ["Port Veil", "the port"], "aliases": ["the Veil"], "topics": ["places"], "links": ["port_veil"] }
```

- `"visibility": "known_by"` keeps an entry to what the POV knows (they must know every linked person and place).
- A **secret** entry holds a secret itself: `"secret": true` with a `gate` formula (`"stage('silas_debt') == 'known'"`), and an `audience` listing the helpers that may read it before the gate opens (`npc.choose`, `contradiction`, `puzzle.answer`, `judge`, `interpret`). Never put `brief`, `outline`, `choices` or `extract` in an audience: what they write reaches the narrator.
- A public entry must never repeat a track's truth (lint error `secret_truth`).
- Keep macros (`{{user}}`, `{{char}}`) out of lore unless the source used them on purpose: the engine lists them for review on install.

## Schedules

Schedules give people routines: where they are (`target: "place"`) or what they do (`target: "activity"`) by time of day and weekday. The owner is an entity, a group, a kind or a selector. Base them on what the story shows ("the baker opens at dawn"); invent plausible ones for the rest of the cast only when it helps.

```json
{ "id": "mara_days", "owner": "mara", "target": "place", "recurrence": { "every": "week", "weekdays": [1, 2, 3, 4, 5] },
  "slots": [{ "start": "06:00", "end": "14:00", "value": "bakery" }, { "start": "14:00", "end": "22:00", "value": "mara_house" }] }
```

## Realism and the rest

- `/realism` sets how much is simulated per domain (0 to 4): Story keeps most at 1 and Space and Calendar at 2. Raise Money to 2 when the story tracks cash, Relationships when feelings drive it. A chat can change levels later.
- Rules (`when this happens, do that`), actions, checks and a ruleset are optional; add them when the story has mechanics the player will use again (a skill check to pick locks, a curfew rule).

## Refining a world in play

When the source chat already plays a world (`chat_state` says so), the draft starts from that world's head and becomes its **next revision**; the chat keeps running on its revision until the player chooses Upgrade in LumiRPEngine (**Settings → Pins and upgrade**), which shows every change and lets them take or keep each one. So:

- Keep every id the chat uses. Renaming an id makes a new thing and strands the old one.
- Add what the story introduced since the world was made: new people, places, quests, lore.
- Fix definitions (a name, a description, a tier) freely; for state the chat has moved on (where someone is, a balance, a quest's stage), the Upgrade keeps the chat's value by default, which is usually right.
- Don't remove what the chat still uses: the Upgrade keeps removed people unless the player picks Remove.
- Install it as **a new revision** of the same world.

## Before finishing

- `draft_check` has no errors.
- The POV exists, stands at the start place, and the start time is the story's present.
- Every id an item names (a place, an owner, a relation target, a track in a formula) exists.
- Everyone who has met the POV holds a `knows` or a `regard` toward them.
- Each person's `life` is their state at the present, and the dead and dying are at the place they lie.
- Everything someone owns names them in `fields.owner`.
- Openings are today's balances, and quests start at the stage the story reached.
- No secret track starts on a stage with a `truth`: a secret the POV has learned starts one stage earlier, moving on `when: "true"`, so the first turn reveals it.
- No public text gives a secret away, and no cue states the secret it stands for.
