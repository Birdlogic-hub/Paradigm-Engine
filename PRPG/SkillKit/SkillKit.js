// ===== SkillKit v0.2.2 =====
// v0.2.2 — SK_rank(name) public seam (the Observatory, 8/12/2026): the
//  effective (floored) rank held for one skill, as the arbiter sees it.
//  ObserverKit is the first consumer; read-only, never throws.
// v0.2.1 — Level MIGRATES to the Character Sheet (owner directive): when
//  SheetKit is present the Skills card drops its Level header + Attributes
//  line (the Sheet owns them); both return if the Sheet is absent.
//  SK_level()/SK_epithet()/SK_attributes stay the public seams the Sheet
//  consumes.
// v0.2.0 — the GROWTH (proposal resolved 7/21 via the Kaspersky pass):
//  LEVEL is what all your skills already add up to — derived, never stored:
//  1 + floor(total contested uses / 25), cap 20 (the d20 the system rolls).
//  One stored number (levelSeen) guards announce-once; dips (eviction) are
//  silent. Channels: TrackerKit consumes SK_level() to scale preset maxima;
//  the arbiter hears the EPITHET (FD's intensityTier combed to eight,
//  "a green adventurer" → "a living legend") prepending the note — never
//  the number. ATTRIBUTE FLOORS (§5 ruling: (b) NOW, creator-defined only):
//  config custom lines — "- Strong: rank=Intermediate, skills=climbing/
//  lifting/melee" — as DERIVATION CLAMPS: rank = max(earned, floor).
//  Live-editable, reversible, Level-neutral (floors never add uses; you can
//  be born Strong — you level by living). Floored skills surface on card
//  and note from Turn 1; lift buckets key on the EFFECTIVE (floored) rank
//  the arbiter actually saw.
// v0.1.5 — the OBVIOUS ladder (owner pacing call, 7/21): thresholds are
//  round numbers a player can hold in their head — 0/1/10/25/50/100/250/
//  1000 (was .../60/150/400/1000). Apprentice 10 and Intermediate 25
//  anchored by the owner; Advanced 50 his call; Expert/Master extrapolated
//  on the doubling cadence; Legendary stays the lifetime mark.
// v0.1.4 — card taxonomy (CardLib v0.4.2, owner directive 7/21): Skills
//  banners as Gameplay, SkillKit Config as Settings. No behavior change.
// v0.1.3 — the WALL rises (owner pacing call, 7/16): thresholds rescaled
//  around Novice→Apprentice = 10 uses. With doubt-teaches active, ranks now
//  price in real adversity: ~5 contested successes to Apprentice, Legendary
//  a lifetime mark. The ladder lives in ONE constant below — pacing is a
//  number, not a mechanic.
// v0.1.2 — DOUBT TEACHES (live-found 7/16: "Inventory Management: Novice"
//  from two /take stubs): only minor and major rulings accrue. Trivial and
//  impossible outcomes are deterministic — they measure action frequency,
//  not skill, enable grinding, and pollute the lift table with guaranteed
//  results that dilute the rank-separation signal. Same boundary as luck:
//  skills grow only where the outcome was in doubt.
// v0.1.1: Show Progress — the Skills card may carry numeric progress
//  toward the next rank ("Apprentice (4/8)"). PLAYER-facing only: the
//  card never enters context and the arbiter note stays ranks-only, so
//  semantic-primary is untouched (proposal §1 amended accordingly).
// (né ParaSkills — renamed 7/15/2026, engine Kit convention)
// script by bottledfox
//
// PRPG extension module: THE SKILL.
// The engine remembers what you're good at; the model judges what that's
// worth. GateKit's arbiter has named the skill behind every ruling since
// v0.3 (skill= in the verdict line); SkillKit is the consumer that field
// was always meant to feed: it tallies rulings into per-skill familiarity,
// projects familiarity as SEMANTIC RANKS (Untrained → Legendary), and shows
// those ranks to the arbiter through GateKit's note seam (GK_setArbiterNote,
// GateKit v0.7.1). Influence is SEMANTIC-PRIMARY (proposal §2): ranks enter
// the arbiter's context; luck stays pure chance; GK_setLuck stays reserved
// for fortune-benders. No classes, no XP tables, no stat engine.
// Design proposal:
//   Documentation/Design Proposals/SkillKit (the Skill) - Design Proposal.md
//
// WIRING (extends the Essentials chain; SkillKit has NO input/context pass):
//   Output tab:   text = GK_onOutput(text);      // verdict captured first
//                 text = INV_onOutput(text);
//                 text = SK_onOutput(text);      // LAST: tally the settled ruling
//
// DEPENDS ON: GateKit (the ruling + the note seam) — without it the Skills
// card is static (floor ranks still project, no accrual). CardLib optional
// (state-only tallies without it). Model omits skill= → no tally that turn,
// nothing breaks (rule 7).
//
// TELEMETRY (the §2 falsifier): every tally also records the outcome keyed
// by the rank HELD AT ATTEMPT — the lift table. `Stats: true` renders it on
// the Skills card; its audience is the TESTER (the arbiter note never
// carries stats). The proposal sketches {s, f}; GateKit's schema has carried
// `partial` since v0.4, so the table stores {s, f, p} — partials tally as
// attempts (+1), never as successes (+2).
//
// EVICTION note: at Max Skills the least-used skill OTHER THAN the one just
// tallied is evicted (fresh interest beats an abandoned skill — a strict
// least-used rule would evict every new skill at birth). Tie: oldest tally.

