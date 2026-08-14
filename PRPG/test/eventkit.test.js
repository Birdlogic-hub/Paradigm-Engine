// EventKit harness suite — the Intrusion, built to the resolved proposal (7/21/2026).
const H = require("../../PE Essentials/test/harness");
H.fresh();
eval(H.load("RegexLib", "CardLib", "GateKit", "TrackerKit", "EventKit"));

// Deterministic dice: queue values for Math.random, fall back to 0.5.
const realRandom = Math.random;
let randQ = [];
Math.random = function () { return randQ.length ? randQ.shift() : 0.5; };
function logCount(rx) {
    const card = SC_get("Event Log");
    if (!card) return 0;
    const m = String(card.entry).match(rx);
    return m ? m.length : 0;
}
function story(n, action) {
    H.turn(n, "do"); H.resetCaches();
    let t = GK_onInput(H.doFrame(action || "You press on"));
    EV_onInput(t);
    return EV_onContext(H.ctx());   // v0.1.1: the roll lives at context
}

// --- Rule 11: card materializes turn 1, knob-only -----------------------------------
story(1);
const cfgCard = SC_get("Events Config");
H.assert(!!cfgCard && /Chance: 10/.test(cfgCard.entry) && /Cooldown: 5/.test(cfgCard.entry)
    && /Report: true/.test(cfgCard.entry), "Events Config ships turn 1 with FD's EventRate default");
H.assert(/Weights: encounter=2, environment=2, discovery=1, hazard=1, omen=1/.test(cfgCard.entry),
    "category weights ride the card as one knob line");

// --- Cadence: chance gates the roll --------------------------------------------------
H.assert(state.vars.EV.pending === null, "default 10% + rand 0.5: no fire (50 > 10)");
cfgCard.entry = cfgCard.entry.replace("Chance: 10", "Chance: 0");
story(2);
H.assert(state.vars.EV.pending === null, "Chance: 0 never fires");
cfgCard.entry = cfgCard.entry.replace("Chance: 0", "Chance: 100");
story(3);
H.assert(!!state.vars.EV.pending && state.vars.EV.pending.turn === 3, "Chance: 100 fires on a story turn");
H.assert(!/[\[\]|]/.test(state.vars.EV.pending.text), "spinner fully expanded — no brackets or pipes survive");

// --- Delivery: the block, BEFORE the arbiter block -----------------------------------
let ctx = EV_onContext(H.ctx());
H.assert(/<SYSTEM>\nEVENT — this turn the world acts: /.test(ctx), "event block renders on the event turn");
ctx = GK_onContext(ctx);
H.assert(ctx.indexOf("EVENT — this turn the world acts") < ctx.indexOf("luck="),
    "the event block sits BEFORE the arbiter block — the verdict schema keeps the last word");
