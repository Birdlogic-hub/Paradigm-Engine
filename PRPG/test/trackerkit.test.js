// TrackerKit harness suite — the Gauge, built to PWorld proposal §3.
const H = require("../../PE Essentials/test/harness");
H.fresh();
eval(H.load("RegexLib", "CardLib", "GateKit", "TrackerKit"));

function ruling(turn, action, verdictLine) {
    H.turn(turn, "do"); H.resetCaches();
    GK_onInput(H.doFrame(action));
    GK_onContext(H.ctx());
    let out = GK_onOutput(verdictLine + "\nThe story continues.");
    out = TK_onOutput(out);
    return out;
}
function plain(turn) {
    H.turn(turn, "do"); H.resetCaches();
    GK_onInput(H.doFrame("You walk on"));
    TK_onOutput("The road unrolls.");
}

// --- Rule 11 + v0.1.1 presets: Health/Stamina/Hunger ship built in ------------------
H.turn(1, "do"); H.resetCaches();
TK_onInput(H.doFrame("You look around"));
H.assert(/Each number is a MAXIMUM/.test(SC_get("Trackers Config").entry), "header says the numbers are maximums (v0.2.3)");
H.assert(/prose/.test(SC_get("Trackers Config").description) && !/combat-family/.test(SC_get("Trackers Config").description),
    "NOTES describe v0.2 physics, not the retired coupling");
H.assert(!!SC_get("Trackers Config") && /Health: 100/.test(SC_get("Trackers Config").entry)
    && /Stamina: 100/.test(SC_get("Trackers Config").entry) && /Hunger: 100/.test(SC_get("Trackers Config").entry),
    "config ships the three presets as plain settings");
H.assert(/- Health: 100\/100 \(fine\)/.test(SC_get("Trackers").entry), "Health projects full, banded fine");
H.assert(/^trackers — health: fine; stamina: 100; hunger: 100/.test(state.vars.GK.notes.TK), "presets reach the arbiter note");

// Hardcoded malus: combat-family fail costs ~10% of Health max
ruling(2, "You take a mauling", "skill=combat; difficulty=major; check=fail;");
H.assert(state.vars.TK.trackers.health.val === 100, "rulings alone no longer wound (v0.2: the Wound is narrative)");
TK_onOutput("The brute slams his club into your ribs and you reel.");
H.assert(state.vars.TK.trackers.health.val === 88, "strong wound parsed from prose (-12% with evidence)");
H.assert(/strong: "slams his club into your ribs"/.test(SC_get("Event Log").entry), "wound evidence posted");

// User-friendly rescale: one number is the whole config; values clamp live
SC_get("Trackers Config").entry = SC_get("Trackers Config").entry.replace("Health: 100", "Health: 20");
H.turn(3, "do"); H.resetCaches();
TK_onInput(H.doFrame("You breathe"));
H.assert(/- Health: 20\/20/.test(SC_get("Trackers").entry), "max rescale is one number; persisted value clamps in");

// Advanced path: a custom line overrides its preset by name
SC_get("Trackers Config").entry += "\n- Health: start=5, range=0-5, low=Dead";
H.turn(4, "do"); H.resetCaches();
TK_onInput(H.doFrame("You inspect yourself"));
H.assert(/- Health: 5\/5/.test(SC_get("Trackers").entry), "custom line overrides the preset");
SC_get("Trackers Config").entry = SC_get("Trackers Config").entry.replace("\n- Health: start=5, range=0-5, low=Dead", "");

// Off-switch: 0 disables a preset; all off = empty card, note withdrawn
SC_get("Trackers Config").entry = SC_get("Trackers Config").entry.replace("Health: 20", "Health: 0").replace("Stamina: 100", "Stamina: 0").replace("Hunger: 100", "Hunger: 0");
H.turn(5, "do"); H.resetCaches();
TK_onInput(H.doFrame("You look"));
H.assert(/none configured/.test(SC_get("Trackers").entry), "0 disables presets (all off = empty card)");
H.assert(!("TK" in state.vars.GK.notes), "no trackers, note withdrawn");

// --- Creator adds tracker lines (live card edit bites) ------------------------------
SC_get("Trackers Config").entry += "\n- Morale: start=6, range=0-10, bands=routed/shaky/steady/bold, on-fail=combat -1"
    + "\n- Doom: start=0, range=0-6, on-fail=any +1, high=Doomsday"
    + "\n- Rations: start=10, range=0-20, drift=-1/8, low=Starving"
    + "\n- Focus: start=2, range=0-5, on-success=any +1, note=false";
