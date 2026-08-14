# Dice v0.2.0 — the Chance primitive

**New in v0.2:** settings are player-editable through a **Dice Config** story card when the StoryCard primitive is present — die size, crit thresholds, advantage-word parsing, and the action-roll toast, all changeable mid-game with typed fallback to defaults (`DICE_cfg()` seam). Without StoryCard, Dice runs on built-in defaults. The GateKit feed now scales to luck's 1–100 range, so a d20 config still speaks luck's language.

**The idea.** The engine owns randomness in one place. Every player action gets exactly one roll — retry-stable, bendable by circumstance, visible to any module that cares. What a roll *means* is deliberately not in here: judgment is the Check's idea (GateKit), interpretation is the consumer's. Dice supplies the number. Draftworlds' d20 proved the concept; this is the concept, free of any scenario.

## What it does

- **The action roll.** One d100 per player action, finalized on the Input pass and cached against `actionCount` — retries reuse it (no reroll fishing). Clamped 1–100 after modifiers; crit flags at the extremes (≤5 failure, ≥96 success — thresholds in `DICE_SETTINGS`).
- **Advantage / disadvantage.** Roll twice, take best/worst. Sourced from the player's own wording ("with advantage", "at a disadvantage" — Draftworlds' trick, toggleable) or from module votes; opposing votes cancel.
- **`/roll` command.** `/roll` → d20, `/roll 2d6+3` → XdY±Z (≤20 dice, 2–1000 sides). Result via toast, command swallowed, retry-stable per action.

## Wiring

Input pass only — not every primitive needs all three hooks:

```js
// Input tab (after passes that add modifiers, so circumstance lands before the roll):
text = SomeModule_onInput(text);   // may call DICE_addModifier / DICE_setAdvantage
text = GK_onInput(text);           // if GateKit present
text = DICE_onInput(text);         // finalizes the roll, feeds the Check
```

## Seams

```js
DICE_lastRoll()
// → { value: 62, raw: 47, raw2: 62, advantage: 1, modifier: 0,
//     crit: null | "success" | "failure", turn: 41 } | null

DICE_addModifier("reputation", 5);    // situational, this action; one per owner, latest wins
DICE_setAdvantage("blessing", 1);     // +1 / -1 / 0 to clear; votes cancel
DICE_roll(2, 6, 3);                   // stateless utility → {total, rolls, modifier, sides}
```

- **Feeds the Check automatically.** If `GK_setLuck` exists, the finalized action roll becomes GateKit's luck — the model then adjudicates against a real roll shaped by advantage and modifiers. If GateKit is absent, Dice runs standalone without complaint (verified in the harness).
- **Consume the roll.** Any module reads `DICE_lastRoll()` — an injury module can key severity off `crit`, a narration module can phrase flair off `advantage`.
- **Bend the odds.** Future Reputation/Condition-style modules push modifiers in during their own Input passes; Dice folds them in at finalize time.

## Verification

18-assertion harness in two parts. Standalone: roll range + retry stability, forced advantage/disadvantage (stubbed RNG proving max/min selection), modifier summing with latest-wins and clamping, vote cancellation, `/roll` parsing/swallowing/caching, utility bounds, graceful GateKit absence. Composition: GateKit loaded alongside — the action roll overrides GK's internal luck, appears in the arbiter block, and lands in the captured ruling. `node --check` clean; frontMemory untouched throughout.
