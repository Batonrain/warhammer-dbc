// tools/_j1nc-quickwins-scan.mjs — wdbc-j1nc, разведка №2: среди 539 нерешённых
// Черт сколько уже несут ненулевые system.effects (legacy), просто не
// сконвертированные в native effects[]. Это самые дешёвые честные победы —
// тот же паттерн, что The Quick and The Dead/Warpforged Plate. Одноразовый.
import fs from "node:fs";

const AP_KEYS = ["apAll", "apHead", "apBody", "apArms", "apLegs"];
const AP_VS = ["apVsEnergy", "apVsImpact", "apVsRending", "apVsExplosive"]; // guess, verify below
const NUM_KEYS = ["charBonusValue", "armourAll", ...AP_KEYS, "fearRating", "sizeMod", "initMod", "speedMod"];

let hits = 0;
const lines = fs.readFileSync("tools/_j1nc-undecided.jsonl", "utf8").trim().split("\n");
for (const line of lines) {
  const { file } = JSON.parse(line);
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const eff = doc.system?.effects ?? {};
  const nonzero = NUM_KEYS.filter(k => eff[k]);
  const hasCB = Array.isArray(eff.charBonuses) && eff.charBonuses.some(cb => cb?.value);
  const hasCVB = Array.isArray(eff.charValueBonuses) && eff.charValueBonuses.some(cb => cb?.value);
  if (nonzero.length || hasCB || hasCVB) {
    hits++;
    console.log(doc.name, "->", JSON.stringify({ nonzero, charBonuses: eff.charBonuses, charValueBonuses: eff.charValueBonuses }), file);
  }
}
console.log(`\nВсего кандидатов с ненулевым legacy system.effects: ${hits}/${lines.length}`);
