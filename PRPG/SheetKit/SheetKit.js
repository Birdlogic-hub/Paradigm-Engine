// ===== SheetKit v0.1.4 =====
// v0.1.4 (owner, 10/7, first FDE playtest): the Attributes line leaves the
//  Sheet (the Skills card's family lines already carry it); so does the
//  epithet ("a green adventurer" — it reaches the arbiter through SkillKit's
//  note, so on the Sheet it was a duplicate in context); and Level gains its
//  progress toward the next Level, in rank points (SkillKit v0.4.0's Skyrim
//  formula, read through SK_levelState) — numbers only (owner: a block-glyph
//  bar rendered as a smudge in AID's font):
//    Level 1 — 2/3 toward 2
//  Nothing at the cap. Without SK_levelState, the line is just "Level N".
//  FIX (live, 10/7): the Sheet's always-on trigger (".") is now HEALED every
//  render. A Sheet created first by someone else — a pre-made scenario card
//  with blank triggers, or FDE's turn-0 fill — kept its own keys, because
//  SC_ensure sets keys only on create, and the Sheet fell out of context.
// v0.1.3 — the RACK, on the Sheet (owner ruling, 8/10/2026): equipment gets
//  its own "## Equipment" SECTION at the foot of the engine block — the
//  visibility the owner first asked of the Inventory card (that version was
//  built and rolled back within the hour; the Sheet is the better home for
//  what's built — the Inventory card keeps its annotated one-list truth,
//  §7.9 stands). Header renders only when gear exists (ruling 5).
// v0.1.2 — the Tools line (the Loadout amendment §9, 8/10/2026): fifth gear
//  category renders as "Tools: ..." — same INV_readEquipment() pull, same
//  empty-renders-nothing rule (owner ruling 5).
// v0.1.1 — the GEAR BLOCK (the Loadout, 7/21): four category lines pulled
//  via INV_readEquipment() each pass (no cross-module card writes — /throw
//  an equipped dagger and both surfaces update next render). Empty
//  categories render nothing (owner ruling 5).
// v0.1.0 — the SHEET (proposal + owner veto pass resolved 7/21/2026):
//  the Trackers card evolves into one always-on "Character Sheet" — the
//  identity block PLAYER-AUTHORED (the config-card clause extended: the
//  card IS the storage; five fields ship blank — Name/Gender/Pronouns/
//  Appearance/Background — and extra player lines survive verbatim),
//  the engine block PROJECTION (Level + epithet + Attributes via SkillKit
//  seams, gauges via TK_readGauges). THE SEMANTIC LAYER (owner ruling):
//  numbers are not hidden from context — they are TRANSLATED: one line of
//  EB-Condition-card prose under each gauge, quartile-keyed with pinned-
//  threshold overrides. The rule line "-----" separates player's half
//  from engine's half; everything above it is theirs.
// Namespace: CS. Consumes public seams only: SC_render/SC_get (CardLib),
//  SK_level/SK_levelState (SkillKit), TK_readGauges
//  (TrackerKit v0.3.1). All optional — rule 7 throughout. TrackerKit and
//  SkillKit yield their card surfaces on `typeof CS_onOutput` presence.

const CS_TITLE = "Character Sheet";
const CS_FIELDS = ["Name", "Gender", "Pronouns", "Appearance", "Background"];
const CS_RULE = "-----";

if (typeof log === "function") log("[SheetKit] library loaded (v0.1.4)");

// The semantic layer: quartile phrases per preset, pinned overrides at the floor.
const CS_PHRASES = {
    health:  { pinned: "You are down.", q: ["You are at death's door.", "You are badly wounded.", "You're hurt, but moving.", "You are unhurt and steady."] },
    stamina: { pinned: "You are utterly spent.", q: ["Your limbs drag with fatigue.", "You're winded and slowing.", "You've broken a sweat.", "You feel fresh."] },
    hunger:  { pinned: "You are starving.", q: ["Hunger gnaws at you.", "Your stomach growls.", "You could eat.", "You are well fed."] },
    mana:    { pinned: "You are drained dry.", q: ["Your magic gutters low.", "Your reserves run thin.", "Your power hums, ready.", "Your magic sits full."] }
};

