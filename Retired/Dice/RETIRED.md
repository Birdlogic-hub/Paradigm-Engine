# Dice — RETIRED 7/13/2026 (never live-proven)

Retired because the idea wasn't irreducible: GateKit rolls its own per-action,
retry-stable luck internally, and the live playtest proved the Check complete
without an external randomness module. "The Chance" turned out to be a
component of "the Check," not a peer primitive.

## Salvage list (if ever needed)

- **Bending odds:** `GK_setLuck(value)` already exists in GateKit — any future
  module (Reputation, Condition) can supply or modify luck directly. No
  aggregation layer needed until two modules fight over it.
- **Advantage/disadvantage** (roll twice, take best/worst, votes cancel):
  clean logic in Dice.js §3 — could become a GK_SETTINGS feature.
- **/roll XdY+Z player command** with retry-stable caching: self-contained in
  DICE_onInput, portable anywhere.
- **SC_config integration** (the "Dice Config" editable card): the pattern
  lives on in StoryCard itself — Dice was its proving ground. A "GateKit
  Config" card is the natural heir when GK settings should be player-editable.

Harness-passed at v0.2.0; both files kept intact below for salvage.