const SK_SETTINGS = {
    ENABLED: true,              // the module; LIVE — card edits apply next action
    PROGRESSION: true,          // accrual on/off (ranks freeze when false)
    STARTING_SKILLS: "(none)",  // floor, applied once per skill: Climbing=Intermediate, ...
    MAX_SKILLS: 12,             // tracked-skill cap (least-used evicted, reported)
    REPORT: true,               // rank-ups + evictions to the Event Log
    SHOW_PROGRESS: true,        // numeric progress toward next rank on the Skills card (player-only)
    STATS: false                // lift table on the Skills card (tester channel)
};

// uses → rank. Thresholds are cumulative uses; success counts double
// (doing teaches; succeeding teaches more).
const SK_RANKS = [
    ["Untrained", 0], ["Novice", 1], ["Apprentice", 10], ["Intermediate", 25],
    ["Advanced", 50], ["Expert", 100], ["Master", 250], ["Legendary", 1000]
];
const SK_NOTE_CAP = 160;
const SK_NOTE_OWNER = "SK";

// Load canary
try {
    if (typeof log === "function") log("[SkillKit] library loaded (v0.2.2)");
} catch (e) {}

// Live settings. Uncached on purpose: SkillKit runs once per turn (one
// output pass), so a per-hook cache buys nothing.
function SK_cfg() {
    if (typeof SC_config === "function") {
        try {
            return SC_config("SkillKit Config", SK_SETTINGS, {
                description: "Settings for SkillKit (the Skill). Skills grow from doing: "
                    + "every GateKit ruling tallies its skill. Starting Skills is a floor, "
                    + "applied once per named skill (Climbing=Intermediate, ...). Ranks are "
                    + "semantic — the arbiter sees them; luck stays pure chance. Stats "
                    + "shows the telemetry lift table on the Skills card."
            });
        } catch (e) {}
    }
    return Object.assign({}, SK_SETTINGS);
}

// --- State (schema-migrating) --------------------------------------------------
function SK_state() {
    if (!state.vars || typeof state.vars !== "object") state.vars = {};
    if (!state.vars.SK || typeof state.vars.SK !== "object") state.vars.SK = {};
    const SK = state.vars.SK;
    if (!SK.skills || typeof SK.skills !== "object") SK.skills = {};
    if (!SK.floor || typeof SK.floor !== "object") SK.floor = {};
    if (typeof SK.tallyTurn !== "number") SK.tallyTurn = -1;
    if (typeof SK.noteTurn !== "number") SK.noteTurn = -1;
    if (typeof SK.levelSeen !== "number") SK.levelSeen = 1;
    return SK;
}

