// SkillKit harness suite — definition of done §7, stage one.
// Runs on the Essentials harness (the seam contract cuts both ways: the
// extension proves itself against the same simulated AID the core uses).
const H = require("../../PE Essentials/test/harness");
H.fresh();
eval(H.load("CardLib", "GateKit", "SkillKit"));

// Helper: run one adjudicated turn end-to-end and settle a verdict.
function ruling(turn, action, verdictLine) {
    H.turn(turn, "do"); H.resetCaches();
    GK_onInput(H.doFrame(action));
    const ctx = GK_onContext(H.ctx());
    let out = GK_onOutput(verdictLine + "\nThe story continues.");
    out = SK_onOutput(out);
    return { ctx: ctx, out: out };
}

// --- Rule 11: cards materialize on the first pass ---------------------------------
H.turn(1, "do"); H.resetCaches();
GK_onInput(H.doFrame("You look around"));
SK_onOutput("Nothing judged yet.");
H.assert(!!SC_get("SkillKit Config") && /Starting Skills: \(none\)/.test(SC_get("SkillKit Config").entry), "SkillKit Config materializes on first output pass");
H.assert(!!SC_get("Skills") && /none yet/.test(SC_get("Skills").entry), "Skills card materializes empty");

// --- Tally: attempt +1, success +2 (success-weighted accrual) ---------------------
ruling(2, "You climb the wall", "skill=climbing; difficulty=major; check=success;");
H.assert(state.vars.SK.skills.climbing && state.vars.SK.skills.climbing.uses === 2, "success tallies +2");
H.assert(SK_rank("climbing") === "Novice" && SK_rank("basket weaving") === "Untrained" && SK_rank("") === "Untrained",
    "SK_rank public seam: effective rank, unknown reads Untrained (v0.2.2, the Observatory)");
H.assert(/- Climbing: Novice \(2\/10\)/.test(SC_get("Skills").entry), "Skills card shows Novice with progress toward the 10-use wall");

// --- Retry guard: same actionCount never re-tallies --------------------------------
SK_onOutput("Retry replay of the same turn.");
H.assert(state.vars.SK.skills.climbing.uses === 2, "retry replay does not re-tally");

// --- Rank thresholds + rank-up reporting -------------------------------------------
ruling(3, "You climb again", "skill=climbing; difficulty=minor; check=fail;");        // 3 uses
H.assert(/- Climbing: Novice \(3\/10\)/.test(SC_get("Skills").entry), "3 uses still Novice under the raised wall");

// --- The note: rendered in GateKit's block after the luck line ----------------------
H.turn(4, "do"); H.resetCaches();
GK_onInput(H.doFrame("You climb once more"));
const ctx4 = GK_onContext(H.ctx());
H.assert(/luck=\d+ \(a d20 roll\)\nplayer \(a green adventurer\) skills — climbing: novice \(unlisted skills: untrained\)/.test(ctx4), "arbiter note rides the block directly after the luck line (epithet first, v0.2.0)");
GK_onOutput("skill=climbing; difficulty=minor; check=partial;\nYou slip but catch a ledge.");
SK_onOutput("");

// --- Partial: +1 attempt, lift bucket p ---------------------------------------------
H.assert(state.vars.SK.skills.climbing.uses === 4, "partial tallies +1");
H.assert(state.vars.SK.skills.climbing.lift.novice.p === 1, "partial recorded in lift bucket (novice held at attempt)");

// --- Lift keyed by rank HELD AT ATTEMPT ---------------------------------------------
H.assert(state.vars.SK.skills.climbing.lift.untrained.s === 1, "first success keyed at untrained (rank held at attempt)");
H.assert(state.vars.SK.skills.climbing.lift.novice.f === 1, "fail keyed at novice");