H.assert(/The player's action still resolves and is judged as usual\./.test(ctx), "directive tells the model the Check still rules");

// --- Retry: never re-roll, never re-settle -------------------------------------------
const heldId = state.vars.EV.pending.id;
randQ = [0.99, 0.99];
EV_onContext(H.ctx());
H.assert(state.vars.EV.pending.id === heldId, "retry replays the same pending event — no re-roll");
EV_onOutput("The story continues.");
const fireRx = new RegExp("event: " + heldId, "g");
H.assert(logCount(fireRx) === 1, "fire line posted to the Event Log");
H.assert(state.vars.EV.recent.indexOf(heldId) !== -1, "fired id enters the no-repeat window");
H.assert(state.vars.EV.cooldown === 5, "cooldown armed at settle");
EV_onOutput("The story continues.");
H.assert(logCount(fireRx) === 1 && state.vars.EV.recent.length === 1, "retry re-renders but never re-settles");

// --- Cooldown: weather, not a metronome ----------------------------------------------
for (let n = 4; n <= 8; n++) {
    story(n);
    H.assert(state.vars.EV.pending.turn !== n, "cooldown suppresses the roll (turn " + n + ", " + state.vars.EV.cooldown + " left)");
}
story(9);
H.assert(state.vars.EV.pending.turn === 9, "cooldown spent: turn 9 rolls again at Chance 100");
EV_onOutput("On it goes.");

// --- Bookkeeping and non-story turns never roll --------------------------------------
state.vars.EV.cooldown = 0;
H.turn(10, "do"); H.resetCaches();
let stub = GK_onInput(H.doFrame("/track"));
stub = TK_onInput(stub);
EV_onInput(stub);
EV_onContext(H.ctx());
H.assert(state.vars.EV.pending.turn !== 10, "bookkeeping turn (verb stamped via GK seam): no roll");
H.turn(11, "continue"); H.resetCaches();
EV_onContext(H.ctx());
H.assert(state.vars.EV.pending.turn !== 11, "continue turns are not story turns: no roll");

// --- Selection: weights steer, no-repeat excludes, exhaustion falls through ----------
cfgCard.entry = cfgCard.entry.replace(/Weights: .*/, "Weights: encounter=0, environment=0, discovery=0, hazard=1, omen=0");
state.vars.EV.recent = [];
const seen = [];
for (let n = 12; n <= 15; n++) {
    H.resetCaches(); H.turn(n, "do");
    EV_onContext(H.ctx());
    H.assert(state.vars.EV.pending.turn === n && state.vars.EV.pending.cat === "hazard",
        "weights steer the pick to hazard (turn " + n + ")");
    seen.push(state.vars.EV.pending.id);
    EV_onOutput("Onward."); state.vars.EV.cooldown = 0;
}
H.assert(new Set(seen).size === 4, "no-repeat window: four fires, four distinct hazard entries");
H.turn(16, "do"); H.resetCaches();
EV_onContext(H.ctx());
H.assert(state.vars.EV.pending.turn !== 16, "hazard exhausted + all else zero-weighted: nothing fires (rule 7)");
cfgCard.entry = cfgCard.entry.replace("encounter=0", "encounter=1");
H.turn(17, "do"); H.resetCaches();
EV_onContext(H.ctx());
H.assert(state.vars.EV.pending.turn === 17 && state.vars.EV.pending.cat === "encounter",
    "exhausted category falls through to the next weighted one");
EV_onOutput("Onward."); state.vars.EV.cooldown = 0;

// --- Thematic layer: EV_addPool + fx through TK_apply --------------------------------
H.assert(EV_addPool("faction", [
    { id: "forced-march", w: 5, text: "the [column|caravan] pushes on through the night", fx: [["stamina", -40], ["karma", -1]] }
]), "EV_addPool registers a scripter category");
cfgCard.entry = cfgCard.entry.replace(/Weights: .*/, "Weights: encounter=0, environment=0, discovery=0, hazard=0, omen=0");
H.turn(18, "do"); H.resetCaches();
TK_onInput(H.doFrame("You march"));   // materialize Trackers (stamina 100)
EV_onContext(H.ctx());
H.assert(state.vars.EV.pending.cat === "faction" && state.vars.EV.pending.id === "forced-march",
    "unlisted scripter category weighs 1 by default and can win the pick");
EV_onOutput("The night is long.");
H.assert(state.vars.TK.trackers.stamina.val === 60, "thematic fx lands whole through TK_apply (-40, uncapped)");
H.assert(/Stamina 100→60 \(event: forced-march\)/.test(SC_get("Event Log").entry), "fx evidence names the event");
H.assert(/apply skipped: no tracker "karma"/.test(SC_get("Event Log").entry), "unknown fx tracker reported, never thrown");
EV_onOutput("The night is long.");
H.assert(state.vars.TK.trackers.stamina.val === 60, "retry never re-applies fx");

// --- /event: the Report-gated debug verb ---------------------------------------------
state.vars.EV.cooldown = 99; state.vars.EV.recent = [];
cfgCard.entry = cfgCard.entry.replace("Chance: 100", "Chance: 0");
H.turn(19, "do"); H.resetCaches();
stub = EV_onInput(H.doFrame("/event omen"));
H.assert(stub === "You take stock of your surroundings.", "/event swallows to a narratable stub");
H.assert(state.vars.EV.pending.turn === 19 && state.vars.EV.pending.cat === "omen",
    "/event forces a fire past Chance: 0 and a 99-turn cooldown, category honored");
H.assert(state.vars.GK.commandTurn === 19, "/event marks bookkeeping (the Check yields)");
EV_onOutput("The world stirs.");

// Fire line is UNCONDITIONAL; the verb is not.
cfgCard.entry = cfgCard.entry.replace("Report: true", "Report: false").replace("Chance: 0", "Chance: 100");
H.turn(20, "do"); H.resetCaches();
state.vars.EV.cooldown = 0;
stub = EV_onInput(H.doFrame("/event"));
H.assert(state.vars.EV.pending.turn !== 20 && stub === "You pause a moment.",
    "Report: false unbinds the debug verb");
H.turn(21, "do"); H.resetCaches();
EV_onContext(H.ctx());
console.log("DEBUG pending@21:", JSON.stringify(state.vars.EV.pending), "cooldown:", state.vars.EV.cooldown, "recent:", JSON.stringify(state.vars.EV.recent));
console.log("DEBUG log tail:", JSON.stringify(String(SC_get("Event Log").entry).split("\n").slice(-4)));
EV_onOutput("The road bends.");
H.assert(/^T21 \[EventKit\] event: /m.test(SC_get("Event Log").entry),
    "the fire line posts even under Report: false — the player's record is not optional (Event Log caps at 10 — presence, not count)");

// --- Rule 7: passthrough always ------------------------------------------------------
H.turn(22, "do"); H.resetCaches();
H.assert(EV_onOutput("Plain story text.") === "Plain story text.", "EV_onOutput is a passthrough");
H.assert(EV_onContext("Some context.") === "Some context.", "no pending event, no block");
cfgCard.entry = cfgCard.entry.replace("Enabled: true", "Enabled: false");
H.turn(23, "do"); H.resetCaches();
H.assert(EV_onInput(H.doFrame("You press on")) === H.doFrame("You press on")
    && EV_onContext("Some context.") === "Some context." && state.vars.EV.pending.turn !== 23,
    "Enabled: false: all passes inert");

// --- the silent sixty-five (v0.1.1 regression) ---------------------------------------
// Live shape: during the INPUT phase, history's tail is the AI's previous
// output — the current action lands in history only by CONTEXT time.
cfgCard.entry = cfgCard.entry.replace("Enabled: false", "Enabled: true").replace(/Weights: .*/, "Weights: encounter=2, environment=2, discovery=1, hazard=1, omen=1");
state.vars.EV.recent = []; state.vars.EV.cooldown = 0;
H.turn(24, "continue"); H.resetCaches();
global.info.actionCount = 25;                 // input phase of turn 25: history still ends in a continue
EV_onInput(H.doFrame("You press on"));
H.assert(state.vars.EV.pending === null || state.vars.EV.pending.turn !== 25, "input phase never rolls (history is one turn behind)");
H.turn(25, "do"); H.resetCaches();            // the action lands in history before context
EV_onContext(H.ctx());
H.assert(!!state.vars.EV.pending && state.vars.EV.pending.turn === 25,
    "the roll lives at context, where history is settled — the silent sixty-five never recurs");

Math.random = realRandom;
H.summary("EventKit");
