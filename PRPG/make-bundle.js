// Regenerates "PRPG - Library.js": PE Essentials modules + SkillKit, one paste.
// Usage: node make-bundle.js   (run from the PRPG folder, commit the result)
// PRPG ships as its own package, versioned against a stated Essentials
// version (the contract: extensions consume public seams only). Hook-tab
// files are hand-owned; SkillKit wires ONE line into the Output tab.
const fs = require("fs");
const path = require("path");
const ESSENTIALS = path.join(__dirname, "..", "PE Essentials");
const MODULES = ["RewindKit", "RegexLib", "CardLib", "GateKit", "InventoryKit"];
const parts = MODULES.map(m => fs.readFileSync(path.join(ESSENTIALS, m, m + ".js"), "utf-8").trimEnd());
parts.push(fs.readFileSync(path.join(__dirname, "SkillKit", "SkillKit.js"), "utf-8").trimEnd());
parts.push(fs.readFileSync(path.join(__dirname, "TrackerKit", "TrackerKit.js"), "utf-8").trimEnd());
parts.push(fs.readFileSync(path.join(__dirname, "EventKit", "EventKit.js"), "utf-8").trimEnd());
parts.push(fs.readFileSync(path.join(__dirname, "SheetKit", "SheetKit.js"), "utf-8").trimEnd());
parts.push(fs.readFileSync(path.join(__dirname, "ObserverKit", "ObserverKit.js"), "utf-8").trimEnd());
const out = parts.join("\n\n") + "\n";
fs.writeFileSync(path.join(__dirname, "PRPG - Library.js"), out);
console.log("PRPG: " + MODULES.join(" + ") + " + SkillKit + TrackerKit + EventKit + SheetKit + ObserverKit -> PRPG - Library.js (" + out.length + " chars)");
