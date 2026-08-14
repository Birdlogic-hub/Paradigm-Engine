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
