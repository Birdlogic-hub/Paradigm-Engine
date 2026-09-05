// ===== InventoryKit v0.2.7 =====
// v0.2.7 — the KIT (player request, TemporaryCrunch 8/29/2026: "is there a way
//  to pre-plant items into the inventory?"): two config-card lines stock a NEW
//  adventure on turn 1 — `Starting Items` and `Starting Wallet` — following
//  SkillKit's Starting Skills precedent (config cards are the sanctioned
//  card→code direction). Same segment grammar as a multi-grab, plus the equip
//  suffix, so armor can be worn from the first breath instead of carried:
//    Starting Items: 2 red healing tonic; iron dagger; leather jerkin as armor
//  A one-shot GRANT, not a floor (items are spent; a floor would restock them),
//  never adjudicated, never on the /undo ring — it is scenario setup, not a
//  deed. Guarded to turn ≤ 1 so adventures already underway are never
//  retro-stocked when this version lands.
// v0.2.6 — the PLAIN RECEIPT (owner ruling, 8/13/2026): case-law names —
//  "the Grab" and kin — are scripter/design language and NEVER reach
//  player-facing surfaces; the Event Log speaks plain. Two report strings
//  cleaned; the convention is a standing lint check now.
// v0.2.5 — the TOKEN SHAVE (owner, 8/10/2026): brace echoes never end in a
//  period — "any period is 1 token, and you can count on the output to have
//  a period in it usually." Stripped once at the echo wrapper, not per line.
// v0.2.4 — the GRAB + the STANDING LEDGER (owner ruling, 8/10/2026: "equip
//  has too much friction already"): /equip on a true ledger miss IMPLIES
//  /take — acquisition under the Take Arbitration policy (attempt-phrased
//  stub, receipt deferred on outcome, gated defers everything), the equip
//  riding the ruling; a fail rolls the take back and the ghost sweep clears
//  the equip with it; one /undo reverses both (take_equip composite op).
//  The guard: the ledger is searched HARD before any take is implied —
//  exact, then loose BOTH ways, boundary-safe ("/equip dagger" finds a held
//  "rusty dagger" instead of grabbing a phantom "dagger"); ambiguity
//  refuses with candidates, never guesses. /unequip gains the same loose
//  match. And the ledger now STANDS IN CONTEXT: Inventory In Context
//  defaults true — the arbiter can't rule "you don't have that" about
//  things the card shows you holding (owner). Existing adventures keep
//  their edited config line; flip it on the card by hand.
// v0.2.3 — the UNIFORM STUB (owner ruling, 8/10/2026): every equip stub
//  reads "You equip the iron dagger." — the per-category verbs retired
//  ("You ready" risked model misinterpretation) and no "as <category>"
//  tail. Residual steering is a scenario AI-instruction concern, not code
//  (owner: "no extra code needed"). INV_EQUIP_STUBS retired with it.
//  Unequip matches: "You unequip the <item>." (same ruling, second pass).
// v0.2.2 — the PREPOSITION LEADS (owner hot take, 8/10/2026, minutes after
//  v0.2.1): "/equip <category> <item> makes more sense to the human brain."
//  The bare category now splits from EITHER end — leading preferred, and
//  when both ends could parse, the split resolving to a HELD item wins.
//  `as` stays canonical and always wins. Stubs unchanged (design-lead lean:
//  "You ready the iron dagger." is the fiction-voice normalization; the
//  uniform "You equip X as a Y." reads menu-register — one-line swap if
//  the owner rules otherwise).
// v0.2.1 — the PREPOSITION + the TOOL (first live playtest, 8/10/2026;
//  amendment §9, owner-approved: "This is exactly what should be done").
//  /equip parses a trailing bare category — the `as` form stays canonical
//  and always wins; the category is still explicitly named (the classifier
//  stays deferred). Regression fixture: `/equip iron dagger weapon`, whose
//  refusal used to suggest a command that could never succeed. Fifth open
//  category: tool ("You take up"). INV_EQUIP_CATS now drives the parse,
//  the usage strings, and unequip's sweep — a sixth category is one line.
// v0.2.0 — the LOADOUT + UNIFIED CONSUMPTION (proposal + owner veto pass
//  resolved 7/21/2026): equipment IS possession with a worn flag. FOUR OPEN
//  CATEGORIES (weapon/armor/clothes/accessory) — lists, not holders: no cap,
//  nothing occupied, nothing to swap. /equip <item> as <category> (explicit
//  only v1 — classifier deferred; model-slotting via a GateKit slot= field
//  is the logged v1.1 candidate) · /unequip <item>. Equipped items stay in
//  the Inventory list, ANNOTATED (render-only — commands parse state names,
//  never card text); the Sheet renders the gear block via INV_readEquipment()
//  (pull, no cross-module card writes). Slots never point at ghosts: a
//  validation pass unequips anything no longer held (drop/give/throw/eat,
//  rollbacks, /undo — all covered), reported. UNIFIED EAT/DRINK (owner
//  ruling: "GateKit can handle 'you eat' better than TrackerKit" — the flat
//  +40 was a free-lunch button): /eat <item> and /drink <item> are REMOVE
//  commands + adjudicated turns — consume 1 (expenditures never refund),
//  narrate the deed, and the ruling prices the meal through the capped
//  resource field. Bare /eat or /drink refuses with usage; there is no
//  deterministic fallback left. TrackerKit v0.3.2 retires its verbs.
// v0.1.7 — card taxonomy (CardLib v0.4.2, owner directive 7/21): Inventory
//  banners as Gameplay, Inventory Config as Settings. No behavior change.
// v0.1.6 — deferred receipts (live-found 7/16, the duck heist's epilogue):
//  a failed grab printed '{ducks x60 added}' AND '{You failed to get 60
//  ducks}' in the same output — the receipt was queued at commit time,
//  before the ruling existed. Judged acquisitions now hold their receipt
//  until the ruling stands; only unjudged ('none' policy) receipts print
//  at input. The Event Log keeps both entries — that's an honest history;
//  the player-facing echo is a statement of fact, and facts wait.
// v0.1.5 — /swap: pure ledger reclassification (items ⇄ wallet), NEVER
//  adjudicated — nothing happens in the fiction when coins change pockets;
//  bookkeeping is deterministic, adjudication is for consequences. Auto-
//  direction (whichever side holds the name moves to the other; items→
//  wallet preferred), bare '/swap coins' moves ALL, composite undo op
//  reverses both sides in one /undo.
// v0.1.4 — the DUCK HEIST (live-found 7/16): '/take 60 ducks' in a duckless
//  guardroom sailed through — v0.1.3's stow-tail made stubs MORE outcome-
//  claiming, feeding the arbiter's leniency. Fix: outcome/gated acquisition
//  stubs are now ATTEMPT-phrased ('You attempt to take X and stow it away')
//  — the Spine's attempt-not-outcome principle applied to our own stubs
//  first; the anti-consumption tail survives as intent. Also: MULTI-GRAB —
//  '/take 2 red healing tonic; iron dagger; rope' (semicolon-separated,
//  optional leading amounts, one turn, one ruling, one receipt; a fail
//  ruling rolls back the whole grab).
// v0.1.3 — the TONIC INCIDENT (live-found 7/16): '/take red tonic' stubbed
//  to 'You take the red tonic.' and the model completed the AFFORDANCE —
//  it narrated drinking it, leaving the fiction with an empty vial while
//  the ledger still held a full one. STATE IS TRUTH; the story must not
//  contradict the ledger. Two fixes: acquisition stubs now foreclose the
//  consumption affordance ('...stowing it away.') so the narration lands
//  on storage, and every acquisition posts a visible {receipt} echo (the
//  SIS clarity lesson) so the player always sees what the bookkeeping did
//  regardless of what the prose claims. /use remains the consumption path.
// (né SlashInventory, renamed 7/14/2026 — same module, same INV_ prefix, same versions)
// script by bottledfox
//
// Paradigm Engine feature module: THE POSSESSION.
// (Module named InventoryKit; function prefix stays INV_ — it manages the
//  inventory, and the slash is how you talk to it.)
// Bookkeeping is deterministic; consequences are adjudicated. A slash command
// is the player exercising agency over their own possessions — it never
// fails. What the deed CAUSES (does the thrown rock hit?) belongs to the
// Check, which rules on the rewritten action like any other turn.
// Lineage: SIS core (Endless Backrooms). SIS's APPROVE/REJECT gate machinery
// is NOT ported — GateKit's per-turn verdict subsumes it at zero cost.
// v0.1.1: cards materialize on Turn 1 — INV_cfg()/INV_renderCard() run
// unconditionally at input (EB's ensure-on-input pattern, SR_ensureCard's
// call-site discipline expressed through ParaCards primitives).
// v0.1.2: the Event Log joins them (SC_reportEnsure — doctrine rule 11).
// Full design: Documentation/Design Proposals/Inventory (the Possession).
//
// DEPENDS ON: Core (RegexLib for parsing, ParaCard for cards) — degrades to
// state-only bookkeeping without ParaCard, to policy "none" without GateKit.
//
// COMMANDS:
//   /take [n] <name>        acquire item(s)        (policy: outcome)
//   /collect [n] <currency> acquire currency       (policy: outcome)
//   /drop [n] <item>        spend                  (policy: none)
//   /give [n] <item> to X   spend                  (policy: outcome)
//   /throw [n] <item> at X  spend                  (policy: outcome)
//   /use <item>             spend exactly 1        (policy: outcome)
//   /undo                   reverse last operation (meta, never judged)
//   /inventory | /inv       show holdings          (meta, never judged)
//
// POLICIES (per verb, editable in the "Inventory Config" card):
//   none    — commit at input; turn marked non-adjudicable
//   outcome — commit at input; the Check rules consequences. Acquisitions
//             roll back on a fail ruling; expenditures never refund (the
//             deed happened — the rock is gone, it just missed)
//   gated   — commit deferred to output, iff the ruling isn't fail
//
// WIRING (order matters):
//   Input tab:    text = INV_onInput(text);   // FIRST: rewrite/mutate/stamp
//                 text = GK_onInput(text);
//   Context tab:  text = GK_onContext(text);  // Inventory has no context pass
//   Output tab:   text = GK_onOutput(text);   // verdict captured first
//                 text = INV_onOutput(text);  // then commits/rollbacks/echoes
//                 text = GK_onOutputDebug(text);
// ---------------------------------------------------------------------------

