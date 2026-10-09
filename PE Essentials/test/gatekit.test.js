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

// --- v0.10.1: the headless dialect — the live leaks, verbatim (rule 9) --------------
H.turn(132, "do"); H.resetCaches();
GK_onInput(H.doFrame("You follow the path carefully."));
GK_onContext(H.ctx());
let headOut = GK_onOutput("none; difficulty=minor; check=success; resource=none\nThe clicking grows more distinct as you follow the path.");
let hc = GK_lastCheck();
H.assert(hc.turn === 132 && hc.dialect === "headless" && hc.skill === null && hc.difficulty === "minor" && hc.result === "success" && hc.resource === null,
    "headless dialect parses (skill label shed, the rest kept); 'none' is no skill");
H.assert(/^The clicking/.test(headOut) && headOut.indexOf("difficulty") === -1, "headless verdict stripped from the story");
H.turn(133, "do"); H.resetCaches();
GK_onInput(H.doFrame("You focus on the sound."));
GK_onContext(H.ctx());
GK_onOutput("None; difficulty=minor; check=success; resource=stamina -4\nThe clicking grows louder.");
hc = GK_lastCheck();
H.assert(hc.turn === 133 && hc.dialect === "headless" && hc.resource === "stamina" && hc.resourceDelta === -4, "headless carries the resource field");
H.turn(134, "do"); H.resetCaches();
GK_onInput(H.doFrame("You climb the ledge."));
GK_onContext(H.ctx());
GK_onOutput("Climbing; difficulty=major; check=fail; resource=none\nYou slip back.");
H.assert(GK_lastCheck().turn === 134 && GK_lastCheck().skill === "climbing" && GK_lastCheck().result === "fail", "headless with a named skill");
H.turn(135, "do"); H.resetCaches();
GK_onInput(H.doFrame("You look around."));
GK_onContext(H.ctx());
let allBare = GK_onOutput("none; minor; success; none" + "\n" + "The chamber is quiet.");
H.assert(GK_lastCheck().turn === 135 && GK_lastCheck().dialect === "bare" && GK_lastCheck().resource === null && /^The chamber/.test(allBare),
    "fully bare, resource label shed too: 'none; minor; success; none' (owner, 10/8)");
H.turn(136, "do"); H.resetCaches();
GK_onInput(H.doFrame("You sprint."));
GK_onContext(H.ctx());
GK_onOutput("Athletics; major; success; stamina -6" + "\n" + "You make the gap.");
H.assert(GK_lastCheck().resource === "stamina" && GK_lastCheck().resourceDelta === -6, "an unlabeled resource still carries its delta");
H.turn(137, "do"); H.resetCaches();
GK_onInput(H.doFrame("You wait."));
GK_onContext(H.ctx());
let keepFirst = GK_onOutput("skill=none; difficulty=trivial; check=success" + "\n" + "Ok.");
H.assert(GK_lastCheck().turn === 137 && GK_lastCheck().resource === null && keepFirst === "Ok.",
    "no trailing ';': the story's first line is never read as an unlabeled resource");
H.turn(138, "do"); H.resetCaches();
GK_onInput(H.doFrame("You wait."));
GK_onContext(H.ctx());
keepFirst = GK_onOutput("Waiting; trivial; success" + "\n" + "Ok.");
H.assert(GK_lastCheck().turn === 138 && keepFirst === "Ok.", "same for the bare dialect");

// --- v0.9.0: code resolution (owner rulings 9/25); v0.10.0: 50% base + luck (10/7) ----
const near = (a, b) => Math.abs(a - b) < 1e-9;
H.assert(near(GK_chance(3, 3), 0.5) && near(GK_chance(2, 3), 0.25) && near(GK_chance(1, 3), 0.125) && near(GK_chance(0, 3), 0.0625)
    && near(GK_chance(4, 3), 0.75) && near(GK_chance(5, 3), 0.875) && near(GK_chance(6, 3), 0.9375),
    "the curve: Volta's half rule, 50% at an equal rank (25/12.5/6.25 below, 75/87.5/93.75 above) — v0.10.0");
H.assert(GK_luckPoints(1) === -18 && GK_luckPoints(9) === -2 && GK_luckPoints(10) === 0 && GK_luckPoints(11) === 0
    && GK_luckPoints(12) === 2 && GK_luckPoints(20) === 18,
    "luck: a symmetric line in 2-point steps, 10-11 neutral (1 = -18 ... 20 = +18)");
H.assert([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].reduce((s, f) => s + GK_luckPoints(f), 0) === 0,
    "luck averages to zero over the d20 — the base holds on average");
