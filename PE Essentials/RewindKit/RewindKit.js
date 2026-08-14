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
