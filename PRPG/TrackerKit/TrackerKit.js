// ===== TrackerKit v0.5.0 =====
// v0.5.0 — the LOCK (the Reckoning, owner ruling 9/8/2026 — the hard-lock
//  option, overruling the narrative-only lean): the MODEL ends the story,
//  the ENGINE keeps it ended. Health reaching its floor sets TK.dead at the
//  OUTPUT pass — after the arbiter has already written the ominous ending,
//  so the death scene is never pre-empted — and the lock bites from the
//  next turn: input refuses commands and yields the Check, output is
//  replaced by the terminal line. Deliberately NOT `stop: true` (platform
//  research 8/12: returning stop produces player-facing errors); rewriting
//  both ends is a harder lock with no error surface.
//  THE ONLY WAY BACK IS ERASE — and it costs nothing: TK.dead lives in
//  state.vars, so RewindKit restores it with everything else. Death is
//  final unless the story itself is rewound.
//  `Death Lock: false` restores the narrative-only behaviour (the original
//  lean, preserved as an option). Seam: TK_isDead().
// v0.4.0 — the WOUND REREAD (proposal + veto pass, all leans, 8/13/2026):
//  the parser stops asking "does a damage verb sit near you and a body part"
//  and starts asking "what KIND of statement is this, and did it happen?"
//  TWO FRAMES with their own ladders — PAIN consulted first and claims the
//  line (most-specific wins), tiered by how the pain READS and capped at
//  strong; then the ASSAULT ladder unchanged. Plus the IRREALIS GUARD: a
//  candidate whose CLAUSE says the blow was prevented, hypothetical, evaded
//  or still coming is vetoed and reported, never applied. New public seam
//  TK_lastWound() feeds ObserverKit v0.1.2, so the next iteration argues
//  from live rates instead of 22 invented sentences. Coverage frames
//  (knockback, collapse, vocal, gesture, stumble, asphyxiation) stay OUT —
//  a separate, evidence-gated wave by owner ruling.
// v0.3.2 — UNIFIED CONSUMPTION (owner ruling 7/21): /eat, /drink, and the
//  deterministic /meditate RETIRE — the flat restores were free-lunch
//  buttons, and "GateKit can handle 'you eat' better than TrackerKit."
//  InventoryKit v0.2.0 owns /eat <item> and /drink <item> (remove +
//  adjudicated efficacy). /meditate survives as a narratable stub that is
//  NOT bookkeeping — the turn is judged and mana arrives via the ruling's
//  resource field. /rest and /sleep stay deterministic BECAUSE the resource
//  field carries one resource per turn (multi-resource field is the logged
//  condition that would unify them; the Reckoning may also want a say).
// v0.3.1 — the Sheet's read seam: TK_readGauges() exposes the gauges as
//  data (name, value, effective max, band, pinned event) for renderers;
//  when SheetKit is present the Trackers card RETIRES (removed, per owner
//  ruling — the card evolves into the Character Sheet) and returns if the
//  Sheet is ever absent (rule 7 both directions). Note + Event Log
//  channels unchanged — the note is telemetry, the Sheet is register.
// v0.3.0 — the GROWTH consumption (proposal §D2, resolved 7/21): preset
//  maxima scale with Player Level — effective max = base × (1 + 5% ×
//  (SK_level() − 1)), rounded. The config number stays the BASE (card→code
//  direction untouched); gauges double by Level 20; wound/drift percentages
//  ride the effective max so a wound tier FEELS constant while the pool
//  deepens. Custom trackers never scale (creator ranges are creator-owned).
//  No SkillKit → bases as-is (rule 7).
// v0.2.3 — the card tells the truth (live-found 7/21, owner review of the
//  Trackers Config card): header now says the numbers are MAXIMUMS; NOTES
//  rewritten to v0.2 physics (the old text still claimed combat-family
//  Health coupling and Stamina drift, both removed in the Rework) and
//  flags Doom as an example, not a built-in. Rides CardLib v0.4.3's
//  description heal so live adventures get the corrected docs next turn.
// v0.2.2 — card taxonomy (CardLib v0.4.2, owner directive 7/21): Trackers
//  banners as Gameplay, Trackers Config as Settings. No behavior change.
// v0.2.1 — TK_APPLY, the public write seam (EventKit proposal D3, owner
//  rulings 7/21): scripter-deterministic deltas from other modules land
//  through one audited door — range-clamp ONLY, no 25% per-turn cap (the
//  cap guards MODEL-reported values; scripter values are deliberate:
//  "how else would the player fall fifty stories to their death?").
//  Evidence rides TK_move's existing report; unknown/disabled trackers
//  are reported and skipped (returns 0, never throws); the arbiter note
//  refreshes in place so it reads truth regardless of caller position.
//  Retry-guarding is the CALLER'S duty (a caller may legitimately apply
//  several deltas in one turn).
// v0.2.0 — the GAUGE REWORKED (proposal + owner rulings, 7/16): different
//  resources have different physics. Health is the WOUND — narrative prose
//  parsing, five severity tiers combed from FD's detectHurt (the owner's
//  prior art), second-person anchored, highest tier wins, evidence logged;
//  plus three-tier narrative HEALING (an NPC binds your wounds). Stamina
//  and Mana are the COST — GateKit v0.8.0's bidirectional resource= field,
//  clamped to 25% of max per turn, drains and restores both (/use item
//  efficacy rides this: InventoryKit consumes, the ruling reports).
//  Hunger keeps the CLOCK (drift). Recovery verbs: /rest /sleep /eat
//  /drink /meditate (hardcoded effects, bookkeeping turns). Stamina's
//  v0.1.1 drift is REMOVED (the cost channel replaces the clock for
//  effort); Health's check-coupling is REMOVED (wounds come from prose,
//  not rulings). Cost has NO difficulty gate (owner ruling: trivial and
//  impossible may charge — cost is the action's price, not a consequence
//  of doubt; the doubt boundary still governs custom on-fail/on-success).
// v0.1.1 — PRESETS BUILT IN (owner call, 7/16: user-friendliness over
//  granular customization): Health, Stamina, Hunger ship as defaults. The
//  config card carries them as plain settings — one number is the max
//  (start = full), 0 disables. Preset internals scale with the max (combat
//  damage ~10%, drift ticks ~5%) and stay deliberately GENTLE — difficulty
//  tuning is deferred until the core mechanics integrate. A custom
//  '- Name:' line OVERRIDES its preset by name (the advanced path).
//  Also: live config edits clamp persisted values into the new range, and
//  the note refreshes every pass (edits bite immediately).
// script by bottledfox
//
// PRPG-hosted module (designed in the PWorld proposal; pulled forward
// 7/16/2026 — modules are standalone by rule, packages are just bundles):
// THE GAUGE.
// The creator names what matters; the engine moves it deterministically; the
// model is told where it stands. ResourceKit dissolved into this module the
// day its build slot arrived (PWorld proposal §8): Health, Stamina, and
// Hunger were always Gauge presets — three config lines, not a module.
// Design: Documentation/Design Proposals/PWorld (StateKit + TrackerKit) - Design Proposal.md (§3)
//
// THE decision — deterministic movement only. Gauges move by exactly three
// sources: COMMANDS (/track morale +1), DRIFT (drift=-1/8 — one point per
// eight adjudicated actions), and CHECK-COUPLING (on-fail=combat -1 — the
// settled ruling's skill= and result matched against the tracker's rule).
// The model influences a gauge only through the Check it already rules on.
//
// Tracker lines live in the "Trackers Config" card (creator-owned data,
// live edits bite; only VALUES persist in state):
//   - Morale: start=6, range=0-10, bands=routed/shaky/steady/bold, on-fail=combat -1
//   - Doom: start=0, range=0-6, on-fail=any +1, high=Doomsday
//   - Rations: start=10, range=0-20, drift=-1/8, low=Starving
// Options: start= range=lo-hi bands=a/b/c/d drift=±n/actions on-fail=skills ±n
//          on-success=skills ±n low=Event high=Event note=false
//
// WIRING (per the proposal's integration contract):
//   Input tab:    text = TK_onInput(text);      // after GK_onInput: /track
//   Output tab:   text = TK_onOutput(text);     // LAST: drift + check-coupling
//
// DEPENDS ON: CardLib (config + projection; state-only without it), GateKit
// (check-coupling + arbiter note; cards still project without it), RegexLib
// (/track parsing; command inert without it). Rule 7 everywhere: malformed
// lines are skipped with an Event Log complaint, never a throw.
//
// SPEC DEVIATION (documented): drift counts ALL player actions, not only
// adjudicated ones — the proposal's "adjudicated actions" would require
// reading GateKit's private command-turn stamp, which the public-seam
// contract forbids. Plain turns are also more player-legible ("every 8
// actions"). A public turn-class seam can refine this later.