H.turn(2, "do"); H.resetCaches();
TK_onInput(H.doFrame("You take stock"));
TK_onOutput("You consider your situation.");
H.assert(/- Morale: 6\/10 \(steady\)/.test(SC_get("Trackers").entry), "Morale projects value + band");
H.assert(/- Doom: 0\/6/.test(SC_get("Trackers").entry) && /- Rations: 10\/20/.test(SC_get("Trackers").entry), "Doom and Rations project");
const note0 = state.vars.GK.notes.TK;
H.assert(/^trackers — morale: steady; doom: 0 of 6; rations: 10/.test(note0), "note: bands speak labels, capped counters speak 'x of max', plain gauges speak numbers");
H.assert(note0.indexOf("focus") === -1, "note=false hides a tracker from the arbiter");
H.assert(note0.length <= 160, "note respects the 160 cap");

// --- Note rides GateKit's block after the luck line ---------------------------------
H.turn(3, "do"); H.resetCaches();
GK_onInput(H.doFrame("You press on"));
H.assert(/luck=\d+ \(a d20 roll\)\ntrackers — morale: steady/.test(GK_onContext(H.ctx())), "note rendered in the arbiter block");
GK_onOutput("skill=none; difficulty=trivial; check=success;\nFine.");
TK_onOutput("");

// --- /track: bookkeeping command, yielded, clamped ----------------------------------
H.turn(4, "do"); H.resetCaches();
GK_onInput(H.doFrame("/track morale +2"));
const stub = TK_onInput(H.doFrame("/track morale +2"));
H.assert(stub === " ", "/track swallows to a stub");
H.assert(state.vars.TK.trackers.morale.val === 8, "/track moves the gauge");
H.assert(state.vars.GK.commandTurn === 4, "/track marks the turn as bookkeeping (Check yields)");
H.assert(/Morale 6→8 \(\/track\)/.test(SC_get("Event Log").entry), "move posted with cause");
H.turn(5, "do"); H.resetCaches();
GK_onInput(H.doFrame("/track morale +99"));
TK_onInput(H.doFrame("/track morale +99"));
H.assert(state.vars.TK.trackers.morale.val === 10, "moves clamp to range");
H.turn(6, "do"); H.resetCaches();
GK_onInput(H.doFrame("/track morale -4"));
TK_onInput(H.doFrame("/track morale -4"));
H.assert(state.vars.TK.trackers.morale.val === 6, "negative deltas work");
H.turn(7, "do"); H.resetCaches();
TK_onInput(H.doFrame("/track chakra +5"));
H.assert(/unknown tracker/.test(SC_get("Event Log").entry), "unknown tracker reported, never thrown");

// --- Check-coupling: the settled ruling moves matching gauges -----------------------
ruling(8, "You swing your blade", "skill=combat; difficulty=major; check=fail;");
H.assert(state.vars.TK.trackers.morale.val === 5, "on-fail=combat moved Morale");
H.assert(state.vars.TK.trackers.doom.val === 1, "on-fail=any moved Doom");
H.assert(/Morale 6→5 \(failed: combat\)/.test(SC_get("Event Log").entry), "cause names the failed skill");
TK_onOutput("retry replay");
H.assert(state.vars.TK.trackers.doom.val === 1, "retry replay never re-moves");
ruling(9, "You climb the ridge", "skill=climbing; difficulty=minor; check=fail;");
H.assert(state.vars.TK.trackers.morale.val === 5, "skill filter holds (climbing is not combat)");
H.assert(state.vars.TK.trackers.doom.val === 2, "any-rule fires on every fail");
ruling(10, "You rally the group", "skill=leadership; difficulty=major; check=success;");
H.assert(state.vars.TK.trackers.focus.val === 3, "on-success=any moved Focus");
ruling(11, "You bargain hard", "skill=bargaining; difficulty=major; check=partial;");
H.assert(state.vars.TK.trackers.doom.val === 2 && state.vars.TK.trackers.focus.val === 3, "partial moves nothing (rules bind success|fail only)");

