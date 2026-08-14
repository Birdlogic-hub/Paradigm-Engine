// ===== Dice v0.2.0 =====
// script by bottledfox
//
// Paradigm Engine primitive: THE CHANCE.
// The engine owns randomness in one place. One action roll per player action
// (retry-stable), bent by advantage/disadvantage and situational modifiers,
// exposed as engine state for any module to consume. Judgment about what a
// roll MEANS belongs elsewhere (the Check); Dice only supplies the number.
//
// v0.2: settings are player-editable through a "Dice Config" story card when
// the StoryCard primitive is present (SC_config). Without StoryCard, Dice
// runs on its built-in defaults — collaborators are optional, always.
//
// WIRING (input pass only — not every primitive needs all three hooks):
//   Input tab:   text = DICE_onInput(text);   // AFTER passes that add modifiers
//
// SEAMS:
//   DICE_lastRoll()                → {value, sides, raw, raw2, advantage,
//                                     modifier, crit, turn} | null
//   DICE_addModifier(owner, n)     → situational bonus/penalty for THIS action
//   DICE_setAdvantage(owner, dir)  → +1 advantage, -1 disadvantage, 0 clear
//   DICE_roll(count, sides, mod)   → plain utility roll, no state, no caching
//   DICE_cfg()                     → live settings (config card if available)
//   GateKit feed                   → action roll → GK_setLuck, scaled to 1..100
//   StoryCard feed                 → settings read via SC_config("Dice Config")
//
// PLAYER COMMAND:
//   /roll  |  /roll 2d6+3   (result via toast; swallowed; retry-stable)
// ---------------------------------------------------------------------------

// Defaults. With StoryCard present these seed the editable "Dice Config" card
// and are the fallback for any line the player deletes or mangles.
const DICE_SETTINGS = {
    SIDES: 100,          // the action roll die
    CRIT_LOW: 5,         // action roll <= this → crit failure flag
    CRIT_HIGH: 96,       // action roll >= this → crit success flag
    PARSE_ADVANTAGE_WORDS: true,   // "advantage"/"disadvantage" in input bend the roll
    SHOW_ACTION_ROLL_TOAST: false  // surface every action roll via state.message?
};

const DICE_CONFIG_CARD = "Dice Config";

// --- State ------------------------------------------------------------------
function DICE_state() {
    if (!state.vars) state.vars = {};
    if (!state.vars.DICE) {
        state.vars.DICE = {
            lastRoll: null,   // finalized action roll (see DICE_lastRoll)
            rollTurn: -1,     // actionCount the roll belongs to
            mods: {},         // {owner: n} situational modifiers, this action
            adv: {},          // {owner: +1|-1} advantage votes, this action
            seamTurn: -1,     // actionCount mods/adv belong to
            cmd: null,        // cached /roll result {turn, text}
            log: []
        };
    }
    return state.vars.DICE;
}

function DICE_turn() {
    return (info && typeof info.actionCount === "number") ? info.actionCount : -1;
}

function DICE_log(msg) {
    const D = DICE_state();
    D.log.push("[" + DICE_turn() + "] " + msg);
    if (D.log.length > 20) D.log.shift();
}

// Live settings: the editable config card when StoryCard is present,
// built-in defaults otherwise. Values are sanity-clamped either way.
function DICE_cfg() {
    let cfg;
    if (typeof SC_config === "function") {
        cfg = SC_config(DICE_CONFIG_CARD, DICE_SETTINGS, {
            description: "Settings for the Dice module. Edit the values in the entry; "
                + "deleted or invalid lines fall back to defaults on the next turn."
        });
    } else {
        cfg = Object.assign({}, DICE_SETTINGS);
    }
    cfg.SIDES = Math.max(2, Math.min(1000, Math.round(cfg.SIDES)));
    cfg.CRIT_LOW = Math.max(0, Math.min(cfg.SIDES, Math.round(cfg.CRIT_LOW)));
    cfg.CRIT_HIGH = Math.max(1, Math.min(cfg.SIDES, Math.round(cfg.CRIT_HIGH)));
    return cfg;
}

// Reset per-action seam inputs when a new action begins.
function DICE_freshSeams() {
    const D = DICE_state();
    const turn = DICE_turn();
    if (D.seamTurn !== turn) {
        D.seamTurn = turn;
        D.mods = {};
        D.adv = {};
    }
    return D;
}

// --- Seams --------------------------------------------------------------------
function DICE_lastRoll() {
    return DICE_state().lastRoll;
}

// Situational modifier for THIS action (e.g., Reputation +5, Condition -10).
// One per owner; latest wins. Call before DICE_onInput in the input chain.
function DICE_addModifier(owner, n) {
    const D = DICE_freshSeams();
    const v = Number(n);
    if (!owner || !Number.isFinite(v)) return;
    D.mods[String(owner)] = Math.round(v);
}