const TK_NOTE_OWNER = "TK";
const TK_NOTE_CAP = 160;
const TK_SETTINGS = {
    ENABLED: true, REPORT: true, HEALTH: 100, STAMINA: 100, HUNGER: 100, MANA: 0,
    DEATH_LOCK: true,   // the Lock (v0.5.0): a dead adventure refuses further turns
    DEATH_MESSAGE: "Your story has ended. Erase this turn to step back into the moment before."
};

// Load canary
try {
    if (typeof log === "function") log("[TrackerKit] library loaded (v0.5.0)");
} catch (e) {}

// --- The WOUND (v0.4.0, the Wound Reread): TWO FRAMES, each with its ladder --------
// Proposal: Documentation/Design Proposals/The Wound Reread - Design Proposal.md
// (veto pass 8/13/2026, all leans). Research: Documentation/Architecture/
// Wound Parsing - Research Findings.md — lineage TAS (Yi1i1i) → FD → here.
//
// PRECEDENCE: the PAIN frame is consulted FIRST and claims the line. It is the
// more specific reading (it needs a pain anchor), and the failure always ran one
// way: pain prose misread as a blade ("piercing throb" → a 12% stab wound, live
// 7/21). Most-specific-frame-wins is RegexLib's longest-first, one layer up.
//
// THE PAIN LADDER: tiered by how the pain READS, not by any verb — TAS's
// adjective ladder. Pain reports CAP AT STRONG: great/severe are structural
// destruction, which prose states as a blow and the assault frame catches in the
// turn it happens; letting a symptom reach 30% double-charges one injury.
// Blade-homonyms (piercing, shooting, stabbing, splitting, tearing) are
// deliberately ABSENT from the ladder: inside a pain frame they do adjectival
// work on their anchor ("a piercing throb" is a sharp twinge, not a puncture),
// and admitting them re-imports the confusion the frame exists to remove.
const TK_PAIN_STRONG ="agonizing|agonising|excruciating|unbearable|blinding|blistering|extreme|gnawing|gripping|horrible|intense|radiating|tremendous|white-hot|explodes|exploding|blossoms|bursts|screams|screaming";
const TK_PAIN_MODERATE = "burning|burns|searing|sears|sharp|hot|fierce|deep|flares|flaring|pulses|pulsing|biting";
const TK_PAIN_ANCHOR = "pain|ache|aches|aching|throb|throbs|throbbing|sting|stings|stinging|agony|pang|pangs|soreness|sore";
// Built on first use: the shapes need TK_BODY, which is declared below with the
// assault frame (keeping each frame's block whole reads better than hoisting one
// string). Cached — the regexes are constant.
var TK_PAIN_SHAPES_CACHE = null;
function TK_painShapes() {
    if (TK_PAIN_SHAPES_CACHE) return TK_PAIN_SHAPES_CACHE;
    TK_PAIN_SHAPES_CACHE = [
        // "you feel a searing pain" — the sensation frame (v0.2's light rule, absorbed)
        new RegExp("\\byou(?:\\s+\\w+){0,3}\\s+feel(?:\\s+\\w+){0,5}\\s+(?:" + TK_PAIN_ANCHOR + "|bruised)\\b", "i"),
        // "pain explodes through your ribs" · "a piercing throb in your temple"
        new RegExp("\\b(?:" + TK_PAIN_ANCHOR + ")\\b(?:\\s+\\w+){0,5}\\s+(?:in|through|along|across|down|up|behind|inside)\\s+your\\b(?:\\s+\\w+){0,2}\\s*(?:" + TK_BODY + ")\\b", "i"),
        // "your shoulder throbs" — the body-part-as-subject frame
        new RegExp("\\byour\\s+(?:\\w+\\s+){0,2}(?:" + TK_BODY + ")(?:\\s+\\w+){0,3}\\s+(?:" + TK_PAIN_ANCHOR + "|burn|burns|burning|scream|screams|screaming)\\b", "i"),
        // "the pain is unbearable" · "a piercing throb builds" — pain as subject
        // (TAS's shape, widened to the indefinite article: second person implied,
        // and the live 7/21 incident opens "A piercing throb…")
        new RegExp("\\b(?:the|a|an)\\s+(?:\\w+\\s+){0,3}(?:" + TK_PAIN_ANCHOR + ")\\b(?:\\s+\\w+){0,4}", "i")
    ];
    return TK_PAIN_SHAPES_CACHE;
}
// Someone ELSE's pain is not ours (the fourth shape carries no you-anchor).
const TK_PAIN_THIRD = /\b(?:'s|s'|its|their|his|her)\s+(?:pain|agony|ache)\b/i;