// --- Rank-up at the raised Novice→Apprentice wall (10 uses) -------------------------
// (Turn numbers jump forward here, then the suite resumes at lower turns —
// that reads to the engine as an erase, which it tolerates by design; the
// Event Log assertions run before the rewind drops them.)
for (let t = 40; t < 43; t++) {
    ruling(t, "You scale the cliff face", "skill=climbing; difficulty=major; check=success;");
}
H.assert(state.vars.SK.skills.climbing.uses === 10, "three contested successes reach the wall (4+6=10)");
H.assert(/climbing: Novice → Apprentice/.test(SC_get("Event Log").entry), "rank-up posted at the 10-use threshold");
H.assert(/- Climbing: Apprentice \(10\/25\)/.test(SC_get("Skills").entry), "Apprentice with progress toward 25");

// --- Canonicalization: punctuation/case variants merge ------------------------------
ruling(5, "You pick the lock", "skill=Lock-Picking!; difficulty=minor; check=success;");
ruling(6, "You pick another", "skill=lock-picking; difficulty=minor; check=success;");
H.assert(state.vars.SK.skills["lock-picking"] && state.vars.SK.skills["lock-picking"].uses === 4, "name variants tally the same canonical skill");

// --- Doubt teaches (v0.1.2): trivial and impossible rulings never accrue -------------
ruling(30, "You pick up a pebble", "skill=inventory management; difficulty=trivial; check=success;");
H.assert(!state.vars.SK.skills["inventory management"], "trivial ruling accrues nothing (the datapad lesson)");
ruling(31, "You flap your arms and fly", "skill=flight; difficulty=impossible; check=fail;");
H.assert(!state.vars.SK.skills.flight, "impossible ruling accrues nothing");

// --- skill=none / missing skill: no tally, nothing breaks (rule 7) ------------------
ruling(7, "You wait", "skill=none; difficulty=trivial; check=success;");
H.assert(Object.keys(state.vars.SK.skills).length === 2, "skill=none is normalized away — no tally");

