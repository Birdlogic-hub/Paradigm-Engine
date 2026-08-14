const H = require("./harness");
H.fresh();
eval(H.load("RegexLib", "CardLib", "GateKit", "InventoryKit"));

function play(n, input, modelOut) {
  H.turn(n, "do"); H.resetCaches();
  let t = INV_onInput(input);
  t = GK_onInput(t);
  GK_onContext(H.ctx());
  let out = GK_onOutput(modelOut);
  out = INV_onOutput(out);
  return { t, out };
}

// Turn 1 materialization (EB ensure-on-input lineage): both cards exist on
// the first player action, before any command is ever issued.
H.turn(0, "do"); H.resetCaches();
INV_onInput(H.doFrame("look around"));
H.assert(!!SC_get("Inventory Config") && !!SC_get("Inventory") && !!SC_get("Event Log"), "cards + Event Log materialize on first action, pre-command");
H.assert(SC_get("Inventory").type === "Gameplay" && SC_get("Inventory Config").type === "Settings", "the two banners: Inventory reads, Inventory Config edits (v0.4.2)");

let r = play(1, H.doFrame("/take 3 torches"), "difficulty=trivial; check=success;\nGathered.");
H.assert(r.t === "You attempt to take 3 torches and stow them away." && INV_count("torches") === 3, "take: ATTEMPT stub + optimistic commit (the duck heist)");
H.assert(/\{torches x3 added to your inventory\}/.test(r.out), "take: visible receipt echo (SIS clarity)");
r = play(2, H.doFrame("/take golden idol"), "difficulty=major; check=fail;\nAir.");
H.assert(INV_count("golden idol") === 0 && /\{You failed to get the golden idol\}/.test(r.out) && !/golden idol x1 added/.test(r.out), "take: rollback on fail, receipt SNIPPED (deferred to ruling)");
r = play(3, H.doFrame("/throw torches at the goblin"), "difficulty=minor; check=fail;\nWide.");
H.assert(r.t === "You throw the torches at the goblin." && INV_count("torches") === 2, "throw: spend never refunds");
r = play(4, H.sayFrame("/drop 2 torches"), "Clatter.");
H.assert(INV_count("torches") === 0 && state.vars.GK.commandTurn === 4, "drop: say-framed, none policy marks turn");
INV_add("rope", 1);
r = play(5, H.doFrame("/drop 5 rope"), "x");
H.assert(INV_count("rope") === 1 && /\{You only have 1 rope\}/.test(r.out), "overspend refused");
r = play(6, H.doFrame("/use excalibur"), "x");
H.assert(/You don't have that/.test(r.out), "unknown item refused");
r = play(7, H.doFrame("/collect 50 gold"), "difficulty=trivial; check=success;\nJingle.");
r = play(8, H.doFrame("/give 20 gold to the guard"), "difficulty=minor; check=success;\nNod.");
H.assert((state.vars.INV.wallet.gold || 0) === 30 && r.t === "You give 20 gold to the guard.", "wallet credit/debit + tail");

const cfgCard = SC_get("Inventory Config");
cfgCard.entry = cfgCard.entry.replace("Take Arbitration: outcome", "Take Arbitration: gated");
r = play(9, H.doFrame("/take dragon egg"), "difficulty=impossible; check=success;\nOr not.");
H.assert(INV_count("dragon egg") === 0 && /\{The attempt fails — nothing gained\}/.test(r.out), "gated: blocked on fail (coerced)");
r = play(10, H.doFrame("/take iron key"), "difficulty=minor; check=success;\nYours.");
H.assert(INV_count("iron key") === 1 && r.t === "You attempt to take the iron key and stow it away.", "gated: allowed commit, attempt stub");
cfgCard.entry = cfgCard.entry.replace("Take Arbitration: gated", "Take Arbitration: outcome");

H.turn(11, "do"); H.resetCaches();
const t1 = INV_onInput(H.doFrame("/drop rope"));
const t2 = INV_onInput(H.doFrame("/drop rope"));
H.assert(t2 === t1 && INV_count("rope") === 0 && state.vars.INV.log.filter(o => o.name === "rope").length === 1, "retry: stub replay, no double-drop");

play(12, H.doFrame("/take lantern"), "difficulty=trivial; check=success;\nOK.");
r = play(13, H.doFrame("/undo"), "x");
H.assert(INV_count("lantern") === 0 && /\{Undid: add lantern x1\}/.test(r.out) && state.vars.GK.commandTurn === 13, "undo reverses, never judged");
r = play(14, H.doFrame("/inventory"), "x");
H.assert(/\{Inventory: .*iron key x1/.test(r.out), "/inventory echoes holdings");
H.assert(/T\d+ \[Inventory\]/.test(SC_get("Event Log").entry), "mutations reach the Event Log");
H.assert(/## Wallet/.test(SC_get("Inventory").entry) && /- iron key x 1/.test(SC_get("Inventory").entry), "Inventory card projection");

// --- v0.1.4: the multi-grab ---------------------------------------------------------
H.turn(60, "do"); H.resetCaches();
let mg = play(60, "/take 2 red healing tonic; iron dagger; rope", "skill=none; difficulty=trivial; check=success;\nYou gather your gear.");
H.assert(mg.t === "You attempt to take 2 red healing tonic, the iron dagger and the rope and stow them away.", "multi-grab: one attempt stub");
H.assert(INV_count("red healing tonic") === 2 && INV_count("iron dagger") === 1 && INV_count("rope") >= 1, "multi-grab: all segments committed");
H.assert(/\{red healing tonic x2, iron dagger x1, rope x1 added to your inventory\}/.test(mg.out), "multi-grab: one combined receipt");
H.turn(61, "do"); H.resetCaches();
mg = play(61, "/take 60 ducks; crown", "skill=perception; difficulty=impossible; check=fail;\nThere are no ducks here.");
H.assert(INV_count("ducks") === 0 && INV_count("crown") === 0, "multi-grab: fail ruling rolls back the WHOLE grab (duck heist regression)");
H.assert(/\{You failed to get 60 ducks and the crown\}/.test(mg.out) && !/added to your inventory/.test(mg.out), "multi-grab: rollback lists the grab, no lying receipt");

// --- v0.1.5: /swap — ledger reclassification, never judged --------------------------
H.turn(70, "do"); H.resetCaches();
play(70, "/take 60 coins", "skill=none; difficulty=trivial; check=success;\nYou scoop the coins.");
H.assert(INV_count("coins") === 60 && INV_walletGet("coins") === 0, "coins taken as ITEMS (the misfile)");
H.turn(71, "do"); H.resetCaches();
let sw = play(71, "/swap coins", "should never be judged");
H.assert(INV_count("coins") === 0 && INV_walletGet("coins") === 60, "bare /swap moves ALL to the wallet");
H.assert(/\{coins x60 moved to your wallet\}/.test(sw.out), "swap receipt echoed");
H.assert(state.vars.GK.commandTurn === 71, "/swap is bookkeeping — the Check yields");
H.turn(72, "do"); H.resetCaches();
play(72, "/swap 10 coins", "meta");
H.assert(INV_count("coins") === 10 && INV_walletGet("coins") === 50, "partial swap back to items (auto-direction)");
H.turn(73, "do"); H.resetCaches();
play(73, "/undo", "meta");
H.assert(INV_count("coins") === 0 && INV_walletGet("coins") === 60, "one /undo reverses BOTH sides (composite op)");
H.turn(74, "do"); H.resetCaches();
sw = play(74, "/swap moonbeams", "meta");
H.assert(/\{You don't have that to swap/.test(sw.out), "unknown name reported, never thrown");

// --- the Loadout (v0.2.0): open categories, verbs-only --------------------------------
play(500, H.doFrame("/take bronze dirk; leather jerkin; silver locket; shortbow"), "difficulty=trivial; check=success;\nTaken.");
r = play(501, H.doFrame("/equip bronze dirk as weapon"), "Steel whispers.");
H.assert(r.t === "You equip the bronze dirk." && state.vars.INV.equip.weapon[0] === "bronze dirk",
    "equip: explicit category, uniform category-free stub (v0.2.3), the ledger flags the name");
H.assert(state.vars.GK.commandTurn === 501, "equip is bookkeeping by default (Equip Arbitration: none)");
H.assert(/- bronze dirk x 1 \(equipped: weapon\)/.test(SC_get("Inventory").entry), "annotated in place — render-only");
r = play(502, H.doFrame("/equip leather jerkin"), "Hm.");
H.assert(/Equip as what\?/.test(r.out) && !INV_equipFind("leather jerkin"), "missing `as` refuses with usage (classifier deferred)");
r = play(503, H.doFrame("/equip supercalifragilistic dragonbone greatplate of the ancient kings as armor"), "Hm.");
H.assert(/name is too long/.test(r.out) && state.vars.INV.equip.armor.length === 0,
    "over-cap name refuses — the Grab's only hard refusal (unowned now grabs, v0.2.4)");
play(504, H.doFrame("/equip shortbow as weapon"), "Strung.");
H.assert(state.vars.INV.equip.weapon.length === 2, "open categories: a second weapon stacks — no cap, no swap");
r = play(505, H.doFrame("/equip bronze dirk as accessory"), "Hm.");
H.assert(/already equipped \(weapon\)/.test(r.out), "double-equip refuses, names the category");
r = play(506, H.doFrame("/unequip shortbow"), "Unstrung.");
H.assert(r.t === "You unequip the shortbow." && state.vars.INV.equip.weapon.length === 1, "unequip by name, symmetric stub");
play(507, H.doFrame("/equip silver locket as accessory"), "Clasped.");
r = play(508, H.doFrame("/undo"), "Rewound.");
H.assert(state.vars.INV.equip.accessory.length === 0, "/undo reverses an equip");
H.assert(JSON.stringify(INV_readEquipment()) === JSON.stringify([{ slot: "weapon", name: "bronze dirk" }]),
    "INV_readEquipment: the gear as data (SheetKit's seam)");
r = play(509, H.doFrame("/throw bronze dirk at the wolf"), "difficulty=minor; check=success;\nThunk.");
H.assert(INV_count("bronze dirk") === 0 && INV_readEquipment().length === 0
    && /unequipped \(weapon\) — no longer held/.test(SC_get("Event Log").entry),
    "slots never point at ghosts: thrown gear auto-unequips, reported");

// --- unified consumption: /eat and /drink are remove commands + judged turns -----------
play(510, H.doFrame("/take 2 bread loaf; waterskin"), "difficulty=trivial; check=success;\nStocked.");
r = play(511, H.doFrame("/eat bread loaf"), "difficulty=trivial; check=success; resource=hunger +12;\nWarm and dense.");
H.assert(r.t === "You eat the bread loaf." && INV_count("bread loaf") === 1, "/eat <item>: a remove command — consumed 1, deed narrated");
H.assert(state.vars.GK.commandTurn !== 511, "/eat is NOT bookkeeping — the ruling prices the meal");
H.assert(/bread loaf x1 consumed \(\/eat\) — efficacy by ruling/.test(SC_get("Event Log").entry), "consumption reported");
r = play(512, H.doFrame("/eat"), "Hm.");
H.assert(/Eat what\?/.test(r.out) && state.vars.GK.commandTurn === 512, "bare /eat refuses with usage — no free lunch left");
r = play(513, H.doFrame("/eat golden apple"), "Hm.");
H.assert(/don't have that to eat/.test(r.out) && INV_count("bread loaf") === 1, "missing item refuses, nothing consumed");
r = play(514, H.doFrame("/drink waterskin"), "difficulty=trivial; check=success; resource=stamina +8;\nCool relief.");
H.assert(r.t === "You drink the waterskin." && INV_count("waterskin") === 0 && state.vars.GK.commandTurn !== 514,
    "/drink unifies identically — the ruling chooses what a drink restores");

// --- v0.2.1: the Preposition (bare trailing category) + the Tool -----------------------
play(520, H.doFrame("/take iron dagger; rusty pick"), "difficulty=trivial; check=success;\nGathered.");
r = play(521, H.doFrame("/equip iron dagger weapon"), "Steel again.");
H.assert(r.t === "You equip the iron dagger." && state.vars.INV.equip.weapon.indexOf("iron dagger") !== -1,
    "the Preposition: bare trailing category equips (the 8/10 playtest fixture)");
r = play(522, H.doFrame("/equip rusty pick tool"), "Hefted.");
H.assert(r.t === "You equip the rusty pick." && state.vars.INV.equip.tool[0] === "rusty pick",
    "the Tool: fifth open category, same uniform stub");
H.assert(/- rusty pick x 1 \(equipped: tool\)/.test(SC_get("Inventory").entry), "tool annotated in place");
r = play(523, H.doFrame("/equip iron dagger"), "Hm.");
H.assert(/Equip as what\? \(\/equip iron dagger as weapon\|armor\|clothes\|accessory\|tool\)/.test(r.out),
    "no category anywhere still refuses — usage lists all five and stays followable");
r = play(524, H.doFrame("/unequip rusty pick"), "Set down.");
H.assert(state.vars.INV.equip.tool.length === 0, "unequip sweeps every category incl. tool");
r = play(525, H.doFrame("/equip tool rusty pick"), "Hefted again.");
H.assert(r.t === "You equip the rusty pick." && state.vars.INV.equip.tool[0] === "rusty pick",
    "the Preposition leads: /equip <category> <item> (v0.2.2, the human order)");
play(526, H.doFrame("/take hand axe"), "difficulty=trivial; check=success;\nFound.");
r = play(527, H.doFrame("/equip weapon hand axe"), "Ready.");
H.assert(r.t === "You equip the hand axe." && state.vars.INV.equip.weapon.indexOf("hand axe") !== -1,
    "leading category + multiword item resolves against holdings");

// --- v0.2.4: the Grab (equip-implies-take) + the loose held guard ----------------------
r = play(530, H.doFrame("/equip storm lantern as tool"), "difficulty=minor; check=success;\nIt glows.");
H.assert(r.t === "You attempt to take the storm lantern and equip it.",
    "the Grab: unheld item, attempt-phrased stub (take policy: outcome)");
H.assert(INV_count("storm lantern") === 1 && state.vars.INV.equip.tool.indexOf("storm lantern") !== -1,
    "the grab commits: taken AND equipped in one turn");
H.assert(/storm lantern x1 added to your inventory and equipped \(tool\)/.test(r.out),
    "the deferred receipt names both halves");
r = play(531, H.doFrame("/undo"), "meta");
H.assert(INV_count("storm lantern") === 0 && state.vars.INV.equip.tool.indexOf("storm lantern") === -1,
    "one /undo reverses the whole grab (take_equip composite)");
r = play(532, H.doFrame("/equip cursed idol as accessory"), "difficulty=major; check=fail;\nYour hand closes on air.");
H.assert(INV_count("cursed idol") === 0 && state.vars.INV.equip.accessory.length === 0
    && /You failed to get the cursed idol/.test(r.out),
    "the grab rolls back on fail — the ghost sweep clears the equip with it");
r = play(533, H.doFrame("/equip dagger as accessory"), "Hm.");
H.assert(/already equipped \(weapon\)/.test(r.out) && INV_count("dagger") === 0,
    "the loose guard: '/equip dagger' finds the held iron dagger — no phantom grab");
play(534, H.doFrame("/take jeweled dagger"), "difficulty=trivial; check=success;\nSparkles.");
r = play(535, H.doFrame("/equip dagger as accessory"), "Hm.");
H.assert(/Equip which\? \(iron dagger \| jeweled dagger\)/.test(r.out) && INV_count("dagger") === 0,
    "ambiguous loose match refuses with candidates, never guesses");
r = play(536, H.doFrame("/unequip pick"), "meta");
H.assert(state.vars.INV.equip.tool.length === 0, "loose unequip: 'pick' finds the equipped rusty pick");
H.assert(SC_get("Inventory").keys !== "Inventory",
    "the Standing Ledger: Inventory card keys always-on by default (v0.2.4)");

H.summary("InventoryKit");