// THE IRREALIS GUARD: damage the prose says did NOT happen — prevented,
// hypothetical, evaded, still coming. Live probe (8/13): "you raise your shield
// before the club can crush your skull" and "your armor absorbs the blow that
// would have shattered your ribs" each took 30% of max Health. Scoped to the
// matched span's CLAUSE, not its sentence: "the troll missed twice, then its
// club crushed your ribs" must still wound (verified fixture).
const TK_IRREALIS = new RegExp(
    "\\b(?:would|could|might|should)(?:'ve|\\s+have)\\b"
    + "|\\bhad\\s+it\\s+not\\b|\\bif\\b"
    + "|\\b(?:nearly|narrowly|almost|barely)\\b"
    + "|\\b(?:miss|misses|missed|avoid|avoids|avoided|dodge|dodges|dodged|evade|evades|evaded|sidestep|sidesteps|sidestepped)\\b"
    + "|\\b(?:block|blocks|blocked|deflect|deflects|deflected|absorb|absorbs|absorbed|parry|parries|parried|shield|shields|shielded|catches|turns\\s+aside)\\b"
    + "|\\b(?:glances|bounces|skitters|skips)\\s+off\\b"
    + "|\\b(?:about|threatens|threatening|ready|moves|moving|aims|aiming|prepares|preparing)\\s+to\\b"
    + "|\\b(?:does|did|do)\\s+not\\b|\\b(?:doesn't|didn't|don't|never)\\b"
    + "|\\bbefore\\b(?:\\s+\\w+){0,6}\\s+(?:can|could|would)\\b", "i");

function TK_clauseAround(text, index, len) {
    let s = index, e = index + len;
    while (s > 0 && ".!?,;:\n—".indexOf(text.charAt(s - 1)) === -1) s--;
    while (e < text.length && ".!?,;:\n—".indexOf(text.charAt(e)) === -1) e++;
    return text.slice(s, e);
}

function TK_painTier(span) {
    if (new RegExp("\\b(?:" + TK_PAIN_STRONG + ")\\b", "i").test(span)) return { name: "strong", pct: 12 };
    if (new RegExp("\\b(?:" + TK_PAIN_MODERATE + ")\\b", "i").test(span)) return { name: "moderate", pct: 6 };
    return { name: "light", pct: 3 };
}

// Read the narrative once: pain frame first, then the assault ladder. Each
// candidate is irrealis-guarded before it can win; a vetoed candidate does not
// stop the scan (a prevented blow may still be followed by a real scrape).
// Returns {frame, tier, pct, span} | {veto:true, ...} | null.
function TK_readWound(out) {
    let firstVeto = null;
    const consider = function (frame, span, index, tier) {
        const clause = TK_clauseAround(out, index, span.length);
        if (TK_IRREALIS.test(clause)) {
            if (!firstVeto) firstVeto = { frame: frame, tier: tier.name, pct: 0, span: span, veto: true };
            return null;
        }
        return { frame: frame, tier: tier.name, pct: tier.pct, span: span, veto: false };
    };
    const shapes = TK_painShapes();
    for (let i = 0; i < shapes.length; i++) {
        const m = out.match(shapes[i]);
        if (!m) continue;
        if (i === 3 && TK_PAIN_THIRD.test(TK_clauseAround(out, m.index, m[0].length))) continue;
        const hit = consider("pain", m[0], m.index, TK_painTier(m[0]));
        if (hit) return hit;
    }
    for (let wi = 0; wi < TK_WOUND_TIERS.length; wi++) {
        const tier = TK_WOUND_TIERS[wi];
        for (let ri = 0; ri < tier.rx.length; ri++) {
            const m = out.match(tier.rx[ri]);
            if (!m) continue;
            const hit = consider("assault", m[0], m.index, tier);
            if (hit) return hit;
        }
    }
    return firstVeto;
}

