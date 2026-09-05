// test/rules/when-any-of.test.mjs
//
// «ИЛИ» в условиях — с обеих сторон (wdbc-n48f).
//
// Условие «когда сработает» в системе записывается двумя языками: entry.when у
// записи Конструктора (восемь гейтов, module/rules/mech-when.mjs) и реестр
// PREDICATES у правил книги (module/rules/predicates.mjs). Ни у одного не было
// «ИЛИ»: гейты складывались только через «И».
//
// Цена этого не теоретическая. Способность вида «работает в Ярости ИЛИ при
// тяжёлых Ранах» приходилось заводить ДВУМЯ записями, и они расходились при
// первой же правке — одну поправили, вторую забыли. Ровно тот класс молчаливой
// поломки, против которого весь этап.
//
// Умолчание — «И», как было: ни одна существующая запись поведения не меняет.

import { describe, it, expect } from "vitest";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";
import { matchRule } from "../../module/rules/collect.mjs";

const actor = (system = {}) => ({ system: { characteristics: {}, ...system } });

/** Актор в Ярости — гейт requireRage. */
const inRage = () => actor({ conditions: {}, inRage: true, rage: { active: true } });

describe("entry.when: ИЛИ между гейтами записи Конструктора", () => {
  // Два гейта, которые легко проверить без Foundry: Покровитель и Тир Ран.
  const twoGates = (extra = {}) => ({
    when: { patronGod: ["khorne"], woundTier: ["healthy"], ...extra }
  });

  it("по умолчанию И: нужны оба гейта", () => {
    const khorneHurt = actor({ patronGod: "khorne", wounds: { value: 1, max: 10 } });
    // Покровитель подходит, Тир Ран — нет.
    expect(entryWhenOk(khorneHurt, twoGates())).toBe(false);
  });

  it("anyOf: хватает одного гейта", () => {
    const khorneHurt = actor({ patronGod: "khorne", wounds: { value: 1, max: 10 } });
    expect(entryWhenOk(khorneHurt, twoGates({ anyOf: true }))).toBe(true);
  });

  it("anyOf: ни один гейт не подошёл — запись не срабатывает", () => {
    const other = actor({ patronGod: "nurgle", wounds: { value: 1, max: 10 } });
    expect(entryWhenOk(other, twoGates({ anyOf: true }))).toBe(false);
  });

  it("anyOf у пустого условия ничего не меняет — работает всем", () => {
    expect(entryWhenOk(actor(), { when: { anyOf: true } })).toBe(true);
  });

  it("anyOf не превращает ненастроенные гейты в разрешение", () => {
    // Главная ловушка «ИЛИ»: ненастроенный гейт всегда «пройден», и наивное
    // ИЛИ пропускало бы вообще всё. Настроен один гейт — он и решает.
    const wrongPatron = actor({ patronGod: "nurgle" });
    expect(entryWhenOk(wrongPatron, { when: { patronGod: ["khorne"], anyOf: true } })).toBe(false);
  });

  it("отрицание отдельного гейта работает и внутри ИЛИ", () => {
    const nurgle = actor({ patronGod: "nurgle" });
    expect(entryWhenOk(nurgle, { when: { patronGod: ["khorne"], negatePatronGod: true, anyOf: true } })).toBe(true);
  });
});

describe("when правила: ИЛИ между условиями из реестра PREDICATES", () => {
  it("по умолчанию И: нужны все условия", () => {
    const rule = { id: "r", when: { race: ["astartes"], subrace: ["ultramarines"] } };
    expect(matchRule(rule, { system: { race: "astartes", subrace: "ironhands" } }, {})).toBe(false);
  });

  it("anyOf: хватает одной ветки", () => {
    const rule = { id: "r", when: { anyOf: [{ race: ["astartes"] }, { subrace: ["ultramarines"] }] } };
    expect(matchRule(rule, { system: { race: "astartes", subrace: "ironhands" } }, {})).toBe(true);
    expect(matchRule(rule, { system: { race: "human", subrace: "ultramarines" } }, {})).toBe(true);
  });

  it("anyOf: ни одна ветка не подошла", () => {
    const rule = { id: "r", when: { anyOf: [{ race: ["astartes"] }, { subrace: ["ultramarines"] }] } };
    expect(matchRule(rule, { system: { race: "human", subrace: "ironhands" } }, {})).toBe(false);
  });

  it("внутри ветки условия по-прежнему складываются через И", () => {
    const rule = { id: "r", when: { anyOf: [{ race: ["astartes"], subrace: ["ultramarines"] }] } };
    expect(matchRule(rule, { system: { race: "astartes", subrace: "ironhands" } }, {})).toBe(false);
    expect(matchRule(rule, { system: { race: "astartes", subrace: "ultramarines" } }, {})).toBe(true);
  });

  it("anyOf соседствует с обычными условиями: они И, ветки ИЛИ", () => {
    // «Астартес И (Ультрамарин ИЛИ Железная Рука)» — самая частая форма из книги.
    const rule = { id: "r", when: {
      race: ["astartes"],
      anyOf: [{ subrace: ["ultramarines"] }, { subrace: ["ironhands"] }]
    } };
    expect(matchRule(rule, { system: { race: "astartes", subrace: "ironhands" } }, {})).toBe(true);
    expect(matchRule(rule, { system: { race: "astartes", subrace: "salamanders" } }, {})).toBe(false);
    expect(matchRule(rule, { system: { race: "human", subrace: "ironhands" } }, {})).toBe(false);
  });

  it("пустой anyOf никого не пропускает — это условие без вариантов", () => {
    // Не «условия нет»: автор написал ИЛИ и не заполнил ни одной ветки, и
    // тихо пропустить всех было бы противоположностью написанного.
    expect(matchRule({ id: "r", when: { anyOf: [] } }, { system: {} }, {})).toBe(false);
  });
});
