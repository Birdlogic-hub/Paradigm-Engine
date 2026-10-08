// SheetKit harness suite — the Sheet, built to the resolved proposal (7/21/2026).
const H = require("../../PE Essentials/test/harness");
H.fresh();
eval(H.load("RegexLib", "CardLib", "GateKit", "InventoryKit", "SkillKit", "TrackerKit", "SheetKit"));

function sheet() { return SC_get("Character Sheet"); }

// --- Rule 11 + the evolution: Sheet on Turn 1, Trackers card retired -----------------
H.turn(1, "do"); H.resetCaches();
TK_onInput(H.doFrame("You look around"));
CS_onInput(H.doFrame("You look around"));
H.assert(!!sheet(), "Character Sheet materializes on Turn 1");
H.assert(sheet().keys === SC_ALWAYS_ON, "always-on keys (owner ruling 2)");
sheet().keys = "Character Sheet";     // the live 10/7 bug: a Sheet created first by someone else, its own keys
CS_onInput("");
H.assert(sheet().keys === SC_ALWAYS_ON, "the always-on trigger is HEALED every render (SC_ensure sets keys only on create)");
sheet().keys = "";                    // a pre-made scenario Sheet with blank triggers
CS_onInput("");
H.assert(sheet().keys === SC_ALWAYS_ON, "…blank triggers included (the pre-made Sheet's 'the engine sets them' promise, kept)");
H.assert(sheet().type === "Gameplay", "Gameplay banner");
H.assert(!SC_get("Trackers"), "the Trackers card retires when the Sheet is present (owner ruling 5)");
for (const f of ["Name:", "Gender:", "Pronouns:", "Appearance:", "Background:"]) {
    H.assert(new RegExp("^" + f + "$", "m").test(sheet().entry), "blank field ships: " + f);
}
H.assert(/^Level 1 — 0\/3 toward 2$/m.test(sheet().entry), "Level line lives on the Sheet, with progress toward the next (v0.1.4)");
H.assert(!/adventurer|legend/.test(sheet().entry), "no epithet on the Sheet (v0.1.4) — SkillKit's arbiter note carries it");
H.assert(/^Health: 100\/100 \(fine\)\nYou are unhurt and steady\.$/m.test(sheet().entry),
    "gauge line + the semantic layer beneath it (owner ruling, §4.5)");
H.assert(/^Stamina: 100\/100\nYou feel fresh\.$/m.test(sheet().entry), "unbanded preset speaks its quartile phrase");

// --- The Skills card yields its header -----------------------------------------------
SK_onOutput("Plain narration.");
H.assert(!/Level /.test(SC_get("Skills").entry), "Skills card drops the Level header — migrated (owner directive)");

// --- Identity round-trip: the card is the storage ------------------------------------
sheet().entry = sheet().entry.replace("Name:", "Name: Kira").replace("Appearance:", "Appearance: Silver-eyed elf\nA scar crosses her left brow");
H.turn(2, "do"); H.resetCaches();
TK_onInput(H.doFrame("You press on"));
CS_onInput(H.doFrame("You press on"));
H.assert(/^Name: Kira$/m.test(sheet().entry), "filled value survives the re-render");
H.assert(/^A scar crosses her left brow$/m.test(sheet().entry), "extra identity lines survive verbatim (owner ruling 4)");
H.assert(/^Gender:$/m.test(sheet().entry), "blank stays blank — the engine never invents an identity");

// --- Engine block refreshes without touching identity --------------------------------
state.vars.SK.skills = { climbing: { uses: 75, tallyTurn: -1, lift: {} } };   // Intermediate earned: 1+2 = 3 points (rank − 1) → Level 2, 0/4 toward 3
state.vars.TK.trackers.health.val = 45;
CS_onOutput("The day wears on.");
H.assert(/^Name: Kira$/m.test(sheet().entry), "identity untouched by engine refresh");
H.assert(/^Level 2 — 0\/4 toward 3$/m.test(sheet().entry), "Level line and its progress track the ledger");
H.assert(/^Health: 45\/105 \(wounded\)\nYou are badly wounded\.$/m.test(sheet().entry),
    "wounded quartile speaks its phrase — and the max is 105: the Growth scaling composed in unasked");