// Public seam (the Observatory): what the reread decided this turn.
// --- The LOCK (v0.5.0) --------------------------------------------------------------
// Public seam: has the story ended? {turn, gauge} or null. Never throws.
function TK_isDead() {
    try { const d = TK_state().dead; return (d && typeof d === "object") ? d : null; } catch (e) { return null; }
}

function TK_lockOn(cfg) {
    const v = (cfg && typeof cfg.DEATH_LOCK !== "undefined") ? cfg.DEATH_LOCK : true;
    return !(v === false || String(v).toLowerCase() === "false");
}

function TK_lastWound() {
    try { const w = TK_state().lastWound; return (w && typeof w === "object") ? w : null; } catch (e) { return null; }
}

// --- The ASSAULT frame: severity tiers combed from FD's detectHurt ------------------
const TK_BODY = "arm|arms|back|body|cheek|chest|chin|ear|eye|eyes|face|finger|fingers|flesh|foot|forearm|forehead|gut|hand|hands|head|hip|jaw|knee|leg|legs|lip|mouth|neck|nose|rib|ribs|scalp|shin|shoulder|shoulders|side|skin|skull|spine|stomach|temple|thigh|throat|torso|waist|wrist";
function TK_hurtRx(verbs) {
    return new RegExp("\\b(?:" + verbs + ")(?:\\s+\\w+){0,3}\\s+(?:you|your)(?:\\s+\\w+){0,5}\\s+(?:" + TK_BODY + ")\\b", "i");
}
const TK_WOUND_TIERS = [
    { name: "severe", pct: 30, rx: [TK_hurtRx("crush|crushes|crushed|crushing|shatter|shatters|shattered|shattering|rupture|ruptures|ruptured|obliterate|obliterates|obliterated|demolish|demolishes|demolished|devastate|devastates|devastated")] },
    { name: "great", pct: 20, rx: [TK_hurtRx("blast|blasts|blasted|blasting|explode|explodes|exploded|fracture|fractures|fractured|impale|impales|impaled|impaling|rip|rips|ripped|ripping|shred|shreds|shredded|shredding|tears? into|tearing into|tore|torn")] },
    { name: "strong", pct: 12, rx: [TK_hurtRx("batter|batters|battered|battering|pierce|pierces|pierced|piercing|slam|slams|slammed|slamming|slice|slices|sliced|slicing|slash|slashes|slashed|slashing|shoot|shoots|shooting|shot|gash|gashes|gashed")] },
    { name: "moderate", pct: 6, rx: [TK_hurtRx("bite|bites|biting|bit|burn|burns|burned|burning|hit|hits|hitting|jab|jabs|jabbed|jabbing|knock|knocks|knocked|knocking|sear|sears|seared|searing|shock|shocks|shocked|shocking|strike|strikes|striking|struck|whack|whacks|whacked|whacking")] },
    { name: "light", pct: 3, rx: [
        TK_hurtRx("bump|bumps|bumped|bumping|bruise|bruises|bruised|bruising|graze|grazes|grazed|grazing|nick|nicks|nicked|scrape|scrapes|scraped|scraping|sting|stings|stinging|stung|singe|singes|singed"),
        new RegExp("\\byou(?:\\s+\\w+){0,3}\\s+feel(?:\\s+\\w+){0,5}\\s+(?:ache|aching|bruised|sting|stinging|throb|throbbing)\\b", "i")
    ] }
];
// --- Narrative HEALING (owner ruling 4b): someone treats YOU -----------------------
const TK_HEAL_TIERS = [
    { name: "major", pct: 25, rx: [
        new RegExp("\\b(?:heal|heals|healed|healing|cure|cures|cured|restore|restores|restored|regenerate|regenerates|regenerated)(?:\\s+\\w+){0,3}\\s+(?:you\\b|your\\b)", "i"),
        new RegExp("\\b(?:warmth|relief|healing light|soothing energy)(?:\\s+\\w+){0,3}\\s+(?:spreads|washes|flows|courses)(?:\\s+\\w+){0,3}\\s+through\\s+(?:you|your)\\b", "i")
    ] },
    { name: "moderate", pct: 12, rx: [
        new RegExp("\\b(?:bandage|bandages|bandaged|bandaging|bind|binds|bound|patch|patches|patched|stitch|stitches|stitched|stitching|treat|treats|treated|mend|mends|mended)(?:\\s+\\w+){0,3}\\s+(?:you|your)\\b", "i"),
        new RegExp("\\byou\\s+feel(?:\\s+\\w+){0,3}\\s+(?:better|restored|mended|renewed|whole)\\b", "i")
    ] },
    { name: "minor", pct: 5, rx: [
        new RegExp("\\b(?:dab|dabs|dabbed|clean|cleans|cleaned|soothe|soothes|soothed|tend|tends|tended)(?:\\s+\\w+){0,3}\\s+(?:you|your)\\b", "i")
    ] }
];
// --- Recovery verbs (owner rulings 5+6): hardcoded percents of max ------------------
const TK_VERBS = {
    rest:     { stub: "You rest for a while.",    effects: { stamina: 50, health: 10, mana: 25 } },
    sleep:    { stub: "You sleep.",               effects: { stamina: 100, mana: 100, health: 25 } }
};  // eat/drink → InventoryKit v0.2.0; meditate → judged stub (v0.3.2)
const TK_COST_CAP_PCT = 25;   // per-turn clamp on model-reported deltas, each direction