function CS_semantic(g) {
    const p = CS_PHRASES[g.name];
    if (g.event) {
        if (p && g.val === g.min) return p.pinned;
        return "Your " + g.pretty.toLowerCase() + " has reached " + String(g.event) + ".";
    }
    if (p) {
        const span = (g.max - g.min) || 1;
        const q = Math.max(0, Math.min(3, Math.floor(((g.val - g.min) / span) * 4)));
        return p.q[q];
    }
    if (g.band) return "Your " + g.pretty.toLowerCase() + " reads " + String(g.band).toLowerCase() + ".";
    return "";
}

// The player's half: everything above the rule line, header stripped,
// the five fields healed in (blank), extra lines preserved verbatim.
function CS_identityFrom(entry) {
    let lines = String(entry || "").split("\n");
    const idx = lines.indexOf(CS_RULE);
    if (idx !== -1) lines = lines.slice(0, idx);
    while (lines.length && /^#\s/.test(lines[0])) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    for (let i = 0; i < CS_FIELDS.length; i++) {
        const rx = new RegExp("^\\s*" + CS_FIELDS[i] + "\\s*:", "i");
        let found = false;
        for (let j = 0; j < lines.length; j++) if (rx.test(lines[j])) { found = true; break; }
        if (!found) lines.push(CS_FIELDS[i] + ":");
    }
    return lines;
}

function CS_render() {
    if (typeof SC_render !== "function" || typeof SC_get !== "function") return;
    const existing = SC_get(CS_TITLE);
    const identity = CS_identityFrom(existing ? existing.entry : "");
    const eng = [];
    if (typeof SK_level === "function") {
        try {
            let line = "Level " + SK_level();
            // v0.1.4: no epithet here — it reaches the arbiter through SkillKit's
            // note (in GateKit's block); on the Sheet it was a duplicate.
            // Progress toward the next Level (none at the cap)
            if (typeof SK_levelState === "function") {
                const ls = SK_levelState();
                if (ls.cost > 0) line += " — " + ls.into + "/" + ls.cost + " toward " + (ls.level + 1);
            }
            eng.push(line);
        } catch (e) {}
    }
    // The Rack (v0.1.3): gear as a dedicated section at the engine block's
    // foot, not lines lost among the stats. Empty renders nothing (ruling 5).
    const gear = [];
    if (typeof INV_readEquipment === "function") {
        try {
            const eq = INV_readEquipment();
            const byCat = {};
            for (let i = 0; i < eq.length; i++) (byCat[eq[i].slot] = byCat[eq[i].slot] || []).push(eq[i].name);
            const labels = { weapon: "Weapons", armor: "Armor", clothes: "Clothes", accessory: "Accessories", tool: "Tools" };
            const order = ["weapon", "armor", "clothes", "accessory", "tool"];
            for (let i = 0; i < order.length; i++) {
                if (byCat[order[i]] && byCat[order[i]].length) gear.push(labels[order[i]] + ": " + byCat[order[i]].join(", "));
            }
        } catch (e) {}
    }
    if (typeof TK_readGauges === "function") {
        try {
            const gs = TK_readGauges();
            for (let i = 0; i < gs.length; i++) {
                const g = gs[i];
                eng.push(g.pretty + ": " + g.val + "/" + g.max + (g.band ? " (" + g.band + ")" : ""));
                const sem = CS_semantic(g);
                if (sem) eng.push(sem);
            }
        } catch (e) {}
    }
    const entry = "# " + CS_TITLE + "\n" + identity.join("\n") + "\n\n" + CS_RULE
        + (eng.length ? "\n" + eng.join("\n") : "")
        + (gear.length ? "\n\n## Equipment\n" + gear.join("\n") : "");
    const always = (typeof SC_ALWAYS_ON !== "undefined") ? SC_ALWAYS_ON : ".";
    const card = SC_render(CS_TITLE, entry, {
        type: (typeof SC_TYPE_GAMEPLAY !== "undefined") ? SC_TYPE_GAMEPLAY : "Gameplay",
        keys: always
    });
    // v0.1.4: HEAL the trigger every render (InventoryKit's pattern). SC_ensure
    // sets keys only when it creates a card, so a Sheet made first by anyone
    // else — a scenario's pre-made card with blank triggers, or FDE's turn-0
    // fill — kept its own keys and fell out of context (live, 10/7).
    if (card && card.keys !== always) card.keys = always;
}

// Rule 11: the Sheet exists from Turn 1 (input pass); refreshed after the
// turn settles (output pass, wired after TK/EV so it renders truth).
function CS_onInput(text)  { try { CS_render(); } catch (e) {} return String(text || ""); }
function CS_onOutput(text) { try { CS_render(); } catch (e) {} return String(text || ""); }
