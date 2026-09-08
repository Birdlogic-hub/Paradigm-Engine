// ===== RewindKit v0.1.0 =====
// v0.1.0 — the REWIND (proposal + veto pass resolved 8/13/2026, all leans:
//  Documentation/Design Proposals/The Rewind (RewindKit) - Design Proposal.md).
//  When the story rewinds, the engine follows — silently, completely,
//  without being asked. A ring of per-turn state snapshots (depth 5,
//  config-live) keyed by actionCount; a REGRESSION in the count means the
//  player erased story — restore the matching snapshot, which also
//  resurrects the correct turn-stamps (lastCheck/tallyTurn/opTurn...) and
//  kills the stale-stamp collision class engine-wide (live-found 8/13:
//  a replayed turn 8 inherited the dead turn 8's verdict). Same count =
//  retry — untouched, the existing convention. Erases deeper than the
//  ring REPORT loudly ("state may carry ghosts") and re-baseline — the
//  case law's lesson is that silence hides.
//  EXEMPT namespaces survive restores: RW itself and OB (telemetry about
//  erased turns is data, not ghosts; ObserverKit stamps replay records).
//  /undo is unchanged — the ledger micro-undo; Erase is now the sanctioned
//  story-level undo. Cards need nothing: projections re-render from
//  restored state next pass.
//
// WIRING (FIRST in ALL THREE tabs, every package — restoration must land
// before any module reads state):
//   Input:   text = RW_onInput(text);   // then the rest
//   Context: text = RW_onContext(text);
//   Output:  text = RW_onOutput(text);
// Namespace: RW. Consumes info.actionCount + SC_config/SC_report only.

const RW_SETTINGS = {
    ENABLED: true,     // the module; LIVE — card edits apply next action
    DEPTH: 5,          // snapshots kept (turns of erase coverage)
    REPORT: true       // Event Log lines on restore / beyond-depth
};
const RW_EXEMPT = ["RW", "OB"];   // namespaces a restore never touches (veto ruling 4)

let RW_CFG_CACHE = null;
function RW_cfg() {
    if (RW_CFG_CACHE) return RW_CFG_CACHE;
    let cfg;
    if (typeof SC_config === "function") {
        try {
            cfg = SC_config("Rewind Config", RW_SETTINGS, {
                header: "# Rewind Config\n> Erase story turns freely — the engine's state follows. Edit values after each colon."
            });
        } catch (e) { cfg = Object.assign({}, RW_SETTINGS); }
    } else cfg = Object.assign({}, RW_SETTINGS);
    RW_CFG_CACHE = cfg;
    return cfg;
}

function RW_state() {
    if (!state.vars || typeof state.vars !== "object") state.vars = {};
    if (!state.vars.RW || typeof state.vars.RW !== "object") state.vars.RW = {};
    const RW = state.vars.RW;
    if (!Array.isArray(RW.snaps)) RW.snaps = [];
    if (typeof RW.lastSeen !== "number") RW.lastSeen = -1;
    if (typeof RW.snapTurn !== "number") RW.snapTurn = -1;
    return RW;
}

function RW_turn() {
    return (info && typeof info.actionCount === "number") ? info.actionCount : -1;
}

function RW_report(line) {
    if (RW_cfg().REPORT && typeof SC_report === "function") {
        try { SC_report("Rewind", line); } catch (e) {}
    }
}

// Snapshot: the non-exempt half of state.vars, deep-copied (plain data is
// law), keyed by the actionCount it is the PRE-state of.
function RW_snapshot(turn, cfg) {
    const RW = RW_state();
    const src = {};
    for (const key in state.vars) { if (RW_EXEMPT.indexOf(key) === -1) src[key] = state.vars[key]; }
    let copy = null;
    try { copy = JSON.parse(JSON.stringify(src)); } catch (e) { return; }
    RW.snaps.push({ k: turn, s: copy });
    const depth = Math.max(1, Math.min(20, Math.round(Number(cfg.DEPTH)) || 5));
    while (RW.snaps.length > depth) RW.snaps.shift();
    RW.snapTurn = turn;
    RW.lastSeen = turn;
}

// Restore: the count regressed — the story was erased back to `turn`.
function RW_restore(turn, cfg) {
    const RW = RW_state();
    let snap = null;
    for (let i = RW.snaps.length - 1; i >= 0; i--) { if (RW.snaps[i].k === turn) { snap = RW.snaps[i]; break; } }
    RW.snaps = RW.snaps.filter(function (s) { return s.k <= turn; });   // dead futures die either way
    if (!snap) {
        // Beyond depth: report loudly, re-baseline from the ghosty present
        // (snapTurn stays stale so RW_tick takes a fresh snapshot for this turn).
        RW_report("erase beyond snapshot depth (" + cfg.DEPTH + " kept) — state may carry ghosts");
        RW.lastSeen = turn;
        return;
    }
    let restored = null;
    try { restored = JSON.parse(JSON.stringify(snap.s)); } catch (e) { return; }
    for (const key in state.vars) { if (RW_EXEMPT.indexOf(key) === -1) delete state.vars[key]; }
    for (const key in restored) { state.vars[key] = restored[key]; }
    RW.snapTurn = turn;              // snapshot(turn) is already the right pre-state; no re-take
    RW.lastSeen = turn;
    RW_report("story erased back to turn " + turn + " — engine state followed");
}

// One guard, three hooks. RW runs FIRST so everything downstream reads truth.
function RW_tick() {
    try {
        const cfg = RW_cfg();
        if (!cfg.ENABLED) return;
        const turn = RW_turn();
        if (turn === -1) return;
        const RW = RW_state();
        if (RW.lastSeen !== -1 && turn < RW.lastSeen) RW_restore(turn, cfg);
        if (RW_state().snapTurn !== turn) RW_snapshot(turn, cfg);   // new count (or re-baseline)
    } catch (e) {}
}

function RW_onInput(text)   { RW_tick(); return String(text || ""); }
function RW_onContext(text) { RW_tick(); return String(text || ""); }
function RW_onOutput(text)  { RW_tick(); return String(text || ""); }

// Load canary
try { if (typeof log === "function") log("[RewindKit] library loaded (v0.1.0)"); } catch (e) {}

// ===== RegexLib v0.1.1 =====
// script by bottledfox
//
// Paradigm Engine primitive: THE GRAMMAR.
// Player text is hostile: AID wraps it in narration ("> You /take sword."),
// auto-punctuates it, and quotes it in Say turns — and the nouns worth
// matching (items, NPCs, spells) are arbitrary strings no fixed grammar can
// anticipate. So the grammar is data: callers hand in their live candidate
// lists and RegexLib turns free text into clean commands and canonical nouns.
//
// Combed from the Endless Backrooms SIS parsing layer (the proven core:
// rxEscape / matchItem / normalizeCommandText / parseSlashCommand /
// parseItemAndAmount), generalized per doctrine:
//   - candidates are INJECTED — no module's state is read from in here
//   - commas survive normalization (SIS stripped them; PMD-style comma args
//     like "/recruit species, nickname" need them)
//   - trailing quotes from Say-framing are scrubbed (SIS left them on args)
//   - the inventory||wallet fallthrough stays with callers — that was SIS
//     plumbing, not grammar
//
// Stateless: pure functions, no hooks, no state namespace, nothing persisted.
//
// SEAMS:
//   RX_escape(s)                         regex-literal escape for any string
//   RX_normalize(text)                   scrub AID input framing (for commands)
//   RX_command(text, names?)             "/verb args" → {name, args} | null
//   RX_matchOne(candidates, text)        canonical noun at start of text
//   RX_findIn(candidates, text)          canonical noun anywhere in text
//   RX_amount(args, def?)                leading integer → {amount, remainder}
//   RX_nounAndAmount(candidates, args)   "3 potions" / "potions 3" ergonomics
//   RX_csv(s)                            comma list, trimmed, de-perioded
//   RX_tail(s)                           leftover text as a narration tail
//   RX_keyValue(line)                    "Key: value" / "key=value" → {key, value}
// ---------------------------------------------------------------------------

