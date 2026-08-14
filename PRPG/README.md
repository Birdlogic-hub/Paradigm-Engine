# Paradigm RPG

A complete RPG layer for AI Dungeon, built on the Paradigm Engine: the AI judges your actions like a DM, your skills grow from what you actually do, your gear and gauges live on real cards, and the world sometimes acts on its own. No classes, no XP tables, no stat formulas — the model judges capability in context; the engine remembers, enforces, and displays.

**The stack** (one paste): RegexLib · CardLib · GateKit · InventoryKit · SkillKit · TrackerKit · EventKit · SheetKit. Standalone by design — it does not require (or want) other context-editing scripts in the same scenario.

## Install

1. In your scenario's **Edit → Scripts**, paste `PRPG - Library.js` into the **Library** tab — the bundle only, never a module file alongside it (duplicate-const crash).
2. Paste the three hook tabs: `PRPG - Input.js`, `PRPG - Context.js`, `PRPG - Output.js`.
3. Make sure the scenario's **SCRIPTING toggle is ON** — new scenarios ship with it off, and off means total silence.
4. Playing on a cache-efficient model, or with **Optimized Context** enabled? The Context tab's first line (`// @cache-compatible`) handles it. Without that line, cached models silently discard everything the engine tells the model.

Every card below creates itself on your first turn. Config edits apply on your next action — no restart needed.

## The cards

**Gameplay** (you read these):

- **Character Sheet** — always in the AI's context. Everything above the `-----` line is *yours*: fill in Name, Gender, Pronouns, Appearance, Background, add any lines you like — the engine never touches them. Below the line the engine writes your Level and epithet, attributes, each gauge with a plain-English condition line, and **## Equipment** — your gear by category.
- **Inventory** — Wallet (currencies) and Inventory (items, with `(equipped: …)` annotations). Also in the AI's context by default, so the DM knows what you're holding.
- **Skills** — every skill you've used, its rank, and progress toward the next rank.
- **Event Log** — the engine's receipt tape: the last 20 engine events, newest first, turn-stamped. Rulings, inventory changes, world events. When something surprises you, read the log before blaming the dice.

**Settings** (you edit these): GateKit Config, Inventory Config, Trackers Config, SkillKit Config, Events Config. Each card documents its own lines in its NOTES; the sections below tell you what the lines mean.

## How a turn is judged

Every Do/Say/Story turn goes to **the Check**: the model rules `skill; difficulty (trivial/minor/major/impossible); result (success/partial/fail)`, with an explicit **d20 luck roll** in view. Trivial things just happen; impossible things just fail; luck sways the middle. Narrate *attempts*, not outcomes — "I swing at the beast," not "I kill the beast." Slash commands are bookkeeping and are never judged (except where noted below); the fiction they cause is.

The ruling can also carry a cost or restore (`resource=stamina -8`), which moves your gauges — capped at 25% of the gauge per turn, so no single sentence can kill you by arithmetic. Deliberate scripted effects are not capped; falls can be fatal.

## The commands — all of them

Items and amounts are free text: `/take 3 torches` and `/take torches 3` both work. Item names cap at 40 characters, 99 copies per item.

### Possessions (InventoryKit)