function SK_turn() {
    return (info && typeof info.actionCount === "number") ? info.actionCount : -1;
}

// Parse-side canonicalization: lowercase, trim, punctuation strip, collapsed
// spaces. First-seen name becomes canonical; the arbiter NOTE is the prompt-
// side canonicalizer (the model reuses names it can see), this catches the rest.
function SK_canon(name) {
    return String(name || "").toLowerCase()
        .replace(/[^a-z0-9 \-']/g, " ")
        .replace(/\s+/g, " ")
        .trim().slice(0, 30);
}

// Ranks are DERIVED, never stored.
function SK_rankFor(uses) {
    let rank = SK_RANKS[0][0];
    for (let i = 0; i < SK_RANKS.length; i++) {
        if (uses >= SK_RANKS[i][1]) rank = SK_RANKS[i][0];
    }
    return rank;
}

function SK_usesFor(rankName) {
    const want = String(rankName || "").trim().toLowerCase();
    for (let i = 0; i < SK_RANKS.length; i++) {
        if (SK_RANKS[i][0].toLowerCase() === want) return SK_RANKS[i][1];
    }
    return 0;
}

// Uses required for the NEXT rank, or 0 at the ladder's top.
function SK_nextThreshold(uses) {
    for (let i = 0; i < SK_RANKS.length; i++) {
        if (uses < SK_RANKS[i][1]) return SK_RANKS[i][1];
    }
    return 0;
}

// --- the Growth (v0.2.0) ---------------------------------------------------------
// Level: derived, never stored. Total = every contested tally there is.
const SK_LEVEL_WALL = 25;
const SK_LEVEL_CAP = 20;
const SK_EPITHETS = [
    [20, "a living legend"], [18, "a renowned adventurer"], [15, "an elite adventurer"],
    [12, "a veteran adventurer"], [9, "a seasoned adventurer"], [6, "a capable adventurer"],
    [3, "a tested adventurer"], [1, "a green adventurer"]
];

function SK_total() {
    const SK = SK_state();
    let t = 0;
    for (const n in SK.skills) t += (SK.skills[n].uses || 0);
    return t;
}

// Public seam — TrackerKit scales preset maxima on this.
function SK_level() {
    return Math.min(SK_LEVEL_CAP, 1 + Math.floor(SK_total() / SK_LEVEL_WALL));
}

// Public seam — the Character Sheet's spoken rank; the note's prefix.
function SK_epithet() {
    const lv = SK_level();
    for (let i = 0; i < SK_EPITHETS.length; i++) {
        if (lv >= SK_EPITHETS[i][0]) return SK_EPITHETS[i][1];
    }
    return SK_EPITHETS[SK_EPITHETS.length - 1][1];
}

function SK_complain(cfg, line) {
    if (cfg.REPORT && typeof SC_report === "function") {
        try { SC_report("SkillKit", "skipped malformed line: \"" + String(line).slice(0, 60) + "\""); } catch (e) {}
    }
}

// Attribute floors (v0.2.0): creator-defined custom lines on the config card.
// "- Strong: rank=Intermediate, skills=climbing/lifting/melee" — a floor is a
// derivation clamp, not a grant: max(earned, floor), Level-neutral, reversible.
function SK_attributes(cfg) {
    const out = { floors: {}, names: [] };
    if (typeof SC_get !== "function") return out;
    const card = SC_get("SkillKit Config");
    if (!card) return out;
    const lines = String(card.entry || "").split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!/^-\s/.test(line)) continue;
        const body = line.replace(/^-\s*/, "");
        const colon = body.indexOf(":");
        if (colon === -1) { SK_complain(cfg, body); continue; }
        const attr = body.slice(0, colon).trim();
        let rank = "", skills = [];
        const parts = body.slice(colon + 1).split(",");
        for (let j = 0; j < parts.length; j++) {
            const m = parts[j].trim().match(/^(rank|skills)\s*[=:]\s*(.+)$/i);
            if (!m) continue;
            if (m[1].toLowerCase() === "rank") rank = m[2].trim();
            else skills = m[2].split("/").map(SK_canon).filter(Boolean);
        }
        if (!attr || !rank || !skills.length) { SK_complain(cfg, body); continue; }
        const floorUses = SK_usesFor(rank);
        if (!floorUses && rank.toLowerCase() !== "untrained") {
            SK_complain(cfg, body + " (unknown rank \"" + rank + "\")"); continue;
        }
        out.names.push(attr);
        for (let j = 0; j < skills.length; j++) {
            out.floors[skills[j]] = Math.max(out.floors[skills[j]] || 0, floorUses);
        }
    }
    return out;
}

