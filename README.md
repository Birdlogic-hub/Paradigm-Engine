# Paradigm Engine

## Which do I paste?

One repo, two shippable packages — each is a single Library-tab paste plus three hook tabs, ready to drop into an AI Dungeon scenario:

- **[`PE Essentials/`](PE%20Essentials/)** — the standard install: adjudication (GateKit), inventory, cards, parsing, and the Rewind. Paste `PE Essentials - Library.js` + its three hook tabs. *(The folder also builds `PE Characters - Library.js`, the character-stack variant bundling third-party guests — see `THIRD_PARTY_LICENSES.md`.)*
- **[`PRPG/`](PRPG/)** — **Paradigm RPG**, the full RPG layer: everything in Essentials plus skills, gauges, random events, the character sheet, and telemetry. Paste `PRPG - Library.js` + its three hook tabs. Its README is the complete player's guide.

Tests run from either package folder (`node test\run.js` in PE Essentials; `node test\<suite>.test.js` in PRPG) — one clone is everything. Regenerate bundles with each folder's `make-bundle.js`.

## The `/` commands

Everything the player can type, and what happens. Items and amounts are free text (`/take 3 torches` and `/take torches 3` both work); "judged" means the AI rules on the attempt like a DM — slash commands themselves are bookkeeping, but the consequences they cause can be adjudicated per your config card policies (`none` / `outcome` / `gated`).

### Possessions — both packages

| Command | What it does |
|---|---|
| `/take <item>` · `/take 2 tonic; dagger; rope` | Acquire — multi-item grabs are one judged turn, one ruling; a fail rolls back the whole grab |
| `/collect <amount> <currency>` | Acquire into the Wallet (`/collect 50 gold`) — judged |
| `/drop <item>` | Shed items — pure bookkeeping |
| `/give <amount> <thing> to <someone>` | Expenditure, judged — expenditures never refund |
| `/throw <item> at <target>` | Expenditure, judged — the throw is certain, the landing is the DM's call |
| `/use <item>` | Consume one; the ruling decides what it did |
| `/eat <item>` · `/drink <item>` | Consume one; the ruling prices the meal — how much it restores, or costs. Bare `/eat` refuses — no free lunches |
| `/swap [amount] <name>` | Reclassify between items and Wallet, auto-direction; bare `/swap coins` moves all. Never judged |
| `/undo` | Reverse the last ledger operation (composites reverse whole, 20 deep). For story regrets, just **Erase the turn** — the engine's state follows automatically |
| `/inventory` · `/inv` | Echo your holdings |

### Equipment — both packages

| Command | What it does |
|---|---|
| `/equip <item> as <category>` | Equip into **weapon / armor / clothes / accessory / tool** (open lists, no caps) |
| `/equip <category> <item>` · `/equip <item> <category>` | Same thing — no `as` needed, either order |
| `/unequip <item>` | Off it comes |

Don't have the item yet? `/equip rusty dagger as weapon` takes *and* equips it in one judged turn — a failed ruling rolls back both. Short names work (`/equip dagger` finds your held "rusty dagger"); genuine ambiguity asks instead of guessing. Anything you drop, give, throw, or eat auto-unequips.

### Gauges and recovery — Paradigm RPG

| Command | What it does |
|---|---|
| `/rest` | Deterministic breather: ~50% Stamina, ~25% Mana, ~10% Health |
| `/sleep` | Full Stamina and Mana, ~25% Health |
| `/meditate` | Judged — the ruling decides what the trance restores |
| `/track <gauge> +N` · `/track <gauge> -N` | Manual gauge nudge (`/track health -10`), range-clamped, logged |

### The world, the record — Paradigm RPG

| Command | What it does |
|---|---|
| `/event [category]` | Force a random world event now (debug verb; requires `Report: true` on the Events Config) |
| `/telemetry` | Echo the telemetry ring's status — how many rulings are recorded for the Observatory (requires `Report: true` on the Observer Config) |

