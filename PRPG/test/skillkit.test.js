// SkillKit harness suite — definition of done §7, stage one.
// Runs on the Essentials harness (the seam contract cuts both ways: the
// extension proves itself against the same simulated AID the core uses).
const H = require("../../PE Essentials/test/harness");
H.fresh();
eval(H.load("CardLib", "GateKit", "SkillKit"));

// Helper: run one adjudicated turn end-to-end and settle a verdict.
function ruling(turn, action, verdictLine) {
    H.turn(turn, "do", H.doFrame(action)); H.resetCaches();   // the action is in history by output (repeat guard reads it)
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

// --- Tally: one practice per attempt (v0.3.0 — Volta's rule; was +2 on success) ---
ruling(2, "You climb the wall", "skill=climbing; difficulty=major; check=success;");
H.assert(state.vars.SK.skills.climbing && state.vars.SK.skills.climbing.uses === 1, "success earns one practice (no longer double)");
H.assert(SK_rank("climbing") === "Novice" && SK_rank("basket weaving") === "Untrained" && SK_rank("") === "Untrained",
    "SK_rank public seam: effective rank, unknown reads Untrained (v0.2.2, the Observatory)");
H.assert(/- Climbing: Novice \(1\/25\)/.test(SC_get("Skills").entry) && !/ — /.test(SC_get("Skills").entry.split("\n").filter(l => /^- /.test(l)).join("\n")),
    "Skills card shows Novice, its benchmark, and progress toward the 25 wall (v0.3.0; re-paced 10/7)");

// --- Retry guard: same actionCount never re-tallies --------------------------------
SK_onOutput("Retry replay of the same turn.");
H.assert(state.vars.SK.skills.climbing.uses === 1, "retry replay does not re-tally");

// --- Rank thresholds + rank-up reporting -------------------------------------------
ruling(3, "You climb again", "skill=climbing; difficulty=minor; check=fail;");        // 2 practice
H.assert(/- Climbing: Novice \(2\/25\)/.test(SC_get("Skills").entry), "a failure earns the same one practice");

// --- The note: rendered in GateKit's block after the luck line ----------------------
H.turn(4, "do", H.doFrame("You climb once more")); H.resetCaches();
GK_onInput(H.doFrame("You climb once more"));
const ctx4 = GK_onContext(H.ctx());
H.assert(/luck=\d+ \(a d20 roll\)\nplayer \(a green adventurer\) skills — climbing: novice \(unlisted skills: untrained\)/.test(ctx4), "arbiter note rides the block directly after the luck line (epithet first, v0.2.0)");
GK_onOutput("skill=climbing; difficulty=minor; check=partial;\nYou slip but catch a ledge.");
SK_onOutput("");

// --- Partial: +1 attempt, lift bucket p ---------------------------------------------
H.assert(state.vars.SK.skills.climbing.uses === 3, "partial tallies +1");
H.assert(state.vars.SK.skills.climbing.lift.novice.p === 1, "partial recorded in lift bucket (novice held at attempt)");

// --- Lift keyed by rank HELD AT ATTEMPT ---------------------------------------------
H.assert(state.vars.SK.skills.climbing.lift.untrained.s === 1, "first success keyed at untrained (rank held at attempt)");
H.assert(state.vars.SK.skills.climbing.lift.novice.f === 1, "fail keyed at novice");

// --- Rank-up at the raised Novice→Apprentice wall (10 uses) -------------------------
// (Turn numbers jump forward here, then the suite resumes at lower turns —
// that reads to the engine as an erase, which it tolerates by design; the
// Event Log assertions run before the rewind drops them.)
// v0.3.0 — Volta's repeat guard: the same action at the same difficulty as
// this skill's last practice earns nothing, however many times it's typed.
for (let t = 40; t < 43; t++) {
    ruling(t, "You scale the cliff face", "skill=climbing; difficulty=major; check=success;");
}
H.assert(state.vars.SK.skills.climbing.uses === 4, "repeat guard: three identical attempts earn one practice (3+1)");
for (let t = 43; t < 64; t++) {
    ruling(t, "You scale the cliff face, pitch " + t, "skill=climbing; difficulty=major; check=success;");
}
H.assert(state.vars.SK.skills.climbing.uses === 25, "twenty-one distinct attempts reach the wall (4+21=25)");
H.assert(/climbing: Novice → Apprentice/.test(SC_get("Event Log").entry), "rank-up posted at the 25 threshold");
H.assert(/- Climbing: Apprentice \(25\/75\)/.test(SC_get("Skills").entry), "Apprentice with progress toward 75");

// --- Canonicalization: punctuation/case variants merge ------------------------------
ruling(5, "You pick the lock", "skill=Lock-Picking!; difficulty=minor; check=success;");
ruling(6, "You pick another", "skill=lock-picking; difficulty=minor; check=success;");
H.assert(state.vars.SK.skills["lock-picking"] && state.vars.SK.skills["lock-picking"].uses === 2, "name variants tally the same canonical skill");
H.assert(SK_rank("Lock-Picking!") === "Novice", "SK_rank canonicalizes as tallies do (v0.3.0 — was a miss)");

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
H.assert(state.vars.SK.skills.survival.uses === 76, "floor (75) applied once + one practice stacks on top");
H.assert(/Survival: Intermediate \(76\/150\)/.test(SC_get("Skills").entry), "floored skill projects rank + progress (next wall 150)");
// Show Progress: false hides the numbers (player choice; arbiter never saw them)
SC_get("SkillKit Config").entry = SC_get("SkillKit Config").entry.replace("Show Progress: true", "Show Progress: false");
SK_onOutput("re-render");
H.assert(/- Survival: Intermediate(?!\s*\()/.test(SC_get("Skills").entry), "Show Progress: false renders ranks only");
H.assert(state.vars.GK.notes.SK.indexOf("(") === -1 || !/\d\/\d/.test(state.vars.GK.notes.SK), "arbiter note never carries numbers either way");
SC_get("SkillKit Config").entry = SC_get("SkillKit Config").entry.replace("Show Progress: false", "Show Progress: true");
H.turn(9, "do"); H.resetCaches();
GK_onInput(H.doFrame("You rest"));
SK_onOutput("Quiet turn.");
H.assert(state.vars.SK.skills.survival.uses === 76, "floor never re-applies");

// --- Note cap: many skills stay under 160 chars --------------------------------------
for (let t = 10; t < 20; t++) {
    ruling(t, "You practice", "skill=very long practice skill number " + t + "; difficulty=minor; check=success;");
}
H.assert(state.vars.GK.notes.SK.length <= 160, "arbiter note respects the 160-char cap");
H.assert(/^player \((a|an) [a-z ]+\) skills — /.test(state.vars.GK.notes.SK), "note keeps its canonical shape (epithet-led, v0.2.0)");

// --- Eviction at Max Skills (cap editable live; fresh skill survives) -----------------
SC_get("SkillKit Config").entry = SC_get("SkillKit Config").entry.replace("Max Skills: 25", "Max Skills: 3");
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

// --- the Growth: Level from EARNED RANKS, Skyrim-style (v0.4.0) -------------------------
// Controlled ledger: Level is derived, so we write the ledger directly. Each earned
// rank is worth its number minus one (Novice 0, Apprentice 1 ... Legendary 6 —
// owner, 10/7); Level L->L+1 costs L+2.
SC_get("SkillKit Config").entry = SC_get("SkillKit Config").entry.replace("Max Skills: 3", "Max Skills: 25");
const sk = uses => ({ uses: uses, tallyTurn: -1, lift: {} });
state.vars.SK.skills = { alpha: sk(24), beta: sk(1), gamma: sk(5) };
state.vars.SK.levelSeen = 1;
H.assert(SK_levelPoints() === 0 && SK_level() === 1, "Novice earns no Level points: three skills tried once buy nothing (owner, 10/7)");
state.vars.SK.skills = { alpha: sk(25) };
H.assert(SK_levelPoints() === 1 && SK_level() === 1, "an Apprentice is 1 point — not yet Level 2 (costs 3)");
state.vars.SK.skills.alpha.uses = 75;
H.assert(SK_levelPoints() === 3 && SK_level() === 2 && SK_epithet() === "a green adventurer",
    "one skill to Intermediate (1+2) lands Level 2; levels 1-2 speak green");
state.vars.SK.skills = { alpha: sk(1000), beta: sk(500), gamma: sk(250) };   // 21 + 15 + 10
H.assert(SK_levelPoints() === 46 && SK_level() === 8 && SK_epithet() === "a capable adventurer",
    "Legendary + Master + Expert = 46 points: Level 8 (42 cumulative) is capable");
for (let i = 0; i < 9; i++) state.vars.SK.skills["deep" + i] = sk(1000);
H.assert(SK_level() === 20 && SK_epithet() === "a living legend", "cap holds at 20 — the living legend");
SK_refreshNote();
H.assert(/^player \(a living legend\) skills — /.test(state.vars.GK.notes.SK), "note leads with the epithet, never the number");
SK_renderCard(SK_cfg());
H.assert(/Level 20 \(a living legend\)\n/.test(SC_get("Skills").entry) && !/toward 21/.test(SC_get("Skills").entry),
    "card header carries Level; no progress line at the cap");
state.vars.SK.skills = { alpha: sk(1000), beta: sk(250) };   // 21 + 10 = 31: Level 6 (25), 6/8 toward 7
SK_renderCard(SK_cfg());
H.assert(/Level 6 \(a capable adventurer\) — 6\/8 toward 7/.test(SC_get("Skills").entry), "within-level progress in rank points");
state.vars.SK.skills.gamma = { uses: 76, granted: 75, tallyTurn: -1, lift: {} };   // a Starting Skills grant + 1 earned
H.assert(SK_levelPoints() === 31, "a Starting Skills head start is Level-neutral: Intermediate given, not earned, is 0 points");

// The announce: once per level, dips silent.
state.vars.SK.levelSeen = 5;
SK_onOutput("Plain narration.");
H.assert(/\[SkillKit\] Level 5 → 6 \(a capable adventurer\)/.test(SC_get("Event Log").entry), "level-up posts once with the epithet");
const lvLogBefore = SC_get("Event Log").entry;
SK_onOutput("More narration.");
H.assert(SC_get("Event Log").entry === lvLogBefore, "no ruling, no change — announce never repeats");
state.vars.SK.skills.alpha.uses = 100;   // dip (eviction class)
SK_onOutput("Yet more narration.");
H.assert(state.vars.SK.levelSeen === SK_level() && SC_get("Event Log").entry === lvLogBefore, "dips update the guard silently");

// Floors: creator-defined baselines (v0.3.0 — Volta's start + practice; were clamps).
const lvBeforeFloors = SK_level();
SC_get("SkillKit Config").entry +="\n- Strong: rank=Intermediate, skills=climbing/lifting\n- Broken line here\n- Weird: rank=Sublime, skills=dancing";
const attrs2 = SK_attributes(SK_cfg());
H.assert(attrs2.names.length === 1 && attrs2.floors.climbing === 75 && attrs2.floors.lifting === 75,
    "attribute line parses: one attribute, floor uses across the family");
H.assert(/skipped malformed line/.test(SC_get("Event Log").entry) && /unknown rank/.test(SC_get("Event Log").entry),
    "malformed and unknown-rank lines reported, never thrown");
const totalBefore = SK_total();
state.vars.SK.skills.climbing = { uses: 3, tallyTurn: -1, lift: {} };
SK_renderCard(SK_cfg());
H.assert(/- Climbing: Intermediate \(3 earned · 78\/150\)/.test(SC_get("Skills").entry), "earned adds on top of the floor (75+3); earned shown honestly");
H.assert(/^- Strong \(Intermediate\): lifting \(0 earned · 75\/150\)$/m.test(SC_get("Skills").entry) && !/- Lifting:/.test(SC_get("Skills").entry),
    "an unpractised floored skill folds under its attribute (v0.4.1); the practised one keeps its own line");
H.assert(/Attributes: Strong/.test(SC_get("Skills").entry), "attribute names surface on the card");
H.assert(SK_total() === totalBefore + 3, "floors never add uses");
H.assert(SK_level() === lvBeforeFloors, "floors are Level-neutral: the Intermediate head start (and 3 earned inside it) earns no rank points");
SK_refreshNote();
H.assert(/climbing: intermediate/.test(state.vars.GK.notes.SK), "note speaks the floored rank (the arbiter's channel)");
state.vars.SK.skills.climbing.uses = 80;
SK_renderCard(SK_cfg());
H.assert(/- Climbing: Advanced \(80 earned · 155\/250\)/.test(SC_get("Skills").entry),
    "floor + earned: 75 + 80 = 155, Advanced (Volta: the start is a baseline, not a clamp)");
H.assert(SK_rank("climbing") === "Advanced" && SK_ranks().climbing === "Advanced" && SK_ranks().lifting === "Intermediate",
    "SK_rank and SK_ranks speak the same effective ranks, floored skills included");
state.vars.SK.skills.climbing.uses = 3;
SC_get("SkillKit Config").entry = SC_get("SkillKit Config").entry.replace("\n- Strong: rank=Intermediate, skills=climbing/lifting", "");
SK_renderCard(SK_cfg());
H.assert(!/Lifting|lifting|Strong/.test(SC_get("Skills").entry.split("## Skills")[1]) && /- Climbing: Novice \(3\/25\)/.test(SC_get("Skills").entry),
    "delete the line and floors withdraw — reversible, only earned rank remains");

// --- v0.3.0: benchmarks --------------------------------------------------------------
H.assert(SK_benchmarks().generic.length === 8 && SK_benchmarks().generic[2] === "Ordinary tasks under normal conditions",
    "Volta's eight generic benchmarks, verbatim");
const logBefore = SC_get("Event Log").entry;
SC_get("SkillKit Config").entry += "\n- Climbing: benchmarks=Steps and gentle slopes | Easy scrambles with abundant holds |  | Steep routes with limited holds"
    + "\n- Juggling: benchmarks=a|b|c|d|e|f|g|h|i";
const bmk = SK_benchmarks();
H.assert(bmk.skills.climbing[0] === "Steps and gentle slopes" && bmk.skills.climbing[3] === "Steep routes with limited holds"
    && bmk.skills.climbing[2] === "Ordinary tasks under normal conditions" && bmk.skills.climbing[7] === "At the limits of the setting",
    "per-skill override: position by position, blanks and missing positions keep the generic");
H.assert(!bmk.skills.juggling && /skipped malformed line: "- Juggling: benchmarks/.test(SC_get("Event Log").entry),
    "more than eight benchmarks is malformed: reported, never thrown");
H.assert(!/skipped malformed line: "Climbing: benchmarks/.test(SC_get("Event Log").entry.slice(logBefore.length)) && SK_attributes(SK_cfg()).names.length === 0,
    "the attribute parser leaves benchmark lines alone");
SK_renderCard(SK_cfg());
H.assert(/- Climbing: Novice \(3\/25\)/.test(SC_get("Skills").entry) && !/Easy scrambles/.test(SC_get("Skills").entry),
    "benchmarks stay off the card (v0.4.1) — they feed GateKit's scale, tested below");

// --- v0.4.1: the fold, on the live fixture (the Warrior's turn-0 card) -----------------
const cfgBefore = SC_get("SkillKit Config").entry;
const skillsBefore = state.vars.SK.skills;
state.vars.SK.skills = {};
SC_get("SkillKit Config").entry += "\n- Martial: rank=Intermediate, skills=melee/swordplay/combat/blades/fighting"
    + "\n- Hardy: rank=Novice, skills=athletics/endurance/climbing";
SK_renderCard(SK_cfg());
const warriorCard = SC_get("Skills").entry.split("\n").filter(l => /^- /.test(l)).join("\n");   // skill lines only (no Sheet here, so the header shows)
H.assert(/^- Martial \(Intermediate\): melee, swordplay, combat, blades, fighting \(0 earned · 75\/150\)$/m.test(warriorCard)
    && /^- Hardy \(Novice\): athletics, endurance, climbing \(0 earned · 1\/25\)$/m.test(warriorCard) && warriorCard.split("\n").length === 2,
    "the Warrior's eight skills fold into two lines (was eight lines, 675 chars, live 10/7)");
state.vars.SK.skills.swordplay = { uses: 4, tallyTurn: -1, lift: {} };
SK_renderCard(SK_cfg());
H.assert(/^- Swordplay: Intermediate \(4 earned · 79\/150\)$/m.test(SC_get("Skills").entry)
    && /^- Martial \(Intermediate\): melee, combat, blades, fighting \(0 earned · 75\/150\)$/m.test(SC_get("Skills").entry),
    "a practised synonym leaves the fold for its own line");
SC_get("SkillKit Config").entry = cfgBefore;
state.vars.SK.skills = skillsBefore;

// --- v0.4.0: XP by difficulty (code resolution) ----------------------------------------
// A success pays by its difficulty, doubling (1,1,2,4,8,16,32,64); failures, trivial
// and impossible pay nothing. Climbing held Novice throughout (3 -> 7, under the wall).
SC_get("GateKit Config").entry = SC_get("GateKit Config").entry.replace("Resolution: model", "Resolution: code");
[["untrained", "success", 1], ["novice", "success", 1], ["apprentice", "success", 2], ["intermediate", "fail", 0],
 ["advanced", "fail", 0], ["trivial", "success", 0], ["impossible", "fail", 0]].forEach(function (b, i) {
    const before = state.vars.SK.skills.climbing.uses;
    ruling(60 + i, "You try route " + i, "skill=climbing; difficulty=" + b[0] + "; check=" + b[1] + ";");
    H.assert(state.vars.SK.skills.climbing.uses - before === b[2],
        "XP: difficulty=" + b[0] + ", " + b[1] + " pays " + b[2]);
});
ruling(70, "You try route 1", "skill=climbing; difficulty=novice; check=success;");
ruling(71, "You try route 1", "skill=climbing; difficulty=novice; check=success;");
H.assert(state.vars.SK.skills.climbing.uses === 8, "repeat guard holds under code resolution too (one of two)");

// No lower edge any more: easy work still pays, just not much (the anti-grind is the scale).
state.vars.SK.skills.swimming = { uses: 150, tallyTurn: -1, lift: {}, lastPractice: "" };   // Advanced
ruling(80, "You paddle across the pool", "skill=swimming; difficulty=novice; check=success;");
H.assert(state.vars.SK.skills.swimming.uses === 151, "an Advanced swimmer's novice success pays 1");
ruling(81, "You swim the flooded tunnel", "skill=swimming; difficulty=expert; check=success;");
H.assert(state.vars.SK.skills.swimming.uses === 167, "…and an expert success pays 16");

// GateKit x SkillKit: the table is built from SK_ranks, the scale from SK_benchmarks.
H.turn(72, "do", H.doFrame("You climb")); H.resetCaches();
GK_onInput(H.doFrame("You climb"));
state.vars.GK.roll = 20; state.vars.GK.luck = 10;   // neutral luck (GateKit v0.10.0)
const joint = GK_onContext(H.ctx());
H.assert(/untrained \(0\): No training\n/.test(joint) && /legendary \(7\): At the limits of the setting\n/.test(joint),
    "the scale carries Volta's generic benchmarks, numbered");
H.assert(/climbing — 0 Steps and gentle slopes; 1 Easy scrambles with abundant holds; 2 Ordinary tasks/.test(joint),
    "per-skill benchmarks join the scale");
H.assert(/- climbing: apprentice\n/.test(joint) && /- any other skill: novice\n/.test(joint),
    "roll 20: climbing (Novice) clears apprentice (35% ≥ 20) — everyone else only novice");
H.assert(/^player \((a|an) [a-z ]+\)$/.test(state.vars.GK.notes.SK) && !/skills —/.test(joint),
    "code mode: the note is the epithet alone — the table already lists the ranks (v0.3.1, veto ⚑7)");
GK_onOutput("skill=climbing; difficulty=apprentice; check=success;\nYou top out.");
H.assert(GK_lastCheck().skillRank === 1 && GK_lastCheck().compliant === true && GK_lastCheck().difficulty === "major",
    "GateKit reads the held rank through SK_rank");

// Long shots pay full value (owner ruling 10/5): a Novice landing a legendary task.
let usesNow = state.vars.SK.skills.climbing.uses;          // 8 — still Novice
ruling(73, "You free-climb the obsidian spire", "skill=climbing; difficulty=legendary; check=success;");
H.assert(state.vars.SK.skills.climbing.uses === usesNow + 64 && SK_rank("climbing") === "Apprentice",
    "a legendary success pays 64, uncapped: Novice to Apprentice in one go (8 + 64 = 72)");
ruling(74, "You leap for the far ledge", "skill=climbing; difficulty=master; check=fail;");
H.assert(state.vars.SK.skills.climbing.uses === usesNow + 64, "a failure pays nothing");
ruling(75, "You free-climb the obsidian spire", "skill=climbing; difficulty=legendary; check=success;");
ruling(76, "You free-climb the obsidian spire", "skill=climbing; difficulty=legendary; check=success;");
H.assert(state.vars.SK.skills.climbing.uses === usesNow + 64,
    "the repeat guard stops the same feat paying twice (the unpaid failure didn't reset it)");
SC_get("GateKit Config").entry = SC_get("GateKit Config").entry.replace("Resolution: code", "Resolution: model");
H.resetCaches();
SK_onOutput("Back on the d20.");
H.assert(/^player \((a|an) [a-z ]+\) skills — [a-z ]+: [a-z]+/.test(state.vars.GK.notes.SK),
    "switched back to model: the full rank note returns at the next output pass");

H.summary("SkillKit");
