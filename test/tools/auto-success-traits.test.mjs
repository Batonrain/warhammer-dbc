// test/tools/auto-success-traits.test.mjs
//
// Автоуспех Черт элитных архетипов (19.11.2026, вторая пачка «Разобрать»):
//   Вуаль Лжи (Когнитэ) — встречные тесты против контроля/чтения разума и допроса;
//   Савант Жизни и Смерти (Мейстер) — тесты медицинской диагностики.
// Запись Конструктора testMod с modValueMode "autoSuccess" (тот же приём, что у Зверя).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { rollModsFromRules } from "../../module/rules/resolve-test.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

const traits = packDocuments("traits", "trait").map(x => x.doc);
const byName = n => traits.find(d => d.name.startsWith(n));
const asItem = d => ({ id: d._id, name: d.name, type: d.type, system: d.system, flags: d.flags });
const autoIn = (doc, ctx) => rollModsFromRules(rulesFromItemMechanics([asItem(doc)]), ctx).filter(m => m.autoSuccess);

describe("Вуаль Лжи", () => {
  const veil = byName("Veil of Lies /");
  it("галочка автоуспеха — в сопротивлении психосиле Волей", () => {
    expect(veil).toBeTruthy();
    expect(autoIn(veil, { kind: "skill", char: "wp", psychicThreat: true })).toHaveLength(1);
  });
  it("автоуспех во встречном тесте допроса", () => {
    expect(autoIn(veil, { kind: "skill", char: "wp", morale: true, interrogation: true })).toHaveLength(1);
  });
  it("в обычном тесте Воли автоуспеха нет", () => {
    expect(autoIn(veil, { kind: "skill", char: "wp" })).toHaveLength(0);
  });
});

describe("Савант Жизни и Смерти", () => {
  const savant = byName("Savant of Life and Death /");
  it("галочка автоуспеха — только в тесте Медицины", () => {
    expect(savant).toBeTruthy();
    expect(autoIn(savant, { kind: "skill", skill: "medicae", char: "int" })).toHaveLength(1);
    expect(autoIn(savant, { kind: "skill", skill: "awareness", char: "per" })).toHaveLength(0);
  });
});
