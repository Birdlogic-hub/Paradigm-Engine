const H = require("./harness");
H.fresh();
eval(H.load("CardLib", "GateKit"));

// Injection + capture happy path
H.turn(1, "do");
GK_onInput(H.doFrame("You climb"));
let ctx = GK_onContext(H.ctx());
H.assert(ctx.endsWith("</SYSTEM>") && /luck=\d+/.test(ctx), "arbiter block at context tail with luck");
H.assert(state.memory.frontMemory === undefined, "frontMemory never touched");
H.assert(!!SC_get("Event Log"), "Event Log materializes on first input (rule 11)");
let out = GK_onOutput("skill=climbing; difficulty=minor; check=partial;\nHalfway up.");   // v0.7 skill-first
H.assert(GK_lastCheck().result === "partial" && GK_lastCheck().skill === "climbing", "verdict captured");
H.assert(GK_lastCheck().dialect === "skillFirst" && /^skill=climbing/i.test(GK_lastCheck().raw),
    "parse metadata rides the check: dialect + raw verdict line (v0.8.3, the Observatory's seam)");
H.assert(!/difficulty=/.test(out), "verdict stripped from prose");

// Semantic + command-turn guards
H.turn(2, "continue");
H.assert(GK_onContext(H.ctx()) === H.ctx(), "continue turn: no injection");
H.turn(3, "do");
GK_onInput(" ");
GK_markCommandTurn();
H.assert(GK_onContext(H.ctx()) === H.ctx(), "GK_markCommandTurn seam: bookkeeping turn skipped");

// Dialect tolerance + coercion + near-miss
H.turn(4, "do");
GK_onInput(H.doFrame("You leap to the moon"));
GK_onOutput("difficulty: impossible; check: success; skill: leaping\nYou soar.");
H.assert(GK_lastCheck().result === "fail", "impossible=>fail coercion (colon dialect)");
H.turn(5, "do");
GK_onInput(H.doFrame("You sneak"));
global.logLines.length = 0;
out = GK_onOutput("Difficulty - Major | Check - Partial\nYou creep.");
H.assert(!/Difficulty - Major/.test(out) && logLines.some(l => /UNPARSED/.test(l)), "near-miss: stripped + logged");

// Config card live switches
H.turn(6, "do");
H.resetCaches();
GK_onInput(H.doFrame("You wave"));
const card = SC_get("GateKit Config");
H.assert(card && /Enabled: true/.test(card.entry) && /Report: true/.test(card.entry), "config card with live switches");
card.entry = card.entry.replace("Enabled: true", "Enabled: false");
H.resetCaches();
H.assert(GK_onContext(H.ctx()) === H.ctx(), "Enabled: false — live off-switch");
card.entry = card.entry.replace("Enabled: false", "Enabled: true");
H.resetCaches();

// Event Log reporting
H.turn(7, "do");
GK_onInput(H.doFrame("You pick the lock"));
GK_onOutput("difficulty=major; check=success; skill=lockpicking;\nClick.");   // v0.4-v0.6 dialect still parsed
H.assert(/T7 \[GateKit\] ruling: major difficulty → success \(lockpicking\)/.test(SC_get("Event Log").entry), "ruling posted to Event Log");

// State migration sweeps
state.vars.GK = { on: true, echo: "stale", luck: 44, luckTurn: 5, lastCheck: null, log: [] };
const GK = GK_state();
H.assert(!("on" in GK) && !("echo" in GK) && GK.luck === 44, "migration sweeps dead fields, keeps live");

// --- v0.7.2: the Die — fixed d20, stated by name, bounds honored ------------------
H.turn(90, "do"); H.resetCaches();
GK_onInput(H.doFrame("You test the dice"));
let d20ctx = GK_onContext(H.ctx());
H.assert(/luck=\d+ \(a d20 roll\)/.test(d20ctx), "block names the d20 outright");
H.assert(/dungeon master reads a d20/.test(d20ctx), "DM framing line present");
for (let t = 91; t < 111; t++) {
    H.turn(t, "do"); H.resetCaches();
    GK_onInput(H.doFrame("You roll again"));
    const L = state.vars.GK.luck;
    H.assert(L >= 1 && L <= 20, "roll within die bounds (turn " + t + ": " + L + ")");
}
GK_setLuck(999);
H.assert(state.vars.GK.luck === 20, "GK_setLuck clamps fortune-benders to the die");

