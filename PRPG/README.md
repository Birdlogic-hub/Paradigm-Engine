# Paradigm RPG

A complete RPG layer for AI Dungeon, built on the Paradigm Engine. The AI judges your actions like a DM. Your skills grow from what you actually do. Your gear and gauges live on real cards. The world sometimes acts on its own. No classes and no stat formulas: the model judges what an action deserves, and the engine remembers, enforces, and displays.

**The stack**, one paste: RewindKit · RegexLib · CardLib · GateKit · InventoryKit · SkillKit · TrackerKit · EventKit · SheetKit · ObserverKit. Standalone by design. It does not require, or want, other context-editing scripts in the same scenario.

## Install

1. In your scenario's **Edit → Scripts**, paste `PRPG - Library.js` into the **Library** tab. The bundle only, never a module file alongside it: that's a duplicate-const crash.
2. Paste the three hook tabs: `PRPG - Input.js`, `PRPG - Context.js`, `PRPG - Output.js`.
3. Make sure the scenario's **SCRIPTING toggle is ON**. New scenarios ship with it off, and off means total silence.
4. Playing on a cache-efficient model, or with **Optimized Context** enabled? The Context tab's first line (`// @cache-compatible`) handles it. Without that line, cached models silently discard everything the engine tells the model.

Every card below creates itself on your first turn. Config edits apply on your next action. No restart needed.

## The cards

**Gameplay** (you read these):

- **Character Sheet**: always in the AI's context. Everything above the `-----` line is yours. Fill in Name, Gender, Pronouns, Appearance, Background, and add any lines you like; the engine never touches them. Below the line the engine writes your Level and its progress (`Level 3 — 2/5 toward 4`), each gauge with a plain-English condition line, and **## Equipment**, your gear by category.
- **Inventory**: Wallet (currencies) and Inventory (items, with `(equipped: …)` notes). In the AI's context by default, so the DM knows what you're holding.
- **Skills**: every skill you've used, its rank, and progress toward the next rank.
- **Event Log**: the engine's receipt tape. The last 20 engine events, newest first, turn-stamped: rulings, inventory changes, rank-ups, world events. When something surprises you, read the log before blaming the dice.

**Settings** (you edit these): GateKit Config, Inventory Config, Trackers Config, SkillKit Config, Events Config, Rewind Config, Observer Config. Each card documents its own lines in its NOTES.

## How a turn is judged

Every Do, Say and Story turn goes to **the Check**. The DM names the skill involved, rates how hard the task is, and rules the result. Trivial things just happen. Impossible things just fail. Narrate *attempts*, not outcomes: "I swing at the beast," not "I kill the beast." Slash commands are bookkeeping and are never judged, except where noted below. The fiction they cause is.

There are two ways the middle gets decided, set on the GateKit Config's `Resolution` line:

- **`Resolution: model`** (the default). The DM rates the task `minor` or `major` with an explicit **d20 luck roll** in view, and rules success, partial, or fail the way a DM reads a d20.
- **`Resolution: code`**. The DM rates the task on the **skill ladder** (Untrained to Legendary), and the outcome is looked up, not judged. The engine rolls before the DM writes a word and hands it a table of what each of your skills can clear this turn. When your rank matches the task you succeed 50% of the time; each rank you fall short halves that, each rank to spare halves your chance of failing. Then **luck**: the d20 adds its face to the odds, from −18 points on a 1 to +18 on a 20 (10 and 11 are neutral). The DM sees the roll and can narrate your fortune, but the result is already in the table. Success or failure only. The Event Log shows the odds, the luck and the roll.

A ruling can also carry a cost or a restore (`resource=stamina -8`), which moves your gauges. It's capped at 25% of the gauge per turn, so no single sentence can kill you by arithmetic. Deliberate scripted effects are not capped. Falls can be fatal.

## The commands — all of them

Items and amounts are free text: `/take 3 torches` and `/take torches 3` both work. Item names cap at 40 characters, 99 copies per item.