// --- Doubt boundary: trivial/impossible rulings move nothing ------------------------
ruling(40, "You pocket a coin", "skill=sleight of hand; difficulty=trivial; check=success;");
ruling(41, "You leap to the moon", "skill=leaping; difficulty=impossible; check=fail;");
H.assert(state.vars.TK.trackers.focus.val === 3 && state.vars.TK.trackers.doom.val === 2, "certainties carry no consequences (trivial/impossible move no gauges)");

// --- Drift: one point per 8 actions, retry-guarded ----------------------------------
const rationsBefore = state.vars.TK.trackers.rations.val;
for (let t = 12; t < 20; t++) plain(t);
H.assert(state.vars.TK.trackers.rations.val === rationsBefore - 1, "drift ticked after 8 actions");
TK_onOutput("same-turn replay");
H.assert(state.vars.TK.trackers.rations.val === rationsBefore - 1, "drift clock is retry-guarded");

// --- Thresholds: fire on arrival, once per pinning, reset on leaving ----------------
H.turn(30, "do"); H.resetCaches();
GK_onInput(H.doFrame("/track doom +6"));
TK_onInput(H.doFrame("/track doom +6"));
H.assert(state.vars.TK.trackers.doom.val === 6, "Doom pinned at max");
H.assert(/Doom: DOOMSDAY/.test(SC_get("Event Log").entry), "threshold event posted");
H.assert(/doom: DOOMSDAY/.test(state.vars.GK.notes.TK), "threshold replaces the note reading while pinned");
const logAtDoom = SC_get("Event Log").entry;
H.turn(31, "do"); H.resetCaches();
GK_onInput(H.doFrame("/track doom +1"));
TK_onInput(H.doFrame("/track doom +1"));
H.assert(SC_get("Event Log").entry === logAtDoom, "pinned gauge cannot re-fire its event");
H.turn(32, "do"); H.resetCaches();
GK_onInput(H.doFrame("/track doom -1"));
TK_onInput(H.doFrame("/track doom -1"));
H.assert(state.vars.TK.trackers.doom.fired === "", "leaving the bound resets the event");
H.assert(/doom: 5 of 6/.test(state.vars.GK.notes.TK), "note reading returns after unpinning");

// --- Malformed lines: skipped and reported, never thrown ----------------------------
SC_get("Trackers Config").entry += "\n- Glitch: range=banana, drift=oops";
H.turn(33, "do"); H.resetCaches();
TK_onInput(H.doFrame("You squint"));
H.assert(/skipped malformed line/.test(SC_get("Event Log").entry), "malformed line reported");
H.assert(!state.vars.TK.trackers.glitch, "malformed line creates no tracker");

// --- Live edits bite: bands re-read every pass --------------------------------------
SC_get("Trackers Config").entry = SC_get("Trackers Config").entry.replace("bands=routed/shaky/steady/bold", "bands=low/high");
H.turn(34, "do"); H.resetCaches();
GK_onInput(H.doFrame("/track morale +1"));
TK_onInput(H.doFrame("/track morale +1"));
H.assert(/morale: high/.test(state.vars.GK.notes.TK), "band edit bites on the next pass");

// --- Mana: visible-but-off preset; casting costs either way; regen drift ------------
H.turn(50, "do"); H.resetCaches();
TK_onInput(H.doFrame("You study the runes"));
H.assert(/Mana: 0/.test(SC_get("Trackers Config").entry), "Mana line ships on the card, off by default");
H.assert(!state.vars.TK.trackers.mana, "Mana off = no tracker");
SC_get("Trackers Config").entry = SC_get("Trackers Config").entry.replace("Mana: 0", "Mana: 100");
ruling(51, "You hurl a firebolt", "skill=spellcasting; difficulty=major; check=success; resource=mana -10;");
H.assert(state.vars.TK.trackers.mana.val === 90, "casting cost arrives via the ruling's resource field");
ruling(52, "You misfire a ward", "skill=sorcery; difficulty=major; check=fail; resource=mana -10;");
H.assert(state.vars.TK.trackers.mana.val === 80, "failed casting still charges (the model reported the spend)");
ruling(53, "You swing a sword", "skill=combat; difficulty=minor; check=fail;");
H.assert(state.vars.TK.trackers.mana.val === 80, "no resource report, no charge");
const manaBefore = state.vars.TK.trackers.mana.val;
for (let t = 54; t < 62; t++) plain(t);
H.assert(state.vars.TK.trackers.mana.val === manaBefore + 5, "mana trickles back (+5 per 8 actions)");
SC_get("Trackers Config").entry = SC_get("Trackers Config").entry.replace("Mana: 100", "Mana: 0");

