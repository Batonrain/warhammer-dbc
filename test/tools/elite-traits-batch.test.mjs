// test/tools/elite-traits-batch.test.mjs
//
// Черты элитных архетипов (19.11.2026): памятки и «только текст» получили
// записи Конструктора. Сторож: каждая запись превращается в правило движка
// (галочка/переброс — с заполненной областью, Возможность — с известным
// именем, склонность — с областью и совпадением), и ничего не теряется молча.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { isKnownCapability } from "../../module/constants/capabilities.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".json") && e.name !== "_Folder.json" ? [path.join(d, e.name)] : []);
}
const docs = walk(path.join(ROOT, "packs-src/traits/Элитные_архетипы"))
  .map(f => JSON.parse(fs.readFileSync(f, "utf8")))
  .filter(d => /^(Частично реализовано|Реализовано) \(19\.11\.2026\)/.test(d.system?.notes ?? ""));

const asItem = d => ({ id: d._id, name: d.name, type: d.type, system: d.system, flags: d.flags });
const RULE_KINDS = new Set(["testMod", "reroll", "capability"]);

describe("Черты элитных архетипов: пачка 19.11.2026", () => {
  it("записи нашлись", () => expect(docs.length).toBeGreaterThanOrEqual(20));

  for (const d of docs) {
    const entries = (d.flags?.["warhammer-dbc"]?.mechanics ?? []).flatMap(g => g.entries ?? []);
    it(`${d.name}: есть запись сверх памятки`, () => {
      expect(entries.some(e => e.kind !== "script")).toBe(true);
    });
    const ruled = entries.filter(e => RULE_KINDS.has(e.kind));
    if (!ruled.length) continue;
    it(`${d.name}: каждая запись — правило`, () => {
      const rules = rulesFromItemMechanics([asItem(d)]);
      const ids = new Set(rules.map(r => r.id.split(".").pop()));
      for (const e of ruled) expect(ids.has(e.id), `${e.kind} ${e.label}`).toBe(true);
      for (const fx of rules.flatMap(r => r.effects ?? [])) {
        if (fx.kind === "rollBonus" || fx.kind === "rollMode") expect(fx.target).toBeTruthy();
        if (fx.kind === "grantFlag") expect(isKnownCapability(fx.target), fx.target).toBe(true);
        if (fx.kind === "grantAptitudeOverride") expect(fx.scope && fx.match).toBeTruthy();
      }
    });
  }

  it("Репутация Тирана — сама, без галочки; Власть Силы — галочка", () => {
    const fx = name => rulesFromItemMechanics([asItem(docs.find(d => d.name.startsWith(name)))])
      .flatMap(r => r.effects).find(e => e.kind === "rollBonus");
    expect(fx("Tyrant")).toMatchObject({ target: "skill:intimidate", formula: "ceil(infv/2)", auto: true });
    expect(fx("Power of Strength")).toMatchObject({ target: "skill:command", value: 15 });
    expect(fx("Power of Strength").auto).not.toBe(true);
  });
});