// Advantage vote for THIS action. +1 / -1 / 0 (clear). Votes cancel out.
function DICE_setAdvantage(owner, dir) {
    const D = DICE_freshSeams();
    if (!owner) return;
    if (dir === 0) { delete D.adv[String(owner)]; return; }
    if (dir !== 1 && dir !== -1) return;
    D.adv[String(owner)] = dir;
}

// Plain utility roll — no state, no caching, no seams.
function DICE_roll(count, sides, mod) {
    const c = Math.max(1, Math.min(20, Math.round(Number(count) || 1)));
    const s = Math.max(2, Math.min(1000, Math.round(Number(sides) || 20)));
    const m = Math.round(Number(mod) || 0);
    let total = 0;
    const rolls = [];
    for (let i = 0; i < c; i++) {
        const r = 1 + Math.floor(Math.random() * s);
        rolls.push(r);
        total += r;
    }
    return { total: total + m, rolls: rolls, modifier: m, sides: s };
}

// --- Input pass -----------------------------------------------------------------
function DICE_onInput(text) {
    const D = DICE_freshSeams();
    const cfg = DICE_cfg();
    let t = String(text || "");
    const turn = DICE_turn();

    // 1) /roll [XdY+Z] — player-facing utility (retry-stable per action)
    const cmd = t.match(/\/roll\b(?:\s+(\d{1,2})?d(\d{1,4})\s*([+-]\s*\d{1,3})?)?/i);
    if (cmd) {
        if (D.cmd && D.cmd.turn === turn) {
            state.message = D.cmd.text;   // retry: same result, no reroll fishing
        } else {
            const r = DICE_roll(cmd[1] || 1, cmd[2] || 20, (cmd[3] || "").replace(/\s+/g, ""));
            const label = (cmd[1] || 1) + "d" + (cmd[2] || 20)
                + (r.modifier ? (r.modifier > 0 ? "+" + r.modifier : String(r.modifier)) : "");
            const msg = "🎲 " + label + " → " + r.total
                + (r.rolls.length > 1 ? "  (" + r.rolls.join(", ") + ")" : "");
            D.cmd = { turn: turn, text: msg };
            state.message = msg;
        }
        t = t.replace(cmd[0], "").trim() || " ";   // swallow, keep input non-empty
    }

    // 2) Advantage words in the player's action (Draftworlds' idea, generalized)
    if (cfg.PARSE_ADVANTAGE_WORDS) {
        if (/\bdisadvantage\b/i.test(t)) DICE_setAdvantage("input", -1);
        else if (/\badvantage\b/i.test(t)) DICE_setAdvantage("input", 1);
    }

    // 3) Finalize THIS action's roll (once; retries reuse it)
    if (D.rollTurn !== turn) {
        D.rollTurn = turn;

        // Net advantage: votes cancel
        let net = 0;
        for (const k in D.adv) net += D.adv[k];
        net = net > 0 ? 1 : (net < 0 ? -1 : 0);

        const s = cfg.SIDES;
        const raw = 1 + Math.floor(Math.random() * s);
        let raw2 = null;
        let base = raw;
        if (net !== 0) {
            raw2 = 1 + Math.floor(Math.random() * s);
            base = (net === 1) ? Math.max(raw, raw2) : Math.min(raw, raw2);
        }

        let modifier = 0;
        for (const k in D.mods) modifier += D.mods[k];

        const value = Math.max(1, Math.min(s, base + modifier));
        D.lastRoll = {
            value: value,
            sides: s,
            raw: raw,
            raw2: raw2,
            advantage: net,
            modifier: modifier,
            crit: (value <= cfg.CRIT_LOW) ? "failure"
                : (value >= cfg.CRIT_HIGH) ? "success"
                : null,
            turn: turn
        };
        DICE_log("action roll " + value + "/" + s + " (raw " + raw + (raw2 !== null ? "/" + raw2 : "")
            + ", adv " + net + ", mod " + modifier + ")");
        if (cfg.SHOW_ACTION_ROLL_TOAST) {
            DICE_toast(D.lastRoll);
        }
    }

    // 4) Feed the Check, if GateKit is present (optional collaborator).
    //    Scaled to 1..100 so a d20 config still speaks luck's language.
    if (D.lastRoll && typeof GK_setLuck === "function") {
        GK_setLuck(Math.max(1, Math.round(D.lastRoll.value * 100 / D.lastRoll.sides)));
    }
    return t;
}

function DICE_toast(roll) {
    const cur = (typeof state.message === "string") ? state.message : "";
    const msg = "🎲 Action roll: " + roll.value + "/" + roll.sides
        + (roll.advantage === 1 ? " (advantage)" : roll.advantage === -1 ? " (disadvantage)" : "")
        + (roll.crit ? " — critical " + roll.crit + "!" : "");
    if (!cur.includes(msg)) state.message = cur ? (cur + "\n" + msg) : msg;
}