// --- The Cost (v0.2): caps, both directions, no difficulty gate ---------------------
SC_get("Trackers Config").entry = SC_get("Trackers Config").entry.replace("Stamina: 0", "Stamina: 100");
ruling(70, "You jog along the road", "skill=running; difficulty=trivial; check=success; resource=stamina -6;");
H.assert(state.vars.TK.trackers.stamina.val === 94, "trivial actions may charge (owner ruling 2)");
ruling(71, "You leap to the moon", "skill=leaping; difficulty=impossible; check=fail; resource=stamina -6;");
H.assert(state.vars.TK.trackers.stamina.val === 88, "impossible attempts charge too (flailing tires you)");
ruling(72, "You sprint for a day", "skill=running; difficulty=major; check=success; resource=stamina -90;");
H.assert(state.vars.TK.trackers.stamina.val === 63, "spends clamp to 25% of max per turn");
ruling(73, "You catch your second wind", "skill=none; difficulty=trivial; check=success; resource=stamina +50;");
H.assert(state.vars.TK.trackers.stamina.val === 88, "restores clamp to 25% too (bidirectional cap)");
ruling(74, "You channel chakra", "skill=focus; difficulty=minor; check=success; resource=chakra -5;");
H.assert(/unknown resource from ruling: chakra/.test(SC_get("Event Log").entry), "unknown resource reported, never thrown");
TK_onOutput("same-turn replay");
H.assert(state.vars.TK.trackers.stamina.val === 88, "one charge per action (retry-guarded)");

// --- The Wound (v0.2): tiers, anchoring, highest-wins, retry ------------------------
SC_get("Trackers Config").entry = SC_get("Trackers Config").entry.replace("Health: 0", "Health: 100");
H.turn(75, "do"); H.resetCaches();
GK_onInput(H.doFrame("/track health +100"));
TK_onInput(H.doFrame("/track health +100"));
H.assert(state.vars.TK.trackers.health.val === 100, "health reset for the wound battery");
plain(76); TK_onOutput("A stray dart grazes your arm as you duck away.");
H.assert(state.vars.TK.trackers.health.val === 97, "light wound: -3%");
plain(77); TK_onOutput("The ogre crushes your shoulder with a bellowing roar.");
H.assert(state.vars.TK.trackers.health.val === 67, "severe wound: -30%");
plain(78); TK_onOutput("The blade slashes Mara's arm open, and she screams.");
H.assert(state.vars.TK.trackers.health.val === 67, "NPC wounds never bleed onto your bar (second-person anchor)");
plain(79); TK_onOutput("Shrapnel grazes your cheek as the spike impales your thigh.");
H.assert(state.vars.TK.trackers.health.val === 47, "multi-hit output: highest tier wins, once (-20%)");
TK_onOutput("Shrapnel grazes your cheek as the spike impales your thigh.");
H.assert(state.vars.TK.trackers.health.val === 47, "one wound per action (retry-guarded)");