// Escape every regex metacharacter so any string can be dropped into a
// RegExp as a literal — the enabler for data-driven matching ("Wand (+1)").
function RX_escape(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Scrub AID's input framing so command parsing sees clean text.
// "> You /take sword."      → "/take sword"
// '> You say "/drop 3 x"'   → "/drop 3 x"
// Commas are preserved (comma-separated command args are legal grammar).
function RX_normalize(text) {
    let t = String(text || "").trim();              // FIRST: shed leading/trailing whitespace
    t = t.replace(/^\s*>\s*you\b[:\-]?\s*/i, "");   // strip "> You" action framing
    t = t.replace(/^[^/]*?(?=\/)/, "");             // drop anything before the first slash
    t = t.replace(/[\s.!?"'””'’]+$/, "");           // trailing junk in ONE class: whitespace,
                                                    // auto-punctuation, Say-quotes — in any
                                                    // order/mix ('."\n', '?!"', etc.)
    return t.trim();
}
// v0.1.1 (live-found by GateKit's /check, 7/13/2026): live AID input carries a
// trailing newline the harness never simulated. v0.1.0 stripped punctuation
// BEFORE trimming, so "/check.\n" kept its period and failed the command
// grammar. Trim first; strip all trailing junk as one class. Order-immune.

// Parse a slash command. Grammar: slash, identifier, optional args.
// `names` (string or array) optionally filters to a module's own verbs,
// so a cheap null answers "is this turn mine?".
function RX_command(text, names) {
    const t = RX_normalize(text);
    const m = t.match(/^\/([a-z][a-z0-9_]*)\b(?:\s+(.*))?$/i);
    if (!m) return null;
    const name = m[1].toLowerCase();
    if (names !== undefined) {
        const list = Array.isArray(names) ? names : [names];
        if (list.map(n => String(n).toLowerCase()).indexOf(name) === -1) return null;
    }
    return { name: name, args: (m[2] || "").trim() };
}

// Deduplicate + longest-first order: the guard against prefix capture
// ("key" must never shadow "key to the cellar").
function RX_prep(candidates) {
    const seen = {};
    const uniq = [];
    for (const c of (Array.isArray(candidates) ? candidates : [])) {
        const name = String(c || "").trim();
        if (!name) continue;
        const k = name.toLowerCase();
        if (!seen[k]) { seen[k] = true; uniq.push(name); }
    }
    uniq.sort((a, b) => b.length - a.length);
    return uniq;
}

// Match a known noun at the START of text. Case-insensitive for identity,
// case-preserving for display (returns the canonical candidate). The
// lookahead boundary is stricter than \b — it behaves around names ending
// in ")", "+", "'" — and consumes nothing, keeping the remainder intact.
function RX_matchOne(candidates, text) {
    const s = String(text || "").trim();
    if (!s) return null;
    for (const name of RX_prep(candidates)) {
        const rx = new RegExp("^\\s*" + RX_escape(name) + "(?=[\\s,.;:!?)'\"”]|$)", "i");
        const m = s.match(rx);
        if (m) return { match: name, remainder: s.slice(m[0].length).trim() };
    }
    return null;
}

// Find a known noun ANYWHERE in text (trigger/name detection — the
// Draftworlds world-matching and HoV gem-detection lineage). Longest-first,
// boundary-guarded on both sides.
function RX_findIn(candidates, text) {
    const s = String(text || "");
    if (!s) return null;
    for (const name of RX_prep(candidates)) {
        const rx = new RegExp("(?:^|[\\s,.;:!?('\"”])" + RX_escape(name) + "(?=[\\s,.;:!?)'\"”]|$)", "i");
        if (rx.test(s)) return name;
    }
    return null;
}

// Pull an optional leading integer. "/drop 3 potions" → {amount: 3, ...}.
function RX_amount(argStr, defaultAmount) {
    const def = (typeof defaultAmount === "number") ? defaultAmount : 1;
    const tokens = String(argStr || "").trim().split(/\s+/).filter(Boolean);
    if (tokens.length && /^\d+$/.test(tokens[0])) {
        return { amount: parseInt(tokens[0], 10), remainder: tokens.slice(1).join(" ") };
    }
    return { amount: def, remainder: String(argStr || "").trim() };
}

// The ergonomic core: amount-first OR noun-first, with a trailing-amount
// re-check. "/drop 3 potions", "/drop potions 3", "/drop potion" all work.
// Returns {name, amount, tail} or null when no candidate matches.
function RX_nounAndAmount(candidates, args, defaultAmount) {
    const def = (typeof defaultAmount === "number") ? defaultAmount : 1;
    const s = String(args || "").trim();
    if (!s) return null;
    const tokens = s.split(/\s+/);
    let amount, m;
    if (/^\d+$/.test(tokens[0])) {
        amount = parseInt(tokens[0], 10);                       // Case A: amount first
        m = RX_matchOne(candidates, tokens.slice(1).join(" "));
        if (!m) return null;
        const re = RX_amount(m.remainder, amount);              // trailing amount re-check
        amount = re.amount;
        return { name: m.match, amount: amount, tail: RX_tail(re.remainder) };
    }
    m = RX_matchOne(candidates, s);                             // Case B: noun first
    if (!m) return null;
    const re = RX_amount(m.remainder, def);
    return { name: m.match, amount: re.amount, tail: RX_tail(re.remainder) };
}

// Comma list → trimmed entries, trailing periods stripped, empties dropped.
function RX_csv(s) {
    if (!s) return [];
    return String(s).split(",").map(x => x.trim().replace(/\.+$/, "")).filter(Boolean);
}

// Leftover text as a narration tail (" on the table"), or "".
function RX_tail(argStr) {
    const t = String(argStr || "").trim();
    return t ? " " + t : "";
}

// One "Key: value" / "key=value" line → {key, value} | null.
// The delimiter tolerance lesson from GateKit's live tuning, made reusable.
function RX_keyValue(line) {
    const m = String(line || "").match(/^\s*([A-Za-z][A-Za-z0-9 _-]*?)\s*[=:]\s*(.+?)\s*$/);
    if (!m) return null;
    return { key: m[1].trim(), value: m[2].trim() };
}

// ===== CardLib v0.4.4 =====
// v0.4.4 — the LONGER LOG (owner call, 7/21): Event Log window 10 → 20,
//  guarded by a 990-char entry budget (the platform caps entries at 1000 —
//  live screenshot evidence): oldest events drop until the entry fits.
//  The ceiling outranks the cap; a shorter log beats a rejected write.
// v0.4.3: DESCRIPTION HEAL in SC_config (live-found 7/21 — the Trackers
//  Config NOTES still described v0.1.1 physics two reworks later, because
//  description was set only at card CREATION and module upgrades never
//  reached live adventures). Config-card NOTES are engine documentation,
//  part of the projection: when the caller declares one and the card
//  disagrees, the card heals — same doctrine as type and config-line heal.
// (né ParaCards, renamed 7/14/2026 — same module, same SC_ prefix)
// v0.4.2: TWO banners, split by FUNCTION (owner directive 7/21/2026 — nine
// cards under one banner stopped telling the player anything): "Gameplay"
// for cards the player READS (Event Log, Inventory, Skills, Trackers, the
// future Character Sheet), "Settings" for config cards the player EDITS.
// SC_TYPE_GAMEPLAY / SC_TYPE_SETTINGS are the public constants; SC_config
// defaults to Settings, SC_reportEnsure to Gameplay. v0.4.0's type-heal
// makes this a live migration: existing "ParadigmEngine" cards re-type
// themselves the first turn after the update, no player action needed.
// v0.4.0: card categories. The story-card panel groups by TYPE, so type is
// part of the projection: SC_ensure HEALS type (a card that drifts from
// its declared category is re-typed, same doctrine as config-line healing).
// v0.4.1 (superseded): one "ParadigmEngine" banner, mod-manager style.
// script by bottledfox
//
// Paradigm Engine primitive: THE PROJECTION.
// Gameplay state lives in state.vars; story cards are renderings of it —
// built by code, shown to player and model, never parsed back into state.
// The one sanctioned reverse direction is the CONFIG CARD: a card the player
// edits and code reads, making story cards the engine's settings UI
// (the Auto-Cards convention, proven again by SIS's Custom Commands card).
//
const SC_TYPE_GAMEPLAY = "Gameplay";   // cards the player reads
const SC_TYPE_SETTINGS = "Settings";   // cards the player edits

// Stateless by design: pure functions over the storyCards array. No hooks,
// no state namespace, nothing persisted — the only primitive that can say that.
//
// SEAMS:
//   SC_get(title) / SC_find(pred, all)   lookup
//   SC_ensure(title, opts)               idempotent create → card
//   SC_render(title, entry, opts)        projection write (only when changed)
//   SC_remove(title)                     delete by title
//   SC_config(title, defaults, opts)     editable settings card, typed round-trip
//   SC_reportEnsure()                    Event Log card exists (Turn-1 seam)
//   SC_ALWAYS_ON                         keys value that triggers every turn
//
// v0.3.2: SC_reportEnsure() — owners materialize the Event Log on their input
// pass (doctrine rule 11: projections exist from Turn 1, never lazily).
// Unconditional load canary (rule 8/10: environment bisection needs one).
// ---------------------------------------------------------------------------

// A lone period matches every turn — the always-on card trick (RESR's Condition).
const SC_ALWAYS_ON = ".";

// Load canary
try {
    if (typeof log === "function") log("[CardLib] library loaded (v0.4.4)");
} catch (e) {}

// --- Lookup ---------------------------------------------------------------------
function SC_find(pred, all) {
    if (typeof pred !== "function" || !Array.isArray(storyCards)) return all ? [] : null;
    if (all) return storyCards.filter(c => c && pred(c));
    for (const c of storyCards) {
        if (c && pred(c)) return c;
    }
    return null;
}

function SC_get(title) {
    return SC_find(c => c.title === title);
}

function SC_indexOf(title) {
    if (!Array.isArray(storyCards)) return -1;
    return storyCards.findIndex(c => c && c.title === title);
}

// --- Create / write ----------------------------------------------------------------
// Idempotent: returns the existing card, or creates one via the platform API
// (never by pushing raw objects — the API is authoritative; index drift is real).
// opts: { type = "Custom", keys = title, entry = "", description = "" }
function SC_ensure(title, opts) {
    opts = opts || {};
    let card = SC_get(title);
    if (card) {
        // Type is part of the projection: heal category drift (v0.4.0).
        if (opts.type && card.type !== opts.type) card.type = String(opts.type);
        return card;
    }
    addStoryCard(title, String(opts.entry || ""), opts.type || "Custom");
    card = SC_get(title);
    if (!card) return null;   // platform refused (duplicate keys elsewhere)
    if (opts.keys && opts.keys !== title) card.keys = String(opts.keys);
    if (opts.description) card.description = String(opts.description);
    return card;
}

// Projection write: state → card. Creates if missing; writes only on change
// so untouched cards don't churn their updatedAt.
function SC_render(title, entry, opts) {
    const card = SC_ensure(title, Object.assign({}, opts, { entry: entry }));
    if (!card) return null;
    const next = String(entry || "");
    if (card.entry !== next) card.entry = next;
    return card;
}

function SC_remove(title) {
    const i = SC_indexOf(title);
    if (i === -1) return false;
    removeStoryCard(i);
    return true;
}

// --- Config cards: the settings UI --------------------------------------------------
// SETTINGS_KEY → "Settings Key" (the player-facing label)
function SC_labelFor(key) {
    return String(key).toLowerCase().split("_")
        .map(w => w ? w[0].toUpperCase() + w.slice(1) : "")
        .join(" ");
}

function SC_rxEscape(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Coerce a player-typed value to the type of its default. Garbage → default.
function SC_coerce(raw, def) {
    const s = String(raw).trim();
    if (typeof def === "boolean") {
        if (/^(true|on|yes|1)$/i.test(s)) return true;
        if (/^(false|off|no|0)$/i.test(s)) return false;
        return def;
    }
    if (typeof def === "number") {
        const n = Number(s);
        return Number.isFinite(n) ? n : def;
    }
    return s || def;
}

// The editable settings card. Ensures a card rendering `defaults` as
// "Label: value" lines, parses the player-edited entry back with types
// inferred from the defaults, heals missing lines (module upgrades add
// settings without wiping player edits), and returns the merged object.
// Invalid edits silently fall back to the default for that key.
// opts: { type = "config", keys = title, header, description }
function SC_config(title, defaults, opts) {
    opts = opts || {};
    const header = opts.header
        || ("# " + title + "\n> Edit the values after each colon, then continue your story.");
    let card = SC_get(title);
    if (card) {
        const want = opts.type || SC_TYPE_SETTINGS;      // v0.4.2 heal on the found path
        if (card.type !== want) card.type = want;
        // v0.4.3: NOTES are engine docs — heal them so upgrades reach live cards.
        if (opts.description && card.description !== String(opts.description)) {
            card.description = String(opts.description);
        }
    }
    if (!card) {
        const lines = Object.keys(defaults).map(k => SC_labelFor(k) + ": " + String(defaults[k]));
        card = SC_ensure(title, {
            type: opts.type || SC_TYPE_SETTINGS,
            keys: opts.keys || title,
            entry: header + "\n\n" + lines.join("\n"),
            description: opts.description || ""
        });
        if (!card) return Object.assign({}, defaults);   // platform refused; run on defaults
    }
    const out = {};
    let entry = String(card.entry || "");
    let healed = false;
    for (const k in defaults) {
        const label = SC_labelFor(k);
        const rx = new RegExp("^\\s*" + SC_rxEscape(label) + "\\s*:\\s*(.+?)\\s*$", "im");
        const m = entry.match(rx);
        if (!m) {
            entry += "\n" + label + ": " + String(defaults[k]);
            healed = true;
            out[k] = defaults[k];
            continue;
        }
        out[k] = SC_coerce(m[1], defaults[k]);
    }
    if (healed) card.entry = entry;
    return out;
}

// --- The Codex: cards from an index, materialized on contact -----------------------
// Combed from Pokémon Mystery Dungeon's Pokédex registry (ensurePokemonCards):
// a catalog of potential cards, built into real story cards only when their
// subject actually enters the story text. Deterministic, data-driven, and
// cheap — Auto-Cards' living-world effect without generation cost.
//
// index: array of { title, entry, type?, aliases? }
//   aliases: extra names that also count as the subject appearing (e.g.
//   ["Pikachu", "the yellow mouse"]). The title always counts.
// text: whatever the caller wants scanned — player input, model output, or both.
// opts: { max }  cap on cards materialized per call (0/undefined = unlimited).
//
// Two-tier scan (PMD's efficiency, plus a fix for its latent bug):
//   1. one toLowerCase + native includes() per alias — fast prescreen, no regex
//   2. boundary-regex confirm ONLY on prescreen hits — so "Mew" no longer
//      materializes when "Mewtwo" walks in (includes() alone can't tell)
// Already-materialized titles are skipped via one Set built per call.
// Returns the array of titles created this call.
function SC_codex(index, text, opts) {
    const created = [];
    if (!Array.isArray(index) || !index.length) return created;
    const hay = String(text || "");
    if (!hay.trim()) return created;
    const hayLower = hay.toLowerCase();
    const max = (opts && typeof opts.max === "number" && opts.max > 0) ? opts.max : Infinity;

    // Existing titles, one pass
    const have = {};
    if (Array.isArray(storyCards)) {
        for (const c of storyCards) {
            if (c && c.title) have[String(c.title).toLowerCase()] = true;
        }
    }

    for (const e of index) {
        if (created.length >= max) break;
        if (!e || !e.title || !e.entry) continue;
        const title = String(e.title);
        if (have[title.toLowerCase()]) continue;

        const names = [title].concat(Array.isArray(e.aliases) ? e.aliases : []);
        let hit = null;
        for (const n of names) {
            const name = String(n || "").trim();
            if (!name) continue;
            // Tier 1: cheap substring prescreen
            if (hayLower.indexOf(name.toLowerCase()) === -1) continue;
            // Tier 2: boundary confirm (kills the Mew-in-Mewtwo false positive)
            const rx = new RegExp("(?:^|[^A-Za-z0-9])" + SC_rxEscape(name) + "(?=[^A-Za-z0-9]|$)", "i");
            if (rx.test(hay)) { hit = name; break; }
        }
        if (!hit) continue;

        const card = SC_ensure(title, {
            type: e.type || "codex",
            keys: names.join(","),
            entry: String(e.entry)
        });
        if (card) {
            have[title.toLowerCase()] = true;
            created.push(title);
        }
    }
    return created;
}

// --- The Event Log: the engine's rolling event log ---------------------------------
// A classic RPG event log: the last N ENGINE EVENTS, newest first (story card
// entries render top-down in the UI, so the most recent event sits at the
// top). Each event is one line, stamped with the turn it happened on:
//
//   T42 [Inventory] rock x1 removed (/throw)
//   T42 [GateKit] ruling: major difficulty -> partial (leaping) · luck 68
//   T41 [GateKit] ruling: trivial difficulty -> success · luck 12
//
// Stateless trick: the CARD is the archive — events are parsed from the entry
// itself, so ParaCard keeps no state. Retry re-posts dedupe by exact line;
// an Erase (actionCount rewinds) drops events from erased turns first.
// Keys are title-scoped — the log is player UI, never model context.
const SC_REPORT_CARD = "Event Log";
const SC_REPORT_EVENTS = 20;         // v0.4.4 (owner call 7/21): was 10
const SC_REPORT_CHAR_BUDGET = 990;   // the platform's 1000-char entry ceiling, with headroom
const SC_REPORT_HEADER = "# Event Log — most recent first";

// Turn-1 materialization seam (doctrine rule 11): owner modules call this on
// their input pass so the Event Log is visible from the first action — an
// empty log card, header only, instead of a card that hides until first post.
function SC_reportEnsure() {
    return SC_ensure(SC_REPORT_CARD, {
        type: SC_TYPE_GAMEPLAY,
        keys: SC_REPORT_CARD,
        entry: SC_REPORT_HEADER,
        description: "The engine's event log: the last " + SC_REPORT_EVENTS
            + " engine events, most recent first. Rewrites itself as you play."
    });
}

function SC_report(owner, line, turnNo) {
    const msg = "[" + String(owner || "engine") + "] " + String(line || "").trim();
    if (msg.length < 4) return null;
    const turn = (typeof turnNo === "number") ? turnNo
        : (typeof info === "object" && info && typeof info.actionCount === "number")
            ? info.actionCount : -1;
    const event = "T" + turn + " " + msg;
    const card = SC_reportEnsure();
    if (!card) return null;

    // Parse existing events from the entry (lines shaped "T<turn> [...] ...")
    const events = [];
    for (const l of String(card.entry || "").split("\n")) {
        const m = l.match(/^T(-?\d+)\s+(\[.*)$/);
        if (m) events.push({ turn: parseInt(m[1], 10), text: l.trim() });
    }

    // Erase rewinds actionCount: drop events from turns that no longer exist
    let kept = events.filter(e => e.turn <= turn);

    // Retry dedupe: identical event for this turn already logged
    if (!kept.some(e => e.turn === turn && e.text === event)) {
        kept.unshift({ turn: turn, text: event });   // newest first
    }
    kept = kept.slice(0, SC_REPORT_EVENTS);

    // v0.4.4: the entry ceiling outranks the event cap — drop oldest until it fits
    // (rule 7: a shorter log, never a rejected write).
    let entry = SC_REPORT_HEADER + "\n" + kept.map(e => e.text).join("\n");
    while (kept.length > 1 && entry.length > SC_REPORT_CHAR_BUDGET) {
        kept.pop();
        entry = SC_REPORT_HEADER + "\n" + kept.map(e => e.text).join("\n");
    }

    card.entry = entry;
    return card;
}

// ===== GateKit v0.8.3 =====
// v0.8.3 — the OBSERVATORY SEAM (proposal veto ruling 2, 8/12/2026):
//  GK_lastCheck() widens with `dialect` (skillFirst|bare|difficultyFirst|
//  legacy) and `raw` (the verdict line as the model wrote it, 160 cap) —
//  additive, no consumer breaks. The bare dialect now NAMES itself (it
//  reported skillFirst since v0.8.1; same group layout, so parsing is
//  unchanged — only the label). ObserverKit is the first consumer.
// v0.8.2 — GK_isCommandTurn(), the read half of the bookkeeping stamp
//  (EventKit build, 7/21): extensions could MARK a turn non-adjudicable
//  but not ASK about one — TrackerKit's drift deviation documented the
//  gap ("public-seam contract forbids reading GK's command stamp").
//  Now they ask, not peek. One getter, no behavior change.
// v0.8.1 — the BARE dialect (live-found 7/16, minutes into v0.8.0):
//  'Survival; trivial; success; resource=none;' — the model kept the field
//  ORDER sacred and shed every label, and the line walked through both the
//  parser and the near-miss net (which looks for labels) into the story.
//  Fix: parse the bare positional dialect (same group layout as skill-
//  first), and widen the near-miss detector to know 'resource'.
// v0.8.0 — the COST (first schema event; owner directive 7/16): the verdict
//  line grows one optional trailing field, resource=none|name -n|name +n.
//  BIDIRECTIONAL: the model reports meaningful spends (-) AND restores (+)
//  of resources named in its notes — /use item efficacy rides this channel
//  (InventoryKit consumes deterministically; the ruling says what it did).
//  Static field, closed vocabulary (the enabled resource names) — the same
//  class as skill=, NOT the rejected per-scenario dynamic deltas. GateKit
//  stores {resource, resourceDelta} raw; TrackerKit clamps (25%/turn cap)
//  and applies. Optional + trailing = fully backward compatible.
// v0.7.2 — the DIE, stage one (owner's call, 7/16): luck is an EXPLICIT d20.
//  The d20 is the most conventionalized random number in the training data;
//  naming it borrows the DM's outcome mapping outright (2 misses, 19
//  crushes) where a d100 percentile maps to nothing. Luck Min/Max leave the
//  config card — a configurable die would destroy the convention that makes
//  this work — but the INTERNAL bounds survive below as the private seam the
//  future spine rides (roll a narrowed range while stating a d20). Verdict
//  schema untouched; crit thresholds deferred (v0.8 candidate c). Old
//  adventures' config cards keep stale Luck Min/Max lines — unread, harmless.
// v0.7.1 — the NOTE seam: GK_setArbiterNote(owner, line). Extensions hand
//  the arbiter one line each (data, not functions); GateKit renders every
//  note inside its EXISTING block, after the luck line — zero extra context
//  blocks, which is the whole point (SkillKit proposal §3: one arbiter
//  voice, not two tail blocks). Capped 160 chars/owner; set "" to clear.
//  First consumer: SkillKit (the Skill).
// script by bottledfox
//
// Paradigm Engine primitive: THE CHECK.
// Code cannot judge story consistency; the model can. So: pose one question
// about the player's action in the strongest context position, receive one
// machine-readable ruling in-band, and expose it as engine state for other
// primitives to consume.
//
// LINEAGE (all changes playtest-driven; full history in ROADMAP):
//   v0.4.x — schema-migrating state; delivery-first Recent-Story trimming vs
//     maxChars; non-adjudicable command turns; semantic do/say/story guard;
//     difficulty-first verdict schema (premise before conclusion); =/: delimiter
//     tolerance; impossible=>fail backstop; near-miss telemetry ("prompt
//     strictly, parse generously"). LIVE-PROVEN 7/13/2026.
//   v0.5.x — "GateKit Config" card via ParaCard (SC_config); /check parsing via
//     RegexLib (RX_command). First Core consumer.
//   v0.6.0 — /check REMOVED (the config card superseded it; its live failure
//     found RegexLib v0.1.1's normalizer bug on the way out). The Enabled
//     switch is now LIVE: read from the config card every turn — edit the card
//     mid-game to toggle the checker. NEW SEAM: GK_markCommandTurn() lets any
//     module (Inventory's /undo, /inventory, ...) stamp the current turn as
//     pure bookkeeping so the arbiter skips it. Echo channel removed with its
//     only user.
//   v0.6.1 — posts each turn's ruling to the "Event Log" card
//     (ParaCard's SC_report — the engine's player-facing event log). Live
//     Report switch in the config card.
//
// WIRING:
//   Input tab:    text = GK_onInput(text);       // per-action luck roll
//   Context tab:  text = GK_onContext(text);     // LAST, after other passes
//   Output tab:   text = GK_onOutput(text);      // FIRST, before other passes
//                 text = GK_onOutputDebug(text); // optional, while playtesting
//
// SEAMS (for other modules):
//   GK_lastCheck()        → {result, difficulty, skill, luck, turn} | null
//   GK_setLuck(n)         → supply/bend this action's luck (clamped to range)
//   GK_markCommandTurn()  → stamp this turn non-adjudicable (bookkeeping)
//   GK_isCommandTurn()    → is this turn stamped? (v0.8.2 — ask, don't peek)
//   GK_setArbiterNote(owner, line) → one rendered line in the arbiter block (160 cap)
// ---------------------------------------------------------------------------

// Defaults. With ParaCard present these seed the editable "GateKit Config"
// card and back-fill any line the player deletes or mangles.
const GK_SETTINGS = {
    ENABLED: true,              // the checker; LIVE — card edits apply next action
    REPORT: true,               // post rulings to the "Event Log" card (needs ParaCard)
    SHOW_TOAST: false,          // state.message — NOT implemented on Phoenix UI
    DEBUG_CONSOLE: true,        // mirror GK activity to the editor's CONSOLE LOG
    DEBUG_FOOTER: false         // GK_onOutputDebug appends a visible footer (playtesting)
};

// The die (v0.7.2): FIXED d20, stated to the model by name. Private bounds —
// not config — because the convention is the mechanism. The future spine
// narrows GK_DIE_ROLL_MAX while the prompt keeps saying d20 (loaded dice).
const GK_DIE_MIN = 1;
const GK_DIE_MAX = 20;          // stated die size (never change casually)
const GK_DIE_ROLL_MAX = 20;     // actual roll ceiling (the spine seam)

function GK_rollDie() {
    return GK_DIE_MIN + Math.floor(Math.random() * (GK_DIE_ROLL_MAX - GK_DIE_MIN + 1));
}

// The arbiter block. {{LUCK}} substituted at context time.
const GK_PROMPT = [
    "<SYSTEM>",
    "You are the silent arbiter of player actions. Before narrating, decide the outcome of the player's most recent action based on story consistency and luck.",
    "luck={{LUCK}} (a d20 roll)",
    "Read the luck roll as a dungeon master reads a d20: 1 is the worst possible luck, 20 the best. Luck does not apply to impossible or trivial actions.",
    "First output EXACTLY one line — name the skill involved, THEN judge its difficulty, THEN the check, THEN any resource spent or restored:",
    "skill=name; difficulty=trivial|minor|major|impossible; check=success|partial|fail; resource=none|name -amount|name +amount;",
    "Rules: impossible always fails. Trivial always succeeds. Luck sways only minor and major attempts. Use skill=none when no particular skill applies. resource: report a meaningful spend (-) or restore (+) of a resource listed in your notes (e.g. resource=stamina -6, or resource=health +10 when something heals you); otherwise resource=none.",
    "Then continue the story, honoring the verdict.",
    "</SYSTEM>"
].join("\n");

// Load canary: appears in Console Log / Script Test logs on EVERY hook run.
// If you don't see this line, the Library isn't attached, saved, or executing.
try {
    if (GK_cfg().DEBUG_CONSOLE) log("[GateKit] library loaded (v0.8.1)");
} catch (e) {}

// Verdict line emitted by the model (v0.7.0 skill-first schema: the model
// names the skill, then reasons difficulty, then concludes the check —
// premise before conclusion, now including WHICH premise).
// Delimiters =/: and separators ;/, accepted — prompt strictly, parse generously.
const GK_VERDICT_RX = /^\s*skill\s*[=:]\s*([^;\n]+?)\s*[;,]\s*difficulty\s*[=:]\s*(trivial|minor|major|impossible)\s*[;,]\s*check\s*[=:]\s*(success|partial|fail)\s*[;,]?(?:\s*resource\s*[=:]\s*([^;\n]+?)\s*[;,]?)?\s*$/im;

// v0.8.1 — the BARE dialect (live-found): labels dropped, order kept.
// "Survival; trivial; success; resource=none;" — same group layout as
// skill-first, so it maps identically after matching.
const GK_VERDICT_RX_BARE = /^\s*([a-z][a-z0-9 '\-]{0,40}?)\s*[;,]\s*(trivial|minor|major|impossible)\s*[;,]\s*(success|partial|fail)\s*[;,]?(?:\s*resource\s*[=:]\s*([^;\n]+?)\s*[;,]?)?\s*$/im;

// v0.4–v0.6 order (difficulty-first, skill optional trailing), still accepted —
// models echo old context, and skill-less rulings arrive in this shape.
const GK_VERDICT_RX_DFIRST = /^\s*difficulty\s*[=:]\s*(trivial|minor|major|impossible)\s*[;,]\s*check\s*[=:]\s*(success|partial|fail)\s*[;,]?\s*(?:skill\s*[=:]\s*([^;\n]+?)\s*[;,]?\s*)?$/im;
// Legacy order (check-first), still accepted — models sometimes echo old context.
const GK_VERDICT_RX_LEGACY = /^\s*check\s*[=:]\s*(success|partial|fail)\s*[;,]\s*difficulty\s*[=:]\s*(trivial|minor|major|impossible)\s*[;,]?\s*(?:skill\s*[=:]\s*([^;\n]+?)\s*[;,]?\s*)?$/im;

// --- Live settings ---------------------------------------------------------------
// The editable "GateKit Config" card when ParaCard is present, built-in
// defaults otherwise. Cached per hook execution (the Library re-runs before
// each hook, so the cache naturally refreshes every pass).
let GK_CFG_CACHE = null;
function GK_cfg() {
    if (GK_CFG_CACHE) return GK_CFG_CACHE;
    let cfg;
    if (typeof SC_config === "function") {
        try {
            cfg = SC_config("GateKit Config", GK_SETTINGS, {
                description: "Settings for GateKit (the silent checker). Edit values in the entry; "
                    + "changes apply on your next action. Deleted or invalid lines fall "
                    + "back to defaults. Enabled toggles the checker on/off."
            });
        } catch (e) {
            cfg = Object.assign({}, GK_SETTINGS);
        }
    } else {
        cfg = Object.assign({}, GK_SETTINGS);
    }
    GK_CFG_CACHE = cfg;
    return cfg;
}

// --- State (schema-migrating) --------------------------------------------------
// Never trust the shape of persisted state: an adventure may carry a GK object
// written by ANY earlier version. Backfill field-by-field; sweep dead fields.
function GK_state() {
    if (!state.vars || typeof state.vars !== "object") state.vars = {};
    if (!state.vars.GK || typeof state.vars.GK !== "object") state.vars.GK = {};
    const GK = state.vars.GK;
    if (typeof GK.luck !== "number") GK.luck = null;
    if (typeof GK.luckTurn !== "number") GK.luckTurn = -1;
    if (typeof GK.commandTurn !== "number") GK.commandTurn = -1;
    if (!Object.prototype.hasOwnProperty.call(GK, "lastCheck")) GK.lastCheck = null;
    if (!Array.isArray(GK.log)) GK.log = [];
    if (!GK.notes || typeof GK.notes !== "object") GK.notes = {};
    for (const k in GK.notes) {
        if (typeof GK.notes[k] !== "string" || GK.notes[k] === "") delete GK.notes[k];
    }
    delete GK.on;     // v0.5.x runtime toggle — superseded by live cfg.ENABLED
    delete GK.echo;   // v0.5.x /check reply channel — removed with /check
    return GK;
}

function GK_turn() {
    return (info && typeof info.actionCount === "number") ? info.actionCount : -1;
}

function GK_log(msg) {
    const GK = GK_state();
    GK.log.push("[" + GK_turn() + "] " + msg);
    if (GK.log.length > 20) GK.log.shift();
    if (GK_cfg().DEBUG_CONSOLE) {
        try { log("[GateKit " + GK_turn() + "] " + msg); } catch (e) {}
    }
}

// --- Seams -----------------------------------------------------------------------
// Latest ruling, for any module that wants to react to it.
function GK_lastCheck() {
    return GK_state().lastCheck;
}

// Another module may supply or bend this action's luck (clamped to range).
// Call during the Input pass.
function GK_setLuck(value) {
    const GK = GK_state();
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    GK.luck = Math.max(GK_DIE_MIN, Math.min(GK_DIE_MAX, Math.round(n)));
    GK.luckTurn = GK_turn();
}

// Stamp the current turn as pure bookkeeping (a swallowed slash command, a
// meta action) so the arbiter skips it. Call from any module's Input pass.
function GK_markCommandTurn() {
    GK_state().commandTurn = GK_turn();
}

// v0.8.2: the read half of the stamp — extensions ask, never peek.
function GK_isCommandTurn() {
    return GK_state().commandTurn === GK_turn();
}

// v0.7.1 — the NOTE seam. An extension supplies ONE line the arbiter should
// see (ranks, world state, gauges); GateKit renders all notes inside its
// existing block, after the luck line. Notes persist until their owner
// overwrites or clears them (line "" deletes). Data only; 160 chars/owner.
function GK_setArbiterNote(owner, line) {
    const GK = GK_state();
    const key = String(owner == null ? "" : owner).trim();
    if (key === "") return;
    const s = String(line == null ? "" : line).replace(/\s+/g, " ").trim();
    if (s === "") { delete GK.notes[key]; return; }
    GK.notes[key] = s.slice(0, 160);
}

// --- Input: per-action luck roll ---------------------------------------------------
function GK_onInput(text) {
    const GK = GK_state();
    // One luck roll per action; retries of the same action reuse it.
    const turn = GK_turn();
    if (GK.luckTurn !== turn) {
        const cfg = GK_cfg();
        GK.luckTurn = turn;
        GK.luck = GK_rollDie();
        // v0.6.2, doctrine rule 11: projections exist from Turn 1 — the
        // Event Log materializes here, not on the first ruling post.
        if (cfg.REPORT && cfg.ENABLED && typeof SC_reportEnsure === "function") SC_reportEnsure();
    }
    return String(text || "");
}

// --- Context: append the arbiter block at the strongest position ----------------
function GK_onContext(text) {
    const GK = GK_state();
    let ctx = String(text || "");
    const cfg = GK_cfg();
    if (!cfg.ENABLED) return ctx;   // LIVE switch — the config card decides

    // Bookkeeping turns aren't adjudicable (GK_markCommandTurn seam).
    if (GK.commandTurn === GK_turn()) return ctx;

    // Semantic guard: only real player actions get adjudicated. Starts,
    // Continues, and see-turns are not player narrative actions.
    try {
        const last = history && history[history.length - 1];
        if (!last || ["do", "say", "story"].indexOf(last.type) === -1) return ctx;
    } catch (e) {}

    // Roll here too in case no input pass ran this action (safety net).
    const turn = GK_turn();
    if (GK.luckTurn !== turn || GK.luck == null) {
        GK.luckTurn = turn;
        GK.luck = GK_rollDie();
    }

    let block = GK_PROMPT
        .replace(/\{\{\s*LUCK\s*\}\}/gi, String(GK.luck));

    // v0.7.1: extension notes ride the existing block, after the luck line —
    // one arbiter voice, zero extra tail blocks (the note seam's contract).
    const noteKeys = Object.keys(GK.notes || {}).sort();
    if (noteKeys.length) {
        block = block.replace(/^(luck=.*)$/m, "$1\n" + noteKeys.map(k => GK.notes[k]).join("\n"));
    }

    // Delivery-first capacity policy: the injection is the module's job.
    const maxChars = (info && typeof info.maxChars === "number") ? info.maxChars : 0;
    const overflow = maxChars > 0 ? (ctx.length + block.length + 2) - maxChars : 0;
    if (overflow > 0) {
        const trimmed = GK_trimRecentStory(ctx, overflow);
        if (trimmed.length < ctx.length) {
            ctx = trimmed;
        } else {
            GK_log("no Recent Story header; injecting with ~" + overflow + " char overflow");
        }
    }
    return (ctx ? ctx + "\n\n" : "") + block;
}

// Remove ~n chars of the OLDEST sentences from the Recent Story portion.
// Returns the original context unchanged if no header is found.
function GK_trimRecentStory(ctx, n) {
    const m = ctx.match(/^\s*Recent Story\s*:?\s*$/im);
    if (!m || typeof m.index !== "number") return ctx;
    const bodyStart = m.index + m[0].length;
    const head = ctx.slice(0, bodyStart);
    let body = ctx.slice(bodyStart);
    let removed = 0;
    while (removed < n) {
        const cut = body.search(/[.!?…]\s+/);
        if (cut === -1) break;
        const sep = body.slice(cut).match(/^[.!?…]\s+/)[0].length;
        removed += cut + sep;
        body = body.slice(cut + sep);
    }
    GK_log("trimmed " + removed + " chars of oldest Recent Story to fit the arbiter block");
    return head + "\n" + body.trimStart();
}

// --- Output: capture the ruling, hide the scaffolding ----------------------------
let GK_DEBUG_RAW = null;   // raw model output, captured before any stripping

function GK_onOutput(text) {
    const GK = GK_state();
    let out = String(text || "");
    GK_DEBUG_RAW = out;

    let m = out.match(GK_VERDICT_RX);            // v0.7 skill-first
    let dialect = "skillFirst";
    if (!m) { m = out.match(GK_VERDICT_RX_BARE); if (m) dialect = "bare"; }   // v0.8.1: skill-first group layout
    if (!m) { m = out.match(GK_VERDICT_RX_DFIRST); dialect = "difficultyFirst"; }
    if (!m) { m = out.match(GK_VERDICT_RX_LEGACY); dialect = "legacy"; }
    if (!m) {
        // Near-miss detector: an attempted verdict in a dialect we don't parse
        // yet. Strip it anyway (scaffolding must never reach the player) and
        // log it verbatim so each model rotation reports its own format.
        const first = out.split("\n").find(l => l.trim()) || "";
        if (first.length < 160
            && /\b(difficulty|check|skill|resource)\s*[-=:]/i.test(first)
            && /\b(trivial|minor|major|impossible|success|partial|fail)\b/i.test(first)) {
            GK_log("UNPARSED verdict-like line (add to parser): \"" + first.trim() + "\"");
            out = out.replace(first, "").replace(/\n{3,}/g, "\n\n").trim();
        }
    }
    if (m) {
        // Per-dialect group mapping: skillFirst/bare = s/d/c, difficultyFirst = d/c/s, legacy = c/d/s
        const sfLayout = (dialect === "skillFirst" || dialect === "bare");   // bare shares the layout (v0.8.3)
        let result = (sfLayout ? m[3] : dialect === "legacy" ? m[1] : m[2]).toLowerCase();
        const difficulty = (sfLayout ? m[2] : dialect === "legacy" ? m[2] : m[1]).toLowerCase();
        const rawSkill = sfLayout ? m[1] : m[3];
        // Normalize non-skills to null ("none", "n/a", "-", "null", "nothing")
        let skill = rawSkill ? rawSkill.trim().toLowerCase() : null;
        if (skill && /^(none|n\/a|na|null|nothing|-+)$/.test(skill)) skill = null;
        // Deterministic backstop for contradictory rulings (seen live: success/impossible)
        if (difficulty === "impossible" && result !== "fail") {
            GK_log("coerced contradictory ruling " + result + "/impossible -> fail/impossible");
            result = "fail";
        }
        // v0.8.0 the Cost: optional bidirectional resource field (skill-first dialect)
        let resource = null, resourceDelta = 0;
        const rawRes = (sfLayout && m[4]) ? m[4].trim() : "";
        if (rawRes !== "" && !/^(none|n\/a|na|null|-+)$/i.test(rawRes)) {
            const rm = rawRes.match(/^([a-z][a-z0-9 '\-]*?)\s*([+-])\s*(\d+)$/i);
            if (rm) {
                resource = rm[1].trim().toLowerCase();
                resourceDelta = parseInt(rm[3], 10) * (rm[2] === "-" ? -1 : 1);
            } else {
                GK_log("UNPARSED resource field (add to parser): \"" + rawRes + "\"");
            }
        }
        GK.lastCheck = {
            result: result,
            difficulty: difficulty,
            skill: skill,
            resource: resource,
            resourceDelta: resourceDelta,
            luck: GK.luck,
            dialect: dialect,                        // parse metadata (v0.8.3, the Observatory's seam)
            raw: m[0].trim().slice(0, 160),          // the verdict line as the model wrote it
            turn: GK_turn()
        };
        out = out.replace(m[0], "").replace(/\n{3,}/g, "\n\n").trim();
        if (GK_cfg().SHOW_TOAST) {
            state.message = "Check: " + GK.lastCheck.difficulty + "/" + GK.lastCheck.result;
        }
        GK_log("difficulty=" + GK.lastCheck.difficulty + " check=" + GK.lastCheck.result + " luck=" + GK.luck);
    }

    // Event Log — the player-facing event log (ParaCard's SC_report).
    // Only on turns the arbiter was actually watching: enabled, player action,
    // not stamped as bookkeeping.
    try {
        const cfg = GK_cfg();
        if (cfg.REPORT && cfg.ENABLED && typeof SC_report === "function") {
            const last = history && history[history.length - 1];
            const playerTurn = last && ["do", "say", "story"].indexOf(last.type) !== -1;
            if (GK.commandTurn === GK_turn()) {
                SC_report("GateKit", "bookkeeping turn — not judged");
            } else if (playerTurn && m) {
                SC_report("GateKit", "ruling: " + GK.lastCheck.difficulty + " difficulty → "
                    + GK.lastCheck.result
                    + (GK.lastCheck.skill ? " (" + GK.lastCheck.skill + ")" : "")
                    + (GK.lastCheck.resource ? " · " + GK.lastCheck.resource + " "
                        + (GK.lastCheck.resourceDelta > 0 ? "+" : "") + GK.lastCheck.resourceDelta : "")
                    + " · luck " + (GK.luck == null ? "-" : GK.luck));
            } else if (playerTurn) {
                SC_report("GateKit", "no ruling captured · luck " + (GK.luck == null ? "-" : GK.luck));
            }
        }
    } catch (e) {}
    return out;
}

// ============================ GK DEBUG SECTION =================================
// Playtest instrumentation. Wire AFTER GK_onOutput in the Output tab.
// Silence via the config card's Debug Footer / Debug Console switches, or
// delete this fenced section (and its call) once trusted.
// NOTE: the footer enters story history; use a throwaway test adventure.
function GK_onOutputDebug(text) {
    let out = String(text || "");
    try {
        const GK = GK_state();
        const cfg = GK_cfg();
        const turn = GK_turn();
        const c = GK.lastCheck;
        const hit = c && c.turn === turn;
        const raw = (GK_DEBUG_RAW == null) ? "(GK_onOutput did not run?)" : GK_DEBUG_RAW;
        const firstLine = (String(raw).split("\n").find(l => l.trim()) || "").slice(0, 100);
        const summary = "checker: " + (cfg.ENABLED ? "ON" : "OFF")
            + " | turn: " + turn
            + " | luck: " + (GK.luck == null ? "-" : GK.luck)
            + " | verdict this turn: " + (hit
                ? c.difficulty + "/" + c.result + (c.skill ? "/" + c.skill : "")
                : "NONE CAPTURED");
        if (cfg.DEBUG_CONSOLE) {
            try {
                log("[GK DEBUG] " + summary);
                log("[GK DEBUG] model's first line: \"" + firstLine + "\"");
            } catch (e) {}
        }
        if (cfg.DEBUG_FOOTER) {
            out += "\n\n----- GK DEBUG -----"
                + "\n" + summary.split(" | ").join("\n")
                + "\nmodel's first line: \"" + firstLine + "\""
                + "\nlog: " + ((GK.log || []).slice(-3).join("  |  ") || "(empty)")
                + "\n--------------------";
        }
    } catch (e) {
        try { log("[GK DEBUG] error: " + e); } catch (e2) {}
    }
    return out;
}
// ========================== END GK DEBUG SECTION ===============================

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

// ===== SkillKit v0.2.2 =====
// v0.2.2 — SK_rank(name) public seam (the Observatory, 8/12/2026): the
//  effective (floored) rank held for one skill, as the arbiter sees it.
//  ObserverKit is the first consumer; read-only, never throws.
// v0.2.1 — Level MIGRATES to the Character Sheet (owner directive): when
//  SheetKit is present the Skills card drops its Level header + Attributes
//  line (the Sheet owns them); both return if the Sheet is absent.
//  SK_level()/SK_epithet()/SK_attributes stay the public seams the Sheet
//  consumes.
// v0.2.0 — the GROWTH (proposal resolved 7/21 via the Kaspersky pass):
//  LEVEL is what all your skills already add up to — derived, never stored:
//  1 + floor(total contested uses / 25), cap 20 (the d20 the system rolls).
//  One stored number (levelSeen) guards announce-once; dips (eviction) are
//  silent. Channels: TrackerKit consumes SK_level() to scale preset maxima;
//  the arbiter hears the EPITHET (FD's intensityTier combed to eight,
//  "a green adventurer" → "a living legend") prepending the note — never
//  the number. ATTRIBUTE FLOORS (§5 ruling: (b) NOW, creator-defined only):
//  config custom lines — "- Strong: rank=Intermediate, skills=climbing/
//  lifting/melee" — as DERIVATION CLAMPS: rank = max(earned, floor).
//  Live-editable, reversible, Level-neutral (floors never add uses; you can
//  be born Strong — you level by living). Floored skills surface on card
//  and note from Turn 1; lift buckets key on the EFFECTIVE (floored) rank
//  the arbiter actually saw.
// v0.1.5 — the OBVIOUS ladder (owner pacing call, 7/21): thresholds are
//  round numbers a player can hold in their head — 0/1/10/25/50/100/250/
//  1000 (was .../60/150/400/1000). Apprentice 10 and Intermediate 25
//  anchored by the owner; Advanced 50 his call; Expert/Master extrapolated
//  on the doubling cadence; Legendary stays the lifetime mark.
// v0.1.4 — card taxonomy (CardLib v0.4.2, owner directive 7/21): Skills
//  banners as Gameplay, SkillKit Config as Settings. No behavior change.
// v0.1.3 — the WALL rises (owner pacing call, 7/16): thresholds rescaled
//  around Novice→Apprentice = 10 uses. With doubt-teaches active, ranks now
//  price in real adversity: ~5 contested successes to Apprentice, Legendary
//  a lifetime mark. The ladder lives in ONE constant below — pacing is a
//  number, not a mechanic.
// v0.1.2 — DOUBT TEACHES (live-found 7/16: "Inventory Management: Novice"
//  from two /take stubs): only minor and major rulings accrue. Trivial and
//  impossible outcomes are deterministic — they measure action frequency,
//  not skill, enable grinding, and pollute the lift table with guaranteed
//  results that dilute the rank-separation signal. Same boundary as luck:
//  skills grow only where the outcome was in doubt.
// v0.1.1: Show Progress — the Skills card may carry numeric progress
//  toward the next rank ("Apprentice (4/8)"). PLAYER-facing only: the
//  card never enters context and the arbiter note stays ranks-only, so
//  semantic-primary is untouched (proposal §1 amended accordingly).
// (né ParaSkills — renamed 7/15/2026, engine Kit convention)
// script by bottledfox
//
// PRPG extension module: THE SKILL.
// The engine remembers what you're good at; the model judges what that's
// worth. GateKit's arbiter has named the skill behind every ruling since
// v0.3 (skill= in the verdict line); SkillKit is the consumer that field
// was always meant to feed: it tallies rulings into per-skill familiarity,
// projects familiarity as SEMANTIC RANKS (Untrained → Legendary), and shows
// those ranks to the arbiter through GateKit's note seam (GK_setArbiterNote,
// GateKit v0.7.1). Influence is SEMANTIC-PRIMARY (proposal §2): ranks enter
// the arbiter's context; luck stays pure chance; GK_setLuck stays reserved
// for fortune-benders. No classes, no XP tables, no stat engine.
// Design proposal:
//   Documentation/Design Proposals/SkillKit (the Skill) - Design Proposal.md
//
// WIRING (extends the Essentials chain; SkillKit has NO input/context pass):
//   Output tab:   text = GK_onOutput(text);      // verdict captured first
//                 text = INV_onOutput(text);
//                 text = SK_onOutput(text);      // LAST: tally the settled ruling
//
// DEPENDS ON: GateKit (the ruling + the note seam) — without it the Skills
// card is static (floor ranks still project, no accrual). CardLib optional
// (state-only tallies without it). Model omits skill= → no tally that turn,
// nothing breaks (rule 7).
//
// TELEMETRY (the §2 falsifier): every tally also records the outcome keyed
// by the rank HELD AT ATTEMPT — the lift table. `Stats: true` renders it on
// the Skills card; its audience is the TESTER (the arbiter note never
// carries stats). The proposal sketches {s, f}; GateKit's schema has carried
// `partial` since v0.4, so the table stores {s, f, p} — partials tally as
// attempts (+1), never as successes (+2).
//
// EVICTION note: at Max Skills the least-used skill OTHER THAN the one just
// tallied is evicted (fresh interest beats an abandoned skill — a strict
// least-used rule would evict every new skill at birth). Tie: oldest tally.

const SK_SETTINGS = {
    ENABLED: true,              // the module; LIVE — card edits apply next action
    PROGRESSION: true,          // accrual on/off (ranks freeze when false)
    STARTING_SKILLS: "(none)",  // floor, applied once per skill: Climbing=Intermediate, ...
    MAX_SKILLS: 12,             // tracked-skill cap (least-used evicted, reported)
    REPORT: true,               // rank-ups + evictions to the Event Log
    SHOW_PROGRESS: true,        // numeric progress toward next rank on the Skills card (player-only)
    STATS: false                // lift table on the Skills card (tester channel)
};

// uses → rank. Thresholds are cumulative uses; success counts double
// (doing teaches; succeeding teaches more).
const SK_RANKS = [
    ["Untrained", 0], ["Novice", 1], ["Apprentice", 10], ["Intermediate", 25],
    ["Advanced", 50], ["Expert", 100], ["Master", 250], ["Legendary", 1000]
];
const SK_NOTE_CAP = 160;
const SK_NOTE_OWNER = "SK";

// Load canary
try {
    if (typeof log === "function") log("[SkillKit] library loaded (v0.2.2)");
} catch (e) {}

// Live settings. Uncached on purpose: SkillKit runs once per turn (one
// output pass), so a per-hook cache buys nothing.
function SK_cfg() {
    if (typeof SC_config === "function") {
        try {
            return SC_config("SkillKit Config", SK_SETTINGS, {
                description: "Settings for SkillKit (the Skill). Skills grow from doing: "
                    + "every GateKit ruling tallies its skill. Starting Skills is a floor, "
                    + "applied once per named skill (Climbing=Intermediate, ...). Ranks are "
                    + "semantic — the arbiter sees them; luck stays pure chance. Stats "
                    + "shows the telemetry lift table on the Skills card."
            });
        } catch (e) {}
    }
    return Object.assign({}, SK_SETTINGS);
}

// --- State (schema-migrating) --------------------------------------------------
function SK_state() {
    if (!state.vars || typeof state.vars !== "object") state.vars = {};
    if (!state.vars.SK || typeof state.vars.SK !== "object") state.vars.SK = {};
    const SK = state.vars.SK;
    if (!SK.skills || typeof SK.skills !== "object") SK.skills = {};
    if (!SK.floor || typeof SK.floor !== "object") SK.floor = {};
    if (typeof SK.tallyTurn !== "number") SK.tallyTurn = -1;
    if (typeof SK.noteTurn !== "number") SK.noteTurn = -1;
    if (typeof SK.levelSeen !== "number") SK.levelSeen = 1;
    return SK;
}

function SK_turn() {
    return (info && typeof info.actionCount === "number") ? info.actionCount : -1;
}

// Parse-side canonicalization: lowercase, trim, punctuation strip, collapsed
// spaces. First-seen name becomes canonical; the arbiter NOTE is the prompt-
// side canonicalizer (the model reuses names it can see), this catches the rest.
function SK_canon(name) {
    return String(name || "").toLowerCase()
        .replace(/[^a-z0-9 \-']/g, " ")
        .replace(/\s+/g, " ")
        .trim().slice(0, 30);
}

// Ranks are DERIVED, never stored.
function SK_rankFor(uses) {
    let rank = SK_RANKS[0][0];
    for (let i = 0; i < SK_RANKS.length; i++) {
        if (uses >= SK_RANKS[i][1]) rank = SK_RANKS[i][0];
    }
    return rank;
}

function SK_usesFor(rankName) {
    const want = String(rankName || "").trim().toLowerCase();
    for (let i = 0; i < SK_RANKS.length; i++) {
        if (SK_RANKS[i][0].toLowerCase() === want) return SK_RANKS[i][1];
    }
    return 0;
}

// Uses required for the NEXT rank, or 0 at the ladder's top.
function SK_nextThreshold(uses) {
    for (let i = 0; i < SK_RANKS.length; i++) {
        if (uses < SK_RANKS[i][1]) return SK_RANKS[i][1];
    }
    return 0;
}

// --- the Growth (v0.2.0) ---------------------------------------------------------
// Level: derived, never stored. Total = every contested tally there is.
const SK_LEVEL_WALL = 25;
const SK_LEVEL_CAP = 20;
const SK_EPITHETS = [
    [20, "a living legend"], [18, "a renowned adventurer"], [15, "an elite adventurer"],
    [12, "a veteran adventurer"], [9, "a seasoned adventurer"], [6, "a capable adventurer"],
    [3, "a tested adventurer"], [1, "a green adventurer"]
];

function SK_total() {
    const SK = SK_state();
    let t = 0;
    for (const n in SK.skills) t += (SK.skills[n].uses || 0);
    return t;
}

// Public seam — TrackerKit scales preset maxima on this.
function SK_level() {
    return Math.min(SK_LEVEL_CAP, 1 + Math.floor(SK_total() / SK_LEVEL_WALL));
}

// Public seam — the Character Sheet's spoken rank; the note's prefix.
function SK_epithet() {
    const lv = SK_level();
    for (let i = 0; i < SK_EPITHETS.length; i++) {
        if (lv >= SK_EPITHETS[i][0]) return SK_EPITHETS[i][1];
    }
    return SK_EPITHETS[SK_EPITHETS.length - 1][1];
}

function SK_complain(cfg, line) {
    if (cfg.REPORT && typeof SC_report === "function") {
        try { SC_report("SkillKit", "skipped malformed line: \"" + String(line).slice(0, 60) + "\""); } catch (e) {}
    }
}

// Attribute floors (v0.2.0): creator-defined custom lines on the config card.
// "- Strong: rank=Intermediate, skills=climbing/lifting/melee" — a floor is a
// derivation clamp, not a grant: max(earned, floor), Level-neutral, reversible.
function SK_attributes(cfg) {
    const out = { floors: {}, names: [] };
    if (typeof SC_get !== "function") return out;
    const card = SC_get("SkillKit Config");
    if (!card) return out;
    const lines = String(card.entry || "").split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!/^-\s/.test(line)) continue;
        const body = line.replace(/^-\s*/, "");
        const colon = body.indexOf(":");
        if (colon === -1) { SK_complain(cfg, body); continue; }
        const attr = body.slice(0, colon).trim();
        let rank = "", skills = [];
        const parts = body.slice(colon + 1).split(",");
        for (let j = 0; j < parts.length; j++) {
            const m = parts[j].trim().match(/^(rank|skills)\s*[=:]\s*(.+)$/i);
            if (!m) continue;
            if (m[1].toLowerCase() === "rank") rank = m[2].trim();
            else skills = m[2].split("/").map(SK_canon).filter(Boolean);
        }
        if (!attr || !rank || !skills.length) { SK_complain(cfg, body); continue; }
        const floorUses = SK_usesFor(rank);
        if (!floorUses && rank.toLowerCase() !== "untrained") {
            SK_complain(cfg, body + " (unknown rank \"" + rank + "\")"); continue;
        }
        out.names.push(attr);
        for (let j = 0; j < skills.length; j++) {
            out.floors[skills[j]] = Math.max(out.floors[skills[j]] || 0, floorUses);
        }
    }
    return out;
}

// name -> effective uses (earned clamped up by any floor), tracked ∪ floored.
function SK_effective(attrs) {
    const SK = SK_state();
    const eff = {};
    for (const n in SK.skills) eff[n] = Math.max(SK.skills[n].uses || 0, attrs.floors[n] || 0);
    for (const n in attrs.floors) if (!(n in eff)) eff[n] = attrs.floors[n];
    return eff;
}

// Public seam (v0.2.2, the Observatory): the EFFECTIVE rank currently held
// for one skill — earned uses clamped up by any attribute/starting floor,
// exactly the rank the arbiter is shown. Unknown or absent skills read
// "Untrained"; never throws.
function SK_rank(name) {
    try {
        const k = String(name || "").trim().toLowerCase();
        if (!k) return SK_RANKS[0][0];
        const attrs = SK_attributes(SK_cfg());
        const rec = SK_state().skills[k];
        return SK_rankFor(Math.max(rec ? (rec.uses || 0) : 0, attrs.floors[k] || 0));
    } catch (e) { return SK_RANKS[0][0]; }
}

function SK_record(name) {
    const SK = SK_state();
    if (!SK.skills[name] || typeof SK.skills[name] !== "object") {
        SK.skills[name] = { uses: 0, tallyTurn: -1, lift: {} };
    }
    const r = SK.skills[name];
    if (typeof r.uses !== "number") r.uses = 0;
    if (typeof r.tallyTurn !== "number") r.tallyTurn = -1;
    if (!r.lift || typeof r.lift !== "object") r.lift = {};
    return r;
}

// Display casing for card lines: "dragon lore" → "Dragon Lore".
function SK_pretty(name) {
    return String(name).replace(/(^|[\s\-'])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
}

// Starting Skills floor (sanctioned card→code direction, config card only):
// "Climbing=Intermediate, Stealth=Novice" — rank-equivalent uses granted
// ONCE per named skill, on first sight. The Skills projection is never
// parsed back.
function SK_applyFloor(cfg) {
    const raw = String(cfg.STARTING_SKILLS || "").trim();
    if (raw === "" || /^\(.*\)$/.test(raw) || /^none$/i.test(raw)) return false;
    const SK = SK_state();
    let changed = false;
    const parts = (typeof RX_csv === "function") ? RX_csv(raw) : String(raw).split(",");
    for (let i = 0; i < parts.length; i++) {
        let kv = null;
        if (typeof RX_keyValue === "function") kv = RX_keyValue(parts[i]);
        if (!kv) {
            const m = String(parts[i]).match(/^\s*(.+?)\s*[=:]\s*(.+?)\s*$/);
            kv = m ? { key: m[1], value: m[2] } : null;
        }
        if (!kv) continue;
        const name = SK_canon(kv.key);
        if (!name || SK.floor[name]) continue;
        SK.floor[name] = true;
        const floorUses = SK_usesFor(kv.value);
        const rec = SK_record(name);
        if (rec.uses < floorUses) { rec.uses = floorUses; changed = true; }
    }
    return changed;
}

// Cap enforcement: evict the least-used skill other than `keep` (see the
// eviction note in the header). Lift telemetry leaves with its skill.
function SK_evict(cfg, keep) {
    const SK = SK_state();
    const cap = Math.max(1, Math.round(cfg.MAX_SKILLS));
    // Loop: a LIVE cap reduction (card edit mid-game) may demand several
    // evictions in one pass, not just the marginal one.
    for (let guard = 0; guard < 100; guard++) {
        const names = Object.keys(SK.skills);
        if (names.length <= cap) return;
        let victim = null;
        for (let i = 0; i < names.length; i++) {
            const n = names[i];
            if (n === keep && names.length > 1) continue;
            if (victim === null
                || SK.skills[n].uses < SK.skills[victim].uses
                || (SK.skills[n].uses === SK.skills[victim].uses
                    && SK.skills[n].tallyTurn < SK.skills[victim].tallyTurn)) {
                victim = n;
            }
        }
        if (victim === null) return;
        delete SK.skills[victim];
        if (cfg.REPORT && typeof SC_report === "function") {
            try { SC_report("SkillKit", victim + " forgotten (Max Skills cap)"); } catch (e) {}
        }
    }
}

// The arbiter note: ranks only, most practiced first, hard 160-char cap
// (GateKit caps again — belt and braces). Doubles as the canonicalizer.
function SK_refreshNote(attrs) {
    if (typeof GK_setArbiterNote !== "function") return;
    const a = attrs || SK_attributes(SK_cfg());
    const eff = SK_effective(a);
    const names = Object.keys(eff).sort(function (x, y) {
        return eff[y] - eff[x] || x.localeCompare(y);
    });
    // v0.2.0: the epithet speaks first — the arbiter hears the phrase, never the number.
    const head = "player (" + SK_epithet() + ") skills —";
    const tail = " (unlisted skills: untrained)";
    const parts = [];
    let len = head.length + tail.length;
    for (let i = 0; i < names.length; i++) {
        const rank = SK_rankFor(eff[names[i]]).toLowerCase();
        if (rank === "untrained") continue;
        const piece = (parts.length ? "; " : " ") + names[i] + ": " + rank;
        if (len + piece.length > SK_NOTE_CAP) break;
        parts.push(piece);
        len += piece.length;
    }
    if (!parts.length) { GK_setArbiterNote(SK_NOTE_OWNER, head + tail); SK_state().noteTurn = SK_turn(); return; }
    GK_setArbiterNote(SK_NOTE_OWNER, head + parts.join("") + tail);
    SK_state().noteTurn = SK_turn();
}

// The Skills card (projection, never parsed back). Stats: true appends the
// lift table — the one sanctioned place numbers surface (audience: tester).
function SK_renderCard(cfg, attrs) {
    if (typeof SC_render !== "function") return;
    const SK = SK_state();
    const a = attrs || SK_attributes(cfg);
    const eff = SK_effective(a);
    const names = Object.keys(eff).sort(function (x, y) {
        return eff[y] - eff[x] || x.localeCompare(y);
    });
    const lines = [];
    for (let i = 0; i < names.length; i++) {
        const uses = (SK.skills[names[i]] ? SK.skills[names[i]].uses : 0) || 0;
        const fl = a.floors[names[i]] || 0;
        let line = "- " + SK_pretty(names[i]) + ": " + SK_rankFor(eff[names[i]]);
        if (cfg.SHOW_PROGRESS) {
            if (fl > uses) line += " (" + uses + " earned)";      // floored: earned shown honestly
            else {
                const next = SK_nextThreshold(uses);
                line += next ? " (" + uses + "/" + next + ")" : " (" + uses + ")";
            }
        }
        lines.push(line);
    }
    // v0.2.0 header; v0.2.1: MIGRATED to the Character Sheet when present.
    let head = "";
    if (typeof CS_onOutput !== "function") {
        const lv = SK_level();
        head = "Level " + lv + " (" + SK_epithet() + ")";
        if (lv < SK_LEVEL_CAP) {
            head += " — " + (SK_total() - (lv - 1) * SK_LEVEL_WALL) + "/" + SK_LEVEL_WALL + " toward " + (lv + 1);
        }
        if (a.names.length) head += "\nAttributes: " + a.names.join(", ");
        head += "\n";
    }
    let entry = "## Skills\n" + head
        + (lines.length ? lines.join("\n") : "- (none yet — skills grow from doing)");
    if (cfg.STATS) {
        const stats = [];
        for (let i = 0; i < names.length; i++) {
            if (!SK.skills[names[i]]) continue;      // floored-untracked: no lift yet (v0.2.0)
            const lift = SK.skills[names[i]].lift || {};
            const ranks = Object.keys(lift);
            for (let j = 0; j < ranks.length; j++) {
                const b = lift[ranks[j]];
                const total = (b.s || 0) + (b.f || 0) + (b.p || 0);
                stats.push("- " + SK_pretty(names[i]) + " @ " + SK_pretty(ranks[j]) + ": "
                    + (b.s || 0) + "/" + total + (b.p ? " (" + b.p + " partial)" : ""));
            }
        }
        if (stats.length) entry += "\n\n## Lift (telemetry)\n" + stats.join("\n");
    }
    SC_render("Skills", entry, { type: SC_TYPE_GAMEPLAY, keys: "Skills" });
}

// --- Output pass: tally the settled ruling ---------------------------------------
// Wired LAST, after GK_onOutput (the ruling must be settled). One tally per
// actionCount — retries replay, never re-tally (SIS's double-mutation lesson).
// Erase rewinds are accepted as untracked (counters can't un-count).
function SK_onOutput(text) {
    const out = String(text || "");
    try {
        const cfg = SK_cfg();                     // rule 11: config card materializes first pass
        if (!cfg.ENABLED) return out;
        const SK = SK_state();
        const attrs = SK_attributes(cfg);              // v0.2.0: floors, parsed once per pass
        let changed = SK_applyFloor(cfg);
        const turn = SK_turn();
        if (cfg.PROGRESSION && typeof GK_lastCheck === "function" && SK.tallyTurn !== turn) {
            let c = null;
            try { c = GK_lastCheck(); } catch (e) {}
            // Doubt teaches: only luck-swayed difficulties accrue (v0.1.2).
            if (c && c.turn === turn && c.skill
                && (c.difficulty === "minor" || c.difficulty === "major")) {
                const name = SK_canon(c.skill);
                if (name) {
                    SK.tallyTurn = turn;
                    const rec = SK_record(name);
                    const fl = attrs.floors[name] || 0;      // v0.2.0: the arbiter saw the FLOORED rank
                    const before = SK_rankFor(Math.max(rec.uses, fl));
                    const heldRank = before.toLowerCase();   // effective rank HELD AT ATTEMPT (lift key)
                    rec.uses += (c.result === "success") ? 2 : 1;
                    rec.tallyTurn = turn;
                    const bucket = rec.lift[heldRank] || (rec.lift[heldRank] = { s: 0, f: 0, p: 0 });
                    if (c.result === "success") bucket.s++;
                    else if (c.result === "partial") bucket.p++;
                    else bucket.f++;
                    changed = true;
                    const after = SK_rankFor(Math.max(rec.uses, fl));
                    if (after !== before && cfg.REPORT && typeof SC_report === "function") {
                        try { SC_report("SkillKit", name + ": " + before + " → " + after); } catch (e) {}
                    }
                    SK_evict(cfg, name);
                }
            }
        }
        // v0.2.0: the Level announce — once per level, dips (eviction) silent.
        const lv = SK_level();
        if (lv > SK.levelSeen) {
            if (cfg.REPORT && typeof SC_report === "function") {
                try { SC_report("SkillKit", "Level " + SK.levelSeen + " → " + lv + " (" + SK_epithet() + ")"); } catch (e) {}
            }
            SK.levelSeen = lv;
        } else if (lv < SK.levelSeen) SK.levelSeen = lv;
        SK_refreshNote(attrs);                         // every pass: floors + level are live
        SK_renderCard(cfg, attrs);
        if (cfg.REPORT && typeof SC_reportEnsure === "function") SC_reportEnsure();
    } catch (e) {}
    return out;
}

// ===== TrackerKit v0.5.0 =====
// v0.5.0 — the LOCK (the Reckoning, owner ruling 9/8/2026 — the hard-lock
//  option, overruling the narrative-only lean): the MODEL ends the story,
//  the ENGINE keeps it ended. Health reaching its floor sets TK.dead at the
//  OUTPUT pass — after the arbiter has already written the ominous ending,
//  so the death scene is never pre-empted — and the lock bites from the
//  next turn: input refuses commands and yields the Check, output is
//  replaced by the terminal line. Deliberately NOT `stop: true` (platform
//  research 8/12: returning stop produces player-facing errors); rewriting
//  both ends is a harder lock with no error surface.
//  THE ONLY WAY BACK IS ERASE — and it costs nothing: TK.dead lives in
//  state.vars, so RewindKit restores it with everything else. Death is
//  final unless the story itself is rewound.
//  `Death Lock: false` restores the narrative-only behaviour (the original
//  lean, preserved as an option). Seam: TK_isDead().
// v0.4.0 — the WOUND REREAD (proposal + veto pass, all leans, 8/13/2026):
//  the parser stops asking "does a damage verb sit near you and a body part"
//  and starts asking "what KIND of statement is this, and did it happen?"
//  TWO FRAMES with their own ladders — PAIN consulted first and claims the
//  line (most-specific wins), tiered by how the pain READS and capped at
//  strong; then the ASSAULT ladder unchanged. Plus the IRREALIS GUARD: a
//  candidate whose CLAUSE says the blow was prevented, hypothetical, evaded
//  or still coming is vetoed and reported, never applied. New public seam
//  TK_lastWound() feeds ObserverKit v0.1.2, so the next iteration argues
//  from live rates instead of 22 invented sentences. Coverage frames
//  (knockback, collapse, vocal, gesture, stumble, asphyxiation) stay OUT —
//  a separate, evidence-gated wave by owner ruling.
// v0.3.2 — UNIFIED CONSUMPTION (owner ruling 7/21): /eat, /drink, and the
//  deterministic /meditate RETIRE — the flat restores were free-lunch
//  buttons, and "GateKit can handle 'you eat' better than TrackerKit."
//  InventoryKit v0.2.0 owns /eat <item> and /drink <item> (remove +
//  adjudicated efficacy). /meditate survives as a narratable stub that is
//  NOT bookkeeping — the turn is judged and mana arrives via the ruling's
//  resource field. /rest and /sleep stay deterministic BECAUSE the resource
//  field carries one resource per turn (multi-resource field is the logged
//  condition that would unify them; the Reckoning may also want a say).
// v0.3.1 — the Sheet's read seam: TK_readGauges() exposes the gauges as
//  data (name, value, effective max, band, pinned event) for renderers;
//  when SheetKit is present the Trackers card RETIRES (removed, per owner
//  ruling — the card evolves into the Character Sheet) and returns if the
//  Sheet is ever absent (rule 7 both directions). Note + Event Log
//  channels unchanged — the note is telemetry, the Sheet is register.
// v0.3.0 — the GROWTH consumption (proposal §D2, resolved 7/21): preset
//  maxima scale with Player Level — effective max = base × (1 + 5% ×
//  (SK_level() − 1)), rounded. The config number stays the BASE (card→code
//  direction untouched); gauges double by Level 20; wound/drift percentages
//  ride the effective max so a wound tier FEELS constant while the pool
//  deepens. Custom trackers never scale (creator ranges are creator-owned).
//  No SkillKit → bases as-is (rule 7).
// v0.2.3 — the card tells the truth (live-found 7/21, owner review of the
//  Trackers Config card): header now says the numbers are MAXIMUMS; NOTES
//  rewritten to v0.2 physics (the old text still claimed combat-family
//  Health coupling and Stamina drift, both removed in the Rework) and
//  flags Doom as an example, not a built-in. Rides CardLib v0.4.3's
//  description heal so live adventures get the corrected docs next turn.
// v0.2.2 — card taxonomy (CardLib v0.4.2, owner directive 7/21): Trackers
//  banners as Gameplay, Trackers Config as Settings. No behavior change.
// v0.2.1 — TK_APPLY, the public write seam (EventKit proposal D3, owner
//  rulings 7/21): scripter-deterministic deltas from other modules land
//  through one audited door — range-clamp ONLY, no 25% per-turn cap (the
//  cap guards MODEL-reported values; scripter values are deliberate:
//  "how else would the player fall fifty stories to their death?").
//  Evidence rides TK_move's existing report; unknown/disabled trackers
//  are reported and skipped (returns 0, never throws); the arbiter note
//  refreshes in place so it reads truth regardless of caller position.
//  Retry-guarding is the CALLER'S duty (a caller may legitimately apply
//  several deltas in one turn).
// v0.2.0 — the GAUGE REWORKED (proposal + owner rulings, 7/16): different
//  resources have different physics. Health is the WOUND — narrative prose
//  parsing, five severity tiers combed from FD's detectHurt (the owner's
//  prior art), second-person anchored, highest tier wins, evidence logged;
//  plus three-tier narrative HEALING (an NPC binds your wounds). Stamina
//  and Mana are the COST — GateKit v0.8.0's bidirectional resource= field,
//  clamped to 25% of max per turn, drains and restores both (/use item
//  efficacy rides this: InventoryKit consumes, the ruling reports).
//  Hunger keeps the CLOCK (drift). Recovery verbs: /rest /sleep /eat
//  /drink /meditate (hardcoded effects, bookkeeping turns). Stamina's
//  v0.1.1 drift is REMOVED (the cost channel replaces the clock for
//  effort); Health's check-coupling is REMOVED (wounds come from prose,
//  not rulings). Cost has NO difficulty gate (owner ruling: trivial and
//  impossible may charge — cost is the action's price, not a consequence
//  of doubt; the doubt boundary still governs custom on-fail/on-success).
// v0.1.1 — PRESETS BUILT IN (owner call, 7/16: user-friendliness over
//  granular customization): Health, Stamina, Hunger ship as defaults. The
//  config card carries them as plain settings — one number is the max
//  (start = full), 0 disables. Preset internals scale with the max (combat
//  damage ~10%, drift ticks ~5%) and stay deliberately GENTLE — difficulty
//  tuning is deferred until the core mechanics integrate. A custom
//  '- Name:' line OVERRIDES its preset by name (the advanced path).
//  Also: live config edits clamp persisted values into the new range, and
//  the note refreshes every pass (edits bite immediately).
// script by bottledfox
//
// PRPG-hosted module (designed in the PWorld proposal; pulled forward
// 7/16/2026 — modules are standalone by rule, packages are just bundles):
// THE GAUGE.
// The creator names what matters; the engine moves it deterministically; the
// model is told where it stands. ResourceKit dissolved into this module the
// day its build slot arrived (PWorld proposal §8): Health, Stamina, and
// Hunger were always Gauge presets — three config lines, not a module.
// Design: Documentation/Design Proposals/PWorld (StateKit + TrackerKit) - Design Proposal.md (§3)
//
// THE decision — deterministic movement only. Gauges move by exactly three
// sources: COMMANDS (/track morale +1), DRIFT (drift=-1/8 — one point per
// eight adjudicated actions), and CHECK-COUPLING (on-fail=combat -1 — the
// settled ruling's skill= and result matched against the tracker's rule).
// The model influences a gauge only through the Check it already rules on.
//
// Tracker lines live in the "Trackers Config" card (creator-owned data,
// live edits bite; only VALUES persist in state):
//   - Morale: start=6, range=0-10, bands=routed/shaky/steady/bold, on-fail=combat -1
//   - Doom: start=0, range=0-6, on-fail=any +1, high=Doomsday
//   - Rations: start=10, range=0-20, drift=-1/8, low=Starving
// Options: start= range=lo-hi bands=a/b/c/d drift=±n/actions on-fail=skills ±n
//          on-success=skills ±n low=Event high=Event note=false
//
// WIRING (per the proposal's integration contract):
//   Input tab:    text = TK_onInput(text);      // after GK_onInput: /track
//   Output tab:   text = TK_onOutput(text);     // LAST: drift + check-coupling
//
// DEPENDS ON: CardLib (config + projection; state-only without it), GateKit
// (check-coupling + arbiter note; cards still project without it), RegexLib
// (/track parsing; command inert without it). Rule 7 everywhere: malformed
// lines are skipped with an Event Log complaint, never a throw.
//
// SPEC DEVIATION (documented): drift counts ALL player actions, not only
// adjudicated ones — the proposal's "adjudicated actions" would require
// reading GateKit's private command-turn stamp, which the public-seam
// contract forbids. Plain turns are also more player-legible ("every 8
// actions"). A public turn-class seam can refine this later.

const TK_NOTE_OWNER = "TK";
const TK_NOTE_CAP = 160;
const TK_SETTINGS = {
    ENABLED: true, REPORT: true, HEALTH: 100, STAMINA: 100, HUNGER: 100, MANA: 0,
    DEATH_LOCK: true,   // the Lock (v0.5.0): a dead adventure refuses further turns
    DEATH_MESSAGE: "Your story has ended. Erase this turn to step back into the moment before."
};

// Load canary
try {
    if (typeof log === "function") log("[TrackerKit] library loaded (v0.5.0)");
} catch (e) {}

// --- The WOUND (v0.4.0, the Wound Reread): TWO FRAMES, each with its ladder --------
// Proposal: Documentation/Design Proposals/The Wound Reread - Design Proposal.md
// (veto pass 8/13/2026, all leans). Research: Documentation/Architecture/
// Wound Parsing - Research Findings.md — lineage TAS (Yi1i1i) → FD → here.
//
// PRECEDENCE: the PAIN frame is consulted FIRST and claims the line. It is the
// more specific reading (it needs a pain anchor), and the failure always ran one
// way: pain prose misread as a blade ("piercing throb" → a 12% stab wound, live
// 7/21). Most-specific-frame-wins is RegexLib's longest-first, one layer up.
//
// THE PAIN LADDER: tiered by how the pain READS, not by any verb — TAS's
// adjective ladder. Pain reports CAP AT STRONG: great/severe are structural
// destruction, which prose states as a blow and the assault frame catches in the
// turn it happens; letting a symptom reach 30% double-charges one injury.
// Blade-homonyms (piercing, shooting, stabbing, splitting, tearing) are
// deliberately ABSENT from the ladder: inside a pain frame they do adjectival
// work on their anchor ("a piercing throb" is a sharp twinge, not a puncture),
// and admitting them re-imports the confusion the frame exists to remove.
const TK_PAIN_STRONG ="agonizing|agonising|excruciating|unbearable|blinding|blistering|extreme|gnawing|gripping|horrible|intense|radiating|tremendous|white-hot|explodes|exploding|blossoms|bursts|screams|screaming";
const TK_PAIN_MODERATE = "burning|burns|searing|sears|sharp|hot|fierce|deep|flares|flaring|pulses|pulsing|biting";
const TK_PAIN_ANCHOR = "pain|ache|aches|aching|throb|throbs|throbbing|sting|stings|stinging|agony|pang|pangs|soreness|sore";
// Built on first use: the shapes need TK_BODY, which is declared below with the
// assault frame (keeping each frame's block whole reads better than hoisting one
// string). Cached — the regexes are constant.
var TK_PAIN_SHAPES_CACHE = null;
function TK_painShapes() {
    if (TK_PAIN_SHAPES_CACHE) return TK_PAIN_SHAPES_CACHE;
    TK_PAIN_SHAPES_CACHE = [
        // "you feel a searing pain" — the sensation frame (v0.2's light rule, absorbed)
        new RegExp("\\byou(?:\\s+\\w+){0,3}\\s+feel(?:\\s+\\w+){0,5}\\s+(?:" + TK_PAIN_ANCHOR + "|bruised)\\b", "i"),
        // "pain explodes through your ribs" · "a piercing throb in your temple"
        new RegExp("\\b(?:" + TK_PAIN_ANCHOR + ")\\b(?:\\s+\\w+){0,5}\\s+(?:in|through|along|across|down|up|behind|inside)\\s+your\\b(?:\\s+\\w+){0,2}\\s*(?:" + TK_BODY + ")\\b", "i"),
        // "your shoulder throbs" — the body-part-as-subject frame
        new RegExp("\\byour\\s+(?:\\w+\\s+){0,2}(?:" + TK_BODY + ")(?:\\s+\\w+){0,3}\\s+(?:" + TK_PAIN_ANCHOR + "|burn|burns|burning|scream|screams|screaming)\\b", "i"),
        // "the pain is unbearable" · "a piercing throb builds" — pain as subject
        // (TAS's shape, widened to the indefinite article: second person implied,
        // and the live 7/21 incident opens "A piercing throb…")
        new RegExp("\\b(?:the|a|an)\\s+(?:\\w+\\s+){0,3}(?:" + TK_PAIN_ANCHOR + ")\\b(?:\\s+\\w+){0,4}", "i")
    ];
    return TK_PAIN_SHAPES_CACHE;
}
// Someone ELSE's pain is not ours (the fourth shape carries no you-anchor).
const TK_PAIN_THIRD = /\b(?:'s|s'|its|their|his|her)\s+(?:pain|agony|ache)\b/i;

// THE IRREALIS GUARD: damage the prose says did NOT happen — prevented,
// hypothetical, evaded, still coming. Live probe (8/13): "you raise your shield
// before the club can crush your skull" and "your armor absorbs the blow that
// would have shattered your ribs" each took 30% of max Health. Scoped to the
// matched span's CLAUSE, not its sentence: "the troll missed twice, then its
// club crushed your ribs" must still wound (verified fixture).
const TK_IRREALIS = new RegExp(
    "\\b(?:would|could|might|should)(?:'ve|\\s+have)\\b"
    + "|\\bhad\\s+it\\s+not\\b|\\bif\\b"
    + "|\\b(?:nearly|narrowly|almost|barely)\\b"
    + "|\\b(?:miss|misses|missed|avoid|avoids|avoided|dodge|dodges|dodged|evade|evades|evaded|sidestep|sidesteps|sidestepped)\\b"
    + "|\\b(?:block|blocks|blocked|deflect|deflects|deflected|absorb|absorbs|absorbed|parry|parries|parried|shield|shields|shielded|catches|turns\\s+aside)\\b"
    + "|\\b(?:glances|bounces|skitters|skips)\\s+off\\b"
    + "|\\b(?:about|threatens|threatening|ready|moves|moving|aims|aiming|prepares|preparing)\\s+to\\b"
    + "|\\b(?:does|did|do)\\s+not\\b|\\b(?:doesn't|didn't|don't|never)\\b"
    + "|\\bbefore\\b(?:\\s+\\w+){0,6}\\s+(?:can|could|would)\\b", "i");

function TK_clauseAround(text, index, len) {
    let s = index, e = index + len;
    while (s > 0 && ".!?,;:\n—".indexOf(text.charAt(s - 1)) === -1) s--;
    while (e < text.length && ".!?,;:\n—".indexOf(text.charAt(e)) === -1) e++;
    return text.slice(s, e);
}

function TK_painTier(span) {
    if (new RegExp("\\b(?:" + TK_PAIN_STRONG + ")\\b", "i").test(span)) return { name: "strong", pct: 12 };
    if (new RegExp("\\b(?:" + TK_PAIN_MODERATE + ")\\b", "i").test(span)) return { name: "moderate", pct: 6 };
    return { name: "light", pct: 3 };
}

// Read the narrative once: pain frame first, then the assault ladder. Each
// candidate is irrealis-guarded before it can win; a vetoed candidate does not
// stop the scan (a prevented blow may still be followed by a real scrape).
// Returns {frame, tier, pct, span} | {veto:true, ...} | null.
function TK_readWound(out) {
    let firstVeto = null;
    const consider = function (frame, span, index, tier) {
        const clause = TK_clauseAround(out, index, span.length);
        if (TK_IRREALIS.test(clause)) {
            if (!firstVeto) firstVeto = { frame: frame, tier: tier.name, pct: 0, span: span, veto: true };
            return null;
        }
        return { frame: frame, tier: tier.name, pct: tier.pct, span: span, veto: false };
    };
    const shapes = TK_painShapes();
    for (let i = 0; i < shapes.length; i++) {
        const m = out.match(shapes[i]);
        if (!m) continue;
        if (i === 3 && TK_PAIN_THIRD.test(TK_clauseAround(out, m.index, m[0].length))) continue;
        const hit = consider("pain", m[0], m.index, TK_painTier(m[0]));
        if (hit) return hit;
    }
    for (let wi = 0; wi < TK_WOUND_TIERS.length; wi++) {
        const tier = TK_WOUND_TIERS[wi];
        for (let ri = 0; ri < tier.rx.length; ri++) {
            const m = out.match(tier.rx[ri]);
            if (!m) continue;
            const hit = consider("assault", m[0], m.index, tier);
            if (hit) return hit;
        }
    }
    return firstVeto;
}

// Public seam (the Observatory): what the reread decided this turn.
// --- The LOCK (v0.5.0) --------------------------------------------------------------
// Public seam: has the story ended? {turn, gauge} or null. Never throws.
function TK_isDead() {
    try { const d = TK_state().dead; return (d && typeof d === "object") ? d : null; } catch (e) { return null; }
}

function TK_lockOn(cfg) {
    const v = (cfg && typeof cfg.DEATH_LOCK !== "undefined") ? cfg.DEATH_LOCK : true;
    return !(v === false || String(v).toLowerCase() === "false");
}

function TK_lastWound() {
    try { const w = TK_state().lastWound; return (w && typeof w === "object") ? w : null; } catch (e) { return null; }
}

// --- The ASSAULT frame: severity tiers combed from FD's detectHurt ------------------
const TK_BODY = "arm|arms|back|body|cheek|chest|chin|ear|eye|eyes|face|finger|fingers|flesh|foot|forearm|forehead|gut|hand|hands|head|hip|jaw|knee|leg|legs|lip|mouth|neck|nose|rib|ribs|scalp|shin|shoulder|shoulders|side|skin|skull|spine|stomach|temple|thigh|throat|torso|waist|wrist";
function TK_hurtRx(verbs) {
    return new RegExp("\\b(?:" + verbs + ")(?:\\s+\\w+){0,3}\\s+(?:you|your)(?:\\s+\\w+){0,5}\\s+(?:" + TK_BODY + ")\\b", "i");
}
const TK_WOUND_TIERS = [
    { name: "severe", pct: 30, rx: [TK_hurtRx("crush|crushes|crushed|crushing|shatter|shatters|shattered|shattering|rupture|ruptures|ruptured|obliterate|obliterates|obliterated|demolish|demolishes|demolished|devastate|devastates|devastated")] },
    { name: "great", pct: 20, rx: [TK_hurtRx("blast|blasts|blasted|blasting|explode|explodes|exploded|fracture|fractures|fractured|impale|impales|impaled|impaling|rip|rips|ripped|ripping|shred|shreds|shredded|shredding|tears? into|tearing into|tore|torn")] },
    { name: "strong", pct: 12, rx: [TK_hurtRx("batter|batters|battered|battering|pierce|pierces|pierced|piercing|slam|slams|slammed|slamming|slice|slices|sliced|slicing|slash|slashes|slashed|slashing|shoot|shoots|shooting|shot|gash|gashes|gashed")] },
    { name: "moderate", pct: 6, rx: [TK_hurtRx("bite|bites|biting|bit|burn|burns|burned|burning|hit|hits|hitting|jab|jabs|jabbed|jabbing|knock|knocks|knocked|knocking|sear|sears|seared|searing|shock|shocks|shocked|shocking|strike|strikes|striking|struck|whack|whacks|whacked|whacking")] },
    { name: "light", pct: 3, rx: [
        TK_hurtRx("bump|bumps|bumped|bumping|bruise|bruises|bruised|bruising|graze|grazes|grazed|grazing|nick|nicks|nicked|scrape|scrapes|scraped|scraping|sting|stings|stinging|stung|singe|singes|singed"),
        new RegExp("\\byou(?:\\s+\\w+){0,3}\\s+feel(?:\\s+\\w+){0,5}\\s+(?:ache|aching|bruised|sting|stinging|throb|throbbing)\\b", "i")
    ] }
];
// --- Narrative HEALING (owner ruling 4b): someone treats YOU -----------------------
const TK_HEAL_TIERS = [
    { name: "major", pct: 25, rx: [
        new RegExp("\\b(?:heal|heals|healed|healing|cure|cures|cured|restore|restores|restored|regenerate|regenerates|regenerated)(?:\\s+\\w+){0,3}\\s+(?:you\\b|your\\b)", "i"),
        new RegExp("\\b(?:warmth|relief|healing light|soothing energy)(?:\\s+\\w+){0,3}\\s+(?:spreads|washes|flows|courses)(?:\\s+\\w+){0,3}\\s+through\\s+(?:you|your)\\b", "i")
    ] },
    { name: "moderate", pct: 12, rx: [
        new RegExp("\\b(?:bandage|bandages|bandaged|bandaging|bind|binds|bound|patch|patches|patched|stitch|stitches|stitched|stitching|treat|treats|treated|mend|mends|mended)(?:\\s+\\w+){0,3}\\s+(?:you|your)\\b", "i"),
        new RegExp("\\byou\\s+feel(?:\\s+\\w+){0,3}\\s+(?:better|restored|mended|renewed|whole)\\b", "i")
    ] },
    { name: "minor", pct: 5, rx: [
        new RegExp("\\b(?:dab|dabs|dabbed|clean|cleans|cleaned|soothe|soothes|soothed|tend|tends|tended)(?:\\s+\\w+){0,3}\\s+(?:you|your)\\b", "i")
    ] }
];
// --- Recovery verbs (owner rulings 5+6): hardcoded percents of max ------------------
const TK_VERBS = {
    rest:     { stub: "You rest for a while.",    effects: { stamina: 50, health: 10, mana: 25 } },
    sleep:    { stub: "You sleep.",               effects: { stamina: 100, mana: 100, health: 25 } }
};  // eat/drink → InventoryKit v0.2.0; meditate → judged stub (v0.3.2)
const TK_COST_CAP_PCT = 25;   // per-turn clamp on model-reported deltas, each direction

function TK_state() {
    if (!state.vars || typeof state.vars !== "object") state.vars = {};
    if (!state.vars.TK || typeof state.vars.TK !== "object") state.vars.TK = {};
    const TK = state.vars.TK;
    if (!TK.trackers || typeof TK.trackers !== "object") TK.trackers = {};
    if (typeof TK.actions !== "number") TK.actions = 0;      // adjudicated-action clock for drift
    if (typeof TK.actionTurn !== "number") TK.actionTurn = -1; // retry guard for the clock
    if (typeof TK.moveTurn !== "number") TK.moveTurn = -1;   // retry guard for check-coupling
    if (typeof TK.costTurn !== "number") TK.costTurn = -1;   // one resource charge per action
    if (typeof TK.woundTurn !== "number") TK.woundTurn = -1; // one wound per action
    if (typeof TK.healTurn !== "number") TK.healTurn = -1;   // one narrative heal per action
    if (!TK.lastWound || typeof TK.lastWound !== "object") TK.lastWound = null;  // the reread's verdict (v0.4.0)
    if (!TK.dead || typeof TK.dead !== "object") TK.dead = null;                 // the Lock (v0.5.0)
    if (typeof TK.noteTurn !== "number") TK.noteTurn = -1;
    return TK;
}

function TK_turn() {
    return (info && typeof info.actionCount === "number") ? info.actionCount : -1;
}

function TK_cfg() {
    if (typeof SC_config === "function") {
        try {
            return SC_config("Trackers Config", TK_SETTINGS, {
                header: "# Trackers Config\n> Each number is a MAXIMUM — full at start; 0 turns a gauge off. Edit, then continue your story.",
                description: "TrackerKit (the Gauge). Health, Stamina, and Hunger are built in; Mana ships OFF — set Mana: 100 to enable it. Each number is the maximum (full at start; 0 disables). How gauges move: Health takes WOUNDS parsed from the story's own prose (severity tiers, evidence in the Event Log) and narrated healing; Stamina and Mana pay COSTS the ruling reports (resource=stamina -6), capped per turn; Hunger drifts down slowly; Mana regenerates slowly. Recovery verbs: /rest /sleep /eat /drink /meditate. Manual override: /track health +10. Advanced: add fully custom trackers one per line in the ENTRY — \"- Doom: start=0, range=0-6, on-fail=any +1, high=Doomsday\" is an EXAMPLE, not a built-in — options: start= range=lo-hi bands=a/b/c/d drift=±n/actions on-fail=skills ±n on-success=skills ±n low=Event high=Event note=false. A custom line named like a preset overrides it. Values clamp to range; malformed lines are skipped and reported."
            });
        } catch (e) {}
    }
    return Object.assign({}, TK_SETTINGS);
}

function TK_canon(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9 \-']/g, " ")
        .replace(/\s+/g, " ").trim().slice(0, 24);
}

function TK_pretty(name) {
    return String(name).replace(/(^|[\s\-'])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
}

// Parse tracker definitions from the Trackers Config card entry. Definitions
// are TRANSIENT (re-read every pass — live edits bite); only values persist.
// Built-in presets (v0.1.1). Internals scale with the configured max;
// gentle on purpose — difficulty is a later pass.
const TK_COMBAT_SKILLS = ["combat", "fighting", "melee", "brawling", "swordsmanship", "archery", "dodging", "defense"];
const TK_MAGIC_SKILLS = ["magic", "spellcasting", "casting", "sorcery", "arcana", "wizardry", "enchanting", "conjuration"];
function TK_preset(name, max) {
    const dmg = Math.max(1, Math.round(max / 10));
    const tick = Math.max(1, Math.round(max / 20));
    const def = { name: name, start: max, min: 0, max: max, bands: null,
        drift: null, rules: [], low: "", high: "", note: true, ok: true };
    if (name === "health") {
        def.bands = ["dying", "wounded", "hurt", "fine"];   // wounds come from PROSE (v0.2)
        def.low = "Down";
    } else if (name === "stamina") {
        def.low = "Exhausted";                              // effort comes from the COST field (v0.2)
    } else if (name === "hunger") {
        def.drift = { delta: -tick, per: 10 };
        def.low = "Starving";
    } else if (name === "mana") {
        // Casting costs arrive via the ruling's resource field (v0.2) —
        // check-rules removed to prevent double-charging. Regen stays.
        def.drift = { delta: tick, per: 8 };
        def.low = "Drained";
    }
    return def;
}

function TK_defs(cfg) {
    const defs = {};
    const presets = [["health", cfg.HEALTH], ["stamina", cfg.STAMINA], ["hunger", cfg.HUNGER], ["mana", cfg.MANA]];
    // v0.3.0 (the Growth): preset maxima scale +5%/level via SkillKit's public
    // seam — the creator's number stays the BASE; custom trackers NEVER scale.
    let lvMult = 1;
    if (typeof SK_level === "function") {
        try { lvMult = 1 + 0.05 * (SK_level() - 1); } catch (e) {}
    }
    for (let i = 0; i < presets.length; i++) {
        let max = Math.round(Number(presets[i][1]));
        if (Number.isFinite(max) && max > 0) {
            max = Math.max(1, Math.round(max * lvMult));
            defs[presets[i][0]] = TK_preset(presets[i][0], max);
        }
    }
    if (typeof SC_get !== "function") return defs;
    const card = SC_get("Trackers Config");
    if (!card) return defs;
    const lines = String(card.entry || "").split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!/^-\s/.test(line)) continue;
        const body = line.replace(/^-\s*/, "");
        const colon = body.indexOf(":");
        if (colon === -1) { TK_complain(cfg, body); continue; }
        const name = TK_canon(body.slice(0, colon));
        if (!name) { TK_complain(cfg, body); continue; }
        const def = { name: name, start: 0, min: 0, max: 10, bands: null,
            drift: null, rules: [], low: "", high: "", note: true, ok: true };
        const parts = (typeof RX_csv === "function") ? RX_csv(body.slice(colon + 1)) : body.slice(colon + 1).split(",");
        for (let j = 0; j < parts.length; j++) {
            const kv = (typeof RX_keyValue === "function") ? RX_keyValue(parts[j]) : null;
            if (!kv) continue;
            const k = kv.key.toLowerCase().replace(/\s+/g, "-");
            const v = kv.value.trim();
            if (k === "start") { def.start = parseInt(v, 10) || 0; }
            else if (k === "range") {
                const m = v.match(/^(-?\d+)\s*-\s*(-?\d+)$/);
                if (m) { def.min = parseInt(m[1], 10); def.max = parseInt(m[2], 10); }
                else def.ok = false;
            }
            else if (k === "bands") { def.bands = v.split("/").map(function (s) { return s.trim(); }).filter(Boolean); }
            else if (k === "drift") {
                const m = v.match(/^([+-]?\d+)\s*\/\s*(\d+)$/);
                if (m) def.drift = { delta: parseInt(m[1], 10), per: Math.max(1, parseInt(m[2], 10)) };
                else def.ok = false;
            }
            else if (k === "on-fail" || k === "on-success") {
                const m = v.match(/^(.*?)\s*([+-]\d+)$/);
                if (m) {
                    const skills = m[1].trim().toLowerCase();
                    def.rules.push({
                        when: (k === "on-fail") ? "fail" : "success",
                        skills: (skills === "" || skills === "any") ? null
                            : skills.split(/[\/|]/).map(function (s) { return TK_canon(s); }).filter(Boolean),
                        delta: parseInt(m[2], 10)
                    });
                } else def.ok = false;
            }
            else if (k === "low") { def.low = v; }
            else if (k === "high") { def.high = v; }
            else if (k === "note") { def.note = !/^(false|off|no|0)$/i.test(v); }
        }
        if (def.max < def.min) def.ok = false;
        if (!def.ok) { TK_complain(cfg, body); continue; }
        defs[name] = def;
    }
    return defs;
}

function TK_complain(cfg, line) {
    if (cfg.REPORT && typeof SC_report === "function") {
        try { SC_report("Trackers", "skipped malformed line: \"" + String(line).slice(0, 60) + "\""); } catch (e) {}
    }
}

function TK_rec(def) {
    const TK = TK_state();
    if (!TK.trackers[def.name] || typeof TK.trackers[def.name] !== "object") {
        TK.trackers[def.name] = { val: TK_clampDef(def, def.start), driftAt: TK.actions, fired: "" };
    }
    const r = TK.trackers[def.name];
    if (typeof r.val !== "number") r.val = TK_clampDef(def, def.start);
    r.val = TK_clampDef(def, r.val);   // live range edits clamp persisted values
    if (typeof r.driftAt !== "number") r.driftAt = TK.actions;
    if (typeof r.fired !== "string") r.fired = "";
    return r;
}

function TK_clampDef(def, v) {
    return Math.max(def.min, Math.min(def.max, Math.round(v)));
}

function TK_band(def, val) {
    if (!def.bands || !def.bands.length) return null;
    const span = (def.max - def.min + 1) / def.bands.length;
    const idx = Math.min(def.bands.length - 1, Math.floor((val - def.min) / span));
    return def.bands[idx];
}

// Move a gauge with cause; clamps, reports, fires thresholds once per pinning.
function TK_move(cfg, def, delta, cause) {
    const r = TK_rec(def);
    const before = r.val;
    r.val = TK_clampDef(def, r.val + delta);
    if (r.val === before) return false;
    if (cfg.REPORT && typeof SC_report === "function") {
        try { SC_report("Trackers", TK_pretty(def.name) + " " + before + "→" + r.val + (cause ? " (" + cause + ")" : "")); } catch (e) {}
    }
    // Threshold events: fire on ARRIVAL at a bound, once per pinning.
    let event = "";
    if (r.val === def.min && def.low) event = def.low;
    else if (r.val === def.max && def.high) event = def.high;
    if (event && r.fired !== event) {
        r.fired = event;
        if (typeof SC_report === "function") {
            try { SC_report("Trackers", TK_pretty(def.name) + ": " + event.toUpperCase()); } catch (e) {}
        }
    } else if (!event) {
        r.fired = "";
    }
    return true;
}

// Public write seam (v0.2.1): other modules move a gauge deterministically.
// Range-clamp only — no 25% cap. Returns the delta actually applied.
function TK_apply(name, delta, cause) {
    try {
        const cfg = TK_cfg();
        if (!cfg.ENABLED) return 0;
        const defs = TK_defs(cfg);
        const canon = TK_canon(name);
        const def = canon ? defs[canon] : null;
        if (!def || !def.ok) {
            if (cfg.REPORT && typeof SC_report === "function") {
                try { SC_report("Trackers", "apply skipped: no tracker \"" + String(name).slice(0, 30) + "\"" + (cause ? " (" + cause + ")" : "")); } catch (e) {}
            }
            return 0;
        }
        const d = Math.round(Number(delta));
        if (!Number.isFinite(d) || d === 0) return 0;
        const before = TK_rec(def).val;
        TK_move(cfg, def, d, cause || "applied");
        const applied = TK_rec(def).val - before;
        if (applied !== 0) TK_refreshNote(cfg, defs);
        return applied;
    } catch (e) { return 0; }
}

// The arbiter note: banded gauges speak labels; unbanded speak numbers
// ("4 of 6" when a high= cap gives the count meaning). Threshold events
// replace the reading while pinned. note=false hides a tracker entirely.
function TK_refreshNote(cfg, defs) {
    if (typeof GK_setArbiterNote !== "function") return;
    const names = Object.keys(defs);
    const parts = [];
    let len = "trackers —".length;
    for (let i = 0; i < names.length; i++) {
        const def = defs[names[i]];
        if (!def.note) continue;
        const r = TK_rec(def);
        let reading;
        if (r.fired) reading = r.fired.toUpperCase();
        else {
            const band = TK_band(def, r.val);
            reading = band ? band : (def.high ? (r.val + " of " + def.max) : String(r.val));
        }
        const piece = (parts.length ? "; " : " ") + def.name + ": " + reading;
        if (len + piece.length > TK_NOTE_CAP) break;
        parts.push(piece); len += piece.length;
    }
    if (!parts.length) { GK_setArbiterNote(TK_NOTE_OWNER, ""); return; }
    GK_setArbiterNote(TK_NOTE_OWNER, "trackers —" + parts.join(""));
    TK_state().noteTurn = TK_turn();
}

// The Trackers card (projection, never parsed back): value, band, bounds.
// v0.3.1 (the Sheet): public read seam — the gauges as data, for renderers.
function TK_readGauges() {
    const out = [];
    try {
        const cfg = TK_cfg();
        if (!cfg.ENABLED) return out;
        const defs = TK_defs(cfg);
        for (const name in defs) {
            const def = defs[name];
            if (!def.ok) continue;
            const r = TK_rec(def);
            out.push({ name: name, pretty: TK_pretty(name), val: r.val, min: def.min,
                max: def.max, band: TK_band(def, r.val), event: r.fired || "" });
        }
    } catch (e) {}
    return out;
}

function TK_renderCard(defs) {
    // v0.3.1: the Trackers card retires when the Sheet is present (owner ruling).
    if (typeof CS_onOutput === "function") {
        try { if (typeof SC_remove === "function") SC_remove("Trackers"); } catch (e) {}
        return;
    }
    if (typeof SC_render !== "function") return;
    const names = Object.keys(defs);
    const lines = [];
    for (let i = 0; i < names.length; i++) {
        const def = defs[names[i]];
        const r = TK_rec(def);
        const band = TK_band(def, r.val);
        lines.push("- " + TK_pretty(def.name) + ": " + r.val + "/" + def.max
            + (band ? " (" + band + ")" : "") + (r.fired ? " — " + r.fired.toUpperCase() : ""));
    }
    SC_render("Trackers", "## Trackers\n" + (lines.length ? lines.join("\n") : "- (none configured — add lines to Trackers Config)"),
        { type: SC_TYPE_GAMEPLAY, keys: "Trackers" });
}

// --- Input pass: /track command (bookkeeping; the Check yields) -------------------
function TK_onInput(text) {
    const t = String(text || "");
    try {
        const cfg = TK_cfg();                       // rule 11: config card materializes
        if (!cfg.ENABLED) return t;
        const defs = TK_defs(cfg);
        TK_renderCard(defs);                        // Trackers card materializes turn 1
        TK_refreshNote(cfg, defs);                  // note exists from turn 1; edits bite on input too
        if (cfg.REPORT && typeof SC_reportEnsure === "function") SC_reportEnsure();
        // The Lock (v0.5.0): a corpse takes no actions. Cards still render above —
        // the Sheet stays readable — but the turn is stamped bookkeeping so the
        // Check never adjudicates the dead, and the action itself is replaced.
        if (TK_isDead() && TK_lockOn(cfg)) {
            if (typeof GK_markCommandTurn === "function") { try { GK_markCommandTurn(); } catch (e) {} }
            return " ";
        }
        if (typeof RX_command !== "function") return t;
        const cmd = RX_command(t, ["track", "rest", "sleep", "meditate"]);
        if (!cmd) return t;
        // v0.3.2: /meditate is JUDGED — a narratable stub, no bookkeeping stamp,
        // no deterministic apply; the ruling reports what the trance restores.
        if (cmd.name === "meditate") return "You settle into meditation, reaching for your center.";
        if (typeof GK_markCommandTurn === "function") { try { GK_markCommandTurn(); } catch (e) {} }
        if (cmd.name === "track") {
            const m = cmd.args.match(/^(.*?)\s*([+-]\d+)\s*$/);
            const name = m ? TK_canon(m[1]) : "";
            if (m && name && defs[name]) {
                TK_move(cfg, defs[name], parseInt(m[2], 10), "/track");
            } else if (cfg.REPORT && typeof SC_report === "function") {
                try { SC_report("Trackers", "unknown tracker or bad amount: /track " + cmd.args); } catch (e) {}
            }
            TK_refreshNote(cfg, defs);
            TK_renderCard(defs);
            return " ";
        }
        // Recovery verbs: hardcoded effects on whichever targets are enabled.
        const verb = TK_VERBS[cmd.name];
        let touched = 0;
        for (const target in verb.effects) {
            if (!defs[target]) continue;
            const def = defs[target];
            const amt = Math.max(1, Math.round((def.max - def.min) * verb.effects[target] / 100));
            if (TK_move(cfg, def, amt, "/" + cmd.name)) touched++;
        }
        if (!touched && cfg.REPORT && typeof SC_report === "function") {
            try { SC_report("Trackers", "/" + cmd.name + ": no enabled tracker to affect (or already full)"); } catch (e) {}
        }
        TK_refreshNote(cfg, defs);
        TK_renderCard(defs);
        return verb.stub;                           // narratable stub, INV-style
    } catch (e) {}
    return t;
}

// --- Output pass: drift + check-coupling on the settled ruling --------------------
// Wired LAST. The action clock ticks once per actionCount (retry-guarded);
// drift applies per tracker from its own driftAt watermark; check-coupling
// reads GK_lastCheck() once per turn — doubt moves gauges, bookkeeping never
// does (command turns are yielded and carry no ruling).
function TK_onOutput(text) {
    let out = String(text || "");
    try {
        const cfg = TK_cfg();
        if (!cfg.ENABLED) return out;
        const TK = TK_state();
        const defs = TK_defs(cfg);
        const turn = TK_turn();
        let changed = false;

        // The Lock (v0.5.0), part one: if the story ALREADY ended before this
        // pass, replace the output and stop. Checked first so a corpse neither
        // drifts nor bleeds — and checked BEFORE the detection below, so the
        // turn that kills you still shows the arbiter's ominous ending.
        if (TK_isDead() && TK_lockOn(cfg)) {
            TK_renderCard(defs);
            return String(cfg.DEATH_MESSAGE || TK_SETTINGS.DEATH_MESSAGE);
        }
        if (turn !== -1 && TK.actionTurn !== turn) {
            TK.actionTurn = turn;
            TK.actions++;
        }
        // The COST (v0.2): apply the ruling's resource report. NO difficulty
        // gate (owner ruling: trivial and impossible may charge). Clamped to
        // ±25% of max per turn; unknown resources reported, never thrown.
        if (typeof GK_lastCheck === "function" && TK.costTurn !== turn) {
            let cc = null;
            try { cc = GK_lastCheck(); } catch (e) {}
            if (cc && cc.turn === turn && cc.resource && cc.resourceDelta) {
                TK.costTurn = turn;
                const rname = TK_canon(cc.resource);
                if (defs[rname]) {
                    const rdef = defs[rname];
                    const cap = Math.max(1, Math.round((rdef.max - rdef.min) * TK_COST_CAP_PCT / 100));
                    const d = Math.max(-cap, Math.min(cap, cc.resourceDelta));
                    if (TK_move(cfg, rdef, d, (d < 0 ? "cost" : "restore") + (cc.skill ? ": " + cc.skill : ""))) changed = true;
                } else if (cfg.REPORT && typeof SC_report === "function") {
                    try { SC_report("Trackers", "unknown resource from ruling: " + cc.resource); } catch (e) {}
                }
            }
        }
        // The WOUND (v0.4.0, the Wound Reread): pain frame first, then assault;
        // every candidate irrealis-guarded. One wound per action, evidence logged.
        if (defs.health && TK.woundTurn !== turn && out.trim() !== "") {
            const hit = TK_readWound(out);
            if (hit) {
                TK.woundTurn = turn;
                TK.lastWound = { frame: hit.frame, tier: hit.tier, pct: hit.pct,
                                 span: String(hit.span).slice(0, 60).trim(), veto: !!hit.veto, turn: turn };
                if (hit.veto) {
                    // The guard fired: say so. Silence is what hid every incident
                    // in the case law; an invisible veto is an invisible bug.
                    if (cfg.REPORT && typeof SC_report === "function") {
                        try { SC_report("Trackers", "no wound — the prose prevented it: \"" + String(hit.span).slice(0, 44).trim() + "\""); } catch (e) {}
                    }
                } else {
                    const dmg = Math.max(1, Math.round((defs.health.max - defs.health.min) * hit.pct / 100));
                    if (TK_move(cfg, defs.health, -dmg, hit.frame + "/" + hit.tier + ": \"" + String(hit.span).slice(0, 44).trim() + "\"")) changed = true;
                }
            }
        }
        // Narrative HEALING (v0.2, owner ruling 4b): someone treats you.
        if (defs.health && TK.healTurn !== turn && out.trim() !== "") {
            for (let hi = 0; hi < TK_HEAL_TIERS.length; hi++) {
                const tier = TK_HEAL_TIERS[hi];
                let hm = null;
                for (let ri = 0; ri < tier.rx.length && !hm; ri++) hm = out.match(tier.rx[ri]);
                if (!hm) continue;
                TK.healTurn = turn;
                const amt = Math.max(1, Math.round((defs.health.max - defs.health.min) * tier.pct / 100));
                if (TK_move(cfg, defs.health, amt, "healed " + tier.name + ": \"" + hm[0].slice(0, 44).trim() + "\"")) changed = true;
                break;
            }
        }
        // Drift: each tracker advances from its own watermark.
        const names = Object.keys(defs);
        for (let i = 0; i < names.length; i++) {
            const def = defs[names[i]];
            if (!def.drift) { TK_rec(def).driftAt = TK.actions; continue; }
            const r = TK_rec(def);
            while (TK.actions - r.driftAt >= def.drift.per) {
                r.driftAt += def.drift.per;
                if (TK_move(cfg, def, def.drift.delta, "drift")) changed = true;
            }
        }
        // Check-coupling: one settled ruling per turn, matched against rules.
        if (typeof GK_lastCheck === "function" && TK.moveTurn !== turn) {
            let c = null;
            try { c = GK_lastCheck(); } catch (e) {}
            // Doubt moves gauges (same boundary as SkillKit's accrual, same
            // reasoning): trivial and impossible rulings are certainties, not
            // events — no consequence flows from them.
            if (c && c.turn === turn && (c.result === "fail" || c.result === "success")
                && (c.difficulty === "minor" || c.difficulty === "major")) {
                TK.moveTurn = turn;
                const skill = c.skill ? TK_canon(c.skill) : null;
                for (let i = 0; i < names.length; i++) {
                    const def = defs[names[i]];
                    for (let j = 0; j < def.rules.length; j++) {
                        const rule = def.rules[j];
                        if (rule.when !== c.result) continue;
                        if (rule.skills && (!skill || rule.skills.indexOf(skill) === -1)) continue;
                        if (TK_move(cfg, def, rule.delta, c.result === "fail" ? ("failed: " + (skill || "check")) : ("succeeded: " + (skill || "check")))) changed = true;
                    }
                }
            }
        }
        // The Lock, part two: the story ends here. Detected AFTER every gauge has
        // settled and after the model's narration has already been written, so
        // this turn keeps its death scene; the lock bites from the next turn.
        if (!TK.dead && defs.health) {
            const hr = TK_rec(defs.health);
            if (hr.val <= defs.health.min) {
                TK.dead = { turn: turn, gauge: defs.health.name || "Health" };
                if (cfg.REPORT && typeof SC_report === "function") {
                    try { SC_report("Trackers", "the story ends here — " + TK.dead.gauge + " reached " + defs.health.min); } catch (e) {}
                }
            }
        }
        TK_refreshNote(cfg, defs);   // every pass: config edits bite immediately
        TK_renderCard(defs);
    } catch (e) {}
    return out;
}

// ===== EventKit v0.1.1 =====
// v0.1.1 — the SILENT SIXTY-FIVE (live-found 7/21/2026: 65 story turns,
//  zero fires — P(luck) ~0.1%). The cadence roll lived in the INPUT pass
//  and asked history whether this was a story turn; during AID's input
//  phase the current action ISN'T IN HISTORY YET, so the guard read the
//  AI's previous output (a continue) every time and vetoed every roll.
//  Rule 7 hid it perfectly. GateKit never trusts history at input — its
//  history reads are context/output only — and now neither do we: the
//  roll moves to EV_onContext, where history is settled (the same reason
//  GK's safety-net roll lives there). Input keeps only /event and the
//  Turn-1 card. Harness caught nothing because the harness appends the
//  action to history before hooks run — live-shaped inputs are LAW, and
//  the live shape of INPUT-phase history is "one turn behind.
// v0.1.0 — the INTRUSION (proposal + owner veto sheet resolved 7/21/2026):
//  the world acts unprompted. On a chance-and-cooldown cadence (Chance is
//  FD's EventRate: percent, default 10; Cooldown 5 story turns), a weighted
//  pick from category pools hands the narrator a DIRECTIVE via a dedicated
//  <SYSTEM> block — rendered only on event turns, wired BEFORE GateKit's
//  arbiter block so the verdict schema keeps the last word. No residue
//  note (owner veto: the story is the memory — once narrated, the event
//  lives in context because the story is written around it).
//  Doctrine (owner ruling, verbatim): "Generic events should alter the
//  fiction, not presume the scenario's mechanics." Preset pools are
//  fiction-only; `fx` is the optional entry field presets never populate.
//  Thematic scripter events (EV_CUSTOM block below, or EV_addPool from any
//  script) may carry fx — applied deterministically through TK_apply
//  (range-clamp only, evidence-logged), the RESR lineage.
//  The Event Log fire line is UNCONDITIONAL — never Report-gated (owner
//  note: it is the player's only deterministic record that an intrusion
//  was engine-made rather than model whimsy). /event [category] is the
//  Report-gated debug verb: bypasses chance/cooldown, honors no-repeat.
//  Selection: config Weights pick the category (unlisted categories weigh
//  1, 0 disables), entry w picks within; last 5 fired ids are excluded
//  (no-repeat); exhausted categories fall through; everything excluded
//  fires nothing (rule 7 — degrade to no event, never repeat-spam).
//  [a|b|c] in entry text is an inline spinner (FD's generative-crossproduct
//  trick at the string layer), expanded at fire time.
// Namespace: EV. Consumes: SC_config/SC_get/SC_report (CardLib),
//  GK_markCommandTurn/GK_isCommandTurn (GateKit v0.8.2), TK_apply
//  (TrackerKit v0.2.1). All optional — degrades per rule 7.

const EV_SETTINGS = {
    ENABLED: true, CHANCE: 10, COOLDOWN: 5,
    WEIGHTS: "encounter=2, environment=2, discovery=1, hazard=1, omen=1",
    REPORT: true
};

if (typeof log === "function") log("[EventKit] library loaded (v0.1.1)");

// --- Layer 1: generic presets — fiction only, never mechanics ------------------------
const EV_POOLS = {
    encounter: [
        { id: "stranger-approach", w: 2, text: "a [stranger|hooded traveler|breathless courier|weathered peddler] approaches the player with [an urgent need|a warning|an offer|a question they seem afraid to ask]" },
        { id: "creature-crosses", w: 2, text: "a [wary animal|strange creature|pack of scavengers] crosses the player's path — [watching|hungry|hurt|guarding something]" },
        { id: "watcher-revealed", w: 1, text: "someone has been [following|watching] the player, and has just [slipped up|been noticed|chosen to show themselves]" },
        { id: "old-face", w: 1, text: "a figure from the player's past appears where they are least expected" }
    ],
    environment: [
        { id: "weather-turns", w: 2, text: "the weather turns [suddenly foul|strange|violent] — [wind|rain|fog|heat|cold] that changes what is possible here" },
        { id: "light-fails", w: 1, text: "the light [fails|shifts] — [dusk falls fast|flames gutter|shadows pool where they should not]" },
        { id: "sound-carries", w: 2, text: "a sound carries from [somewhere close|the distance]: [a scream|a bell|hoofbeats|something large moving|music where none should play]" },
        { id: "ground-shifts", w: 1, text: "the ground itself acts — [a tremor|a collapse ahead|a path revealed|a way closed]" }
    ],
    discovery: [
        { id: "glint", w: 2, text: "something [glints|lies half-hidden] nearby, [dropped|abandoned|deliberately placed]" },
        { id: "traces", w: 2, text: "traces of [recent passage|a struggle|a hastily abandoned camp] tell a story the player can read" },
        { id: "unnoticed-way", w: 1, text: "a [door|path|passage] the player had not noticed before stands [ajar|marked|waiting]" },
        { id: "message", w: 1, text: "a message reaches the player — [a note|a sign|a symbol|a voice] meant for [them|someone else entirely]" }
    ],
    hazard: [
        { id: "ambush", w: 2, text: "an ambush springs — [figures|something] that has been waiting for [the player|anyone at all]" },
        { id: "trap", w: 2, text: "a hazard underfoot: [a snare|a pitfall|a weakened floor|a warning, triggered]" },
        { id: "pursuit", w: 1, text: "pursuit — something [has caught the player's trail|is closing in], and it is no longer being quiet about it" },
        { id: "accident", w: 1, text: "an accident unfolds nearby that will involve the player whether they act or not" }
    ],
    omen: [
        { id: "dread", w: 2, text: "a wrongness settles over the moment — [silence where there should be sound|a smell of smoke on clean air|the sense of being expected]" },
        { id: "portent", w: 1, text: "a portent: [an animal behaving strangely|a mark that was not there before|the image of a dream, waking]" },
        { id: "memory-stirs", w: 1, text: "this place stirs a memory in the player, vivid and uninvited" },
        { id: "unnatural-calm", w: 1, text: "an unnatural calm — the world holding its breath" }
    ]
};

// --- Layer 2a: EV_CUSTOM — scripters, add your scenario's events HERE ----------------
// Same entry shape as above. New category names create categories; existing
// names extend them. Thematic events may carry fx — deterministic tracker
// deltas applied via TK_apply, evidence-logged:
//   mytheme: [ { id: "gate-bell", w: 2, text: "the gate bell tolls, and it is not a drill", fx: [["stamina", -10]] } ]
const EV_CUSTOM = {};

// --- Layer 2b: EV_addPool — register pools from your own script ----------------------
let EV_REG = {};
function EV_addPool(category, entries) {
    try {
        const cat = String(category || "").trim().toLowerCase();
        if (!cat || !Array.isArray(entries)) return false;
        if (!EV_REG[cat]) EV_REG[cat] = [];
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            if (e && typeof e.id === "string" && typeof e.text === "string") EV_REG[cat].push(e);
        }
        return true;
    } catch (e) { return false; }
}

function EV_pools() {
    const merged = {};
    const srcs = [EV_POOLS, EV_CUSTOM, EV_REG];
    for (let s = 0; s < srcs.length; s++) {
        for (const cat in srcs[s]) {
            if (!Array.isArray(srcs[s][cat])) continue;
            if (!merged[cat]) merged[cat] = [];
            merged[cat] = merged[cat].concat(srcs[s][cat]);
        }
    }
    return merged;
}

// --- plumbing ------------------------------------------------------------------------
function EV_state() {
    if (!state.vars) state.vars = {};
    if (!state.vars.EV || typeof state.vars.EV !== "object") state.vars.EV = {};
    const EV = state.vars.EV;
    if (typeof EV.rollTurn !== "number") EV.rollTurn = -1;
    if (typeof EV.firedTurn !== "number") EV.firedTurn = -1;
    if (typeof EV.cooldown !== "number") EV.cooldown = 0;
    if (typeof EV.pending !== "object") EV.pending = null;
    if (!Array.isArray(EV.recent)) EV.recent = [];
    return EV;
}

function EV_turn() {
    return (info && typeof info.actionCount === "number") ? info.actionCount : -1;
}

function EV_cfg() {
    if (typeof SC_config === "function") {
        try { return SC_config("Events Config", EV_SETTINGS); } catch (e) {}
    }
    return Object.assign({}, EV_SETTINGS);
}

function EV_report(msg) {
    if (typeof SC_report === "function") { try { SC_report("EventKit", msg); } catch (e) {} }
}

// [a|b|c] inline spinner — expanded at fire time; no nesting.
function EV_spin(s) {
    let out = String(s || ""), guard = 0, m;
    const rx = /\[([^\[\]]+)\]/;
    while ((m = rx.exec(out)) && guard++ < 20) {
        const opts = m[1].split("|");
        out = out.slice(0, m.index) + opts[Math.floor(Math.random() * opts.length)].trim() + out.slice(m.index + m[0].length);
    }
    return out;
}

function EV_weights(cfg) {
    const w = {};
    const parts = String(cfg.WEIGHTS || "").split(",");
    for (let i = 0; i < parts.length; i++) {
        const m = parts[i].trim().match(/^([a-z][a-z0-9 _-]*?)\s*[=:]\s*(\d+)$/i);
        if (m) w[m[1].trim().toLowerCase()] = parseInt(m[2], 10);
    }
    return w;
}

// Weighted pick: category by config Weights (unlisted = 1, 0 disables),
// entry by w within. Recent ids excluded; empty categories fall through;
// full exclusion returns null (rule 7). `only` restricts to one category.
function EV_pick(cfg, only) {
    const pools = EV_pools();
    const weights = EV_weights(cfg);
    const EV = EV_state();
    const cats = [];
    for (const name in pools) {
        if (only && name !== only) continue;
        const entries = [];
        for (let i = 0; i < pools[name].length; i++) {
            const e = pools[name][i];
            if (e && e.id && EV.recent.indexOf(e.id) === -1) entries.push(e);
        }
        if (!entries.length) continue;
        const w = only ? 1 : ((name in weights) ? weights[name] : 1);
        if (w > 0) cats.push({ name: name, entries: entries, w: w });
    }
    if (!cats.length) return null;
    let total = 0;
    for (let i = 0; i < cats.length; i++) total += cats[i].w;
    let roll = Math.random() * total;
    let cat = cats[cats.length - 1];
    for (let i = 0; i < cats.length; i++) { roll -= cats[i].w; if (roll < 0) { cat = cats[i]; break; } }
    total = 0;
    for (let i = 0; i < cat.entries.length; i++) total += (cat.entries[i].w > 0 ? cat.entries[i].w : 1);
    roll = Math.random() * total;
    let ent = cat.entries[cat.entries.length - 1];
    for (let i = 0; i < cat.entries.length; i++) { roll -= (cat.entries[i].w > 0 ? cat.entries[i].w : 1); if (roll < 0) { ent = cat.entries[i]; break; } }
    return { id: ent.id, cat: cat.name, text: EV_spin(ent.text), fx: Array.isArray(ent.fx) ? ent.fx : null };
}

// Bookkeeping? Ask GateKit (v0.8.2 seam); without it, slash-prefix fallback.
function EV_isBookkeeping(t) {
    if (typeof GK_isCommandTurn === "function") { try { return GK_isCommandTurn(); } catch (e) {} }
    return /^\s*>?\s*(?:You\s+)?\//i.test(String(t || ""));
}

// --- hooks ---------------------------------------------------------------------------
// Input: /event and the Turn-1 card ONLY (v0.1.1). No rolls here — during
// the input phase, history is one turn behind (the silent sixty-five).
function EV_onInput(text) {
    try {
        const t = String(text || "");
        const cfg = EV_cfg();                              // rule 11: card on turn 1
        if (!cfg.ENABLED) return t;
        const EV = EV_state();
        const turn = EV_turn();

        // /event [category] — the Report-gated debug verb (owner ruling 7).
        const m = t.match(/^\s*>?\s*(?:You\s+)?\/event\b\s*([a-z0-9 _-]*?)[.\s]*$/im);
        if (m) {
            if (typeof GK_markCommandTurn === "function") { try { GK_markCommandTurn(); } catch (e) {} }
            if (!cfg.REPORT) { EV_report("/event is a debug verb — set Report: true to use it"); return "You pause a moment."; }
            const only = (m[1] || "").trim().toLowerCase() || null;
            const pick = EV_pick(cfg, only);
            if (!pick) { EV_report("/event: no eligible event" + (only ? " in \"" + only + "\"" : "")); return "You pause a moment."; }
            EV.rollTurn = turn;
            EV.pending = { id: pick.id, cat: pick.cat, text: pick.text, fx: pick.fx, turn: turn };
            return "You take stock of your surroundings.";
        }
        return t;
    } catch (e) { return String(text || ""); }
}

// Context (wired BEFORE GK_onContext): roll, then render. History is
// settled here, so the story-turn guard reads THIS turn (v0.1.1); the
// arbiter block lands after ours, so the verdict schema keeps the last
// word. One roll per actionCount — retries re-render, never re-roll.
function EV_onContext(text) {
    try {
        let ctx = String(text || "");
        const cfg = EV_cfg();
        if (!cfg.ENABLED) return ctx;
        const EV = EV_state();
        const turn = EV_turn();

        if (EV.rollTurn !== turn) {
            EV.rollTurn = turn;
            let story = false;
            try {
                const last = history && history[history.length - 1];
                story = !!last && ["do", "say", "story"].indexOf(last.type) !== -1;
            } catch (e) {}
            if (story && !EV_isBookkeeping("")) {
                if (EV.cooldown > 0) { EV.cooldown--; }    // weather, not a metronome
                else {
                    const chance = Math.max(0, Math.min(100, Math.round(Number(cfg.CHANCE)) || 0));
                    if (Math.random() * 100 < chance) {
                        const pick = EV_pick(cfg, null);
                        if (pick) EV.pending = { id: pick.id, cat: pick.cat, text: pick.text, fx: pick.fx, turn: turn };
                    }
                }
            }
        }

        if (!EV.pending || EV.pending.turn !== turn) return ctx;
        const block = "<SYSTEM>\nEVENT — this turn the world acts: " + EV.pending.text + ".\n"
            + "Weave it into your narration naturally. The player's action still resolves and is judged as usual.\n</SYSTEM>";
        return (ctx ? ctx + "\n\n" : "") + block;
    } catch (e) { return String(text || ""); }
}

// Output (wired after TK_onOutput): settle — fire line (UNCONDITIONAL), fx
// via TK_apply, no-repeat window, cooldown armed. Once per actionCount;
// retries re-render but never re-settle.
function EV_onOutput(text) {
    try {
        const t = String(text || "");
        const cfg = EV_cfg();
        if (!cfg.ENABLED) return t;
        const EV = EV_state();
        const turn = EV_turn();
        const p = EV.pending;
        if (!p || p.turn !== turn || EV.firedTurn === turn) return t;
        EV.firedTurn = turn;
        EV_report("event: " + p.id + " (" + p.cat + ")");   // the player's record — never gated
        if (Array.isArray(p.fx)) {
            for (let i = 0; i < p.fx.length; i++) {
                const f = p.fx[i];
                if (!Array.isArray(f) || f.length < 2) continue;
                if (typeof TK_apply === "function") { try { TK_apply(f[0], f[1], "event: " + p.id); } catch (e) {} }
                else EV_report("fx skipped (no TrackerKit): " + String(f[0]));
            }
        }
        EV.recent.push(p.id);
        while (EV.recent.length > 5) EV.recent.shift();
        EV.cooldown = Math.max(0, Math.round(Number(cfg.COOLDOWN)) || 0);
        return t;
    } catch (e) { return String(text || ""); }
}

// ===== SheetKit v0.1.3 =====
// v0.1.3 — the RACK, on the Sheet (owner ruling, 8/10/2026): equipment gets
//  its own "## Equipment" SECTION at the foot of the engine block — the
//  visibility the owner first asked of the Inventory card (that version was
//  built and rolled back within the hour; the Sheet is the better home for
//  what's built — the Inventory card keeps its annotated one-list truth,
//  §7.9 stands). Header renders only when gear exists (ruling 5).
// v0.1.2 — the Tools line (the Loadout amendment §9, 8/10/2026): fifth gear
//  category renders as "Tools: ..." — same INV_readEquipment() pull, same
//  empty-renders-nothing rule (owner ruling 5).
// v0.1.1 — the GEAR BLOCK (the Loadout, 7/21): four category lines pulled
//  via INV_readEquipment() each pass (no cross-module card writes — /throw
//  an equipped dagger and both surfaces update next render). Empty
//  categories render nothing (owner ruling 5).
// v0.1.0 — the SHEET (proposal + owner veto pass resolved 7/21/2026):
//  the Trackers card evolves into one always-on "Character Sheet" — the
//  identity block PLAYER-AUTHORED (the config-card clause extended: the
//  card IS the storage; five fields ship blank — Name/Gender/Pronouns/
//  Appearance/Background — and extra player lines survive verbatim),
//  the engine block PROJECTION (Level + epithet + Attributes via SkillKit
//  seams, gauges via TK_readGauges). THE SEMANTIC LAYER (owner ruling):
//  numbers are not hidden from context — they are TRANSLATED: one line of
//  EB-Condition-card prose under each gauge, quartile-keyed with pinned-
//  threshold overrides. The rule line "-----" separates player's half
//  from engine's half; everything above it is theirs.
// Namespace: CS. Consumes public seams only: SC_render/SC_get (CardLib),
//  SK_level/SK_epithet/SK_attributes/SK_cfg (SkillKit), TK_readGauges
//  (TrackerKit v0.3.1). All optional — rule 7 throughout. TrackerKit and
//  SkillKit yield their card surfaces on `typeof CS_onOutput` presence.

const CS_TITLE = "Character Sheet";
const CS_FIELDS = ["Name", "Gender", "Pronouns", "Appearance", "Background"];
const CS_RULE = "-----";

if (typeof log === "function") log("[SheetKit] library loaded (v0.1.3)");

// The semantic layer: quartile phrases per preset, pinned overrides at the floor.
const CS_PHRASES = {
    health:  { pinned: "You are down.", q: ["You are at death's door.", "You are badly wounded.", "You're hurt, but moving.", "You are unhurt and steady."] },
    stamina: { pinned: "You are utterly spent.", q: ["Your limbs drag with fatigue.", "You're winded and slowing.", "You've broken a sweat.", "You feel fresh."] },
    hunger:  { pinned: "You are starving.", q: ["Hunger gnaws at you.", "Your stomach growls.", "You could eat.", "You are well fed."] },
    mana:    { pinned: "You are drained dry.", q: ["Your magic gutters low.", "Your reserves run thin.", "Your power hums, ready.", "Your magic sits full."] }
};

function CS_semantic(g) {
    const p = CS_PHRASES[g.name];
    if (g.event) {
        if (p && g.val === g.min) return p.pinned;
        return "Your " + g.pretty.toLowerCase() + " has reached " + String(g.event) + ".";
    }
    if (p) {
        const span = (g.max - g.min) || 1;
        const q = Math.max(0, Math.min(3, Math.floor(((g.val - g.min) / span) * 4)));
        return p.q[q];
    }
    if (g.band) return "Your " + g.pretty.toLowerCase() + " reads " + String(g.band).toLowerCase() + ".";
    return "";
}

// The player's half: everything above the rule line, header stripped,
// the five fields healed in (blank), extra lines preserved verbatim.
function CS_identityFrom(entry) {
    let lines = String(entry || "").split("\n");
    const idx = lines.indexOf(CS_RULE);
    if (idx !== -1) lines = lines.slice(0, idx);
    while (lines.length && /^#\s/.test(lines[0])) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    for (let i = 0; i < CS_FIELDS.length; i++) {
        const rx = new RegExp("^\\s*" + CS_FIELDS[i] + "\\s*:", "i");
        let found = false;
        for (let j = 0; j < lines.length; j++) if (rx.test(lines[j])) { found = true; break; }
        if (!found) lines.push(CS_FIELDS[i] + ":");
    }
    return lines;
}

function CS_render() {
    if (typeof SC_render !== "function" || typeof SC_get !== "function") return;
    const existing = SC_get(CS_TITLE);
    const identity = CS_identityFrom(existing ? existing.entry : "");
    const eng = [];
    if (typeof SK_level === "function") {
        try {
            let line = "Level " + SK_level();
            if (typeof SK_epithet === "function") line += " (" + SK_epithet() + ")";
            eng.push(line);
            if (typeof SK_attributes === "function" && typeof SK_cfg === "function") {
                const a = SK_attributes(SK_cfg());
                if (a.names.length) eng.push("Attributes: " + a.names.join(", "));
            }
        } catch (e) {}
    }
    // The Rack (v0.1.3): gear as a dedicated section at the engine block's
    // foot, not lines lost among the stats. Empty renders nothing (ruling 5).
    const gear = [];
    if (typeof INV_readEquipment === "function") {
        try {
            const eq = INV_readEquipment();
            const byCat = {};
            for (let i = 0; i < eq.length; i++) (byCat[eq[i].slot] = byCat[eq[i].slot] || []).push(eq[i].name);
            const labels = { weapon: "Weapons", armor: "Armor", clothes: "Clothes", accessory: "Accessories", tool: "Tools" };
            const order = ["weapon", "armor", "clothes", "accessory", "tool"];
            for (let i = 0; i < order.length; i++) {
                if (byCat[order[i]] && byCat[order[i]].length) gear.push(labels[order[i]] + ": " + byCat[order[i]].join(", "));
            }
        } catch (e) {}
    }
    if (typeof TK_readGauges === "function") {
        try {
            const gs = TK_readGauges();
            for (let i = 0; i < gs.length; i++) {
                const g = gs[i];
                eng.push(g.pretty + ": " + g.val + "/" + g.max + (g.band ? " (" + g.band + ")" : ""));
                const sem = CS_semantic(g);
                if (sem) eng.push(sem);
            }
        } catch (e) {}
    }
    const entry = "# " + CS_TITLE + "\n" + identity.join("\n") + "\n\n" + CS_RULE
        + (eng.length ? "\n" + eng.join("\n") : "")
        + (gear.length ? "\n\n## Equipment\n" + gear.join("\n") : "");
    SC_render(CS_TITLE, entry, {
        type: (typeof SC_TYPE_GAMEPLAY !== "undefined") ? SC_TYPE_GAMEPLAY : "Gameplay",
        keys: (typeof SC_ALWAYS_ON !== "undefined") ? SC_ALWAYS_ON : CS_TITLE
    });
}

// Rule 11: the Sheet exists from Turn 1 (input pass); refreshed after the
// turn settles (output pass, wired after TK/EV so it renders truth).
function CS_onInput(text)  { try { CS_render(); } catch (e) {} return String(text || ""); }
function CS_onOutput(text) { try { CS_render(); } catch (e) {} return String(text || ""); }

// ===== ObserverKit v0.1.2 =====
// v0.1.2 — the WOUND FIELD (the Wound Reread's instrument, 8/13/2026):
//  records carry `wnd` = {f: frame, t: tier, v: vetoed, s: span} from
//  TK_lastWound(), so the parser's real false-positive and miss rates can be
//  measured in play instead of estimated from invented sentences.
//  BACKFILLED, deliberately: TrackerKit settles the wound LATER in the output
//  chain than OB records (OB sits right after GateKit so `rank` is the rank
//  HELD at attempt). Rather than move OB — or add a hook line the proposal
//  ruled out of scope — the field is written onto the previous record at the
//  next input pass. One turn of lag, invisible to a polling harvester.
// v0.1.1 — the REPLAY STAMP (RewindKit's companion, 8/13/2026): OB is
//  exempt from the Rewind's restores (telemetry about erased turns is
//  data, not ghosts) — so records written for a turn BELOW the ring's
//  high-water mark stamp `replay: true`. Same-turn retries are not
//  replays. The harvester sorts; nothing is discarded or overstated.
// v0.1.0 — the RECORD (proposal: Documentation/Design Proposals/The
//  Observatory (Telemetry + Replay Lab) - Design Proposal.md; veto sheet
//  resolved 8/12/2026): one flat record per adjudicated turn, ring-buffered
//  in state (cap 400 — veto ruling 3; oldest drop, drops counted). This is
//  the sealed sandbox's half of the Observatory: the external harvester
//  reads the ring from OUTSIDE via the API (the gameState probe, P2); the
//  module never exports and never phones home — it can't (no network in
//  the sandbox, verified 8/12).
//  Consumes PUBLIC seams only (the extension contract proving itself):
//  GK_lastCheck incl. dialect/raw (GateKit v0.8.3), GK_isCommandTurn,
//  SK_rank (SkillKit v0.2.2), SC_config/SC_report, RX_command. Degrades to
//  nothing without GateKit (rule 7); the rank field is absent without
//  SkillKit. A judged turn that produced NO ruling records r="NONE" — the
//  Optimized Silence taught us that silence is itself a datum.
//  /telemetry (Report-gated) echoes ring status. OB_tag(label) marks
//  records with a lab cell id — the replay bench's hook; "" clears.
//  Retries REPLACE the turn's record and increment its retry counter (one
//  record per actionCount, latest wins — the house retry convention).
//
// WIRING (PRPG):
//   Input tab:   ... -> text = OB_onInput(text);   // LAST: /telemetry + Turn-1 card
//   Context tab: ... -> text = OB_onContext(text); // LAST: fingerprint what the
//                                                  // model actually sees
//   Output tab:  text = GK_onOutput(text);
//                text = OB_onOutput(text);         // IMMEDIATELY after GK: the rank
//                ...rest of the chain...           // recorded is the rank HELD AT
//                                                  // ATTEMPT (SkillKit tallies later)
// Namespace: OB.

const OB_SETTINGS = {
    ENABLED: true,     // the module; LIVE — card edits apply next action
    REPORT: true       // gates /telemetry's echo
};
const OB_RING_CAP = 400;    // records kept (veto ruling 3); oldest drop, counted
const OB_RAW_CAP = 160;     // raw verdict line kept per record
const OB_NARR_CAP = 80;     // narration head kept per record

let OB_CFG_CACHE = null;
function OB_cfg() {
    if (OB_CFG_CACHE) return OB_CFG_CACHE;
    let cfg;
    if (typeof SC_config === "function") {
        try {
            cfg = SC_config("Observer Config", OB_SETTINGS, {
                header: "# Observer Config\n> The Observatory's collector: one record per ruling, kept in state for the external harvester. Edit values after each colon."
            });
        } catch (e) { cfg = Object.assign({}, OB_SETTINGS); }
    } else cfg = Object.assign({}, OB_SETTINGS);
    OB_CFG_CACHE = cfg;
    return cfg;
}

function OB_state() {
    if (!state.vars || typeof state.vars !== "object") state.vars = {};
    if (!state.vars.OB || typeof state.vars.OB !== "object") state.vars.OB = {};
    const OB = state.vars.OB;
    if (!Array.isArray(OB.ring)) OB.ring = [];
    if (typeof OB.dropped !== "number") OB.dropped = 0;
    if (typeof OB.lastTurn !== "number") OB.lastTurn = -1;
    if (!Object.prototype.hasOwnProperty.call(OB, "tag")) OB.tag = null;
    if (!Array.isArray(OB.echo)) OB.echo = [];
    if (typeof OB.ctxTurn !== "number") OB.ctxTurn = -1;
    if (typeof OB.maxTurn !== "number") OB.maxTurn = -1;
    return OB;
}

function OB_turn() {
    return (info && typeof info.actionCount === "number") ? info.actionCount : -1;
}

// Public seam — the replay bench tags records with its cell id ("" clears).
function OB_tag(label) {
    OB_state().tag = String(label || "") || null;
}

// Public seam — the ring as data (tests, in-adventure inspection).
function OB_ring() { return OB_state().ring; }

// TrackerKit's wound lands after our output pass — stamp it onto the record it
// belongs to, next turn. Idempotent; silent when there is nothing to add.
function OB_backfillWound() {
    try {
        if (typeof TK_lastWound !== "function") return;
        const OB = OB_state();
        if (!OB.ring.length) return;
        const rec = OB.ring[OB.ring.length - 1];
        if (!rec || rec.wnd) return;
        const w = TK_lastWound();
        if (!w || w.turn !== rec.t) return;
        rec.wnd = { f: w.frame, t: w.tier, v: !!w.veto };
        if (w.span) rec.wnd.s = String(w.span).slice(0, 48);
    } catch (e) {}
}

function OB_onInput(text) {
    const t = String(text || "");
    try {
        const cfg = OB_cfg();
        if (!cfg.ENABLED) return t;
        OB_state();                                  // ring + card exist from Turn 1 (rule 11)
        OB_backfillWound();                          // the previous turn's wound settles after we recorded it
        if (typeof RX_command === "function") {
            const cmd = RX_command(t, ["telemetry"]);
            if (cmd) {
                if (typeof GK_markCommandTurn === "function") { try { GK_markCommandTurn(); } catch (e) {} }
                const OB = OB_state();
                if (cfg.REPORT) {
                    const n = OB.ring.length;
                    const span = n ? ("turns " + OB.ring[0].t + "-" + OB.ring[n - 1].t) : "empty";
                    OB.echo.push("Telemetry: " + n + " records (" + span + "), " + OB.dropped + " dropped" + (OB.tag ? ", tag " + OB.tag : ""));
                } else {
                    OB.echo.push("/telemetry is Report-gated — set Report: true on the Observer Config");
                }
                return " ";
            }
        }
    } catch (e) {}
    return t;
}

// Context pass: fingerprint the script-visible context this turn (djb2) —
// records become joinable to the exact context variant that produced them
// (the replay lab's cells differ ONLY here; LewdLeah-research field matrix:
// "context hash: yes, implement"). Wired LAST so it hashes what GK delivered.
function OB_onContext(text) {
    const t = String(text || "");
    try {
        const cfg = OB_cfg();
        if (!cfg.ENABLED) return t;
        let h = 5381;
        for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
        const OB = OB_state();
        OB.ctxTurn = OB_turn();
        OB.ctxHash = (h >>> 0).toString(36);
        OB.ctxLen = t.length;
    } catch (e) {}
    return t;
}

function OB_onOutput(text) {
    let out = String(text || "");
    try {
        const cfg = OB_cfg();
        if (!cfg.ENABLED) return OB_flush(out);
        if (typeof GK_lastCheck !== "function") return OB_flush(out);   // no arbiter, no record (rule 7)
        const OB = OB_state();
        const turn = OB_turn();
        if (turn === -1) return OB_flush(out);
        if (turn > OB.maxTurn) OB.maxTurn = turn;   // high-water mark: EVERY turn counts, recorded or not (v0.1.1)

        const last = (typeof history !== "undefined" && history && history[history.length - 1]) || null;
        const playerTurn = !!last && ["do", "say", "story"].indexOf(last.type) !== -1;
        const command = (typeof GK_isCommandTurn === "function") ? !!GK_isCommandTurn() : false;
        if (!playerTurn || command) return OB_flush(out);   // only adjudicated turns become records

        let c = null;
        try { const cc = GK_lastCheck(); if (cc && cc.turn === turn) c = cc; } catch (e) {}
        const rec = {
            t: turn,
            at: last.type,
            luck: c ? c.luck : null,
            sk: c ? c.skill : null,
            d: c ? c.difficulty : null,
            r: c ? c.result : "NONE",               // judged turn, no ruling — itself a datum
            res: c ? c.resource : null,
            rd: c ? c.resourceDelta : 0,
            dia: c ? (c.dialect || null) : null,
            raw: (c && c.raw) ? String(c.raw).slice(0, OB_RAW_CAP) : null,
            nh: out.trim().slice(0, OB_NARR_CAP),
            ch: (OB.ctxTurn === turn) ? OB.ctxHash : null,   // context fingerprint (joinable to lab cells)
            cl: (OB.ctxTurn === turn) ? OB.ctxLen : 0,
            retry: 0
        };
        if (typeof SK_rank === "function" && rec.sk) { try { rec.rank = SK_rank(rec.sk); } catch (e) {} }
        if (OB.tag) rec.cell = OB.tag;
        if (OB.maxTurn > turn) rec.replay = true;   // the story rewound past this turn once (v0.1.1)
        try { if (typeof Date !== "undefined" && Date.now) rec.ms = Date.now(); } catch (e) {}   // probe P5 rides feature-detection

        // Retry replaces; a REPLAY (post-erase, same count, different action)
        // pushes alongside the dead record — nothing discarded (v0.1.1).
        // Same turn + same replay-ness = a true retry of that record.
        const prev = OB.ring.length ? OB.ring[OB.ring.length - 1] : null;
        if (prev && prev.t === turn && (prev.replay === true) === (rec.replay === true)) {
            rec.retry = (prev.retry || 0) + 1;      // retry: latest wins, counted
            OB.ring[OB.ring.length - 1] = rec;
        } else {
            OB.ring.push(rec);
        }
        OB.lastTurn = turn;
        while (OB.ring.length > OB_RING_CAP) { OB.ring.shift(); OB.dropped++; }
    } catch (e) {}
    return OB_flush(out);
}

function OB_flush(out) {
    try {
        const OB = OB_state();
        if (OB.echo.length) {
            out = OB.echo.map(l => "{" + String(l).replace(/\.\s*$/, "") + "}").join("\n") + (String(out).trim() ? "\n\n" + out : "");
            OB.echo = [];
        }
    } catch (e) {}
    return out;
}

// Load canary
try { if (typeof log === "function") log("[ObserverKit] library loaded (v0.1.1)"); } catch (e) {}