TK_apply("health", -999, "test: the fall");            // ARRIVAL at the floor pins the event
CS_onOutput("Darkness closes in.");
H.assert(/^Health: 0\/105 \(dying\)\nYou are down\.$/m.test(sheet().entry), "pinned threshold overrides the quartile (Down)");
state.vars.TK.trackers.health.val = 80;

// --- Attributes line + custom trackers -----------------------------------------------
SC_get("SkillKit Config").entry += "\n- Strong: rank=Apprentice, skills=climbing";
SC_get("Trackers Config").entry += "\n- Morale: start=6, range=0-6, bands=shaken/wary/steady\n- Doom: start=0, range=0-6";
H.turn(3, "do"); H.resetCaches();
TK_onInput(H.doFrame("You march"));
CS_onOutput("The road unrolls.");
H.assert(!/^Attributes:/m.test(sheet().entry), "no Attributes line on the Sheet (v0.1.4) — the Skills card carries the families");
state.vars.SK.skills = { a: { uses: 1000, tallyTurn: -1, lift: {} } };
for (let i = 0; i < 10; i++) state.vars.SK.skills["b" + i] = { uses: 1000, tallyTurn: -1, lift: {} };   // 11 Legendary skills x 21 = 231 >= 228
CS_onOutput("Legend.");
H.assert(/^Level 20$/m.test(sheet().entry), "no bar at the cap");
SK_refreshNote();
H.assert(/^player \(a living legend\)/.test(state.vars.GK.notes.SK), "…while the epithet still reaches the arbiter through SkillKit's note");
state.vars.SK.skills = { climbing: { uses: 75, tallyTurn: -1, lift: {} } };
H.assert(/^Morale: 6\/6 \(steady\)\nYour morale reads steady\.$/m.test(sheet().entry), "banded custom speaks its band plainly");
H.assert(/^Doom: 0\/6$/m.test(sheet().entry) && !/Your doom/.test(sheet().entry), "unbanded custom stays numeric — no invented register");

// --- The rule line is the frontier ----------------------------------------------------
const playerHalf = sheet().entry.split("-----")[0];
H.assert(/Kira/.test(playerHalf) && !/Level 2/.test(playerHalf), "everything above the rule is the player's; the engine writes below it");
H.assert(CS_onOutput("Plain story text.") === "Plain story text.", "CS_onOutput is a passthrough");

// --- the gear block (v0.1.1): pulled from INV_readEquipment ----------------------------
INV_add("bronze dirk", 1); INV_add("hide vest", 1);
state.vars.INV.equip.weapon.push("bronze dirk");
state.vars.INV.equip.armor.push("hide vest");
CS_onOutput("The gear settles.");
H.assert(/^Weapons: bronze dirk$/m.test(sheet().entry) && /^Armor: hide vest$/m.test(sheet().entry),
    "gear block renders by category from the INV seam");
INV_add("rusty pick", 1);
state.vars.INV.equip.tool.push("rusty pick");
CS_onOutput("The pick hangs from your belt.");
H.assert(/^Tools: rusty pick$/m.test(sheet().entry), "the Tools line renders (v0.1.2, fifth category)");
H.assert(/^## Equipment$/m.test(sheet().entry) && /## Equipment\nWeapons: bronze dirk/.test(sheet().entry),
    "the Rack (v0.1.3): gear under its own ## Equipment section");
H.assert(!/^Clothes:/m.test(sheet().entry) && !/^Accessories:/m.test(sheet().entry), "empty categories render nothing (owner ruling 5)");
state.vars.INV.items = [];                       // the gear is gone from the world
CS_onOutput("Later.");
H.assert(!/^Weapons:/m.test(sheet().entry) && !/^Armor:/m.test(sheet().entry) && !/^Tools:/m.test(sheet().entry)
    && !/^## Equipment$/m.test(sheet().entry), "ghost gear vanishes from the Sheet, section header with it (ruling 5)");

H.summary("SheetKit");