| Command | What happens | Judged? |
|---|---|---|
| `/take <item>` · `/take 2 tonic; dagger; rope` | Acquire — multiple items in one grab, semicolon-separated, optional amounts. One grab, one ruling; a fail rolls back the *whole* grab | Yes (Take Arbitration, default `outcome`) |
| `/collect <amount> <currency>` | Acquire into the Wallet (`/collect 50 gold`) | Yes (default `outcome`) |
| `/drop <item>` | Shed items — pure bookkeeping | No (default `none`) |
| `/give <amount> <thing> to <someone>` | Expenditure. **Expenditures never refund** — a botched gift is still gone | Yes (default `outcome`) |
| `/throw <item> at <target>` | Expenditure; the rock leaves your hand with certainty, where it lands is the DM's call | Yes (default `outcome`) |
| `/use <item>` | Consume one and let the ruling decide what it did (`/use red tonic`) | Yes (default `outcome`) |
| `/eat <item>` · `/drink <item>` | Consume one; the ruling *prices the meal* — how much Hunger or Stamina it restores (or doesn't; eating something foul can cost you). Bare `/eat` refuses — no free lunches | Yes, always |
| `/swap [amount] <name>` | Reclassify between items and Wallet (`/swap coins` moves all, `/swap 10 coins` partial, auto-direction). Meta — nothing happens in the fiction when coins change pockets | Never |
| `/undo` | Reverse the last ledger operation (composites like a grab-and-equip reverse whole). Depth: 20. Typo'd a command? `/undo`. Regret a whole turn? **Erase it** — the engine's state follows the story automatically, up to 5 turns back | Never |
| `/inventory` · `/inv` | Echo your holdings | Never |

### Equipment (the Loadout)

Five open categories — **weapon, armor, clothes, accessory, tool** — lists, not slots: no caps, nothing to swap. Equipped gear shows on the Sheet's **## Equipment** section and annotated in the Inventory list, and the DM judges your attempts with it in view.

| Command | Notes |
|---|---|
| `/equip <item> as <category>` | The canonical form — always wins |
| `/equip <category> <item>` · `/equip <item> <category>` | Same thing, no `as` needed, either order |
| `/unequip <item>` | Off it comes |

The fine print, all player-friendly:

- **Don't have it yet? `/equip` takes it too.** `/equip rusty dagger as weapon` with the dagger still on the table is one judged grab-and-equip; if the ruling fails, both halves roll back. One `/undo` reverses both.
- **Short names work.** `/equip dagger` finds your held "rusty dagger". If it's genuinely ambiguous, the engine asks (`Equip which? (iron dagger | jeweled dagger)`) rather than guessing.
- Items whose names start or end with a category word ("tool belt") need the `as` form.
- Anything you drop, give, throw, or eat auto-unequips — gear never points at things you no longer hold.
- Equipping is bookkeeping by default; set `Equip Arbitration: outcome` if drawing a blade mid-parley deserves a ruling in your scenario.

### Gauges and recovery (TrackerKit)

Health, Stamina, and Hunger ship on; Mana ships visible-but-off (`Mana: 0` — set a number to enable). Each config number is a **maximum**; 0 disables a gauge; add your own lines for custom gauges. Maxima grow +5% per Level. Health takes wounds from the story's own prose (five severity tiers) and heals from healing prose; Hunger ticks down as you act; costs arrive via rulings.

| Command | What happens | Judged? |
|---|---|---|
| `/rest` | Deterministic breather: ~50% Stamina, ~25% Mana, ~10% Health | No |
| `/sleep` | Full Stamina and Mana, ~25% Health | No |
| `/meditate` | You reach for your center — and the *ruling* decides what the trance restores | Yes |
| `/track <gauge> +N` · `/track <gauge> -N` | Manual nudge (`/track health -10`) — range-clamped, logged | No |

### The world acts (EventKit)

Random intrusions — strangers, weather, discoveries, ambushes — fire on story turns by chance and cooldown (Events Config: `Enabled`, `Chance`, `Cooldown`, per-category `Weights`; 0 disables a category). Every fire is logged, so you always know an event was the engine's doing and not model whimsy.

| Command | What happens |
|---|---|
| `/event [category]` | Debug verb: force an event now (optionally from one category). Requires `Report: true` on the Events Config |
| `/telemetry` | Echo the telemetry ring's status — how many rulings ObserverKit has recorded, their turn span, and drops. Requires `Report: true` on the Observer Config |

Erasing story turns is safe: the engine keeps short-term state snapshots and restores the matching one when you erase (up to 5 turns; deeper erases are reported on the Event Log rather than silently ignored).

### Skills and Level (SkillKit — no commands, all play)

Skills grow from *doing*: every ruling tallies its named skill — +1 for the attempt, +2 total when it succeeds. Trivial and impossible rulings teach nothing — only genuine uncertainty counts, so command-spam can't grind. Ranks climb Novice → Apprentice (10) → Intermediate (25) → Advanced (50) → Expert (100) → Master (250) → Legendary (1000), and the DM hears your rank in words, never numbers.

**Level** is what all your skills add up to (derived, never stored — cap 20), carries an epithet from *green* to *a living legend*, and deepens your gauges as you grow. On the SkillKit Config: `Starting Skills` grants rank floors (`Climbing=Intermediate`), `Show Progress` toggles the numbers on the Skills card, and creator-defined attribute lines (`- Strong: rank=Intermediate, skills=climbing/lifting/melee`) floor whole skill families.

## Arbitration policies (Inventory Config)

Each inventory verb has a policy line — `none` (pure bookkeeping), `outcome` (commit now, a failed ruling rolls it back), or `gated` (nothing happens unless the ruling allows). Defaults: Take/Collect/Give/Throw/Use `outcome`, Drop/Equip `none`. `Inventory In Context: true` keeps your ledger in the DM's view (recommended); `Report: true` posts mutations to the Event Log.

## For scripters

PRPG consumes only public Engine seams — `GK_lastCheck()`, `GK_setLuck`, `GK_markCommandTurn`/`GK_isCommandTurn`, `GK_setArbiterNote`, `SC_config`/`SC_render`/`SC_report`/`SC_codex`, `TK_apply`, `TK_readGauges`, `INV_readEquipment`, `SK_level`/`SK_epithet`, `EV_addPool`. Thematic event pools register in code via `EV_addPool(category, entries)` — see EventKit's marked extend-here region. If you need something not public, that's an engine design bug worth reporting.

Versioned against **PE Essentials** (RegexLib v0.1.1 · CardLib v0.4.4 · GateKit v0.8.2 · InventoryKit v0.2.5) with SkillKit v0.2.1 · TrackerKit v0.3.2 · EventKit v0.1.1 · SheetKit v0.1.3. The committed bundle is the authoritative artifact — it embeds these exact module versions.

**Running the tests**: clone the [Paradigm-Engine](https://github.com/Birdlogic-hub/Paradigm-Engine) repo — this folder ships alongside `PE Essentials/`, whose harness and core modules the suites load directly. Then `node test\<suite>.test.js` per suite; bundle via `node make-bundle.js`.