// Defaults. With ParaCard present these seed the editable "Inventory Config"
// card and back-fill any line the player deletes or mangles.
const INV_SETTINGS = {
    TAKE_ARBITRATION: "outcome",
    COLLECT_ARBITRATION: "outcome",
    DROP_ARBITRATION: "none",
    GIVE_ARBITRATION: "outcome",
    THROW_ARBITRATION: "outcome",
    USE_ARBITRATION: "outcome",
    EQUIP_ARBITRATION: "none",     // equip/unequip: bookkeeping by default; outcome = judged
    STARTING_ITEMS: "(none)",      // the Kit (v0.2.7): granted once, on turn 1 only
    STARTING_WALLET: "(none)",     // same, for currencies
    INVENTORY_IN_CONTEXT: true,    // the Standing Ledger (v0.2.4): always-on keys, the arbiter sees holdings
    REPORT: true                   // post mutations to the "Event Log" card
};

const INV_VERBS = ["take", "collect", "drop", "give", "throw", "use", "swap", "undo", "inventory", "inv", "equip", "unequip", "eat", "drink"];
const INV_NAME_CAP = 40;       // max chars for a /take'd item name
const INV_ITEM_CAP = 99;       // max copies of one item (SIS's cap, kept)
const INV_UNDO_MAX = 20;       // undo ring buffer depth (SIS's depth, kept)

