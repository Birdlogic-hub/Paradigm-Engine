# SkillKit v0.3.0 — the Skill

**v0.3.0 — Volta's ladder (9/25/2026).** Same eight ranks and thresholds, with Volta's rules:
- **Benchmarks.** Each rank has a description of what that rank can do, and the Skills card shows it: `Climbing: Advanced — Sophisticated or demanding tasks`. Give one skill its own descriptions with a SkillKit Config line: `- Climbing: benchmarks=Steps and gentle slopes | Easy scrambles with abundant holds | …`. It takes up to eight entries, lowest rank first, and blanks keep the generic text.
- **Attributes are a head start.** `- Strong: rank=Intermediate, skills=climbing/lifting` gives an Intermediate baseline, and practice adds on top of it.
- **One practice per attempt**, success or failure.
- **The practice band.** With GateKit's `Resolution: code`:
  - tasks from two ranks below yours up to two ranks above teach, win or lose;
  - tasks further above teach only when you succeed;
  - tasks three or more ranks below (96%+ odds) never teach.

  With `Resolution: model`, any minor or major ruling teaches.
- **Repeats don't count.** Repeating the exact same move at the same difficulty teaches only once.

Design record: `Documentation/Design Proposals/Code Resolution - Design Proposal.md`.

*Roadmapped 7/13/2026. Designed 7/14/2026 — see `Documentation/Design Proposals/SkillKit (the Skill) - Design Proposal.md`. **Built to spec 7/15/2026 — harness-passed (28 assertions at that build, `test/skillkit.test.js`, runs on the Essentials harness; the suite now runs 53).** Awaits live-proof; ships alongside GateKit v0.7.1 (the `GK_setArbiterNote` seam, its first consumer).*

**Wiring (Output tab, LAST — after GateKit and InventoryKit):** `text = SK_onOutput(text);` — no input or context pass.

**Testing:** `node test/skillkit.test.js` from the `PRPG` folder.

**Design headline:** semantic ranks (Untrained→Legendary) delivered to the arbiter through the proposed `GK_setArbiterNote` seam; influence is semantic-primary — `GK_setLuck` stays reserved for fortune-benders (the note below about bending odds is superseded on this point).*

**The idea.** GateKit's verdict line has carried a `skill=` field since v0.3 — the arbiter already names the skill behind every judged action (`lockpicking`, `perception`, `leaping`) and it lands in `GK_lastCheck().skill`, currently consumed by nobody. RPG is the lightweight consumer it was always meant to feed: skill familiarity that accrues from *doing* — every ruling tallies its skill; practiced skills bend future odds through `GK_setLuck` (the seam retired Dice left behind); a "Skills" ParaCards projection shows growth.

The design intent is *lightweight*: no classes, no XP tables, no TAS-style stat engine — the Check already judges difficulty and outcome, so RPG only needs to remember what you're good at and lean on the scales accordingly. TAS's Frequency Emergent Collocation Model (skill learning from repeated attempts) is prior art worth a comb when design begins.

Per rule 8: design proposal first, and it waits until PE Essentials is live-proven and the Inner Self compatibility question is settled.