**Scenario creators**: the Inventory Config card's `Starting Items` and `Starting Wallet` lines stock a new adventure on turn 1 — `2 field ration; iron dagger; leather jerkin as armor` — so armor can be worn from the first breath rather than carried. Paired with SkillKit's `Starting Skills`, that's character archetypes with zero scripting; the full walkthrough is in the [starting kit guide](PRPG/README.md#starting-kit-for-scenario-creators).

Skills have **no commands** — they grow from doing (every ruling tallies its skill; trivial and impossible teach nothing). Full detail, cards, and config reference: the [Paradigm RPG player's guide](PRPG/README.md).

---

A modular engine within AID, built from shared primitives. Each module generalizes an **idea** proven somewhere in the old projects — never the old implementation itself. Legacy projects are source material (bones), not consumers: nothing here exists to retrofit them, and they stay frozen as-is.

**PE Essentials Package** (defined 7/13/2026): **RegexLib + CardLib + GateKit + InventoryKit** — the four-module bundle that ships together as the engine's standard install. Every module still stands alone as a single file and degrades gracefully when its collaborators are absent; Essentials is the recommended full stack, not a hard dependency.

## The modules

| Module | The idea it generalizes | Proven in | Status |
|---|---|---|---|
| **RegexLib/** | **The Grammar** — player text is hostile and nouns are arbitrary, so the grammar is data: injected candidate lists define the language. Framing scrub, slash commands, longest-first boundary-safe matching, amount ergonomics. | SIS parsing layer (EB), the "crown jewel" | **v0.1.1** ✔ · **ESSENTIALS** |
| **CardLib/** | **The Projection** — gameplay state lives in `state.vars`; cards are pure renderings, never parsed back. Config cards (player edits, code reads) are the sanctioned exception. **v0.2: the Codex** — cards materialize from an index when their subject enters the story. **v0.3: the Event Log** — rolling engine log, newest first (20 events under a 990-char budget as of v0.4.4). **v0.4: the two banners** — Gameplay (cards you read) / Settings (cards you edit). | SIS, RESR's Condition card; AC's config card; PMD's Pokédex registry | **v0.4.4** ✔ · **ESSENTIALS** |
| **GateKit/** | **The Check** — the model judges what code can't: whether an action is consistent with the story. One question at the strongest context position, one machine-readable ruling, captured as engine state. | Silent DM (concept); SIS/RESR/PMD gates were instances | **v0.8.2** — v0.4.5 LIVE-PROVEN ✔ · **ESSENTIALS** |
| **InventoryKit/** | **The Possession** — what the player holds, held honestly: bookkeeping deterministic, consequences adjudicated. Per-verb arbitration policy (none/outcome/gated). **v0.2: the Loadout** — equipment as possession with a worn flag. | SIS core; Cragin's policy idea | **v0.2.0** — harness-passed · **ESSENTIALS** |
| **BridgeKit/** | **The Truce** — third-party shim: the Check yields on guests' special turns (IS task, AC generation, LC thought, SAE control), and new characters get walked around the room (the Introduction). | Inner Self / Auto-Cards / Living Characters / SlowBurn compat studies | **v0.8.1** — AC yield LIVE-PROVEN ✔ · **PE CHARACTERS** |
| **SkillKit/** | **The Skill** — the Check already names the skill behind every ruling (`skill=`); SkillKit remembers what you're good at. Ranks are semantic and reach the arbiter as words, never as `GK_setLuck`. **v0.2: the Growth** — Level derived from total contested accrual, plus attribute floors. | TAS's skill-learning (prior art); Dice's salvaged seam | **v0.2.1** — v0.1.x LIVE-PROVEN ✔ · **PRPG** |
| **TrackerKit/** | **The Gauge** — creator-declared gauges with per-resource physics: the Wound (prose), the Cost (the ruling's `resource=`), the Clock (drift). Absorbed ResourceKit 7/16. | RESR's meters (EB), FD's detectHurt, TAS | **v0.3.2** — v0.2.x LIVE-PROVEN ✔ · **PRPG** |
| **SheetKit/** | **The Sheet** — the Trackers card evolved: identity player-authored above the rule line, engine projection below, every number translated by the Semantic Layer. | FD's character card (layout comb) | **v0.1.1** — harness-passed · **PRPG** |
| **EventKit/** | **The Intrusion** — the world acts without player prompting: weighted category tables, flavor pools as data, effects attached by category. | RESR, Fusion Dungeon | **v0.1.1** — live-confirmed ✔ · **PRPG** |

## The action lifecycle

Every player action moves through five stages, each owned by exactly one party:

```
Player intent            (the typed turn — free text or slash command)
      ↓
Command validation       (producer module: is this my verb? does it parse?)
      ↓
State preconditions      (producer module: do you actually hold the rock?)
      ↓
Narrative arbitration    (the Check: difficulty, outcome — the model rules)
      ↓
State consequences       (producer module: reads GK_lastCheck, commits/rolls back)
```

InventoryKit is one producer of actions; combat, dialogue, and crafting will be others. GateKit never learns who produced an action, because **the interchange format is text**: producers rewrite their command turns into honest narrative stubs ("You throw the rock at the goblin."), and the Check judges the sentence. In an engine whose arbiter is a language model, text is not the informal fallback — it is the native interface. A sentence simultaneously informs the arbiter, the player, and the story history; a structured action object would need serializing back into prose for the only judge we have. No action bus is planned until a real consumer demonstrates a need the sentence can't carry (rule 8 applies to infrastructure too — see Dice).

Producers opt out of arbitration per action (`GK_markCommandTurn()` for bookkeeping turns) or per policy (config-card data, e.g. InventoryKit's `none`/`outcome`/`gated`).

## Rules of the road

1. One module = one folder: `<Module>.js` + `README.md` + player guide where player-facing.
2. **Generalize the idea, not the implementation.** If a module needs a migration guide for an old project, it's the wrong module. And the idea must be *irreducible*: if another primitive fully contains it (Dice vs the Check's internal luck), it's a mechanism, not a primitive — retire it.
3. Modules own no hooks — they export `X_onInput/onContext/onOutput` passes; the scenario wires the chain. **Hook tabs stay thin** (one-line pass calls only): all logic, including debug instrumentation, lives in the shared Library tab — the AID norm. Debug ships as its own pass (e.g., `GK_onOutputDebug`), setting-gated and comment-fenced.
4. **No `state.memory.frontMemory`, ever.** Delivery is context-tail injection (the Silent DM channel) inside a module's own context pass, respecting `info.maxChars`.
5. State under one namespace per module (`state.vars.<module>`); no functions or prompt text stored in state.
6. Modules compose through small seams (read another module's exposed state, or feed it one value) — never by reaching into each other's internals.
7. Degrade to nothing, never to breakage: if the model ignores a schema, the turn must pass through untouched.
8. **Prove it works first.** A green harness is necessary, never sufficient — a module reaches *live-proven* only when its happy path has been demonstrated inside a real AID adventure (canary in Console Log, behavior visible in play). No module may build on another's seam until that seam is live-proven. Building on top of unproven code is how the GateKit playtest surprise happened; don't repeat it.
9. **Prompt strictly, parse generously.** AID rotates models (Dynamic Large is literally a rotation), so output-format drift is the operating condition, not an edge case. Ask the model for one exact format; accept every reasonable dialect of it. When parsing fails on something that was clearly an attempt, strip it from the story anyway and log it verbatim — every model rotation should report its own dialect for parser tuning. GateKit's near-miss detector is the reference implementation.
10. **Debug the execution environment before debugging the implementation.** When behavior is *totally* absent (no output, no logs, no errors), the first suspects are outside the code: master toggles (new scenarios ship with SCRIPTING disabled by default!), unsaved tabs, wrong scenario/child/published-snapshot binding, invisible log panels. Code failures throw; environments shrug. Bisect with a minimal canary before touching module logic.
11. **Projections exist from Turn 1.** A module ensures every card it owns — config, projections, logs — unconditionally in its input pass, never lazily on first use. A card the player can't see yet is a feature they can't discover, and (as the missing-Event-Log incident proved) a diagnostic surface that hides exactly when needed. Lineage: EB's ensure-on-input (`SR_ensureCard`'s call-site discipline).