// Load canary
try {
    if (typeof log === "function") log("[InventoryKit] library loaded (v0.2.7)");
} catch (e) {}

// --- Live settings -----------------------------------------------------------------
let INV_CFG_CACHE = null;
function INV_cfg() {
    if (INV_CFG_CACHE) return INV_CFG_CACHE;
    let cfg;
    if (typeof SC_config === "function") {
        try {
            cfg = SC_config("Inventory Config", INV_SETTINGS, {
                description: "Settings for the Inventory module. Arbitration per verb: "
                    + "none (bookkeeping only), outcome (deed certain, consequences judged), "
                    + "gated (nothing happens unless the ruling allows it). "
                    + "Starting Items / Starting Wallet stock a NEW adventure on turn 1 — "
                    + "semicolon-separated, optional amounts, optional 'as <category>' to "
                    + "wear it from the start (e.g. 2 tonic; iron dagger; leather jerkin as armor). "
                    + "Edits apply on your next action."
            });
        } catch (e) {
            cfg = Object.assign({}, INV_SETTINGS);
        }
    } else {
        cfg = Object.assign({}, INV_SETTINGS);
    }
    // Sanity: policies must be one of the three; garbage falls back per key
    for (const k in INV_SETTINGS) {
        if (/_ARBITRATION$/.test(k)) {
            const v = String(cfg[k] || "").toLowerCase().trim();
            cfg[k] = (v === "none" || v === "outcome" || v === "gated") ? v : INV_SETTINGS[k];
        }
    }
    INV_CFG_CACHE = cfg;
    return cfg;
}