H.assert(GK_luckPoints(null) === 0 && GK_luckPoints(undefined) === 0, "no d20 is no luck (a null face must not read as 1)");
H.assert(GK_chance(3, 1, 18) === 1 && GK_chance(0, 3, -18) === 0 && near(GK_chance(3, 3, 12), 0.62),
    "chance = base + luck, clamped to 0..1");
H.assert(/Resolution: model/.test(SC_get("GateKit Config").entry), "config card carries Resolution, model by default");

// Model mode never reads the rank ladder: a code-dialect line is a near-miss.
H.turn(140, "do"); H.resetCaches();
GK_onInput(H.doFrame("You climb"));
global.logLines.length = 0;
out = GK_onOutput("skill=climbing; difficulty=novice; check=fail;\nYou slip.");
H.assert(GK_lastCheck().turn !== 140 && /^You slip\./.test(out) && logLines.some(l => /UNPARSED/.test(l)),
    "model mode: a rank-ladder verdict is stripped and logged, never parsed");
H.assert(/^T140 \[GateKit\] unparsed ruling, stripped: "skill=climbing; difficulty=novice; check=fail;" · luck \d+$/m.test(SC_get("Event Log").entry),
    "a near-miss reaches the Event Log verbatim, not as 'no ruling captured' (v0.10.1)");

H.assert(GK_resolution() === "model", "GK_resolution() reads model by default (v0.9.1)");
SC_get("GateKit Config").entry = SC_get("GateKit Config").entry.replace("Resolution: model", "Resolution: code");
H.resetCaches();
H.assert(GK_resolution() === "code", "GK_resolution() follows the live card");
// Pin both draws: the percentile roll and the d20 (10 = neutral luck unless a test says otherwise).
function codeTurn(n, action, roll, luck) {
    H.turn(n, "do", H.doFrame(action)); H.resetCaches();
    GK_onInput(H.doFrame(action));
    state.vars.GK.roll = roll;
    state.vars.GK.luck = (luck === undefined) ? 10 : luck;
    return GK_onContext(H.ctx());
}
let cctx = codeTurn(150, "You climb", 40);
H.assert(cctx.endsWith("</SYSTEM>") && /^luck=10 \(a d20 roll\) — already counted in the table: let it color the narration, never the result\.$/m.test(cctx),
    "code block: the d20 is in view, marked as already counted (v0.10.0)");
H.assert(/trivial = no one could fail, even without training\. Never rate a task trivial because this player is skilled/.test(cctx),
    "trivial is pinned to anyone, never relative to this player's skill (v0.9.2)");
H.assert(/untrained < novice < apprentice < intermediate < advanced < expert < master < legendary/.test(cctx),
    "without SkillKit the scale is the bare ladder");
H.assert(/- any other skill: untrained\nOtherwise it FAILS\./.test(cctx), "roll 40, neutral luck: untrained clears (50%), novice doesn't (25%)");
H.assert(/- any other skill: novice\n/.test(codeTurn(151, "You climb", 20)), "roll 20: novice clears (25%), apprentice doesn't (12.5%)");
H.assert(/- any other skill: fails unless trivial\n/.test(codeTurn(152, "You climb", 95)), "roll 95: nothing clears");
const r152 = state.vars.GK.roll, l152 = state.vars.GK.luck;
GK_onInput(H.doFrame("You climb"));
H.assert(state.vars.GK.roll === r152 && state.vars.GK.luck === l152, "a retry of the same action reuses both draws");
H.assert(/- any other skill: fails unless trivial\n/.test(codeTurn(153, "You climb", 60, 10))
    && /- any other skill: untrained\n/.test(codeTurn(154, "You climb", 60, 20)),
    "luck moves the table: roll 60 fails at 50%, clears untrained at 68% (+18)");
GK_setArbiterNote("TK", "gauges: health fine");
H.assert(/Otherwise it FAILS\.\ngauges: health fine\n/.test(codeTurn(155, "You climb", 50)), "notes ride directly after the table");
GK_setArbiterNote("TK", "");

// Compliant ruling: roll 40, untrained (50%), neutral luck -> success.
codeTurn(160, "You climb the fence", 40);
out = GK_onOutput("skill=climbing; difficulty=untrained; check=success; resource=none;\nYou swing over.");
let cc = GK_lastCheck();
H.assert(cc.resolution === "code" && cc.difficultyRank === "untrained" && cc.difficultyIndex === 0 && cc.skillRank === 0
    && near(cc.chance, 0.5) && near(cc.baseChance, 0.5) && cc.luckPoints === 0 && cc.luck === 10
    && cc.roll === 40 && cc.expected === "success" && cc.compliant === true,
    "code ruling carries rank, base, luck, chance, roll, expected and compliance");
