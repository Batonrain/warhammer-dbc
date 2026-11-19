// test/tools/elite-talents-batch1.test.mjs
//
// Элитные архетипы (корбук), пачка 19.11.2026: Таланты получили записи
// Конструктора — обращение броска, активацию за Бесчестие «до конца боя или
// сцены», перебросы и модификаторы. Сторож: каждый помеченный Талант даёт
// правила, а записи «пока включено» молчат без флага activated и работают с ним.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { hasActivationGatedEntries } from "../../module/rules/item-activation.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".json") ? [path.join(d, e.name)] : []);
}
const docs = walk(path.join(ROOT, "packs-src", "talents", "Элитные_архетипы"))
  .map(f => JSON.parse(fs.readFileSync(f, "utf8")))
  .filter(d => /^Реализовано \(19\.11\.2026\)/.test(d.system?.notes ?? ""));

const NS = "warhammer-dbc";
const asItem = (d, activated = false) => ({ id: d._id, name: d.name, type: d.type, system: d.system,
  flags: activated ? { ...d.flags, [NS]: { ...d.flags?.[NS], activated: { combatId: "", at: 0 } } } : d.flags });
const actor = { system: { geneSeed: {}, bio: { age: 0 } }, items: [] };
const live = rules => rules.flatMap(r => r.effects ?? []).filter(fx => ["rollMode", "rollBonus"].includes(fx.kind));

describe("элитные архетипы, пачка 19.11.2026", () => {
  it("Таланты нашлись", () => expect(docs.length).toBeGreaterThanOrEqual(15));

  for (const d of docs) {
    const groups = d.flags?.[NS]?.mechanics ?? [];
    const entries = groups.flatMap(g => g.entries ?? []);
    const rolls = entries.filter(e => ["reroll", "testMod"].includes(e.kind));
    if (!rolls.length) continue;
    const gated = hasActivationGatedEntries(groups);

    it(`${d.name}: ${gated ? "броски действуют только пока включено" : "записи бросков дают правила"}`, () => {
      const onRules = live(rulesFromItemMechanics([asItem(d, true)], () => true, actor));
      expect(onRules.length).toBe(rolls.length);
      if (gated) {
        const offRules = live(rulesFromItemMechanics([asItem(d, false)], () => true, actor));
        expect(offRules.length).toBeLessThan(onRules.length);
        // и есть кнопка, которая включает: запись-скрипт с ценой Бесчестия
        expect(entries.some(e => e.kind === "script" && e.capabilityCostPool && /activateItemUntil/.test(e.code ?? ""))).toBe(true);
      }
    });
  }

  it("обращение броска записано режимом reverse", () => {
    const reverse = docs.flatMap(d => live(rulesFromItemMechanics([asItem(d, true)], () => true, actor)))
      .filter(fx => fx.kind === "rollMode" && fx.mode === "reverse");
    expect(reverse.length).toBeGreaterThanOrEqual(7);
  });
});