// name -> effective uses (earned clamped up by any floor), tracked ∪ floored.
function SK_effective(attrs) {
    const SK = SK_state();
    const eff = {};
    for (const n in SK.skills) eff[n] = Math.max(SK.skills[n].uses || 0, attrs.floors[n] || 0);
    for (const n in attrs.floors) if (!(n in eff)) eff[n] = attrs.floors[n];
    return eff;
}

// Public seam (v0.2.2, the Observatory): the EFFECTIVE rank currently held
// for one skill — earned uses clamped up by any attribute/starting floor,
// exactly the rank the arbiter is shown. Unknown or absent skills read
// "Untrained"; never throws.
function SK_rank(name) {
    try {
        const k = String(name || "").trim().toLowerCase();
        if (!k) return SK_RANKS[0][0];
        const attrs = SK_attributes(SK_cfg());
        const rec = SK_state().skills[k];
        return SK_rankFor(Math.max(rec ? (rec.uses || 0) : 0, attrs.floors[k] || 0));
    } catch (e) { return SK_RANKS[0][0]; }
}

function SK_record(name) {
    const SK = SK_state();
    if (!SK.skills[name] || typeof SK.skills[name] !== "object") {
        SK.skills[name] = { uses: 0, tallyTurn: -1, lift: {} };
    }
    const r = SK.skills[name];
    if (typeof r.uses !== "number") r.uses = 0;
    if (typeof r.tallyTurn !== "number") r.tallyTurn = -1;
    if (!r.lift || typeof r.lift !== "object") r.lift = {};
    return r;
}