function TK_state() {
    if (!state.vars || typeof state.vars !== "object") state.vars = {};
    if (!state.vars.TK || typeof state.vars.TK !== "object") state.vars.TK = {};
    const TK = state.vars.TK;
    if (!TK.trackers || typeof TK.trackers !== "object") TK.trackers = {};
    if (typeof TK.actions !== "number") TK.actions = 0;      // adjudicated-action clock for drift
    if (typeof TK.actionTurn !== "number") TK.actionTurn = -1; // retry guard for the clock
    if (typeof TK.moveTurn !== "number") TK.moveTurn = -1;   // retry guard for check-coupling
    if (typeof TK.costTurn !== "number") TK.costTurn = -1;   // one resource charge per action
    if (typeof TK.woundTurn !== "number") TK.woundTurn = -1; // one wound per action
    if (typeof TK.healTurn !== "number") TK.healTurn = -1;   // one narrative heal per action
    if (!TK.lastWound || typeof TK.lastWound !== "object") TK.lastWound = null;  // the reread's verdict (v0.4.0)
    if (!TK.dead || typeof TK.dead !== "object") TK.dead = null;                 // the Lock (v0.5.0)
    if (typeof TK.noteTurn !== "number") TK.noteTurn = -1;
    return TK;
}

function TK_turn() {
    return (info && typeof info.actionCount === "number") ? info.actionCount : -1;
}

function TK_cfg() {
    if (typeof SC_config === "function") {
        try {
            return SC_config("Trackers Config", TK_SETTINGS, {
                header: "# Trackers Config\n> Each number is a MAXIMUM — full at start; 0 turns a gauge off. Edit, then continue your story.",
                description: "TrackerKit (the Gauge). Health, Stamina, and Hunger are built in; Mana ships OFF — set Mana: 100 to enable it. Each number is the maximum (full at start; 0 disables). How gauges move: Health takes WOUNDS parsed from the story's own prose (severity tiers, evidence in the Event Log) and narrated healing; Stamina and Mana pay COSTS the ruling reports (resource=stamina -6), capped per turn; Hunger drifts down slowly; Mana regenerates slowly. Recovery verbs: /rest /sleep /eat /drink /meditate. Manual override: /track health +10. Advanced: add fully custom trackers one per line in the ENTRY — \"- Doom: start=0, range=0-6, on-fail=any +1, high=Doomsday\" is an EXAMPLE, not a built-in — options: start= range=lo-hi bands=a/b/c/d drift=±n/actions on-fail=skills ±n on-success=skills ±n low=Event high=Event note=false. A custom line named like a preset overrides it. Values clamp to range; malformed lines are skipped and reported."
            });
        } catch (e) {}
    }
    return Object.assign({}, TK_SETTINGS);
}

function TK_canon(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9 \-']/g, " ")
        .replace(/\s+/g, " ").trim().slice(0, 24);
}

