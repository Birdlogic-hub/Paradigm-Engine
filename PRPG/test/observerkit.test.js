// ObserverKit harness suite — the Record (the Observatory's collector),
// built to the resolved proposal + veto sheet (8/12/2026).
const H = require("../../PE Essentials/test/harness");
H.fresh();
eval(H.load("RegexLib", "CardLib", "GateKit", "SkillKit", "ObserverKit"));

// One full turn through the wired chain (input → context → output, OB placed
// exactly as the tabs place it: input LAST, context LAST, output right after GK).
function play(n, input, modelOut) {
    H.turn(n, "do"); H.resetCaches();
    let t = OB_onInput(GK_onInput(input));
    OB_onContext(GK_onContext(H.ctx()));
    let out = GK_onOutput(modelOut);
    out = OB_onOutput(out);
    out = SK_onOutput(out);
    return { t: t, out: out };
}

// --- Rule 11: card + ring exist from Turn 1 -------------------------------------------
H.turn(1, "do"); H.resetCaches();
OB_onInput(H.doFrame("You look around"));
H.assert(!!SC_get("Observer Config"), "Observer Config materializes on Turn 1");
H.assert(Array.isArray(state.vars.OB.ring) && state.vars.OB.ring.length === 0, "the ring exists, empty");

// --- A ruling becomes a record, fully fielded ------------------------------------------
let r = play(2, H.doFrame("You climb the wall"), "skill=climbing; difficulty=major; check=success; resource=stamina -6;\nUp you go, scraping knuckles.");
let rec = OB_ring()[OB_ring().length - 1];
H.assert(OB_ring().length === 1 && rec.t === 2 && rec.at === "do", "one adjudicated turn, one record");
H.assert(rec.sk === "climbing" && rec.d === "major" && rec.r === "success", "ruling fields captured");
H.assert(typeof rec.luck === "number" && rec.luck >= 1 && rec.luck <= 20, "the d20 rides the record");
H.assert(rec.res === "stamina" && rec.rd === -6, "the resource field rides the record");
H.assert(rec.dia === "skillFirst" && /^skill=climbing/i.test(rec.raw), "parse metadata: dialect + raw verdict line (GateKit v0.8.3)");
H.assert(rec.rank === "Untrained", "rank recorded via SK_rank — the FIRST attempt reads Untrained (held, pre-tally)");
H.assert(typeof rec.ch === "string" && rec.ch.length > 0 && rec.cl > 0, "context fingerprint joined from the context pass");
H.assert(/^Up you go/.test(rec.nh), "narration head captured post-strip");

// --- Rank is HELD AT ATTEMPT: a threshold-crossing success records the old rank --------
state.vars.SK.skills.climbing.uses = 9;                    // Novice, one success from Apprentice
r = play(3, H.doFrame("You climb the cliff"), "skill=climbing; difficulty=major; check=success;\nHigher.");
rec = OB_ring()[OB_ring().length - 1];
H.assert(rec.rank === "Novice" && SK_rank("climbing") === "Apprentice",
    "the record keys on the rank the arbiter SAW; SkillKit tallies after (wiring law)");

// --- The bare dialect names itself (GateKit v0.8.3) ------------------------------------
r = play(4, H.doFrame("You duck behind the crates"), "Stealth; minor; success; resource=none;\nYou vanish.");
rec = OB_ring()[OB_ring().length - 1];
H.assert(rec.dia === "bare" && rec.sk === "stealth", "bare dialect parsed AND labeled bare");

// --- Silence is a datum: judged turn, no verdict --------------------------------------
r = play(5, H.doFrame("You hum quietly"), "The tune drifts through the tower.");
rec = OB_ring()[OB_ring().length - 1];
H.assert(rec.t === 5 && rec.r === "NONE" && rec.sk === null && rec.raw === null,
    "no ruling captured records r=NONE (the Optimized Silence's lesson)");

// --- Retries replace, counted ----------------------------------------------------------
let out2 = GK_onOutput("skill=humming; difficulty=trivial; check=success;\nA better tune.");
out2 = OB_onOutput(out2);
rec = OB_ring()[OB_ring().length - 1];
H.assert(OB_ring().filter(x => x.t === 5).length === 1 && rec.retry === 1 && rec.r === "success",
    "retry replaces the turn's record, latest wins, counted");

// --- Command turns are never records ---------------------------------------------------
H.turn(6, "do"); H.resetCaches();
GK_markCommandTurn();
OB_onOutput("Bookkeeping happened.");
H.assert(OB_ring().filter(x => x.t === 6).length === 0, "command turns yield no record");

// --- The lab hook: OB_tag stamps records ----------------------------------------------
OB_tag("cell-L5-expert");
play(7, H.doFrame("You leap the gap"), "skill=jumping; difficulty=minor; check=fail;\nShort.");
rec = OB_ring()[OB_ring().length - 1];
H.assert(rec.cell === "cell-L5-expert", "OB_tag stamps the lab cell id");
OB_tag("");
play(8, H.doFrame("You try again"), "skill=jumping; difficulty=minor; check=success;\nMade it.");
H.assert(!OB_ring()[OB_ring().length - 1].cell, "empty tag clears the stamp");

// --- /telemetry: Report-gated echo, bookkeeping turn -----------------------------------
r = play(9, H.doFrame("/telemetry"), "should not matter");
H.assert(/\{Telemetry: \d+ records \(turns 2-8\), 0 dropped\}/.test(r.out), "/telemetry echoes ring status");
H.assert(state.vars.GK.commandTurn === 9 && OB_ring().filter(x => x.t === 9).length === 0,
    "/telemetry is bookkeeping — the Check yields, no record");

// --- The cap: 400 records, oldest drop, counted ---------------------------------------
for (let n = 100; n < 510; n++) {
    H.turn(n, "do"); H.resetCaches();
    let o = GK_onOutput("skill=walking; difficulty=trivial; check=success;\nStep.");
    OB_onOutput(o);
}
H.assert(OB_ring().length === 400, "ring capped at 400 (veto ruling 3)");
H.assert(state.vars.OB.dropped > 0 && OB_ring()[0].t > 100, "oldest dropped, drops counted");

// --- Rule 7: disabled = inert passthrough ---------------------------------------------
const cfgCard = SC_get("Observer Config");
cfgCard.entry = cfgCard.entry.replace("Enabled: true", "Enabled: false");
H.turn(600, "do"); H.resetCaches();
const before = OB_ring().length;
const echoed = OB_onOutput(GK_onOutput("skill=x; difficulty=minor; check=success;\nOk."));
H.assert(OB_ring().length === before && /Ok\./.test(echoed), "Enabled: false — no record, text untouched");
cfgCard.entry = cfgCard.entry.replace("Enabled: false", "Enabled: true");

H.summary("ObserverKit");