// --- The KIT (v0.2.7): what the scenario hands you before turn one ------------------
// Player request (TemporaryCrunch, 8/29): "is there a way to pre-plant items into
// the inventory?" — armor especially, since carrying it before wearing it is silly.
// Follows SkillKit's Starting Skills precedent exactly: a config-card line, the
// sanctioned card→code direction. Unlike a skill FLOOR this is a one-shot GRANT —
// items are spent, and a floor that kept restocking them would be a duplication
// glitch. Same segment grammar the player already knows from a multi-grab, plus
// the equip suffix, so a creator writes what they'd type:
//   Starting Items: 2 red healing tonic; iron dagger; leather jerkin as armor
//   Starting Wallet: 50 gold; 12 silver coins
// NOT undoable (it is scenario setup, not an act of yours) and never adjudicated.
function INV_seedKit(cfg) {
    const INV = INV_state();
    const spoken = [];
    const blank = function (s) { const v = String(s || "").trim().toLowerCase(); return !v || v === "(none)" || v === "none"; };
    const segs = function (line) {
        return String(line).split(/\s*;\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
    };
    if (!blank(cfg.STARTING_ITEMS)) {
        const list = segs(cfg.STARTING_ITEMS);
        for (let i = 0; i < list.length; i++) {
            let seg = list[i], cat = "";
            const asm = seg.match(new RegExp("^(.*?)\\s+as\\s+(" + INV_EQUIP_ALT + ")\\s*$", "i"));
            if (asm) { seg = asm[1].trim(); cat = asm[2].toLowerCase(); }
            const a = (typeof RX_amount === "function") ? RX_amount(seg, 1) : { amount: 1, remainder: seg };
            const name = String(a.remainder || "").trim();
            if (!name || name.length > INV_NAME_CAP) continue;
            const n = INV_add(name, Math.max(1, Math.min(INV_ITEM_CAP, a.amount)));
            if (n < 1) continue;
            if (cat && !INV_equipFind(name)) INV.equip[cat].push(name);
            spoken.push(name + " x" + n + (cat ? " (" + cat + ")" : ""));
        }
    }
    if (!blank(cfg.STARTING_WALLET)) {
        const list = segs(cfg.STARTING_WALLET);
        for (let i = 0; i < list.length; i++) {
            const a = (typeof RX_amount === "function") ? RX_amount(list[i], 0) : { amount: 0, remainder: list[i] };
            const cur = String(a.remainder || "").trim();
            if (!cur || cur.length > INV_NAME_CAP || a.amount < 1) continue;
            INV_walletAdd(cur, a.amount);
            spoken.push(a.amount + " " + cur + " (wallet)");
        }
    }
    if (spoken.length) {
        INV_report("starting kit: " + spoken.join(", "));
        INV_renderCard();
    }
}

function INV_policy(verb) {
    const cfg = INV_cfg();
    return cfg[verb.toUpperCase() + "_ARBITRATION"] || "outcome";
}

// --- State (schema-migrating) --------------------------------------------------------
function INV_state() {
    if (!state.vars || typeof state.vars !== "object") state.vars = {};
    if (!state.vars.INV || typeof state.vars.INV !== "object") state.vars.INV = {};
    const INV = state.vars.INV;
    if (!Array.isArray(INV.items)) INV.items = [];
    if (!INV.wallet || typeof INV.wallet !== "object") INV.wallet = {};
    if (!Array.isArray(INV.log)) INV.log = [];
    if (!Object.prototype.hasOwnProperty.call(INV, "pending")) INV.pending = null;
    if (typeof INV.opTurn !== "number") INV.opTurn = -1;
    if (!Object.prototype.hasOwnProperty.call(INV, "lastStub")) INV.lastStub = null;
    if (!Array.isArray(INV.echo)) INV.echo = [];
    if (typeof INV.seeded !== "boolean") INV.seeded = false;   // the Kit fires once (v0.2.7)
    if (!INV.equip || typeof INV.equip !== "object") INV.equip = {};
    for (let i = 0; i < INV_EQUIP_CATS.length; i++) {
        if (!Array.isArray(INV.equip[INV_EQUIP_CATS[i]])) INV.equip[INV_EQUIP_CATS[i]] = [];
    }
    return INV;
}

function INV_turn() {
    return (info && typeof info.actionCount === "number") ? info.actionCount : -1;
}

// --- Possession primitives (SIS's proven core) ----------------------------------------
function INV_count(name) {
    const k = String(name).toLowerCase();
    return INV_state().items.filter(s => String(s).toLowerCase() === k).length;
}

function INV_add(name, amount) {
    const INV = INV_state();
    const room = Math.max(0, INV_ITEM_CAP - INV_count(name));
    const n = Math.min(Math.max(1, amount), room);
    for (let i = 0; i < n; i++) INV.items.push(String(name));
    return n;
}

function INV_removeItems(name, amount) {
    const INV = INV_state();
    const k = String(name).toLowerCase();
    let left = amount;
    for (let i = INV.items.length - 1; i >= 0 && left > 0; i--) {
        if (String(INV.items[i]).toLowerCase() === k) { INV.items.splice(i, 1); left--; }
    }
    return amount - left;
}

function INV_walletGet(cur) { return INV_state().wallet[String(cur).toLowerCase()] || 0; }

function INV_walletAdd(cur, amount) {
    const INV = INV_state();
    const k = String(cur).toLowerCase();
    const next = Math.max(0, (INV.wallet[k] || 0) + amount);
    if (next === 0) delete INV.wallet[k]; else INV.wallet[k] = next;
}

// --- the Loadout (v0.2.0; the Tool v0.2.1): open categories ---------------------------
const INV_EQUIP_CATS = ["weapon", "armor", "clothes", "accessory", "tool"];
const INV_EQUIP_ALT = INV_EQUIP_CATS.join("|");    // one list drives parse + usage (v0.2.1)

function INV_equipFind(name) {
    const k = String(name).toLowerCase();
    const INV = INV_state();
    for (let i = 0; i < INV_EQUIP_CATS.length; i++) {
        const cat = INV_EQUIP_CATS[i];
        if (INV.equip[cat].some(n => String(n).toLowerCase() === k)) return cat;
    }
    return "";
}

// The Grab's guard (v0.2.4): search a candidate list HARD before concluding a
// miss — exact command match, then a candidate named inside the args ("the
// rusty dagger"), then the args inside a candidate ("dagger" → "rusty
// dagger"). One hit resolves; several refuse (never guess); zero is a true
// miss. RegexLib primitives, boundary-safe throughout.
function INV_looseMatch(candidates, args) {
    const names = [];
    const seen = {};
    for (let i = 0; i < candidates.length; i++) {
        const n = String(candidates[i]);
        if (!seen[n.toLowerCase()]) { seen[n.toLowerCase()] = true; names.push(n); }
    }
    const exact = RX_matchOne(names, args);
    if (exact) return { name: exact.match };
    const within = RX_findIn(names, args);
    if (within) return { name: within };
    const k = String(args || "").trim();
    if (k) {
        const rx = new RegExp("(?:^|[\\s,.;:!?('\"”])" + RX_escape(k) + "(?=[\\s,.;:!?)'\"”]|$)", "i");
        const hits = names.filter(function (n) { return rx.test(n); });
        if (hits.length === 1) return { name: hits[0] };
        if (hits.length > 1) return { ambiguous: hits };
    }
    return null;
}

// Slots never point at ghosts: anything no longer held unequips, reported.
function INV_validateEquip() {
    const INV = INV_state();
    for (let i = 0; i < INV_EQUIP_CATS.length; i++) {
        const cat = INV_EQUIP_CATS[i];
        for (let j = INV.equip[cat].length - 1; j >= 0; j--) {
            if (INV_count(INV.equip[cat][j]) < 1) {
                INV_report(INV.equip[cat][j] + " unequipped (" + cat + ") — no longer held");
                INV.equip[cat].splice(j, 1);
            }
        }
    }
}

// Public seam (SheetKit consumes): the gear as data.
function INV_readEquipment() {
    const out = [];
    try {
        INV_validateEquip();
        const INV = INV_state();
        for (let i = 0; i < INV_EQUIP_CATS.length; i++) {
            const cat = INV_EQUIP_CATS[i];
            for (let j = 0; j < INV.equip[cat].length; j++) out.push({ slot: cat, name: INV.equip[cat][j] });
        }
    } catch (e) {}
    return out;
}

function INV_logOp(kind, name, amount) {
    const INV = INV_state();
    INV.log.push({ kind: kind, name: String(name), amount: amount, turn: INV_turn() });
    if (INV.log.length > INV_UNDO_MAX) INV.log.shift();
}

// --- Card projection (state → card, never parsed back) ---------------------------------
function INV_renderCard() {
    if (typeof SC_render !== "function") return;
    INV_validateEquip();                            // v0.2.0: every render is a ghost-check
    const INV = INV_state();
    const wallet = Object.keys(INV.wallet).sort();
    const wLines = wallet.length ? wallet.map(k => "- " + k + ": " + INV.wallet[k]) : ["- (empty)"];
    const counts = {};
    for (const it of INV.items) counts[it] = (counts[it] || 0) + 1;
    const names = Object.keys(counts).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const iLines = names.length ? names.map(n => {
        const cat = INV_equipFind(n);               // annotation is RENDER-ONLY (owner caution 9)
        return "- " + n + " x " + counts[n] + (cat ? " (equipped: " + cat + ")" : "");
    }) : ["- (empty)"];
    const entry = "## Wallet\n" + wLines.join("\n") + "\n\n## Inventory\n" + iLines.join("\n");
    const card = SC_render("Inventory", entry, { type: SC_TYPE_GAMEPLAY, keys: "Inventory" });
    if (card) {
        const wantKeys = INV_cfg().INVENTORY_IN_CONTEXT
            ? (typeof SC_ALWAYS_ON === "string" ? SC_ALWAYS_ON : ".")
            : "Inventory";
        if (card.keys !== wantKeys) card.keys = wantKeys;
    }
}

// --- Reporting & echoes -------------------------------------------------------------------
function INV_report(line) {
    if (INV_cfg().REPORT && typeof SC_report === "function") {
        try { SC_report("Inventory", line); } catch (e) {}
    }
}

function INV_say(line) {
    INV_state().echo.push(String(line));
}

function INV_mark() {
    if (typeof GK_markCommandTurn === "function") {
        try { GK_markCommandTurn(); } catch (e) {}
    }
}

// --- Stub helpers ----------------------------------------------------------------------
function INV_qty(name, amount) { return amount > 1 ? amount + " " + name : "the " + name; }

// --- Input pass ------------------------------------------------------------------------
function INV_onInput(text) {
    const INV = INV_state();
    // Projections exist from Turn 1 (EB's ensure-on-input pattern): the
    // Inventory Config and Inventory cards materialize on the first player
    // action, not the first command. SC_render writes only on change, so
    // this never churns a card. Both degrade to no-ops without ParaCards.
    INV_cfg();
    // The Kit (v0.2.7): stock a NEW adventure, once. The turn guard matters —
    // an adventure already underway when this version lands must NOT have a
    // starting kit dumped into it at turn 200; it stamps `seeded` and grants
    // nothing. A creator adding the line mid-run is likewise ignored (say so
    // in the guide), which is the honest cost of never duplicating items.
    if (!INV.seeded) {
        INV.seeded = true;
        if (INV_turn() <= 1) { try { INV_seedKit(INV_cfg()); } catch (e) {} }
    }
    INV_renderCard();
    if (INV_cfg().REPORT && typeof SC_reportEnsure === "function") SC_reportEnsure();
    const t = String(text || "");
    if (typeof RX_command !== "function") return t;   // no Grammar, no commands

    const cmd = RX_command(t, INV_VERBS);
    if (!cmd) return t;

    // Retry guard: this turn already processed a command — replay the stub,
    // never re-mutate. (Edited retries with a DIFFERENT command re-process;
    // /undo covers the rare double. Documented limitation.)
    const turn = INV_turn();
    if (INV.opTurn === turn && INV.lastStub) return INV.lastStub;

    const verb = cmd.name === "inv" ? "inventory" : cmd.name;
    const args = cmd.args;
    let stub = null;

    // ---- meta verbs (never judged) ----
    if (verb === "inventory") {
        const counts = {};
        for (const it of INV.items) counts[it] = (counts[it] || 0) + 1;
        const items = Object.keys(counts).map(n => n + " x" + counts[n]).join(", ") || "nothing";
        const wallet = Object.keys(INV.wallet).map(k => INV.wallet[k] + " " + k).join(", ") || "empty wallet";
        INV_say("Inventory: " + items + " | " + wallet);
        INV_mark();
        stub = " ";
    } else if (verb === "undo") {
        const op = INV.log.pop();
        if (!op) {
            INV_say("Nothing to undo.");
        } else {
            if (op.kind === "add") { INV_removeItems(op.name, op.amount); }
            else if (op.kind === "remove") { INV_add(op.name, op.amount); }
            else if (op.kind === "wallet_add") { INV_walletAdd(op.name, -op.amount); }
            else if (op.kind === "wallet_remove") { INV_walletAdd(op.name, op.amount); }
            else if (op.kind === "swap_to_wallet") { INV_walletAdd(op.name, -op.amount); INV_add(op.name, op.amount); }
            else if (op.kind === "swap_to_items") { INV_removeItems(op.name, op.amount); INV_walletAdd(op.name, op.amount); }
            else if (op.kind === "equip") { INV.equip[op.cat] = INV.equip[op.cat].filter(n => n !== op.name); }
            else if (op.kind === "unequip") { INV.equip[op.cat].push(op.name); }
            else if (op.kind === "take_equip") { INV_removeItems(op.name, op.amount); INV.equip[op.cat] = INV.equip[op.cat].filter(n => n !== op.name); }   // the Grab: one undo, both halves (v0.2.4)
            INV_say("Undid: " + op.kind.replace("_", " ") + " " + op.name + " x" + op.amount);
            INV_report("undo: reversed " + op.kind.replace("_", " ") + " " + op.name + " x" + op.amount);
            INV_renderCard();
        }
        INV_mark();
        stub = " ";
    }

    // ---- /swap: ledger reclassification (meta, never judged) ----
    else if (verb === "swap") {
        const candidates = INV.items.concat(Object.keys(INV.wallet));
        const parsed = RX_nounAndAmount(candidates, args, 0);   // 0 = "all of them"
        if (!parsed) {
            INV_say("You don't have that to swap. (/swap 60 coins, or /swap coins for all)");
        } else {
            const held = INV_count(parsed.name);
            if (held > 0) {
                const want = parsed.amount > 0 ? Math.min(parsed.amount, held) : held;
                const n = INV_removeItems(parsed.name, want);
                INV_walletAdd(parsed.name, n);
                INV_logOp("swap_to_wallet", parsed.name, n);
                INV_say(parsed.name + " x" + n + " moved to your wallet.");
                INV_report(parsed.name + " x" + n + " moved items → wallet (/swap)");
            } else {
                const have = INV_walletGet(parsed.name);
                const want = parsed.amount > 0 ? Math.min(parsed.amount, have) : have;
                const added = INV_add(parsed.name, want);        // item cap may shrink it
                INV_walletAdd(parsed.name, -added);
                INV_logOp("swap_to_items", parsed.name, added);
                INV_say(parsed.name + " x" + added + " moved to your inventory."
                    + (added < want ? " (item cap reached)" : ""));
                INV_report(parsed.name + " x" + added + " moved wallet → items (/swap)");
            }
            INV_renderCard();
        }
        INV_mark(); stub = " ";
    }

    // ---- acquisitions ----
    else if (verb === "take" || verb === "collect") {
        const isWallet = (verb === "collect");
        const policy = INV_policy(verb);
        // v0.1.4 multi-grab: semicolon-separated segments, optional leading amounts.
        const segs = args.split(/\s*;\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
        const items = [];
        let bad = null;
        for (let i = 0; i < segs.length; i++) {
            const a = RX_amount(segs[i], 1);
            const nm = a.remainder.trim();
            if (!nm) { bad = "missing an item name in \"" + segs[i] + "\""; break; }
            if (nm.length > INV_NAME_CAP) { bad = "that name is too long (max " + INV_NAME_CAP + " characters)"; break; }
            items.push({ target: isWallet ? "wallet" : "items", name: nm, amount: a.amount });
        }
        if (!segs.length) {
            INV_say("What do you want to " + verb + "? Try /" + verb + " 3 torches; rope");
            INV_mark(); stub = " ";
        } else if (bad) {
            INV_say("Couldn't " + verb + ": " + bad);
            INV_mark(); stub = " ";
        } else {
            const parts = items.map(function (it) { return INV_qty(it.name, it.amount); });
            const spoken = parts.length === 1 ? parts[0]
                : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
            const plural = (items.length > 1 || items[0].amount > 1) ? "them" : "it";
            const receipt = items.map(function (it) { return it.name + " x" + it.amount; }).join(", ")
                + " added to your " + (isWallet ? "wallet" : "inventory") + ".";
            const commitAll = function () {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].target === "wallet") { INV_walletAdd(items[i].name, items[i].amount); INV_logOp("wallet_add", items[i].name, items[i].amount); }
                    else { INV_add(items[i].name, items[i].amount); INV_logOp("add", items[i].name, items[i].amount); }
                }
                INV_renderCard();
            };
            // ATTEMPT-phrased stubs for judged policies (the duck heist):
            // the stow-intent survives as purpose, not accomplishment.
            const attemptStub = "You attempt to take " + spoken + " and "
                + (isWallet ? "pocket " : "stow ") + plural + " away.";
            if (policy === "gated") {
                INV.pending = { kind: "gated-acquire", verb: verb, items: items, turn: turn };
                INV_report(receipt.replace(" added", " — gated, awaiting ruling"));
                stub = attemptStub;
            } else {
                commitAll();
                INV_report(receipt + " (/" + verb + ")");
                if (policy === "outcome") {
                    // Receipt DEFERRED to the ruling: printed only if the grab stands.
                    INV.pending = { kind: "outcome-acquire", verb: verb, items: items, receipt: receipt, turn: turn };
                    stub = attemptStub;
                } else {
                    INV_say(receipt);
                    INV_mark();
                    stub = "You take " + spoken + ", "
                        + (isWallet ? "pocketing " : "stowing ") + plural + " away.";
                }
            }
        }
    }

    // ---- expenditures ----
    // ---- the Loadout: /equip <item> [as] <category> · /unequip <item> (v0.2.0; bare category v0.2.1) ----
    else if (verb === "equip") {
        // The Preposition (v0.2.1–v0.2.2): the `as` split always wins; otherwise the
        // bare category may LEAD (/equip weapon iron dagger — the human order) or
        // TRAIL (/equip iron dagger weapon), and the split that resolves to a HELD
        // item wins (leading preferred). Items whose names start or end in a
        // category word need the `as` form (documented edge, amendment §9).
        let m = args.match(new RegExp("^(.*?)\\s+as\\s+(" + INV_EQUIP_ALT + ")\\s*$", "i"));
        if (!m) {
            const lead = args.match(new RegExp("^(" + INV_EQUIP_ALT + ")\\s+(.+)$", "i"));
            const trail = args.match(new RegExp("^(.*?)\\s+(" + INV_EQUIP_ALT + ")\\s*$", "i"));
            const leadN = lead ? [lead[0], lead[2], lead[1]] : null;   // reshaped to [full, item, cat]
            const resolves = function (s) { const h = INV_looseMatch(INV.items, s); return h && h.name; };
            m = (leadN && resolves(leadN[1])) ? leadN
                : (trail && resolves(trail[1])) ? trail
                : (leadN || trail);
        }
        // The Grab's guard (v0.2.4): the ledger is searched hard before any
        // take is implied — loose both ways; ambiguity refuses, never guesses.
        const held = m ? INV_looseMatch(INV.items, m[1]) : null;
        if (!m) { INV_say("Equip as what? (/equip " + (args || "<item>") + " as " + INV_EQUIP_ALT + ")"); INV_mark(); stub = " "; }
        else if (held && held.ambiguous) { INV_say("Equip which? (" + held.ambiguous.join(" | ") + ")"); INV_mark(); stub = " "; }
        else if (held && INV_equipFind(held.name)) { INV_say(held.name + " is already equipped (" + INV_equipFind(held.name) + ")."); INV_mark(); stub = " "; }
        else if (held) {
            const cat = m[2].toLowerCase();
            INV.equip[cat].push(held.name);
            INV.log.push({ kind: "equip", name: held.name, amount: 1, cat: cat, turn: turn });
            if (INV.log.length > INV_UNDO_MAX) INV.log.shift();
            INV_report(held.name + " equipped (" + cat + ")");
            if (INV_policy("equip") !== "outcome") INV_mark();
            stub = "You equip " + INV_qty(held.name, 1) + ".";   // uniform, category-free (v0.2.3, owner ruling)
            INV_renderCard();
        }
        // The GRAB (v0.2.4, owner ruling): a true ledger miss implies /take —
        // acquisition under the Take Arbitration policy, the equip riding the ruling.
        else {
            const name = m[1].trim();
            const cat = m[2].toLowerCase();
            if (!name) { INV_say("Equip what? (/equip <item> as " + INV_EQUIP_ALT + ")"); INV_mark(); stub = " "; }
            else if (name.length > INV_NAME_CAP) { INV_say("Couldn't take: that name is too long (max " + INV_NAME_CAP + " characters)"); INV_mark(); stub = " "; }
            else {
                const policy = INV_policy("take");
                const receipt = name + " x1 added to your inventory and equipped (" + cat + ").";
                if (policy === "gated") {
                    INV.pending = { kind: "gated-acquire", verb: "equip", items: [{ target: "items", name: name, amount: 1 }], equipCat: cat, turn: turn };
                    INV_report(name + " x1 — gated, awaiting ruling (/equip)");
                    stub = "You attempt to take " + INV_qty(name, 1) + " and equip it.";
                } else {
                    INV_add(name, 1);
                    INV.equip[cat].push(name);
                    INV.log.push({ kind: "take_equip", name: name, amount: 1, cat: cat, turn: turn });
                    if (INV.log.length > INV_UNDO_MAX) INV.log.shift();
                    INV_report(receipt + " (/equip)");
                    INV_renderCard();
                    if (policy === "outcome") {
                        // Receipt deferred to the ruling; a fail rolls the take back
                        // and the ghost sweep clears the equip with it.
                        INV.pending = { kind: "outcome-acquire", verb: "equip", items: [{ target: "items", name: name, amount: 1 }], receipt: receipt, turn: turn };
                        stub = "You attempt to take " + INV_qty(name, 1) + " and equip it.";
                    } else {
                        INV_say(receipt);
                        INV_mark();
                        stub = "You take " + INV_qty(name, 1) + " and equip it.";
                    }
                }
            }
        }
    }
    else if (verb === "unequip") {
        const all = [].concat.apply([], INV_EQUIP_CATS.map(c => INV.equip[c]));   // every category, always (v0.2.1)
        const it = INV_looseMatch(all, args);                                     // loose, same guard as equip (v0.2.4)
        if (!it) { INV_say("That isn't equipped. (/unequip <item>)"); INV_mark(); stub = " "; }
        else if (it.ambiguous) { INV_say("Unequip which? (" + it.ambiguous.join(" | ") + ")"); INV_mark(); stub = " "; }
        else {
            const cat = INV_equipFind(it.name);
            INV.equip[cat] = INV.equip[cat].filter(n => String(n).toLowerCase() !== it.name.toLowerCase());
            INV.log.push({ kind: "unequip", name: it.name, amount: 1, cat: cat, turn: turn });
            if (INV.log.length > INV_UNDO_MAX) INV.log.shift();
            INV_report(it.name + " unequipped (" + cat + ")");
            if (INV_policy("equip") !== "outcome") INV_mark();
            stub = "You unequip " + INV_qty(it.name, 1) + ".";   // symmetric with the equip stub (v0.2.3)
            INV_renderCard();
        }
    }
    // ---- unified consumption: /eat · /drink (v0.2.0, owner ruling — always adjudicated) ----
    else if (verb === "eat" || verb === "drink") {
        if (!args.trim()) { INV_say((verb === "eat" ? "Eat" : "Drink") + " what? (/" + verb + " <item>)"); INV_mark(); stub = " "; }
        else {
            const it = RX_matchOne(INV.items, args);
            if (!it) { INV_say("You don't have that to " + verb + ". (/" + verb + " " + args + ")"); INV_mark(); stub = " "; }
            else {
                INV_removeItems(it.match, 1);       // a REMOVE command (owner ruling); never refunded
                INV_logOp("remove", it.match, 1);
                INV_report(it.match + " x1 consumed (/" + verb + ") — efficacy by ruling");
                stub = "You " + verb + " " + INV_qty(it.match, 1) + ".";
                INV_renderCard();
                // NOT marked: the turn is adjudicated — the ruling prices the meal.
            }
        }
    }
    else if (verb === "drop" || verb === "give" || verb === "throw" || verb === "use") {
        const candidates = INV.items.concat(Object.keys(INV.wallet));
        const parsed = (verb === "use")
            ? (function () { const m = RX_matchOne(INV.items, args); return m ? { name: m.match, amount: 1, tail: RX_tail(m.remainder) } : null; })()
            : RX_nounAndAmount(candidates, args);
        if (!parsed) {
            INV_say("You don't have that. (/" + verb + " " + args + ")");
            INV_mark(); stub = " ";
        } else {
            const isWallet = !INV_count(parsed.name) && INV_walletGet(parsed.name) > 0;
            const have = isWallet ? INV_walletGet(parsed.name) : INV_count(parsed.name);
            if (parsed.amount > have) {
                INV_say("You only have " + have + " " + parsed.name + ".");
                INV_mark(); stub = " ";
            } else {
                const policy = INV_policy(verb);
                const doSpend = function () {
                    if (isWallet) { INV_walletAdd(parsed.name, -parsed.amount); INV_logOp("wallet_remove", parsed.name, parsed.amount); }
                    else { INV_removeItems(parsed.name, parsed.amount); INV_logOp("remove", parsed.name, parsed.amount); }
                    INV_renderCard();
                };
                const verbPhrase = verb === "use" ? "use" : verb;
                if (policy === "gated") {
                    INV.pending = { kind: "gated", verb: verb, target: isWallet ? "wallet" : "items", name: parsed.name, amount: parsed.amount, turn: turn, spend: true };
                    INV_report(parsed.name + " x" + parsed.amount + " — gated, awaiting ruling (/" + verb + ")");
                } else {
                    doSpend();
                    INV_report(parsed.name + " x" + parsed.amount + " removed (/" + verb + ")"
                        + (policy === "outcome" ? " — outcome pending" : ""));
                    if (policy === "none") INV_mark();
                }
                stub = "You " + verbPhrase + " " + INV_qty(parsed.name, parsed.amount) + (parsed.tail || "") + ".";
            }
        }
    }

    if (stub !== null) {
        INV.opTurn = turn;
        INV.lastStub = stub;
        return stub;
    }
    return t;
}

