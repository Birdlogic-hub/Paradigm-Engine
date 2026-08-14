// RewindKit harness suite — the Rewind, built to the resolved proposal
// (8/13/2026, all leans). The regression fixture IS the owner's 8/13 log:
// collect → undo → erase → replay.
const H = require("./harness");
H.fresh();
eval(H.load("RegexLib", "CardLib", "GateKit", "InventoryKit", "SkillKit", "RewindKit", "ObserverKit"));

// One full turn through the wired chain, RW FIRST everywhere (the tabs' law).
function turn(n, input, modelOut) {
    H.turn(n, "do"); H.resetCaches();
    let t = RW_onInput(input);
    t = INV_onInput(t); t = GK_onInput(t); t = OB_onInput(t);
    let c = RW_onContext(H.ctx()); c = GK_onContext(c); OB_onContext(c);
    let out = RW_onOutput(modelOut);
    out = GK_onOutput(out); out = OB_onOutput(out); out = INV_onOutput(out); out = SK_onOutput(out);
    return out;
}

// --- Setup: the 8/13 evening, reconstructed --------------------------------------------
turn(2, H.doFrame("You survey the guardroom"), "skill=perception; difficulty=minor; check=success;\nStone and rain.");
H.assert(state.vars.SK.skills.perception.uses === 2, "setup: perception tallied at T2");
turn(4, H.doFrame("You listen at the gate"), "skill=perception; difficulty=trivial; check=success;\nScrape... clang.");
turn(6, H.doFrame("/take coil of rope"), "difficulty=trivial; check=success;\nGathered.");
turn(8, H.doFrame("/collect 12 silver coins"), "difficulty=trivial; check=success;\nJingle.");
H.assert(INV_walletGet("silver coins") === 12, "setup: coins collected at T8");
turn(10, H.doFrame("/undo"), "meta");
H.assert(INV_walletGet("silver coins") === 0, "setup: /undo reversed the wallet at T10");
H.assert(state.vars.RW.snaps.length === 5, "snapshots accrued to depth (5)");

// --- THE ERASE: back to turn 8, replayed (the stale-stamp collision fixture) -----------
const ringLenBefore = OB_ring().length;
turn(8, H.doFrame("You reach for the silver coins"), "skill=perception; difficulty=minor; check=success;\nCool metal against your palm.");
H.assert(/\[Rewind\]/.test(SC_get("Event Log").entry) && /story erased back to turn 8/.test(SC_get("Event Log").entry),
    "the restore is reported to the Event Log");
H.assert(GK_lastCheck().turn === 8 && GK_lastCheck().skill === "perception",
    "the replayed T8 carries the FRESH ruling — the dead turn 8's verdict is gone (the collision, dead)");
H.assert(state.vars.SK.skills.perception.uses === 4,
    "SkillKit tallies the replayed ruling — restored tallyTurn no longer suppresses it");
H.assert(INV_walletGet("silver coins") === 0 && INV_count("coil of rope") === 1,
    "the ledger is the pre-T8 present: dead collect AND dead undo both never happened; T6's rope survives");
H.assert(state.vars.RW.snaps.filter(s => s.k > 8).length === 0, "dead-future snapshots discarded");

// --- OB is exempt: telemetry survives, replays are stamped ------------------------------
H.assert(OB_ring().length === ringLenBefore + 1, "the Observer ring SURVIVED the restore (exempt namespace)");
const last = OB_ring()[OB_ring().length - 1];
H.assert(last.t === 8 && last.replay === true && last.r === "success",
    "the replayed turn's record is stamped replay: true (v0.1.1)");
H.assert(OB_ring().filter(r => r.t === 8).length === 2,
    "the dead turn 8's record COEXISTS with its replay — nothing discarded (data, not ghosts)");

// --- Retry is not an erase --------------------------------------------------------------
const snapsBefore = JSON.stringify(state.vars.RW.snaps.map(s => s.k));
let o = RW_onOutput("skill=perception; difficulty=minor; check=partial;\nAlmost.");
o = GK_onOutput(o); OB_onOutput(o);
H.assert(JSON.stringify(state.vars.RW.snaps.map(s => s.k)) === snapsBefore && !/beyond snapshot depth/.test(SC_get("Event Log").entry),
    "same-count retry: no restore, no new snapshot, no complaint");

// --- Beyond depth: loud, honest, re-baselined -------------------------------------------
for (let n = 20; n <= 32; n += 2) turn(n, H.doFrame("You walk on"), "skill=none; difficulty=trivial; check=success;\nOnward.");
H.assert(state.vars.RW.snaps.length === 5 && state.vars.RW.snaps[0].k > 8, "depth eviction: only the recent 5 kept");
turn(4, H.doFrame("You think back"), "skill=none; difficulty=trivial; check=success;\nLong ago.");
H.assert(/beyond snapshot depth/.test(SC_get("Event Log").entry), "erase beyond the ring reports the ghosts loudly");
H.assert(state.vars.RW.snaps.some(s => s.k === 4) && state.vars.RW.lastSeen === 4,
    "beyond-depth re-baselines: a fresh snapshot anchors the new present");

// --- Rule 7: disabled = inert ------------------------------------------------------------
const cfgCard = SC_get("Rewind Config");
cfgCard.entry = cfgCard.entry.replace("Enabled: true", "Enabled: false");
H.turn(40, "do"); H.resetCaches();
const nSnaps = state.vars.RW.snaps.length;
RW_onInput(H.doFrame("x"));
H.assert(state.vars.RW.snaps.length === nSnaps, "Enabled: false — no snapshots, no restores, no cost");
cfgCard.entry = cfgCard.entry.replace("Enabled: false", "Enabled: true");

H.summary("RewindKit");