**Auto Pickup** (on by default): you don't have to `/take` everything. When the story has you take or receive something ("you pocket the coin"), the DM reports it in its ruling and the engine adds it, with a `{Picked up: …}` receipt and an Event Log line. Up to 5 items a turn. Coins go to your Wallet if you already carry that currency. Retrying the turn undoes the previous attempt's pickups, and `/undo` takes back one. Turn it off with `Auto Pickup: false` on Inventory Config, and the DM is told to leave found items where they lie.

### Possessions (InventoryKit)

| Command | What happens | Judged? |
|---|---|---|
| `/take <item>` · `/take 2 tonic; dagger; rope` | Acquire. Multiple items in one grab, semicolon-separated, optional amounts. One grab, one ruling; a fail rolls back the *whole* grab | Yes (Take Arbitration, default `outcome`) |
| `/collect <amount> <currency>` | Acquire into the Wallet (`/collect 50 gold`) | Yes (default `outcome`) |
| `/drop <item>` | Shed items. Pure bookkeeping | No (default `none`) |
| `/give <amount> <thing> to <someone>` | Expenditure. **Expenditures never refund**: a botched gift is still gone | Yes (default `outcome`) |
| `/throw <item> at <target>` | Expenditure. The rock leaves your hand with certainty; where it lands is the DM's call | Yes (default `outcome`) |
| `/use <item>` | Consume one and let the ruling decide what it did (`/use red tonic`) | Yes (default `outcome`) |
| `/eat <item>` · `/drink <item>` | Consume one. The ruling *prices the meal*: how much Hunger or Stamina it restores, or doesn't. Bare `/eat` refuses. No free lunches | Yes, always |
| `/swap [amount] <name>` | Reclassify between items and Wallet (`/swap coins` moves all, `/swap 10 coins` partial, auto-direction). Nothing happens in the fiction when coins change pockets | Never |
| `/undo` | Reverse the last ledger operation (composites like a grab-and-equip reverse whole). Depth: 20. Typo'd a command? `/undo`. Regret a whole turn? **Erase it**, and the engine's state follows the story back | Never |
| `/inventory` · `/inv` | Echo your holdings | Never |

### Equipment (the Loadout)

Five open categories: **weapon, armor, clothes, accessory, tool**. Lists, not slots. No caps, nothing to swap. Equipped gear shows on the Sheet's **## Equipment** section and in the Inventory list, and the DM judges your attempts with it in view.

| Command | Notes |
|---|---|
| `/equip <item> as <category>` | The canonical form. Always wins |
| `/equip <category> <item>` · `/equip <item> <category>` | Same thing, no `as` needed, either order |
| `/unequip <item>` | Off it comes |

The fine print:

- **Don't have it yet? `/equip` takes it too.** `/equip rusty dagger as weapon` with the dagger still on the table is one judged grab-and-equip. If the ruling fails, both halves roll back. One `/undo` reverses both.
- **Short names work.** `/equip dagger` finds your held "rusty dagger". If it's genuinely ambiguous, the engine asks (`Equip which? (iron dagger | jeweled dagger)`) rather than guessing.
- Items whose names start or end with a category word ("tool belt") need the `as` form.
- Anything you drop, give, throw, or eat auto-unequips.
- Equipping is bookkeeping by default. Set `Equip Arbitration: outcome` if drawing a blade mid-parley deserves a ruling in your scenario.

### Gauges and recovery (TrackerKit)

Health, Stamina, and Hunger ship on. Mana ships visible but off (`Mana: 0`; set a number to enable it). Each config number is a **maximum**, 0 disables a gauge, and you can add your own lines for custom gauges. Maxima grow 5% per Level. Health takes wounds from the story's own prose and heals from healing prose. Hunger ticks down as you act. Costs arrive through rulings.