// --- v0.8.0: the Cost — optional bidirectional resource field ----------------------
H.turn(120, "do"); H.resetCaches();
GK_onInput(H.doFrame("You sprint up the scree"));
GK_onContext(H.ctx());
GK_onOutput("skill=climbing; difficulty=major; check=success; resource=stamina -6;\nYou crest the ridge, lungs burning.");
H.assert(GK_lastCheck().resource === "stamina" && GK_lastCheck().resourceDelta === -6, "spend parses (name -n)");
H.turn(121, "do"); H.resetCaches();
GK_onInput(H.doFrame("You drink the elixir"));
GK_onContext(H.ctx());
GK_onOutput("skill=none; difficulty=trivial; check=success; resource=health +10;\nWarmth floods you.");
H.assert(GK_lastCheck().resource === "health" && GK_lastCheck().resourceDelta === 10, "restore parses (name +n)");
H.turn(122, "do"); H.resetCaches();
GK_onInput(H.doFrame("You look around"));
GK_onContext(H.ctx());
GK_onOutput("skill=none; difficulty=trivial; check=success; resource=none;\nAll quiet.");
H.assert(GK_lastCheck().resource === null && GK_lastCheck().resourceDelta === 0, "resource=none is null");
H.turn(123, "do"); H.resetCaches();
GK_onInput(H.doFrame("You pick the lock"));
GK_onContext(H.ctx());
GK_onOutput("skill=lockpicking; difficulty=minor; check=success;\nClick.");
H.assert(GK_lastCheck().resource === null, "absent field is null (backward compatible)");
H.assert(GK_lastCheck().skill === "lockpicking", "old-shape verdicts still fully parse");

// --- v0.8.1: the bare dialect — the live leak, verbatim (rule 9) -------------------
H.turn(130, "do"); H.resetCaches();
GK_onInput(H.doFrame("You take the tonic, stowing it away."));
GK_onContext(H.ctx());
let bareOut = GK_onOutput("Survival; trivial; success; resource=none;\nMara nods with approval as you pocket the healing tonic.");
H.assert(GK_lastCheck().skill === "survival" && GK_lastCheck().difficulty === "trivial" && GK_lastCheck().result === "success", "bare dialect parses (labels shed, order kept)");
H.assert(GK_lastCheck().resource === null, "bare resource=none is null");
H.assert(bareOut.indexOf("trivial") === -1 && /^Mara nods/.test(bareOut), "bare verdict line stripped from the story");
H.turn(131, "do"); H.resetCaches();
GK_onInput(H.doFrame("You haul yourself up the shaft"));
GK_onContext(H.ctx());
GK_onOutput("Climbing; major; success; resource=stamina -8;\nYou reach the maintenance shaft.");
H.assert(GK_lastCheck().resource === "stamina" && GK_lastCheck().resourceDelta === -8, "bare dialect carries the resource field");
H.assert(GK_lastCheck().dialect === "bare", "the bare dialect NAMES itself (v0.8.3 — it reported skillFirst since v0.8.1)");

// --- v0.9.0: code resolution (owner rulings 9/25) ------------------------------------
const near = (a, b) => Math.abs(a - b) < 1e-9;
H.assert(near(GK_chance(3, 3), 0.7) && near(GK_chance(2, 3), 0.35) && near(GK_chance(1, 3), 0.175) && near(GK_chance(0, 3), 0.0875)
    && near(GK_chance(4, 3), 0.85) && near(GK_chance(5, 3), 0.925) && near(GK_chance(6, 3), 0.9625),
    "the curve: 70% at an equal rank, halving per rank (35/17.5/8.75 below, 85/92.5/96.25 above)");
H.assert(/Resolution: model/.test(SC_get("GateKit Config").entry), "config card carries Resolution, model by default");

// Model mode never reads the rank ladder: a code-dialect line is a near-miss.
H.turn(140, "do"); H.resetCaches();
GK_onInput(H.doFrame("You climb"));
global.logLines.length = 0;
out = GK_onOutput("skill=climbing; difficulty=novice; check=fail;\nYou slip.");
H.assert(GK_lastCheck().turn !== 140 && /^You slip\./.test(out) && logLines.some(l => /UNPARSED/.test(l)),
    "model mode: a rank-ladder verdict is stripped and logged, never parsed");