// --- Narrative healing (v0.2, ruling 4b) --------------------------------------------
plain(80); TK_onOutput("The medic bandages your arm with practiced hands.");
H.assert(state.vars.TK.trackers.health.val === 59, "moderate heal: +12%");
H.assert(/healed moderate: "bandages your/.test(SC_get("Event Log").entry), "heal evidence posted");
plain(81); TK_onOutput("Warmth spreads through you as the priest finishes her prayer.");
H.assert(state.vars.TK.trackers.health.val === 84, "major heal: +25%");

// --- Recovery verbs (rulings 5+6) ---------------------------------------------------
H.turn(82, "do"); H.resetCaches();
GK_onInput(H.doFrame("/rest"));
const restStub = TK_onInput(H.doFrame("/rest"));
H.assert(restStub === "You rest for a while.", "/rest returns a narratable stub");
H.assert(state.vars.GK.commandTurn === 82, "verbs are bookkeeping (Check yields)");
H.assert(state.vars.TK.trackers.stamina.val === 100, "/rest: Stamina +50% (clamped at full)");
H.assert(state.vars.TK.trackers.health.val === 94, "/rest: Health +10% (rest heals some — ruling 6)");
H.turn(83, "do"); H.resetCaches();
GK_onInput(H.doFrame("/sleep"));
TK_onInput(H.doFrame("/sleep"));
H.assert(state.vars.TK.trackers.health.val === 100, "/sleep: the long rest tops Health toward full (+25%)");
H.turn(84, "do"); H.resetCaches();
GK_onInput(H.doFrame("/meditate"));
const medStub = TK_onInput(H.doFrame("/meditate"));
H.assert(medStub === "You settle into meditation, reaching for your center.", "/meditate survives as a narratable stub (v0.3.2)");
H.assert(state.vars.GK.commandTurn !== 84, "/meditate is JUDGED — no bookkeeping stamp; mana arrives by ruling");
H.assert(TK_onInput(H.doFrame("/eat")) === H.doFrame("/eat"), "/eat is no longer TrackerKit's — passes through untouched (unified consumption)");
SC_get("Trackers Config").entry = SC_get("Trackers Config").entry.replace("Health: 100", "Health: 0").replace("Stamina: 100", "Stamina: 0");

// --- TK_apply: the public write seam (v0.2.1, EventKit D3) --------------------------
SC_get("Trackers Config").entry += "\n- Grit: start=100, range=0-100";
H.turn(200, "do"); H.resetCaches();
TK_onInput(H.doFrame("You trudge on"));
let ap = TK_apply("grit", -55, "event: forced-march");
H.assert(ap === -55 && state.vars.TK.trackers.grit.val === 45,
    "TK_apply moves a tracker whole — 55% in one hit, no 25% cap (the fifty-stories ruling)");
H.assert(/Grit 100→45 \(event: forced-march\)/.test(SC_get("Event Log").entry), "apply posts evidence with cause");
H.assert(/grit/i.test(state.vars.GK.notes.TK), "apply refreshes the arbiter note in place");
ap = TK_apply("grit", -999, "event: the fall");
H.assert(ap === -45 && state.vars.TK.trackers.grit.val === 0,
    "range-clamp only: the floor stops it; return reports actual movement");
H.assert(TK_apply("grit", -5, "event: again") === 0, "apply at the floor moves nothing and returns 0");
ap = TK_apply("grit", 20, "event: a second wind");
H.assert(ap === 20 && state.vars.TK.trackers.grit.val === 20, "applies restore as readily as harm");
H.assert(TK_apply("karma", -10, "event: hubris") === 0
    && /apply skipped: no tracker "karma"/.test(SC_get("Event Log").entry),
    "unknown tracker: reported and skipped, never thrown");
H.assert(TK_apply("grit", 0.4, "event: rounding dust") === 0, "sub-integer deltas round to nothing");

// --- the no-target report still lives (rest targets all disabled here) ----------------
H.turn(299, "do"); H.resetCaches();
GK_onInput(H.doFrame("/rest"));
TK_onInput(H.doFrame("/rest"));
H.assert(/\/rest: no enabled tracker/.test(SC_get("Event Log").entry), "verb with no enabled target reports instead of throwing");

// --- v0.3.0: preset maxima scale with SK_level (the Growth) ---------------------------
global.SK_level = function () { return 5; };            // +20%
SC_get("Trackers Config").entry = SC_get("Trackers Config").entry.replace("Health: 0", "Health: 100");
H.turn(300, "do"); H.resetCaches();
TK_onInput(H.doFrame("You stretch"));
H.assert(/- Health: \d+\/120/.test(SC_get("Trackers").entry), "preset max scales +5%/level (level 5: 100 → 120)");
H.assert(/Grit: \d+\/100/.test(SC_get("Trackers").entry), "custom trackers never scale (creator ranges are creator-owned)");
state.vars.TK.trackers.health.val = 120;
H.turn(301, "do"); H.resetCaches();
TK_onInput(H.doFrame("You fight"));
TK_onOutput("The brute slams his club into your ribs and you reel.");
H.assert(state.vars.TK.trackers.health.val === 106, "wound tiers ride the effective max (strong: 12% of 120 = 14)");
global.SK_level = function () { return 1; };
H.turn(302, "do"); H.resetCaches();
TK_onInput(H.doFrame("You breathe"));
H.assert(/- Health: \d+\/100/.test(SC_get("Trackers").entry) && state.vars.TK.trackers.health.val <= 100,
    "level 1 returns the base; persisted values clamp into the smaller range");
delete global.SK_level;

// --- Rule 7: passthrough always ------------------------------------------------------
H.assert(TK_onOutput("Plain story text.") === "Plain story text.", "TK_onOutput is a passthrough");

H.summary("TrackerKit");