| Command | What happens | Judged? |
|---|---|---|
| `/rest` | Deterministic breather: ~50% Stamina, ~25% Mana, ~10% Health | No |
| `/sleep` | Full Stamina and Mana, ~25% Health | No |
| `/meditate` | You reach for your center, and the *ruling* decides what the trance restores | Yes |
| `/track <gauge> +N` · `/track <gauge> -N` | Manual nudge (`/track health -10`). Range-clamped, logged | No |

**At 0 Health the story ends.** The DM narrates the death, and with `Death Lock: true` (the default) every turn after it shows the `Death Message` instead of more story. Erasing the killing turn brings you back. `Death Lock: false` leaves death to the story.

### The world acts (EventKit)

Random intrusions (strangers, weather, discoveries, ambushes) fire on story turns by chance and cooldown. Story turns are Do, Say, Story **and Continue**: pressing Continue hands the narration over, and the world may act in the gap. Commands never roll. Events Config: `Enabled`, `Chance`, `Cooldown`, per-category `Weights`; 0 disables a category. Every fire is logged, so you always know an event was the engine's doing and not model whimsy.

| Command | What happens |
|---|---|
| `/event [category]` | Debug verb: force an event now, optionally from one category. Requires `Report: true` on the Events Config |
| `/telemetry` | Echo the telemetry ring's status: how many rulings ObserverKit has recorded, their turn span, and drops. Requires `Report: true` on the Observer Config |

### Erase (RewindKit)

Erasing story turns is safe. The engine keeps a snapshot of its state for each of the last 5 turns and restores the matching one when you erase. Deeper erases are reported on the Event Log, not silently ignored.

### Skills and Level (SkillKit — no commands, all play)

Skills grow from *doing*. The DM names a skill in every ruling, any skill it likes, and the engine records it. There's no fixed list.

**Ranks** climb by total XP:

| Rank | Untrained | Novice | Apprentice | Intermediate | Advanced | Expert | Master | Legendary |
|---|---|---|---|---|---|---|---|---|
| XP | 0 | 1 | 25 | 75 | 150 | 250 | 500 | 1000 |

**XP** depends on how the turn was judged:

- **Code resolution:** a **success** pays by how hard the task was. Untrained or novice 1, apprentice 2, intermediate 4, advanced 8, expert 16, master 32, legendary 64. Failures pay nothing.
- **Model resolution:** every minor or major attempt pays 1, win or lose.
- Either way, trivial and impossible tasks teach nothing, and repeating the exact same move only teaches once. Command spam can't grind.

The DM hears your ranks in words, never numbers. The Skills card keeps up to 25 skills (`Max Skills`); past that, the least-practised one is forgotten.

**Level** comes from the ranks you earn, Skyrim-style. Each rank is worth its number minus one: Novice 0, Apprentice 1, Intermediate 2, up to Legendary 6. Going from Level L to L+1 costs L+2 points, so one skill taken to Intermediate makes you Level 2. Level caps at 20, carries an epithet from *a green adventurer* to *a living legend*, and deepens your gauges as you grow. Ranks you were given at the start don't count. Only what you earn does.

On the SkillKit Config: `Starting Skills` grants starting ranks, `Show Progress` toggles the numbers on the Skills card, and attribute lines (`- Strong: rank=Intermediate, skills=climbing/lifting`) give a whole family of skills a head start.

## Starting kit (for scenario creators)

Stock every new adventure with items, gear and coin. No scripting required.

### Where it lives

A story card in **your scenario** (not in an adventure), titled exactly `Inventory Config`, with its **triggers left blank**. Config cards are for you to edit, not for the AI to read.

Write only the lines you care about. The engine fills in the rest on turn 1 and never overwrites what you wrote:

```
Starting Items: 2 field ration; iron dagger; leather jerkin as armor
Starting Wallet: 50 gold; 12 silver coins
```

Every new adventure from your scenario now starts stocked.

### The syntax

- **Semicolons separate entries.** Commas are part of an item's name.
- **Amounts are optional and lead**: `3 torches`. No number means one. Max 99 per item, 40 characters per name.
- **`as <category>` equips it from the start**: `weapon`, `armor`, `clothes`, `accessory`, `tool`.
- **Starting Wallet needs a number.** `50 gold` works; a bare `gold` is skipped.