// --- Starting Skills floor: applied once, tally stacks on top -----------------------
SC_get("SkillKit Config").entry = SC_get("SkillKit Config").entry.replace("Starting Skills: (none)", "Starting Skills: Survival=Intermediate");
H.turn(8, "do"); H.resetCaches();
GK_onInput(H.doFrame("You forage"));
GK_onContext(H.ctx());
SK_onOutput(GK_onOutput("skill=survival; difficulty=minor; check=success;\nYou find mushrooms."));
H.assert(state.vars.SK.skills.survival.uses === 27, "floor (25) applied once + success (+2) stacks on top");
H.assert(/Survival: Intermediate \(27\/50\)/.test(SC_get("Skills").entry), "floored skill projects rank + progress (the obvious ladder: next wall 50)");
// Show Progress: false hides the numbers (player choice; arbiter never saw them)
SC_get("SkillKit Config").entry = SC_get("SkillKit Config").entry.replace("Show Progress: true", "Show Progress: false");
SK_onOutput("re-render");
H.assert(/- Survival: Intermediate(?!\s*\()/.test(SC_get("Skills").entry), "Show Progress: false renders ranks only");
H.assert(state.vars.GK.notes.SK.indexOf("(") === -1 || !/\d\/\d/.test(state.vars.GK.notes.SK), "arbiter note never carries numbers either way");
SC_get("SkillKit Config").entry = SC_get("SkillKit Config").entry.replace("Show Progress: false", "Show Progress: true");
H.turn(9, "do"); H.resetCaches();
GK_onInput(H.doFrame("You rest"));
SK_onOutput("Quiet turn.");
H.assert(state.vars.SK.skills.survival.uses === 27, "floor never re-applies");

// --- Note cap: many skills stay under 160 chars --------------------------------------
for (let t = 10; t < 20; t++) {
    ruling(t, "You practice", "skill=very long practice skill number " + t + "; difficulty=minor; check=success;");
}
H.assert(state.vars.GK.notes.SK.length <= 160, "arbiter note respects the 160-char cap");
H.assert(/^player \((a|an) [a-z ]+\) skills — /.test(state.vars.GK.notes.SK), "note keeps its canonical shape (epithet-led, v0.2.0)");

// --- Eviction at Max Skills (cap editable live; fresh skill survives) -----------------
SC_get("SkillKit Config").entry = SC_get("SkillKit Config").entry.replace("Max Skills: 12", "Max Skills: 3");
ruling(20, "You juggle", "skill=juggling; difficulty=minor; check=success;");
H.assert(Object.keys(state.vars.SK.skills).length <= 3, "cap enforced after live card edit");
H.assert(!!state.vars.SK.skills.juggling, "the just-tallied skill survives its own arrival");
H.assert(/forgotten \(Max Skills cap\)/.test(SC_get("Event Log").entry), "eviction posted to Event Log");

// --- Stats toggle renders the lift table ----------------------------------------------
SC_get("SkillKit Config").entry = SC_get("SkillKit Config").entry.replace("Stats: false", "Stats: true");
ruling(21, "You juggle again", "skill=juggling; difficulty=minor; check=fail;");
H.assert(/## Lift \(telemetry\)/.test(SC_get("Skills").entry) && /Juggling @ /.test(SC_get("Skills").entry), "Stats: true renders the lift table on the Skills card");

// --- Progression: false freezes accrual ------------------------------------------------
SC_get("SkillKit Config").entry = SC_get("SkillKit Config").entry.replace("Progression: true", "Progression: false");
const frozen = state.vars.SK.skills.juggling.uses;
ruling(22, "You juggle frozen", "skill=juggling; difficulty=minor; check=success;");
H.assert(state.vars.SK.skills.juggling.uses === frozen, "Progression: false freezes accrual");
SC_get("SkillKit Config").entry = SC_get("SkillKit Config").entry.replace("Progression: false", "Progression: true");

// --- Note clears when empty; GK seam hygiene -------------------------------------------
GK_setArbiterNote("SK", "");
H.assert(!("SK" in state.vars.GK.notes), "empty line clears a note (seam contract)");
GK_setArbiterNote("", "orphan");
H.assert(Object.keys(state.vars.GK.notes).length === 0, "ownerless notes are refused");
GK_setArbiterNote("XX", new Array(50).fill("long").join(" "));
H.assert(state.vars.GK.notes.XX.length === 160, "GateKit clamps foreign notes to 160");
GK_setArbiterNote("XX", "");

// --- Degradation: no GateKit seam → SkillKit still projects (spot check) ----------------
// (Full no-GateKit run belongs to a standalone fixture; here we verify the
// guards: SK_onOutput with no settled ruling and no note change is a no-op.)
H.turn(23, "do"); H.resetCaches();
GK_onInput(H.doFrame("You ponder"));
const before23 = JSON.stringify(state.vars.SK.skills);
H.assert(SK_onOutput("Unjudged text.") === "Unjudged text." && JSON.stringify(state.vars.SK.skills) === before23, "no ruling = passthrough, no mutation");

// --- the Growth (v0.2.0): Level, epithet, floors --------------------------------------
// Controlled ledger: Level is derived, so we write the ledger directly.
state.vars.SK.skills = { alpha: { uses: 20, tallyTurn: -1, lift: {} }, beta: { uses: 4, tallyTurn: -1, lift: {} } };
state.vars.SK.levelSeen = 1;
H.assert(SK_total() === 24 && SK_level() === 1, "total sums the ledger; 24 is still Level 1");
state.vars.SK.skills.alpha.uses = 21;
H.assert(SK_level() === 2 && SK_epithet() === "a green adventurer", "the 25-wall lands Level 2; levels 1-2 speak green");
state.vars.SK.skills.alpha.uses = 226;
H.assert(SK_level() === 10 && SK_epithet() === "a seasoned adventurer", "level 10 is seasoned");
state.vars.SK.skills.alpha.uses = 996;
H.assert(SK_level() === 20 && SK_epithet() === "a living legend", "cap holds at 20 — the living legend");
SK_refreshNote();
H.assert(/^player \(a living legend\) skills — /.test(state.vars.GK.notes.SK), "note leads with the epithet, never the number");
SK_renderCard(SK_cfg());
H.assert(/Level 20 \(a living legend\)\n/.test(SC_get("Skills").entry) && !/toward 21/.test(SC_get("Skills").entry),
    "card header carries Level; no progress line at the cap");
state.vars.SK.skills.alpha.uses = 191;   // total 195 → Level 8, 20/25 toward 9
SK_renderCard(SK_cfg());
H.assert(/Level 8 \(a capable adventurer\) — 20\/25 toward 9/.test(SC_get("Skills").entry), "within-level progress in the obvious style");

// The announce: once per level, dips silent.
state.vars.SK.levelSeen = 7;
SK_onOutput("Plain narration.");
H.assert(/\[SkillKit\] Level 7 → 8 \(a capable adventurer\)/.test(SC_get("Event Log").entry), "level-up posts once with the epithet");
const lvLogBefore = SC_get("Event Log").entry;
SK_onOutput("More narration.");
H.assert(SC_get("Event Log").entry === lvLogBefore, "no ruling, no change — announce never repeats");
state.vars.SK.skills.alpha.uses = 100;   // dip (eviction class)
SK_onOutput("Yet more narration.");
H.assert(state.vars.SK.levelSeen === SK_level() && SC_get("Event Log").entry === lvLogBefore, "dips update the guard silently");

// Floors: creator-defined derivation clamps.
SC_get("SkillKit Config").entry += "\n- Strong: rank=Intermediate, skills=climbing/lifting\n- Broken line here\n- Weird: rank=Sublime, skills=dancing";
const attrs2 = SK_attributes(SK_cfg());
H.assert(attrs2.names.length === 1 && attrs2.floors.climbing === 25 && attrs2.floors.lifting === 25,
    "attribute line parses: one attribute, floor uses across the family");
H.assert(/skipped malformed line/.test(SC_get("Event Log").entry) && /unknown rank/.test(SC_get("Event Log").entry),
    "malformed and unknown-rank lines reported, never thrown");
const totalBefore = SK_total();
state.vars.SK.skills.climbing = { uses: 3, tallyTurn: -1, lift: {} };
SK_renderCard(SK_cfg());
H.assert(/- Climbing: Intermediate \(3 earned\)/.test(SC_get("Skills").entry), "floor clamps the rank up; earned progress shown honestly");
H.assert(/- Lifting: Intermediate \(0 earned\)/.test(SC_get("Skills").entry), "floored skills materialize untracked");
H.assert(/Attributes: Strong/.test(SC_get("Skills").entry), "attribute names surface on the card");
H.assert(SK_total() === totalBefore + 3, "floors are Level-neutral — they never add uses");
SK_refreshNote();
H.assert(/climbing: intermediate/.test(state.vars.GK.notes.SK), "note speaks the floored rank (the arbiter's channel)");
state.vars.SK.skills.climbing.uses = 30;
SK_renderCard(SK_cfg());
H.assert(/- Climbing: Intermediate \(30\/50\)/.test(SC_get("Skills").entry),
    "earned overtakes the floor — normal progress returns past the clamp");
state.vars.SK.skills.climbing.uses = 3;
SC_get("SkillKit Config").entry = SC_get("SkillKit Config").entry.replace("\n- Strong: rank=Intermediate, skills=climbing/lifting", "");
SK_renderCard(SK_cfg());
H.assert(!/- Lifting:/.test(SC_get("Skills").entry) && /- Climbing: Novice \(3\/10\)/.test(SC_get("Skills").entry),
    "delete the line and floors withdraw — reversible, only earned rank remains");

H.summary("SkillKit");