SC_get("GateKit Config").entry = SC_get("GateKit Config").entry.replace("Resolution: model", "Resolution: code");
function codeTurn(n, action, roll) {
    H.turn(n, "do", H.doFrame(action)); H.resetCaches();
    GK_onInput(H.doFrame(action));
    state.vars.GK.roll = roll;              // pin the draw (the table is a pure function of it)
    return GK_onContext(H.ctx());
}
let cctx = codeTurn(150, "You climb", 50);
H.assert(cctx.endsWith("</SYSTEM>") && !/luck=/.test(cctx) && !/d20/.test(cctx), "code block: no luck line, no d20");
H.assert(/untrained < novice < apprentice < intermediate < advanced < expert < master < legendary/.test(cctx),
    "without SkillKit the scale is the bare ladder");
H.assert(/- any other skill: untrained\nOtherwise it FAILS\./.test(cctx), "roll 50: untrained clears (70%), novice doesn't (35%)");
H.assert(/- any other skill: novice\n/.test(codeTurn(151, "You climb", 20)), "roll 20: novice clears (35%), apprentice doesn't (17.5%)");
H.assert(/- any other skill: fails unless trivial\n/.test(codeTurn(152, "You climb", 95)), "roll 95: nothing clears");
const r152 = state.vars.GK.roll;
GK_onInput(H.doFrame("You climb"));
H.assert(state.vars.GK.roll === r152, "a retry of the same action reuses the draw");
GK_setArbiterNote("TK", "gauges: health fine");
H.assert(/Otherwise it FAILS\.\ngauges: health fine\n/.test(codeTurn(153, "You climb", 50)), "notes ride directly after the table");
GK_setArbiterNote("TK", "");

// Compliant ruling: roll 50, untrained (70%) -> success.
codeTurn(160, "You climb the fence", 50);
out = GK_onOutput("skill=climbing; difficulty=untrained; check=success; resource=none;\nYou swing over.");
let cc = GK_lastCheck();
H.assert(cc.resolution === "code" && cc.difficultyRank === "untrained" && cc.difficultyIndex === 0 && cc.skillRank === 0
    && near(cc.chance, 0.7) && cc.roll === 50 && cc.expected === "success" && cc.compliant === true,
    "code ruling carries rank, chance, roll, expected and compliance");
H.assert(cc.difficulty === "minor" && cc.luck === null, "consumers keep the old vocabulary (at/below held rank = minor); no luck in code mode");
H.assert(/^You swing over\./.test(out), "verdict stripped from prose");
H.assert(/ruling: untrained difficulty → success \(climbing, untrained\) · 70% · rolled 50$/m.test(SC_get("Event Log").entry),
    "Event Log shows the odds and the roll");

// Non-compliant ruling: roll 20 at novice (35%) should succeed; the arbiter wrote fail.
codeTurn(161, "You climb the wall", 20);
GK_onOutput("skill=climbing; difficulty=novice; check=fail;\nYou slip.");
cc = GK_lastCheck();
H.assert(cc.result === "fail" && cc.expected === "success" && cc.compliant === false && cc.difficulty === "major",
    "the written check stands (the prose shows it); compliance is measured, not enforced");
H.assert(/· 35% · rolled 20 · the table said success$/m.test(SC_get("Event Log").entry), "the mismatch is reported");

// Dialects: bare, digit difficulty, trivial, impossible.
codeTurn(162, "You haul yourself up", 10);
GK_onOutput("Climbing; apprentice; success; resource=stamina -4;\nYou make it.");
cc = GK_lastCheck();
H.assert(cc.dialect === "bare" && cc.difficultyRank === "apprentice" && cc.compliant === true && cc.resourceDelta === -4,
    "bare dialect on the ladder (10 < 17.5: success) keeps its resource field");
codeTurn(163, "You climb", 5);
GK_onOutput("skill=climbing; difficulty=3 (3); check=success;\nUp.");
H.assert(GK_lastCheck().difficultyRank === "intermediate" && GK_lastCheck().compliant === true, "digit difficulty, echoed (n) tolerated");
codeTurn(164, "You wave", 99);
GK_onOutput("skill=none; difficulty=trivial; check=success;\nYou wave.");
H.assert(GK_lastCheck().expected === "success" && GK_lastCheck().compliant === true && GK_lastCheck().chance === null,
    "trivial always succeeds, whatever the roll");
codeTurn(165, "You fly", 1);
GK_onOutput("skill=flight; difficulty=impossible; check=success;\nYou soar.");
H.assert(GK_lastCheck().result === "fail" && GK_lastCheck().compliant === true, "impossible still coerces to fail");
SC_get("GateKit Config").entry = SC_get("GateKit Config").entry.replace("Resolution: code", "Resolution: model");

H.summary("GateKit");