H.assert(cc.difficulty === "minor", "consumers keep the old vocabulary (at/below held rank = minor)");
H.assert(/^You swing over\./.test(out), "verdict stripped from prose");
H.assert(/ruling: untrained difficulty → success \(climbing, untrained\) · 50% · luck 10 \(\+0\) → 50% · rolled 40$/m.test(SC_get("Event Log").entry),
    "Event Log shows base odds, luck, final odds and the roll");

// Non-compliant ruling: roll 20 at novice (25%) should succeed; the arbiter wrote fail.
codeTurn(161, "You climb the wall", 20);
GK_onOutput("skill=climbing; difficulty=novice; check=fail;\nYou slip.");
cc = GK_lastCheck();
H.assert(cc.result === "fail" && cc.expected === "success" && cc.compliant === false && cc.difficulty === "major",
    "the written check stands (the prose shows it); compliance is measured, not enforced");
H.assert(/· 25% · luck 10 \(\+0\) → 25% · rolled 20 · the table said success$/m.test(SC_get("Event Log").entry), "the mismatch is reported");

// GK_setLuck works in code mode: a fortune-bender sets the face before the table is built.
H.turn(166, "do", H.doFrame("You leap the chasm")); H.resetCaches();
GK_onInput(H.doFrame("You leap the chasm"));
state.vars.GK.roll = 60;
GK_setLuck(20);                                        // the blessing
const blessed = GK_onContext(H.ctx());
GK_onOutput("skill=jumping; difficulty=untrained; check=success;\nYou land it.");
cc = GK_lastCheck();
H.assert(/^luck=20 /m.test(blessed) && cc.luck === 20 && cc.luckPoints === 18 && near(cc.chance, 0.68) && cc.expected === "success",
    "GK_setLuck bends a code-mode outcome: roll 60 succeeds at 50% + 18 (v0.10.0)");
H.assert(/· 50% · luck 20 \(\+18\) → 68% · rolled 60$/m.test(SC_get("Event Log").entry), "the blessing shows in the Event Log");

// Dialects: bare, digit difficulty, trivial, impossible.
codeTurn(162, "You haul yourself up", 10);
GK_onOutput("Climbing; apprentice; success; resource=stamina -4;\nYou make it.");
cc = GK_lastCheck();
H.assert(cc.dialect === "bare" && cc.difficultyRank === "apprentice" && cc.compliant === true && cc.resourceDelta === -4,
    "bare dialect on the ladder (10 < 12.5: success) keeps its resource field");
codeTurn(1621, "You follow the path", 10);
GK_onOutput("none; difficulty=apprentice; check=success; resource=none\nYou follow it.");
cc = GK_lastCheck();
H.assert(cc.turn === 1621 && cc.dialect === "headless" && cc.resolution === "code" && cc.difficultyRank === "apprentice" && cc.skill === null,
    "headless dialect on the ladder (v0.10.1)");
codeTurn(1622, "You grab the rope", 10);
let gOut = GK_onOutput("skill=climbing; difficulty=apprentice; check=success; resource=none; gain=coil of rope\nYou take it.");
H.assert(GK_lastCheck().turn === 1622 && GK_lastCheck().difficultyRank === "apprentice" && GK_lastCheck().gain === "coil of rope" && gOut === "You take it.",
    "gain= lifts off a code-mode verdict; the ruling parses as before (v0.11.0)");
codeTurn(1623, "You look", 10);
GK_onOutput("skill=none; difficulty=trivial; check=success; resource=none\nNothing.");
H.assert(GK_lastCheck().gain === null, "no gain field: gain is null");
codeTurn(163, "You climb", 5);
GK_onOutput("skill=climbing; difficulty=3 (3); check=success;\nUp.");
H.assert(GK_lastCheck().difficultyRank === "intermediate" && GK_lastCheck().compliant === true, "digit difficulty, echoed (n) tolerated");
codeTurn(164, "You wave", 99, 1);
GK_onOutput("skill=none; difficulty=trivial; check=success;\nYou wave.");
H.assert(GK_lastCheck().expected === "success" && GK_lastCheck().compliant === true && GK_lastCheck().chance === null && GK_lastCheck().luckPoints === null,
    "trivial always succeeds, whatever the roll — and luck never touches it");
codeTurn(165, "You fly", 1, 20);
GK_onOutput("skill=flight; difficulty=impossible; check=success;\nYou soar.");
H.assert(GK_lastCheck().result === "fail" && GK_lastCheck().compliant === true, "impossible still coerces to fail, even on a 20");
SC_get("GateKit Config").entry = SC_get("GateKit Config").entry.replace("Resolution: code", "Resolution: model");

H.summary("GateKit");
