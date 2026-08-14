// ===== ObserverKit v0.1.1 =====
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

function OB_onInput(text) {
    const t = String(text || "");
    try {
        const cfg = OB_cfg();
        if (!cfg.ENABLED) return t;
        OB_state();                                  // ring + card exist from Turn 1 (rule 11)
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