The `as` suffix is the point of the feature. `leather jerkin as armor` means the player *wakes up wearing it*: on the Character Sheet's Equipment block from turn one, no `/equip` needed, and the AI judges them as armored from the first sentence.

### Four things that will bite you

1. **It only fires on turn 1.** Editing the values does nothing to an adventure already underway. Start a **fresh adventure** to see changes.
2. **The card must already exist in the scenario.** If the engine creates it during play instead, you're past turn 1 and nothing seeds.
3. **Scripting must be ON.** The most common cause of "nothing works."
4. **Check the Event Log.** A successful seed posts one line: `starting kit: field ration x2, iron dagger x1, leather jerkin x1 (armor), 50 gold (wallet)`. No line means one of the above is wrong.

The kit is scenario setup, not a deed. Never judged, and `/undo` can't strip it.

### The companion: starting skills

On the **SkillKit Config** card, the same idea for skills:

```
Starting Skills: Climbing=Intermediate, Stealth=Apprentice
```

Each named skill starts at that rank's XP, once, on the turn it's first seen. The player grows from there. Starting ranks never count toward Level, so a class's head start doesn't buy Levels.

### Classes without a class system

Between the two cards you can build archetypes with zero scripting:

```
# the soldier
Starting Items:  iron sword as weapon; chainmail as armor; 3 field ration
Starting Skills: Martial Combat=Intermediate, Athletics=Apprentice

# the thief
Starting Items:  worn lockpicks as tool; dark cloak as clothes
Starting Skills: Stealth=Intermediate, Lockpicking=Apprentice
```

Keep skill names plain. The DM picks its own words for a skill, so `Martial Combat` and `Stealth` match more of its rulings than something exotic would.

## Arbitration policies (Inventory Config)

Each inventory verb has a policy line: `none` (pure bookkeeping), `outcome` (commit now, a failed ruling rolls it back), or `gated` (nothing happens unless the ruling allows). Defaults: Take, Collect, Give, Throw, Use `outcome`; Drop, Equip `none`. `Inventory In Context: true` keeps your ledger in the DM's view, which is recommended. `Report: true` posts changes to the Event Log.

## For scripters

PRPG consumes only public engine seams:

- **GateKit:** `GK_lastCheck()`, `GK_setLuck` (bends luck in both modes), `GK_markCommandTurn` / `GK_isCommandTurn`, `GK_setArbiterNote`, `GK_resolution()`, `GK_chance(skillRank, difficultyRank[, luckPoints])`, `GK_luckPoints(face)`
- **CardLib:** `SC_config`, `SC_render`, `SC_report`, `SC_codex`
- **InventoryKit:** `INV_readEquipment`
- **SkillKit:** `SK_level`, `SK_levelState`, `SK_epithet`, `SK_rank`, `SK_ranks`, `SK_benchmarks`
- **TrackerKit:** `TK_apply`, `TK_readGauges`, `TK_isDead`
- **EventKit:** `EV_addPool`

Thematic event pools register in code with `EV_addPool(category, entries)`; see EventKit's marked extend-here region. If you need something that isn't public, that's an engine design bug worth reporting.

Versioned against **PE Essentials** (RewindKit v0.1.0 · RegexLib v0.1.1 · CardLib v0.4.4 · GateKit v0.11.0 · InventoryKit v0.3.0), with SkillKit v0.4.1 · TrackerKit v0.5.0 · EventKit v0.1.2 · SheetKit v0.1.4 · ObserverKit v0.1.4. The committed bundle is the authoritative artifact: it embeds these exact module versions.

**Running the tests**: clone the [Paradigm-Engine](https://github.com/Birdlogic-hub/Paradigm-Engine) repo. This folder ships alongside `PE Essentials/`, whose harness and core modules the suites load directly. Then `node test\run.js` to run them all, or `node test\<suite>.test.js` for one. Bundle with `node make-bundle.js`.