function TK_pretty(name) {
    return String(name).replace(/(^|[\s\-'])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
}

// Parse tracker definitions from the Trackers Config card entry. Definitions
// are TRANSIENT (re-read every pass — live edits bite); only values persist.
// Built-in presets (v0.1.1). Internals scale with the configured max;
// gentle on purpose — difficulty is a later pass.
const TK_COMBAT_SKILLS = ["combat", "fighting", "melee", "brawling", "swordsmanship", "archery", "dodging", "defense"];
const TK_MAGIC_SKILLS = ["magic", "spellcasting", "casting", "sorcery", "arcana", "wizardry", "enchanting", "conjuration"];
function TK_preset(name, max) {
    const dmg = Math.max(1, Math.round(max / 10));
    const tick = Math.max(1, Math.round(max / 20));
    const def = { name: name, start: max, min: 0, max: max, bands: null,
        drift: null, rules: [], low: "", high: "", note: true, ok: true };
    if (name === "health") {
        def.bands = ["dying", "wounded", "hurt", "fine"];   // wounds come from PROSE (v0.2)
        def.low = "Down";
    } else if (name === "stamina") {
        def.low = "Exhausted";                              // effort comes from the COST field (v0.2)
    } else if (name === "hunger") {
        def.drift = { delta: -tick, per: 10 };
        def.low = "Starving";
    } else if (name === "mana") {
        // Casting costs arrive via the ruling's resource field (v0.2) —
        // check-rules removed to prevent double-charging. Regen stays.
        def.drift = { delta: tick, per: 8 };
        def.low = "Drained";
    }
    return def;
}

function TK_defs(cfg) {
    const defs = {};
    const presets = [["health", cfg.HEALTH], ["stamina", cfg.STAMINA], ["hunger", cfg.HUNGER], ["mana", cfg.MANA]];
    // v0.3.0 (the Growth): preset maxima scale +5%/level via SkillKit's public
    // seam — the creator's number stays the BASE; custom trackers NEVER scale.
    let lvMult = 1;
    if (typeof SK_level === "function") {
        try { lvMult = 1 + 0.05 * (SK_level() - 1); } catch (e) {}
    }
    for (let i = 0; i < presets.length; i++) {
        let max = Math.round(Number(presets[i][1]));
        if (Number.isFinite(max) && max > 0) {
            max = Math.max(1, Math.round(max * lvMult));
            defs[presets[i][0]] = TK_preset(presets[i][0], max);
        }
    }
    if (typeof SC_get !== "function") return defs;
    const card = SC_get("Trackers Config");
    if (!card) return defs;
    const lines = String(card.entry || "").split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!/^-\s/.test(line)) continue;
        const body = line.replace(/^-\s*/, "");
        const colon = body.indexOf(":");
        if (colon === -1) { TK_complain(cfg, body); continue; }
        const name = TK_canon(body.slice(0, colon));
        if (!name) { TK_complain(cfg, body); continue; }
        const def = { name: name, start: 0, min: 0, max: 10, bands: null,
            drift: null, rules: [], low: "", high: "", note: true, ok: true };
        const parts = (typeof RX_csv === "function") ? RX_csv(body.slice(colon + 1)) : body.slice(colon + 1).split(",");
        for (let j = 0; j < parts.length; j++) {
            const kv = (typeof RX_keyValue === "function") ? RX_keyValue(parts[j]) : null;
            if (!kv) continue;
            const k = kv.key.toLowerCase().replace(/\s+/g, "-");
            const v = kv.value.trim();
            if (k === "start") { def.start = parseInt(v, 10) || 0; }
            else if (k === "range") {
                const m = v.match(/^(-?\d+)\s*-\s*(-?\d+)$/);
                if (m) { def.min = parseInt(m[1], 10); def.max = parseInt(m[2], 10); }
                else def.ok = false;
            }
            else if (k === "bands") { def.bands = v.split("/").map(function (s) { return s.trim(); }).filter(Boolean); }
            else if (k === "drift") {
                const m = v.match(/^([+-]?\d+)\s*\/\s*(\d+)$/);
                if (m) def.drift = { delta: parseInt(m[1], 10), per: Math.max(1, parseInt(m[2], 10)) };
                else def.ok = false;
            }
            else if (k === "on-fail" || k === "on-success") {
                const m = v.match(/^(.*?)\s*([+-]\d+)$/);
                if (m) {
                    const skills = m[1].trim().toLowerCase();
                    def.rules.push({
                        when: (k === "on-fail") ? "fail" : "success",
                        skills: (skills === "" || skills === "any") ? null
                            : skills.split(/[\/|]/).map(function (s) { return TK_canon(s); }).filter(Boolean),
                        delta: parseInt(m[2], 10)
                    });
                } else def.ok = false;
            }
            else if (k === "low") { def.low = v; }
            else if (k === "high") { def.high = v; }
            else if (k === "note") { def.note = !/^(false|off|no|0)$/i.test(v); }
        }
        if (def.max < def.min) def.ok = false;
        if (!def.ok) { TK_complain(cfg, body); continue; }
        defs[name] = def;
    }
    return defs;
}

function TK_complain(cfg, line) {
    if (cfg.REPORT && typeof SC_report === "function") {
        try { SC_report("Trackers", "skipped malformed line: \"" + String(line).slice(0, 60) + "\""); } catch (e) {}
    }
}

function TK_rec(def) {
    const TK = TK_state();
    if (!TK.trackers[def.name] || typeof TK.trackers[def.name] !== "object") {
        TK.trackers[def.name] = { val: TK_clampDef(def, def.start), driftAt: TK.actions, fired: "" };
    }
    const r = TK.trackers[def.name];
    if (typeof r.val !== "number") r.val = TK_clampDef(def, def.start);
    r.val = TK_clampDef(def, r.val);   // live range edits clamp persisted values
    if (typeof r.driftAt !== "number") r.driftAt = TK.actions;
    if (typeof r.fired !== "string") r.fired = "";
    return r;
}

function TK_clampDef(def, v) {
    return Math.max(def.min, Math.min(def.max, Math.round(v)));
}

function TK_band(def, val) {
    if (!def.bands || !def.bands.length) return null;
    const span = (def.max - def.min + 1) / def.bands.length;
    const idx = Math.min(def.bands.length - 1, Math.floor((val - def.min) / span));
    return def.bands[idx];
}

// Move a gauge with cause; clamps, reports, fires thresholds once per pinning.
function TK_move(cfg, def, delta, cause) {
    const r = TK_rec(def);
    const before = r.val;
    r.val = TK_clampDef(def, r.val + delta);
    if (r.val === before) return false;
    if (cfg.REPORT && typeof SC_report === "function") {
        try { SC_report("Trackers", TK_pretty(def.name) + " " + before + "→" + r.val + (cause ? " (" + cause + ")" : "")); } catch (e) {}
    }
    // Threshold events: fire on ARRIVAL at a bound, once per pinning.
    let event = "";
    if (r.val === def.min && def.low) event = def.low;
    else if (r.val === def.max && def.high) event = def.high;
    if (event && r.fired !== event) {
        r.fired = event;
        if (typeof SC_report === "function") {
            try { SC_report("Trackers", TK_pretty(def.name) + ": " + event.toUpperCase()); } catch (e) {}
        }
    } else if (!event) {
        r.fired = "";
    }
    return true;
}

// Public write seam (v0.2.1): other modules move a gauge deterministically.
// Range-clamp only — no 25% cap. Returns the delta actually applied.
function TK_apply(name, delta, cause) {
    try {
        const cfg = TK_cfg();
        if (!cfg.ENABLED) return 0;
        const defs = TK_defs(cfg);
        const canon = TK_canon(name);
        const def = canon ? defs[canon] : null;
        if (!def || !def.ok) {
            if (cfg.REPORT && typeof SC_report === "function") {
                try { SC_report("Trackers", "apply skipped: no tracker \"" + String(name).slice(0, 30) + "\"" + (cause ? " (" + cause + ")" : "")); } catch (e) {}
            }
            return 0;
        }
        const d = Math.round(Number(delta));
        if (!Number.isFinite(d) || d === 0) return 0;
        const before = TK_rec(def).val;
        TK_move(cfg, def, d, cause || "applied");
        const applied = TK_rec(def).val - before;
        if (applied !== 0) TK_refreshNote(cfg, defs);
        return applied;
    } catch (e) { return 0; }
}

// The arbiter note: banded gauges speak labels; unbanded speak numbers
// ("4 of 6" when a high= cap gives the count meaning). Threshold events
// replace the reading while pinned. note=false hides a tracker entirely.
function TK_refreshNote(cfg, defs) {
    if (typeof GK_setArbiterNote !== "function") return;
    const names = Object.keys(defs);
    const parts = [];
    let len = "trackers —".length;
    for (let i = 0; i < names.length; i++) {
        const def = defs[names[i]];
        if (!def.note) continue;
        const r = TK_rec(def);
        let reading;
        if (r.fired) reading = r.fired.toUpperCase();
        else {
            const band = TK_band(def, r.val);
            reading = band ? band : (def.high ? (r.val + " of " + def.max) : String(r.val));
        }
        const piece = (parts.length ? "; " : " ") + def.name + ": " + reading;
        if (len + piece.length > TK_NOTE_CAP) break;
        parts.push(piece); len += piece.length;
    }
    if (!parts.length) { GK_setArbiterNote(TK_NOTE_OWNER, ""); return; }
    GK_setArbiterNote(TK_NOTE_OWNER, "trackers —" + parts.join(""));
    TK_state().noteTurn = TK_turn();
}

// The Trackers card (projection, never parsed back): value, band, bounds.
// v0.3.1 (the Sheet): public read seam — the gauges as data, for renderers.
function TK_readGauges() {
    const out = [];
    try {
        const cfg = TK_cfg();
        if (!cfg.ENABLED) return out;
        const defs = TK_defs(cfg);
        for (const name in defs) {
            const def = defs[name];
            if (!def.ok) continue;
            const r = TK_rec(def);
            out.push({ name: name, pretty: TK_pretty(name), val: r.val, min: def.min,
                max: def.max, band: TK_band(def, r.val), event: r.fired || "" });
        }
    } catch (e) {}
    return out;
}

function TK_renderCard(defs) {
    // v0.3.1: the Trackers card retires when the Sheet is present (owner ruling).
    if (typeof CS_onOutput === "function") {
        try { if (typeof SC_remove === "function") SC_remove("Trackers"); } catch (e) {}
        return;
    }
    if (typeof SC_render !== "function") return;
    const names = Object.keys(defs);
    const lines = [];
    for (let i = 0; i < names.length; i++) {
        const def = defs[names[i]];
        const r = TK_rec(def);
        const band = TK_band(def, r.val);
        lines.push("- " + TK_pretty(def.name) + ": " + r.val + "/" + def.max
            + (band ? " (" + band + ")" : "") + (r.fired ? " — " + r.fired.toUpperCase() : ""));
    }
    SC_render("Trackers", "## Trackers\n" + (lines.length ? lines.join("\n") : "- (none configured — add lines to Trackers Config)"),
        { type: SC_TYPE_GAMEPLAY, keys: "Trackers" });
}

// --- Input pass: /track command (bookkeeping; the Check yields) -------------------
function TK_onInput(text) {
    const t = String(text || "");
    try {
        const cfg = TK_cfg();                       // rule 11: config card materializes
        if (!cfg.ENABLED) return t;
        const defs = TK_defs(cfg);
        TK_renderCard(defs);                        // Trackers card materializes turn 1
        TK_refreshNote(cfg, defs);                  // note exists from turn 1; edits bite on input too
        if (cfg.REPORT && typeof SC_reportEnsure === "function") SC_reportEnsure();
        // The Lock (v0.5.0): a corpse takes no actions. Cards still render above —
        // the Sheet stays readable — but the turn is stamped bookkeeping so the
        // Check never adjudicates the dead, and the action itself is replaced.
        if (TK_isDead() && TK_lockOn(cfg)) {
            if (typeof GK_markCommandTurn === "function") { try { GK_markCommandTurn(); } catch (e) {} }
            return " ";
        }
        if (typeof RX_command !== "function") return t;
        const cmd = RX_command(t, ["track", "rest", "sleep", "meditate"]);
        if (!cmd) return t;
        // v0.3.2: /meditate is JUDGED — a narratable stub, no bookkeeping stamp,
        // no deterministic apply; the ruling reports what the trance restores.
        if (cmd.name === "meditate") return "You settle into meditation, reaching for your center.";
        if (typeof GK_markCommandTurn === "function") { try { GK_markCommandTurn(); } catch (e) {} }
        if (cmd.name === "track") {
            const m = cmd.args.match(/^(.*?)\s*([+-]\d+)\s*$/);
            const name = m ? TK_canon(m[1]) : "";
            if (m && name && defs[name]) {
                TK_move(cfg, defs[name], parseInt(m[2], 10), "/track");
            } else if (cfg.REPORT && typeof SC_report === "function") {
                try { SC_report("Trackers", "unknown tracker or bad amount: /track " + cmd.args); } catch (e) {}
            }
            TK_refreshNote(cfg, defs);
            TK_renderCard(defs);
            return " ";
        }
        // Recovery verbs: hardcoded effects on whichever targets are enabled.
        const verb = TK_VERBS[cmd.name];
        let touched = 0;
        for (const target in verb.effects) {
            if (!defs[target]) continue;
            const def = defs[target];
            const amt = Math.max(1, Math.round((def.max - def.min) * verb.effects[target] / 100));
            if (TK_move(cfg, def, amt, "/" + cmd.name)) touched++;
        }
        if (!touched && cfg.REPORT && typeof SC_report === "function") {
            try { SC_report("Trackers", "/" + cmd.name + ": no enabled tracker to affect (or already full)"); } catch (e) {}
        }
        TK_refreshNote(cfg, defs);
        TK_renderCard(defs);
        return verb.stub;                           // narratable stub, INV-style
    } catch (e) {}
    return t;
}

// --- Output pass: drift + check-coupling on the settled ruling --------------------
// Wired LAST. The action clock ticks once per actionCount (retry-guarded);
// drift applies per tracker from its own driftAt watermark; check-coupling
// reads GK_lastCheck() once per turn — doubt moves gauges, bookkeeping never
// does (command turns are yielded and carry no ruling).
function TK_onOutput(text) {
    let out = String(text || "");
    try {
        const cfg = TK_cfg();
        if (!cfg.ENABLED) return out;
        const TK = TK_state();
        const defs = TK_defs(cfg);
        const turn = TK_turn();
        let changed = false;

        // The Lock (v0.5.0), part one: if the story ALREADY ended before this
        // pass, replace the output and stop. Checked first so a corpse neither
        // drifts nor bleeds — and checked BEFORE the detection below, so the
        // turn that kills you still shows the arbiter's ominous ending.
        if (TK_isDead() && TK_lockOn(cfg)) {
            TK_renderCard(defs);
            return String(cfg.DEATH_MESSAGE || TK_SETTINGS.DEATH_MESSAGE);
        }
        if (turn !== -1 && TK.actionTurn !== turn) {
            TK.actionTurn = turn;
            TK.actions++;
        }
        // The COST (v0.2): apply the ruling's resource report. NO difficulty
        // gate (owner ruling: trivial and impossible may charge). Clamped to
        // ±25% of max per turn; unknown resources reported, never thrown.
        if (typeof GK_lastCheck === "function" && TK.costTurn !== turn) {
            let cc = null;
            try { cc = GK_lastCheck(); } catch (e) {}
            if (cc && cc.turn === turn && cc.resource && cc.resourceDelta) {
                TK.costTurn = turn;
                const rname = TK_canon(cc.resource);
                if (defs[rname]) {
                    const rdef = defs[rname];
                    const cap = Math.max(1, Math.round((rdef.max - rdef.min) * TK_COST_CAP_PCT / 100));
                    const d = Math.max(-cap, Math.min(cap, cc.resourceDelta));
                    if (TK_move(cfg, rdef, d, (d < 0 ? "cost" : "restore") + (cc.skill ? ": " + cc.skill : ""))) changed = true;
                } else if (cfg.REPORT && typeof SC_report === "function") {
                    try { SC_report("Trackers", "unknown resource from ruling: " + cc.resource); } catch (e) {}
                }
            }
        }
        // The WOUND (v0.4.0, the Wound Reread): pain frame first, then assault;
        // every candidate irrealis-guarded. One wound per action, evidence logged.
        if (defs.health && TK.woundTurn !== turn && out.trim() !== "") {
            const hit = TK_readWound(out);
            if (hit) {
                TK.woundTurn = turn;
                TK.lastWound = { frame: hit.frame, tier: hit.tier, pct: hit.pct,
                                 span: String(hit.span).slice(0, 60).trim(), veto: !!hit.veto, turn: turn };
                if (hit.veto) {
                    // The guard fired: say so. Silence is what hid every incident
                    // in the case law; an invisible veto is an invisible bug.
                    if (cfg.REPORT && typeof SC_report === "function") {
                        try { SC_report("Trackers", "no wound — the prose prevented it: \"" + String(hit.span).slice(0, 44).trim() + "\""); } catch (e) {}
                    }
                } else {
                    const dmg = Math.max(1, Math.round((defs.health.max - defs.health.min) * hit.pct / 100));
                    if (TK_move(cfg, defs.health, -dmg, hit.frame + "/" + hit.tier + ": \"" + String(hit.span).slice(0, 44).trim() + "\"")) changed = true;
                }
            }
        }
        // Narrative HEALING (v0.2, owner ruling 4b): someone treats you.
        if (defs.health && TK.healTurn !== turn && out.trim() !== "") {
            for (let hi = 0; hi < TK_HEAL_TIERS.length; hi++) {
                const tier = TK_HEAL_TIERS[hi];
                let hm = null;
                for (let ri = 0; ri < tier.rx.length && !hm; ri++) hm = out.match(tier.rx[ri]);
                if (!hm) continue;
                TK.healTurn = turn;
                const amt = Math.max(1, Math.round((defs.health.max - defs.health.min) * tier.pct / 100));
                if (TK_move(cfg, defs.health, amt, "healed " + tier.name + ": \"" + hm[0].slice(0, 44).trim() + "\"")) changed = true;
                break;
            }
        }
        // Drift: each tracker advances from its own watermark.
        const names = Object.keys(defs);
        for (let i = 0; i < names.length; i++) {
            const def = defs[names[i]];
            if (!def.drift) { TK_rec(def).driftAt = TK.actions; continue; }
            const r = TK_rec(def);
            while (TK.actions - r.driftAt >= def.drift.per) {
                r.driftAt += def.drift.per;
                if (TK_move(cfg, def, def.drift.delta, "drift")) changed = true;
            }
        }
        // Check-coupling: one settled ruling per turn, matched against rules.
        if (typeof GK_lastCheck === "function" && TK.moveTurn !== turn) {
            let c = null;
            try { c = GK_lastCheck(); } catch (e) {}
            // Doubt moves gauges (same boundary as SkillKit's accrual, same
            // reasoning): trivial and impossible rulings are certainties, not
            // events — no consequence flows from them.
            if (c && c.turn === turn && (c.result === "fail" || c.result === "success")
                && (c.difficulty === "minor" || c.difficulty === "major")) {
                TK.moveTurn = turn;
                const skill = c.skill ? TK_canon(c.skill) : null;
                for (let i = 0; i < names.length; i++) {
                    const def = defs[names[i]];
                    for (let j = 0; j < def.rules.length; j++) {
                        const rule = def.rules[j];
                        if (rule.when !== c.result) continue;
                        if (rule.skills && (!skill || rule.skills.indexOf(skill) === -1)) continue;
                        if (TK_move(cfg, def, rule.delta, c.result === "fail" ? ("failed: " + (skill || "check")) : ("succeeded: " + (skill || "check")))) changed = true;
                    }
                }
            }
        }
        // The Lock, part two: the story ends here. Detected AFTER every gauge has
        // settled and after the model's narration has already been written, so
        // this turn keeps its death scene; the lock bites from the next turn.
        if (!TK.dead && defs.health) {
            const hr = TK_rec(defs.health);
            if (hr.val <= defs.health.min) {
                TK.dead = { turn: turn, gauge: defs.health.name || "Health" };
                if (cfg.REPORT && typeof SC_report === "function") {
                    try { SC_report("Trackers", "the story ends here — " + TK.dead.gauge + " reached " + defs.health.min); } catch (e) {}
                }
            }
        }
        TK_refreshNote(cfg, defs);   // every pass: config edits bite immediately
        TK_renderCard(defs);
    } catch (e) {}
    return out;
}
