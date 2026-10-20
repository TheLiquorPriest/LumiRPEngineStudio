# Converting chats and lore into a LumiRPEngine world

This guide is what the Studio's assistant works from, and what you can read to know what it does. A LumiRPEngine world is one JSON document (`lre-world-v1`). Collections are objects keyed by id, and each item's `id` repeats its key. Money is in integer minor units of the world's currency (cents for dollars), and times are ISO local date-times (`2026-09-14T18:30`). Kinds, fields, relation types, effects and formula functions are all in the reference (`reference_lookup`); this guide says how to use them for a conversion.

## The goal

A converted world starts where the story is now. When the chat attaches it, the engine begins at the chat's latest message: the POV stands where the story left them, the clock reads the story's present, balances are what they are today, people stand where they last were (the dead where they lie), everyone who has met the POV knows them, quests sit at the stage the story reached, and secrets the POV has learned are revealed on the first turn (see [Quests and secrets as tracks](#quests-and-secrets-as-tracks)). Nothing that already happened is replayed. The world only has to be true from now on.

## Working order

1. Read the sources first: skim the transcript from the start (`transcript_read` in ranges of 30 to 60), search it for names, places, money and dates (`transcript_search`), read the cards (`cards_read`) and list and read the lore (`lore_list`, `lore_search`, `lore_read`). Read the end of the chat closely: it is the present.
2. Decide the POV, the places and the cast before writing anything, then write in batches with `draft_patch`: places and routes, then people, then their money (accounts, flows, jobs), then relations, then tracks, lore, schedules, and last the start and calendar.
3. Run `draft_check` after each batch and fix every error. Keep ids stable: other items refer to them.
4. Finish with a short answer: what the world holds, what you assumed, what the user should look at.

## The POV

`pov` names the entity the player plays: the chat's user persona, the one the transcript calls "you" or the user's character. A new draft has a POV `you` at a place `home`; rename it by writing your own entity and setting `/pov` to its id (then remove `you`), or keep `you` and give it the real name. The POV is a `person` (or a kind that extends `person`) on a lead tier, and never capped by realism.

```json
{ "id": "rhea", "kind": "person", "name": "Rhea Valen", "tier": "principal", "fields": { "place": "salt_quay", "wealth": "modest" }, "relations": [] }
```

## People, tiers and classifications

- **Who goes in.** Everyone the story names who could matter again: a lead, a recurring face, someone owed money or a favor. Leave out passers-by; the engine introduces new people as the story does.
- **Tiers** say how deeply someone is simulated. The default tiers are `principal` (Leads), `supporting` and `background`. Put the POV and the people the story turns on in `principal`, recurring characters in `supporting`, shopkeepers and the like in `background`. Set `"agent": true` on someone who pursues their own goals off-screen (a rival, a schemer). From Cast life 3 (`castlife` in `/realism/levels`), an agent also lives the plans their mind makes (to go somewhere, to meet someone); anyone else keeps to their schedules, and their mind's plans lapse. A mind's plan to pay or lend someone money is paid either way, from the character's own money.
- **Fields** a person can carry (see `reference_lookup person`): `place` (where they are now), `home` (a place id), `activity` (what they're doing: "tending bar"), `wealth` (a band at Money 1: `broke`, `poor`, `modest`, `comfortable`, `rich` or `wealthy`), `occupation`, and the sheet stats `might`, `agility`, `wits`, `charm`, `grit` (3 to 18) when the story gives them meaning. What someone earns is a job (see [Money](#money)). Who someone is goes in fields of their own kind (below): a character's mind reads their entity's fields, never their character card, so move a card's description, personality and manner there. History and background can also go in lore entries linked to them.
- **Your own kinds.** When the cast needs fields the packs don't define (a description, a role, an age), add a kind that extends `person` and use it for the cast:

```json
{ "id": "character", "label": "Character", "extends": "person", "fields": { "description": { "type": "text", "label": "Description" }, "role": { "type": "text", "label": "Role" }, "traits": { "type": "list", "of": "text", "label": "Traits" } } }
```

- **Classifications** sort people for rules and for the GM: a facet with values, optionally nested. Keep a facet hidden (no `"shown": true`) when its values would spoil the story ("villain").

```json
{ "id": "role", "label": "Story role", "multiple": false, "values": { "ally": { "label": "Ally" }, "antagonist": { "label": "Antagonist" }, "villain": { "label": "Villain", "parent": "antagonist" } } }
```

An entity holds values in `class` (`"class": { "role": ["ally"] }`) and free tags in `tags`.

- **Groups** are entities of kind `group`, `faction`, `family`, `household` or `company`; members hold `{ "type": "member_of", "to": "harbor_guild", "fields": { "role": "Quartermaster" } }`. A `household` can also hold money and share its bills (see [Money](#money)).
- **Life and death.** Everyone is alive unless the story says otherwise; set each person's `life` as it is at the present. Someone the story left dying is `"dying"`, someone who died is `"dead"`. Keep the dead in the world, with `fields.place` where the body lies: it stays there to be found, and someone who doesn't act keeps no routine or plans, so give them no schedule. A state the story needs beyond those three goes in `/lifeStates` (`{ "unconscious": { "label": "Unconscious", "acts": false, "reads": "lies unconscious" } }`) and an entity names it in `life`; never redefine `alive`, `dying` or `dead`. When the POV hasn't learned of a death or a dying, set `lifeKnownBy` to the ids of the people who know, including everyone who starts in the same place as the body; everyone else, the POV too, takes the person for alive until they see it or are told. Leaving `lifeKnownBy` out (or empty) means everyone knows, which tells the player; when nobody else knows yet, list the person themself. Old Bram here died in the net loft, and only Silas knows:

```json
{ "id": "old_bram", "kind": "person", "name": "Old Bram", "tier": "supporting", "life": "dead", "lifeKnownBy": ["silas"], "fields": { "place": "net_loft" }, "relations": [] }
```

- **Cues** are what the narrator sees someone do while a secret of theirs stays hidden. Each cue stands for exactly one secret: a secret `track` (while it hides something), a secret `lore` entry (until its gate holds) or a story `flag` (until it is set). Write behaviour, never the secret, and name no one the POV doesn't know.

```json
"cues": [{ "text": "Changes the subject whenever the guild comes up.", "track": "silas_debt" }]
```

## Character minds

A character can have a **mind**: a model call made as that character alone, from what they know (their entity's fields, the lore they may read, the turns they were there for, their notes and commitments, their money and their day, and their own secrets whole), which answers with their private read of the moment and what they intend, for the narrator to depict. Minds are blind to each other, and a mind reads its character's fields, never a character card, so write who each person is into their fields (see [your own kinds](#people-tiers-and-classifications)). What a mind plans is lived only by an agent (see Tiers there).

Each turn a focus score puts each character on a ladder: **Live** (a mind every turn), **Near** and **Far** (a mind on their refresh) or **Background** (routine only). The score counts being in the POV's scene or close by, being named, a relation with the POV, a stake in tracks and rules under way, plans with the POV, and the person's tier. The world tunes it in `/minds`; every part is optional, and one left out reads as its default:

```json
{ "secrecy": "brief", "weights": { "mentioned": 50 }, "thresholds": { "live": 60, "near": 35, "far": 15 }, "always": { "ids": ["silas"] }, "never": { "tag": ["crowd"] }, "memory": { "notes": { "show": 10, "keep": 30 }, "salience": { "halfLifeDays": 14 } } }
```

- `secrecy` decides what reaches the narrator. `brief` (the default) gives only what anyone present could see, withheld where it would give away a secret or a name the POV can't know; `full` gives the character's thoughts and intent too. A mind knows its own character's secrets, so keep `brief` unless no one has a secret they would think about.
- `weights` are the points each input adds, from −100 to 200 (`here` 45, `nearby` 20, `mentioned` 40, `regard` 10, `knows` 10, `owner` 15, `track` 8, `rule` 5, `pending` 15, `recent` 10, `band` per tier band, and `roles` per classification value, `antagonist` 20 by default); `thresholds` are the lowest scores for Live, Near and Far (60, 35 and 15). Only someone in the POV's scene or named this turn is ever Live: anyone else, close by or not, is Near at most, whatever their score.
- `always` and `never` are selectors (`ids`, `kind`, `tier`, `memberOf`, `tag`, `class`): `always` keeps someone Live wherever they are, and `never` keeps them in the background without a mind, winning over `always`. Name only ids, kinds, tiers, groups and classification values the world has.
- `memory` sets what a mind is shown and how long a note lasts: `notes.show` (8) and `notes.keep` (24 before the oldest fold into a summary), `witness.show`, `recall`, `commitments.show`, `salience.halfLifeDays` (7 game days) and `consolidate`.

The defaults suit most worlds: pin the people the story turns on with `always`, and keep crowds out with `never`. A world can give minds its own voice with a step template in `/steps` of purpose `mind`, `memory`, `skip` or `consolidate`, one per purpose: `"output": "text"`, `"signals": []`, and a `template` holding the step's instructions only, where `{{character}}` is the character's name and `{{world}}` the world's. The engine adds the answer's format itself, so write how to think, never the JSON.

```json
{ "id": "mind_port_veil", "purpose": "mind", "output": "text", "signals": [], "template": "You are the private mind of {{character}} in {{world}}, a salt port where debts outlive names. Think as {{character}}, from only what they know below. Decide how they read this moment and what they intend; never script anyone else." }
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

Money is entities, a few fields and the economy pack's config. Amounts are whole minor units of the world's currency (4250 is $42.50) and percentages are percent units (22 is 22 %). Write money only in the shapes below: a `bills` list, a single `owner` or a `type` on an account, pay fields on a person (`hourly_cents`, `payday`, `deposit_to`) and `units` of a `symbol` on a brokerage account are older shapes, which `draft_check` warns about (`migrated`).

- **The currency.** Set `/currency` when the story doesn't use US dollars: `{ "code": "GP", "symbol": "gp", "minorUnit": "copper", "decimals": 2, "format": "{sign}{amount} gp" }`.
- **How much runs** is `/realism/levels/money`, capped by a person's tier (never the POV's). At 1 a person's `wealth` band is all there is: set it from how the story treats them. At 2 their cash and one everyday account are real, and a payment they can't cover is declined. From 3 all their accounts run, with flows, cards, payment preferences, household shares, living costs, withholding on pay and property; from 4 statements, interest, fees, late payments, credit scores, cash only at a machine or a branch, holds, daily card limits, overdraft policies, tax brackets, sales and business tax and investments. A new draft is at 1: raise it to 2 when the story counts cash, and to 3 when it has wages, rent, cards or property.
- **The economy config.** A new draft has no `/packs/economy`: add it whole once, `{ "version": 1, "config": {} }`. Its config holds `products` (the world's own account products), `features` (a feature switched on or off for this world by its id, `{ "flows": true }`: from Money 2 for `flows`, `cards`, `payment_prefs`, `households`, `living_costs`, `atm`, `daily_limits` and `overdraft`, from Money 3 for the rest), `assets` (what holdings are in), `region` (the world's region, a row of the regions data table such as `mi`, which sets its tax rates and cost of living) and `taxes` (`exempt`, the categories no sales tax falls on, and `corporatePct`). Add a map whole the first time (`/packs/economy/config/products` with its first product in it), then each further entry by its own path (`/packs/economy/config/products/<id>`): adding the whole map again replaces it, and every entry in it.
- **Who owns money.** A party is a person, or an entity of kind `business`, `trust` or `household`. Every account, business, holding and property lists its holders in `fields.owners`, each `{ "party": "rhea", "role": "owner" }`: `owner` and `joint` spend, manage and count it; `authorized_user` only spends; `custodian` and `trustee` spend and manage it for a `beneficiary`, who counts it. A `share` (a percent) divides its worth between the holders who count it; given by none, they share equally.

### Accounts and cards

An `account` is one purse, wallet, bank account, card account, loan or investment account: `owners`, `product`, `institution` (the bank's name) and `opening`, the balance **now**, at the story's present, from the holder's side (a debt is negative). Read the transcript for the last mention of money: what they paid, what they were paid, what they have left.

```json
{ "id": "rhea_checking", "kind": "account", "name": "Rhea's checking", "tier": "background", "fields": { "owners": [{ "party": "rhea", "role": "owner" }], "product": "checking", "institution": "Harbor Savings", "opening": 182000 }, "relations": [] }
```

`product` is a class, each a built-in product (`cash`, `checking`, `business_checking`, `savings`, `money_market`, `cd`, `trust`, `escrow`, `credit_card`, `charge_card`, `line_of_credit`, `loan`, `mortgage`, `brokerage`, `retirement`), or one of the world's own products by id: a `class` with its terms (`label`, `institution`, `limit`, `apr_pct`, `apy_pct`, …). An account's own `limit`, `apr_pct`, `apy_pct`, `statement_day`, `due_day`, `payment`, `months_left` and `overdraft` win over its product's, and `autopay` (`minimum`, `statement`, `full` or `fixed`) with `autopay_from` pays a credit account by itself:

```json
"products": { "harbor_visa": { "label": "Harbor Savings Visa", "class": "credit_card", "institution": "Harbor Savings", "limit": 300000, "apr_pct": 21.9 } }
```

```json
{ "id": "rhea_visa", "kind": "account", "name": "Harbor Visa", "tier": "background", "fields": { "owners": [{ "party": "rhea", "role": "owner" }], "product": "harbor_visa", "opening": -12500, "autopay": "statement", "autopay_from": "rhea_checking" }, "relations": [] }
```

A **card** is an entity of its own, kind `card`: the `account` it draws on, its `holder` (one of that account's owners; an `authorized_user` holds a card on someone else's account), `network` (`debit`, `credit` or `charge`), `state` (`active`, `frozen`, `lost` or `cancelled`) and optionally `item`, the card in the holder's gear.

```json
{ "id": "rhea_debit", "kind": "card", "name": "Rhea's debit card", "tier": "background", "fields": { "account": "rhea_checking", "holder": "rhea", "network": "debit" }, "relations": [] }
```

### Flows

A **flow** is every scheduled or one-off movement of money: rent, a bill, a transfer to savings, an allowance, a loan payment, income from outside. Each is an entity of kind `flow`:

- `flow_kind`: `transfer`, `bill`, `rent`, `utility`, `subscription`, `premium`, `loan_payment`, `card_payment`, `savings`, `income`, `payroll`, `allowance`, `living`, `tax`, `distribution`, `invoice`, `draw` or `other`.
- `from` and `to`: an account; a party (paying as their preferences choose, or paid into their account); or an outside payer or payee in words (`"Harbor Lets"`). An id-shaped word that names no entity (`rhea_chequing`) draws a warning: it is read as an outside party, so the money would come from or go to nowhere.
- The amount, the first of `amount_cents`, `amount_formula`, `amount_table`, `amount_min` with `amount_max` (a draw between them), `amount_pct` of `amount_of`'s balance, and `amount_due` (`minimum`, `statement` or `balance` of the credit account it pays).
- When: `every` (`day`, `week`, `month` or `year`) with `interval` (biweekly is `week` with 2), `weekdays` (0 is Sunday), `days` of the month (−1 is the last) and `months`, at `at` (`HH:MM`); or `once`, a local date-time. `start`, `end` and `count` bound it.
- `shortfall`, when the money isn't there: `skip` (the default), `partial`, `retry` (after `retry_days`, up to `retries` times), `fallback` (from `fallback`: another account the payer may spend from, by id; nothing else is drawn on, and a `fallback` that isn't in the world is an error), `overdraft` or `defer`.
- `link` ties it to what it belongs to (a property, a job, a loan), `splits` sends parts elsewhere, and `shares` splits a household's flow between its members.

```json
{ "id": "rhea_boat_fund", "kind": "flow", "name": "Boat fund", "tier": "background", "fields": { "flow_kind": "savings", "from": "rhea_checking", "to": "rhea_savings", "amount_cents": 4000, "every": "week", "interval": 2, "weekdays": [5] }, "relations": [] }
```

A **household** (kind `household`, its members holding `member_of` toward it) is a party too. Where household shares run (Money 3, or from 2 with `households` switched on), a flow from it with `shares` has each member pay their percent from their own money; below that, its payer pays it whole. This one is also a **lease**: a `rent` flow from the tenants to the owner, `link`ed to the property.

```json
{ "id": "valen_rent", "kind": "flow", "name": "Rent on the Valen flat", "tier": "background", "fields": { "flow_kind": "rent", "from": "valen_household", "to": "silas", "amount_cents": 140000, "every": "month", "days": [1], "shares": [{ "party": "rhea", "pct": 60 }, { "party": "teo", "pct": 40 }], "shortfall": "retry", "retry_days": 3, "retries": 2, "link": "valen_flat_property" }, "relations": [] }
```

### Work, business and tax

A **job** is one person's employment, kind `job`: `worker`; `employer` (a business entity, a place, or an outside employer in words; an id-shaped one that names no one and no place draws a warning); `workplace`; `title`; `basis` (`salary`, `hourly`, `per_shift`, `commission`, `tips` or `stipend`) with `rate` (a year's salary, the hourly rate or the pay per shift); and `pay_every`: `weekly` or `biweekly` (on `pay_weekday`, or counted from the first payday, `pay_anchor`), `semimonthly` or `monthly` (on `pay_days`), `per_job` or `custom`. `hours` says what hourly and per-shift pay count: `scheduled` (the worker's scheduled shifts at the workplace), `attended` (the shifts the POV turns up for) or `contract` (`hours_per_week` or `shifts_per_week`); left out, it is `attended` for the POV and `scheduled` for anyone else with a routine at the job, else `contract`. `splits` sends pay across the worker's accounts, a `contractor` has nothing withheld, and `season_from` and `season_to` (`MM-DD`), `start` and `end` bound it.

```json
{ "id": "rhea_pilot_job", "kind": "job", "name": "Harbor pilot", "tier": "background", "fields": { "worker": "rhea", "employer": "Port Veil Pilots", "workplace": "salt_quay", "title": "Harbor pilot", "basis": "hourly", "rate": 3800, "hours": "contract", "hours_per_week": 30, "pay_every": "biweekly", "pay_anchor": "2026-09-18" }, "relations": [] }
```

A **business** is kind `business`: `owners`, the `places` it trades at (a purchase there pays it), its `operating_account` (an account it owns), `collects_sales_tax`, `margin_pct`, and what it pays its owners (`distribution_pct`, `distribution_every`). Its Money level is its tier's cap, as a person's is, so put it on the `principal` tier for all of it to run (sales tax and business taxes need Money 4). An **invoice** it is owed is kind `invoice`: `business`, `customer` (a party, or an outside customer in words), `cents`, `memo`, `issued`, `due` and `state` (`open`, `paid`, `late` or `void`).

```json
{ "id": "chandlery", "kind": "business", "name": "Net Loft Chandlery", "tier": "principal", "fields": { "owners": [{ "party": "silas", "role": "owner" }], "places": ["net_loft"], "operating_account": "chandlery_checking", "collects_sales_tax": true }, "relations": [] }
```

```json
{ "id": "chandlery_invoice_rhea", "kind": "invoice", "name": "Rope and fittings", "tier": "background", "fields": { "business": "chandlery", "customer": "rhea", "cents": 18000, "memo": "Rope and fittings", "issued": "2026-09-01", "due": "2026-10-01", "state": "open" }, "relations": [] }
```

**Tax** reads a person's `filing_status` (`single`, `married_filing_jointly` or `head_of_household`) and `local_tax`, and their own `region` field for income tax, else the config's `region`; sales tax reads a place's `sales_tax_pct`, `tax_region` and `tax_exempt` (categories), or an enclosing place's, else the config's `region` and `taxes`. With no region anywhere, the national row's rates apply.

### Holdings and property

An **asset** is defined once, in `/packs/economy/config/assets` by id: `label`, `class` (`security`, `fund`, `bond`, `option`, `property`, `business_stake`, `crypto` or `other`), an optional `symbol`, its `price` per unit at the start, and how it moves and pays (`annual_return_pct`, `annual_volatility_pct`, `yield_pct`). A **holding**, kind `holding`, is a position in one asset: in an `account` (a `brokerage` or `retirement` one) or held directly by its `owners`, with `lots` (each `qty`, its total `cost` and when it was bought, `at`) and `route` for what it pays out (an account id, or `reinvest`).

```json
"assets": { "glix": { "label": "Great Lakes Index Fund", "class": "fund", "symbol": "GLIX", "price": 11240, "yield_pct": 1.6 } }
```

```json
{ "id": "rhea_glix", "kind": "holding", "name": "Great Lakes Index Fund", "tier": "background", "fields": { "account": "rhea_brokerage", "asset": "glix", "lots": [{ "qty": 20, "cost": 196000, "at": "2025-03-02" }], "route": "reinvest" }, "relations": [] }
```

A **property**, kind `property`, is real estate tied to a `place`: `owners`, its `value` now, `appreciation_pct` a year, `purchase_price` and `purchased`, and its upkeep (`tax_pct` of value a year, `insurance` a month, `upkeep_pct` a year). A **mortgage** is an account of product `mortgage` whose `secured_by` names the property, and the property's `mortgage` names the account back.

```json
{ "id": "valen_flat_property", "kind": "property", "name": "The Valen flat", "tier": "background", "fields": { "place": "valen_flat", "owners": [{ "party": "silas", "role": "owner" }], "value": 18500000, "appreciation_pct": 3, "mortgage": "silas_mortgage" }, "relations": [] }
```

```json
{ "id": "silas_mortgage", "kind": "account", "name": "Mortgage on the Valen flat", "tier": "background", "fields": { "owners": [{ "party": "silas", "role": "owner" }], "product": "mortgage", "opening": -9200000, "payment": 98000, "months_left": 214, "secured_by": "valen_flat_property" }, "relations": [] }
```

### Paying

- **`pay_prefs`**, a person field, orders how they pay: tiers of `use` (`cash`, `debit`, `credit`, `charge`, `checking`, `savings`, or a card or account id), each for amounts from `min` to `max` and for `categories`, but not those in `except`. Left out, they follow the person's wealth band and `traits`: a frugal or careful person keeps to cash and debit longer, an impulsive or flashy one reaches for credit first.

```json
"pay_prefs": [{ "use": "cash", "max": 2000 }, { "use": "debit", "max": 50000 }, { "use": "rhea_visa", "categories": ["travel"] }]
```

- **Cash machines and branches** are place fields: `atm`, `{ "bank": "Harbor Savings", "fee": 300, "limit": 40000 }` (`fee` the machine's own charge, `limit` the most one withdrawal takes, `deposits` whether it takes them), and `branch`, `{ "bank": "Harbor Savings" }`, a counter where that bank's customers withdraw and deposit. `bank` is the institution as the accounts name it. Where cash machines run (Money 4, or from 2 where the world switches `atm` on), cash comes out and goes in only at one of the two, and only once the world places at least one `atm` or `branch`: place none and cash moves freely at every level.

## Calendar and the start

- `/start` is where and when play begins: `{ "place": "salt_quay", "at": "2026-09-14T18:30" }`, the POV's place and the story's present. Put the POV's `fields.place` at the same place.
- `/calendar/epoch` is the zero of the game clock: midnight of the start day, or earlier (with an invented calendar, exactly the start day). Keep `timeZone` to the setting's (`America/New_York`, or `Etc/UTC` for an invented world).
- Read the present from the transcript: the last date, weekday, time of day or season it states, or what the events imply ("the next morning" after a night scene). If the story never says, pick a plausible date and say so.
- An invented calendar uses `"system": "custom"` with `custom: { monthLengths, monthNames, weekdayNames }`, and dates in its own years (`0412-08-25T07:30`). Set its `epoch` to midnight of the start's own day (`0412-08-25T00:00`): LumiRPEngine counts the start's clock from the epoch as an ordinary calendar would, so any day between them would shift the date the player sees in the invented months.
- `dayParts` name the parts of the day (`{ "id": "morning", "label": "Morning", "start": "06:00" }`).

## Relations and regard

- **Regard** is how one person feels about another, one directed relation with three axes from −100 to 100: `warmth`, `trust` and `respect`. Write both directions when both matter; they differ more often than not. Calibrate from the story: 0 is a stranger, ±20 an acquaintance's lean, ±50 strong feeling, ±80 and beyond for the defining bonds and feuds.

```json
{ "type": "regard", "to": "rhea", "fields": { "warmth": 35, "trust": 10, "respect": 40 } }
```

- **Knowledge.** `{ "type": "knows", "to": "harbor_guild" }` on the POV marks what they know of: people they've met, places they've heard of, a secret they've learned. The POV knows everyone the chat has introduced to them.
- **Who knows the POV.** Everyone who has met the POV holds a `knows` toward the POV (`{ "type": "knows", "to": "rhea" }`), or a `regard` toward them. LumiRPEngine tells the narrator how each person present stands toward the POV, and reads someone with neither as a stranger ("Silas doesn't know you."), so a person the POV spent the chat with would greet them as one.
- **Kinship and bonds:** `parent_of`/`child_of` (each other's inverse), `sibling_of`, `spouse_of`, `partner_of` (symmetric). Write both sides.
- **Things** are where they are: `fields.place` for something lying somewhere, `{ "type": "in", "to": "rhea" }` for something carried. Whose a thing is lives in its `fields.owner` (the owner's id): that puts it on their gear, a vehicle in their garage, and lets them drive it. An `owns` relation only changes how the Journal words it, so set `fields.owner` on everything someone owns. Money is owned differently, through `owners` (see [Money](#money)).

## Quests and secrets as tracks

A track is a small state machine: `start` names its first stage, and each stage's `next` lists `{ "to": stage, "when": formula }`. Formulas read the world: `at(pov, 'archive')`, `stage(track)`, `knows(pov, 'silas')`, `flag('vault_opened')`, `balance('rhea_purse') >= 5000`, `hour >= 18`. `reference_lookup formula` lists them all.

- **Quests** are what the POV is pursuing. Start the track at the stage the story has **reached**, not at its beginning; earlier stages can stay for completeness, but `start` is today's stage. Give that stage a `cue` (what the player knows now) and `objectives` (`{ "label": "Find the ledger", "when": "flag('ledger_found')" }`). A quest whose stage has no `next` is finished.

```json
{ "id": "lost_ledger", "kind": "quest", "label": "The lost ledger", "visibility": "public", "start": "searching", "stages": {
  "searching": { "label": "Searching the archive", "cue": "Silas swears the ledger left the archive in May.", "next": [{ "to": "found", "when": "flag('ledger_found')" }] },
  "found": { "label": "The ledger is found", "next": [] } } }
```

- **Secrets** are what the story hides. A secret track's stages carry a `cue` (what the POV can notice: the hint the narrator may use) and a `truth` (what is really so, kept from the player until the stage is reached). Cue versus truth is the whole point: the cue never states the truth. Secrets advance only by their conditions, so write conditions the story can meet. Give the person who keeps the secret a cue for it (see Cues above), and make them the track's `owner`: the owner's mind, and the mind of anyone with a cue that stands for it, knows its truths whatever the player has found out.

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
- A **secret** entry holds a secret itself: `"secret": true` with a `gate` formula (`"stage('silas_debt') == 'known'"`), and an `audience` listing the helpers that may read it before the gate opens (`npc.choose`, `contradiction`, `puzzle.answer`, `judge`, `interpret`). Never put `brief`, `outline`, `choices` or `extract` in an audience: what they write reaches the narrator. Name in `holders` the people whose own secret it is: their minds read it, gate or no gate, and so does the mind of anyone with a cue that stands for it. No other mind ever reads a secret entry, whatever links it or opens its gate.
- A public entry must never repeat a track's truth (lint error `secret_truth`).
- Keep macros (`{{user}}`, `{{char}}`) out of lore unless the source used them on purpose: the engine lists them for review on install.

## Schedules

Schedules give people routines: where they are (`target: "place"`) or what they do (`target: "activity"`) by time of day and weekday. The owner is an entity, a group, a kind or a selector. Base them on what the story shows ("the baker opens at dawn"); invent plausible ones for the rest of the cast only when it helps.

```json
{ "id": "mara_days", "owner": "mara", "target": "place", "recurrence": { "every": "week", "weekdays": [1, 2, 3, 4, 5] },
  "slots": [{ "start": "06:00", "end": "14:00", "value": "bakery" }, { "start": "14:00", "end": "22:00", "value": "mara_house" }] }
```

## Realism and the rest

- `/realism` sets how much is simulated per domain (0 to 4): Story keeps most at 1 and Space and Calendar at 2. Raise Money when the story counts money (see [Money](#money)), Relationships when feelings drive it. A chat can change levels later.
- Rules (`when this happens, do that`), actions, checks and a ruleset are optional; add them when the story has mechanics the player will use again (a skill check to pick locks, a curfew rule).
- **Data tables.** A new draft carries LumiRPEngine's seventeen default data tables (`/tables`: prices, pay, taxes, occupations, regions, gear, vehicles and the calendar's holidays, all Modern US), so a `region`, an `occupation` or an `amount_table` reads from them at once. Leave the tables as they are, with each one's `revision` and `/pins`: LumiRPEngine works a table's revision and pin out again only when Build edits it, so a table changed here would keep its old ones. When the setting needs other prices or pay, say so in your answer: the user adapts the tables in Build after installing.

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
- A death or dying the POV hasn't learned of sets `lifeKnownBy` to who knows, with everyone who starts where the body lies; left out, it tells the player.
- Every thing someone owns names them in `fields.owner`, and every account, business, holding and property names its holders in `fields.owners`.
- Every flow and job pays from and to something that exists (an id, or an outside party in words), with an amount and a schedule (`every`, or `once`).
- No money is in an older shape: `draft_check` shows no `migrated` warning.
- A world whose minds run in full (`"secrecy": "full"`) has no secret a character would think about openly.
- Openings are today's balances, and quests start at the stage the story reached.
- No secret track starts on a stage with a `truth`: a secret the POV has learned starts one stage earlier, moving on `when: "true"`, so the first turn reveals it.
- No public text gives a secret away, and no cue states the secret it stands for.