// --- Output pass --------------------------------------------------------------------------
function INV_onOutput(text) {
    const INV = INV_state();
    let out = String(text || "");
    const turn = INV_turn();

    // Resolve a pending operation against this turn's ruling
    const p = INV.pending;
    if (p && p.turn === turn) {
        let check = null;
        if (typeof GK_lastCheck === "function") {
            try { const c = GK_lastCheck(); if (c && c.turn === turn) check = c; } catch (e) {}
        }
        const failed = check && check.result === "fail";
        const commit = function () {
            if (p.spend) {
                if (p.target === "wallet") { INV_walletAdd(p.name, -p.amount); INV_logOp("wallet_remove", p.name, p.amount); }
                else { INV_removeItems(p.name, p.amount); INV_logOp("remove", p.name, p.amount); }
            } else {
                if (p.target === "wallet") { INV_walletAdd(p.name, p.amount); INV_logOp("wallet_add", p.name, p.amount); }
                else { INV_add(p.name, p.amount); INV_logOp("add", p.name, p.amount); }
            }
            INV_renderCard();
        };
        // v0.1.4: acquisitions carry an items array; migrate stale singles.
        const acq = p.items || (p.name ? [{ target: p.target, name: p.name, amount: p.amount }] : []);
        const acqSpoken = function () {
            const l = acq.map(function (it) { return INV_qty(it.name, it.amount); });
            return l.length === 1 ? l[0] : l.slice(0, -1).join(", ") + " and " + l[l.length - 1];
        };
        if (p.kind === "gated") {
            if (failed) {
                INV_say("The attempt fails — nothing " + (p.spend ? "spent" : "gained") + ".");
                INV_report("gated /" + p.verb + " cancelled (ruling: fail)");
            } else {
                commit();
                INV_report(p.name + " x" + p.amount + " " + (p.spend ? "removed" : "added") + " (gated /" + p.verb + " — ruling allowed)");
            }
        } else if (p.kind === "gated-acquire") {
            if (failed) {
                INV_say("The attempt fails — nothing gained.");
                INV_report("gated /" + p.verb + " cancelled (ruling: fail)");
            } else {
                for (let i = 0; i < acq.length; i++) {
                    if (acq[i].target === "wallet") { INV_walletAdd(acq[i].name, acq[i].amount); INV_logOp("wallet_add", acq[i].name, acq[i].amount); }
                    else { INV_add(acq[i].name, acq[i].amount); INV_logOp("add", acq[i].name, acq[i].amount); }
                }
                if (p.equipCat) {   // the Grab, gated (v0.2.4): the equip rides the allowed take
                    for (let i = 0; i < acq.length; i++) {
                        INV.equip[p.equipCat].push(acq[i].name);
                        INV.log.push({ kind: "equip", name: acq[i].name, amount: 1, cat: p.equipCat, turn: turn });
                        if (INV.log.length > INV_UNDO_MAX) INV.log.shift();
                        INV_report(acq[i].name + " equipped (" + p.equipCat + ")");
                    }
                }
                INV_renderCard();
                const receipt = acq.map(function (it) { return it.name + " x" + it.amount; }).join(", ")
                    + " added to your " + (p.verb === "collect" ? "wallet" : "inventory")
                    + (p.equipCat ? " and equipped (" + p.equipCat + ")" : "") + ".";
                INV_say(receipt);
                INV_report(receipt + " (gated /" + p.verb + " — ruling allowed)");
            }
        } else if (p.kind === "outcome-acquire") {
            if (failed) {
                // Roll back the whole optimistic grab: you reached, you didn't get it
                for (let i = 0; i < acq.length; i++) {
                    if (acq[i].target === "wallet") { INV_walletAdd(acq[i].name, -acq[i].amount); INV_logOp("wallet_remove", acq[i].name, acq[i].amount); }
                    else { INV_removeItems(acq[i].name, acq[i].amount); INV_logOp("remove", acq[i].name, acq[i].amount); }
                }
                INV_renderCard();
                INV_say("You failed to get " + acqSpoken() + ".");
                INV_report("/" + p.verb + " rolled back (ruling: fail)");
            } else if (p.receipt) {
                INV_say(p.receipt);       // the grab stands; the receipt is now true
            }
        }
        INV.pending = null;
    }

    // Surface queued player messages, GateKit-brace style
    if (INV.echo.length) {
        // The token shave (v0.2.5): a trailing period in the braces buys nothing.
        out = INV.echo.map(l => "{" + String(l).replace(/\.\s*$/, "") + "}").join("\n") + (out.trim() ? "\n\n" + out : "");
        INV.echo = [];
    }
    return out;
}