// Display casing for card lines: "dragon lore" → "Dragon Lore".
function SK_pretty(name) {
    return String(name).replace(/(^|[\s\-'])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
}

// Starting Skills floor (sanctioned card→code direction, config card only):
// "Climbing=Intermediate, Stealth=Novice" — rank-equivalent uses granted
// ONCE per named skill, on first sight. The Skills projection is never
// parsed back.
function SK_applyFloor(cfg) {
    const raw = String(cfg.STARTING_SKILLS || "").trim();
    if (raw === "" || /^\(.*\)$/.test(raw) || /^none$/i.test(raw)) return false;
    const SK = SK_state();
    let changed = false;
    const parts = (typeof RX_csv === "function") ? RX_csv(raw) : String(raw).split(",");
    for (let i = 0; i < parts.length; i++) {
        let kv = null;
        if (typeof RX_keyValue === "function") kv = RX_keyValue(parts[i]);
        if (!kv) {
            const m = String(parts[i]).match(/^\s*(.+?)\s*[=:]\s*(.+?)\s*$/);
            kv = m ? { key: m[1], value: m[2] } : null;
        }
        if (!kv) continue;
        const name = SK_canon(kv.key);
        if (!name || SK.floor[name]) continue;
        SK.floor[name] = true;
        const floorUses = SK_usesFor(kv.value);
        const rec = SK_record(name);
        if (rec.uses < floorUses) { rec.uses = floorUses; changed = true; }
    }
    return changed;
}

// Cap enforcement: evict the least-used skill other than `keep` (see the
// eviction note in the header). Lift telemetry leaves with its skill.
function SK_evict(cfg, keep) {
    const SK = SK_state();
    const cap = Math.max(1, Math.round(cfg.MAX_SKILLS));
    // Loop: a LIVE cap reduction (card edit mid-game) may demand several
    // evictions in one pass, not just the marginal one.
    for (let guard = 0; guard < 100; guard++) {
        const names = Object.keys(SK.skills);
        if (names.length <= cap) return;
        let victim = null;
        for (let i = 0; i < names.length; i++) {
            const n = names[i];
            if (n === keep && names.length > 1) continue;
            if (victim === null
                || SK.skills[n].uses < SK.skills[victim].uses
                || (SK.skills[n].uses === SK.skills[victim].uses
                    && SK.skills[n].tallyTurn < SK.skills[victim].tallyTurn)) {
                victim = n;
            }
        }
        if (victim === null) return;
        delete SK.skills[victim];
        if (cfg.REPORT && typeof SC_report === "function") {
            try { SC_report("SkillKit", victim + " forgotten (Max Skills cap)"); } catch (e) {}
        }
    }
}

// The arbiter note: ranks only, most practiced first, hard 160-char cap
// (GateKit caps again — belt and braces). Doubles as the canonicalizer.
function SK_refreshNote(attrs) {
    if (typeof GK_setArbiterNote !== "function") return;
    const a = attrs || SK_attributes(SK_cfg());
    const eff = SK_effective(a);
    const names = Object.keys(eff).sort(function (x, y) {
        return eff[y] - eff[x] || x.localeCompare(y);
    });
    // v0.2.0: the epithet speaks first — the arbiter hears the phrase, never the number.
    const head = "player (" + SK_epithet() + ") skills —";
    const tail = " (unlisted skills: untrained)";
    const parts = [];
    let len = head.length + tail.length;
    for (let i = 0; i < names.length; i++) {
        const rank = SK_rankFor(eff[names[i]]).toLowerCase();
        if (rank === "untrained") continue;
        const piece = (parts.length ? "; " : " ") + names[i] + ": " + rank;
        if (len + piece.length > SK_NOTE_CAP) break;
        parts.push(piece);
        len += piece.length;
    }
    if (!parts.length) { GK_setArbiterNote(SK_NOTE_OWNER, head + tail); SK_state().noteTurn = SK_turn(); return; }
    GK_setArbiterNote(SK_NOTE_OWNER, head + parts.join("") + tail);
    SK_state().noteTurn = SK_turn();
}

// The Skills card (projection, never parsed back). Stats: true appends the
// lift table — the one sanctioned place numbers surface (audience: tester).
function SK_renderCard(cfg, attrs) {
    if (typeof SC_render !== "function") return;
    const SK = SK_state();
    const a = attrs || SK_attributes(cfg);
    const eff = SK_effective(a);
    const names = Object.keys(eff).sort(function (x, y) {
        return eff[y] - eff[x] || x.localeCompare(y);
    });
    const lines = [];
    for (let i = 0; i < names.length; i++) {
        const uses = (SK.skills[names[i]] ? SK.skills[names[i]].uses : 0) || 0;
        const fl = a.floors[names[i]] || 0;
        let line = "- " + SK_pretty(names[i]) + ": " + SK_rankFor(eff[names[i]]);
        if (cfg.SHOW_PROGRESS) {
            if (fl > uses) line += " (" + uses + " earned)";      // floored: earned shown honestly
            else {
                const next = SK_nextThreshold(uses);
                line += next ? " (" + uses + "/" + next + ")" : " (" + uses + ")";
            }
        }
        lines.push(line);
    }
    // v0.2.0 header; v0.2.1: MIGRATED to the Character Sheet when present.
    let head = "";
    if (typeof CS_onOutput !== "function") {
        const lv = SK_level();
        head = "Level " + lv + " (" + SK_epithet() + ")";
        if (lv < SK_LEVEL_CAP) {
            head += " — " + (SK_total() - (lv - 1) * SK_LEVEL_WALL) + "/" + SK_LEVEL_WALL + " toward " + (lv + 1);
        }
        if (a.names.length) head += "\nAttributes: " + a.names.join(", ");
        head += "\n";
    }
    let entry = "## Skills\n" + head
        + (lines.length ? lines.join("\n") : "- (none yet — skills grow from doing)");
    if (cfg.STATS) {
        const stats = [];
        for (let i = 0; i < names.length; i++) {
            if (!SK.skills[names[i]]) continue;      // floored-untracked: no lift yet (v0.2.0)
            const lift = SK.skills[names[i]].lift || {};
            const ranks = Object.keys(lift);
            for (let j = 0; j < ranks.length; j++) {
                const b = lift[ranks[j]];
                const total = (b.s || 0) + (b.f || 0) + (b.p || 0);
                stats.push("- " + SK_pretty(names[i]) + " @ " + SK_pretty(ranks[j]) + ": "
                    + (b.s || 0) + "/" + total + (b.p ? " (" + b.p + " partial)" : ""));
            }
        }
        if (stats.length) entry += "\n\n## Lift (telemetry)\n" + stats.join("\n");
    }
    SC_render("Skills", entry, { type: SC_TYPE_GAMEPLAY, keys: "Skills" });
}

// --- Output pass: tally the settled ruling ---------------------------------------
// Wired LAST, after GK_onOutput (the ruling must be settled). One tally per
// actionCount — retries replay, never re-tally (SIS's double-mutation lesson).
// Erase rewinds are accepted as untracked (counters can't un-count).
function SK_onOutput(text) {
    const out = String(text || "");
    try {
        const cfg = SK_cfg();                     // rule 11: config card materializes first pass
        if (!cfg.ENABLED) return out;
        const SK = SK_state();
        const attrs = SK_attributes(cfg);              // v0.2.0: floors, parsed once per pass
        let changed = SK_applyFloor(cfg);
        const turn = SK_turn();
        if (cfg.PROGRESSION && typeof GK_lastCheck === "function" && SK.tallyTurn !== turn) {
            let c = null;
            try { c = GK_lastCheck(); } catch (e) {}
            // Doubt teaches: only luck-swayed difficulties accrue (v0.1.2).
            if (c && c.turn === turn && c.skill
                && (c.difficulty === "minor" || c.difficulty === "major")) {
                const name = SK_canon(c.skill);
                if (name) {
                    SK.tallyTurn = turn;
                    const rec = SK_record(name);
                    const fl = attrs.floors[name] || 0;      // v0.2.0: the arbiter saw the FLOORED rank
                    const before = SK_rankFor(Math.max(rec.uses, fl));
                    const heldRank = before.toLowerCase();   // effective rank HELD AT ATTEMPT (lift key)
                    rec.uses += (c.result === "success") ? 2 : 1;
                    rec.tallyTurn = turn;
                    const bucket = rec.lift[heldRank] || (rec.lift[heldRank] = { s: 0, f: 0, p: 0 });
                    if (c.result === "success") bucket.s++;
                    else if (c.result === "partial") bucket.p++;
                    else bucket.f++;
                    changed = true;
                    const after = SK_rankFor(Math.max(rec.uses, fl));
                    if (after !== before && cfg.REPORT && typeof SC_report === "function") {
                        try { SC_report("SkillKit", name + ": " + before + " → " + after); } catch (e) {}
                    }
                    SK_evict(cfg, name);
                }
            }
        }
        // v0.2.0: the Level announce — once per level, dips (eviction) silent.
        const lv = SK_level();
        if (lv > SK.levelSeen) {
            if (cfg.REPORT && typeof SC_report === "function") {
                try { SC_report("SkillKit", "Level " + SK.levelSeen + " → " + lv + " (" + SK_epithet() + ")"); } catch (e) {}
            }
            SK.levelSeen = lv;
        } else if (lv < SK.levelSeen) SK.levelSeen = lv;
        SK_refreshNote(attrs);                         // every pass: floors + level are live
        SK_renderCard(cfg, attrs);
        if (cfg.REPORT && typeof SC_reportEnsure === "function") SC_reportEnsure();
    } catch (e) {}
    return out;
}
