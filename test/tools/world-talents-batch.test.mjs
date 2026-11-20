// test/tools/world-talents-batch.test.mjs
//
// Шаг 2 плана (18.11.2026): Таланты, которые стоят на листах персонажей мира
// «Из пепла». Сторожим новые записи Конструктора: каждая превращается в
// правило с заполненной областью (пустая область молча ничего не даёт).

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../packs-src/talents");
const load = (dir, prefix) => {
  const f = fs.readdirSync(path.join(ROOT, dir)).find(n => n.startsWith(prefix));
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, dir, f), "utf8"));
  return { id: d._id, name: d.name, type: d.type, system: d.system, flags: d.flags };
};
const effects = item => rulesFromItemMechanics([item]).flatMap(r => r.effects ?? []);

describe("Таланты персонажей мира", () => {
  it("Полиглот: галочка −10 к Ремеслу, не тихая прибавка", () => {
    const fx = effects(load("Социальные", "Polyglot")).filter(e => e.kind === "rollBonus");
    expect(fx).toHaveLength(1);
    expect(fx[0].target).toBe("skill:trade");
    expect(fx[0].value).toBe(-10);
    expect(fx[0].auto).not.toBe(true);
  });

  it("Локум: переброс Командования и Внимательности", () => {
    const fx = effects(load("Крафт", "Locum")).filter(e => e.kind === "rollMode");
    expect(fx.map(e => e.target).sort()).toEqual(["skill:awareness", "skill:command"]);
    for (const e of fx) expect(e.mode).toBe("keepBest");
  });

  it("Мудрость Древних: кнопка на панели с ценой 1 Очко Бесчестия", () => {
    const item = load("Мудрец", "Wisdom_of_the_Ancients");
    const fx = effects(item).filter(e => e.kind === "scriptAbility");
    expect(fx).toHaveLength(1);
    const entry = item.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(e => e.kind === "script");
    expect(entry.capabilityCostPool).toBe("infamy");
    expect(entry.capabilityCostAmount).toBe(1);
    expect(entry.code).toMatch(/ChatMessage\.create/);
  });
});
