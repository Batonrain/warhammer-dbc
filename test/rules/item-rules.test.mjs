// Правила, которые предметы актора дают через Конструктор. Первый такой вид —
// «Переброс» (Локусы Герольдов); дальше тем же путём поедут остальные.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";

const SYSTEM = "warhammer-dbc";
let errors;
beforeEach(() => { errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => errors.mockRestore());

/** Предмет с одной И-группой Механики. */
const item = (name, entries, extraFlags = {}) => ({
  id: name, name,
  flags: { [SYSTEM]: { mechanics: [{ id: "g1", operator: "AND", entries }], ...extraFlags } }
});

const reroll = (over = {}) => ({
  id: "e1", kind: "reroll", rerollScope: "char", rerollChar: "ag",
  rerollMode: "keepBest", label: "", ...over
});

describe("rulesFromItemMechanics: сборка правил", () => {
  it("запись «Переброс» превращается в правило с эффектом rollMode", () => {
    const rules = rulesFromItemMechanics([item("Локус Грации", [reroll()])]);
    expect(rules).toEqual([{
      id: "item.Локус Грации.e1",
      label: "Локус Грации",
      when: {},
      // who — чей бросок перебрасывается; по умолчанию свой, см. capability.test.mjs
      effects: [{ kind: "rollMode", target: "char:ag", mode: "keepBest", rolls: 2, who: "self" }]
    }]);
  });

  it("подпись записи важнее имени предмета — у одной способности бывает два переброса", () => {
    const rules = rulesFromItemMechanics([item("Локус", [reroll({ label: "Переброс Ловкости" })])]);
    expect(rules[0].label).toBe("Переброс Ловкости");
  });

  it("области собираются из вида: навык, атака, инициатива, социальные, любой тест", () => {
    const cases = [
      [reroll({ rerollScope: "skill", skillKey: "dodge" }), "skill:dodge"],
      [reroll({ rerollScope: "attack" }), "attack"],
      [reroll({ rerollScope: "initiative" }), "initiative"],
      [reroll({ rerollScope: "social" }), "social"],
      [reroll({ rerollScope: "all" }), "all"]
    ];
    for (const [entry, target] of cases) {
      const rules = rulesFromItemMechanics([item("И", [entry])]);
      expect(rules[0].effects[0].target).toBe(target);
    }
  });

  it("режим «худший из двух» доезжает до правила", () => {
    const rules = rulesFromItemMechanics([item("И", [reroll({ rerollMode: "keepWorst" })])]);
    expect(rules[0].effects[0].mode).toBe("keepWorst");
  });

  // testMod modValueMode:"formula" (wdbc-1rno) — formula едет как строка на
  // effect.formula, не превращается в Number() (это отличает её от голого
  // "flat", который берёт Number(entry.value) сразу тут же, до броска).
  it("testMod modValueMode:formula кладёт строку формулы в effect.formula, не число", () => {
    const testMod = {
      id: "e1", kind: "testMod", modScope: "skill", skillKey: "awareness",
      modValueMode: "formula", value: "ceil(cor/2)", label: "Чёрные Глаза"
    };
    const rules = rulesFromItemMechanics([item("Чёрные Глаза", [testMod])]);
    expect(rules[0].effects[0]).toEqual({ kind: "rollBonus", target: "skill:awareness", formula: "ceil(cor/2)" });
  });

  // failDegMod (wdbc-1rno, Sentient Cyst) — тот же scopeTarget, что testMod,
  // но эффект своего вида kind:"failDegMod" (не rollBonus): применяется после
  // броска, не в галочках диалога, см. resolve-test.mjs/kind-outcome.mjs.
  it("failDegMod кладёт effect kind:failDegMod с областью и значением", () => {
    const entry = { id: "e1", kind: "failDegMod", modScope: "social", value: 3, label: "Разумная Циста" };
    const rules = rulesFromItemMechanics([item("Разумная Циста", [entry])]);
    expect(rules[0].effects[0]).toEqual({ kind: "failDegMod", target: "social", value: 3 });
  });
});

describe("rulesFromItemMechanics: что НЕ должно давать правил", () => {
  it("выключенный предмет правил не даёт — иначе Локус действовал бы всегда", () => {
    const off = item("Локус Грации", [reroll()]);
    expect(rulesFromItemMechanics([off], () => false)).toEqual([]);
  });

  it("прочие виды записи здесь не при чём", () => {
    expect(rulesFromItemMechanics([item("Черта", [{ id: "e", kind: "characteristic" }])])).toEqual([]);
  });

  it("ИЛИ-ветки пропускаются: там выбор делается один раз при выдаче", () => {
    const or = { id: "x", name: "x", flags: { [SYSTEM]: {
      mechanics: [{ id: "g", operator: "OR", entries: [reroll()] }] } } };
    expect(rulesFromItemMechanics([or])).toEqual([]);
  });

  it("незаполненная область характеристики отбрасывается с жалобой", () => {
    expect(rulesFromItemMechanics([item("И", [reroll({ rerollChar: "" })])])).toEqual([]);
    expect(errors).toHaveBeenCalled();
  });

  it("предмет без Механики молчит, и пустой список тоже", () => {
    expect(rulesFromItemMechanics([{ id: "a", name: "a", flags: {} }])).toEqual([]);
    expect(rulesFromItemMechanics([])).toEqual([]);
    expect(rulesFromItemMechanics(undefined)).toEqual([]);
  });
});

describe("rulesFromItemMechanics: вложенные подгруппы", () => {
  it("И-подгруппа внутри И-группы просматривается", () => {
    const nested = item("И", [
      { id: "g2", kind: "group", group: { id: "g2", operator: "AND", entries: [reroll()] } }
    ]);
    expect(rulesFromItemMechanics([nested])).toHaveLength(1);
  });
});

// entry.when — тот же гейт по Геносемени, что у разовой выдачи/долговечных
// записей (module/apps/mechanics.mjs), но здесь он должен закрывать и «живой
// запрос» — Оолитическая Почка на XIV легион даёт testMod «против болезней»,
// и без этой проверки его получил бы любой Астартес, не только Гвардия Смерти.
describe("rulesFromItemMechanics: гейт по Геносемени (entry.when)", () => {
  const gated = (w) => reroll({ when: w });

  it("без актора — правило как раньше, всем", () => {
    const rules = rulesFromItemMechanics([item("И", [gated({ negate: false, conditions: [{ legion: "XIV" }] })])]);
    expect(rules).toHaveLength(1);
  });

  it("легион совпал — правило есть", () => {
    const actor = { system: { geneSeed: { legion: "XIV", chapter: "" } } };
    const rules = rulesFromItemMechanics(
      [item("И", [gated({ negate: false, conditions: [{ legion: "XIV" }] })])], () => true, actor);
    expect(rules).toHaveLength(1);
  });

  it("легион не совпал — правила нет", () => {
    const actor = { system: { geneSeed: { legion: "VI", chapter: "" } } };
    const rules = rulesFromItemMechanics(
      [item("И", [gated({ negate: false, conditions: [{ legion: "XIV" }] })])], () => true, actor);
    expect(rules).toEqual([]);
  });

  it("negate — правило у всех, кроме перечисленных", () => {
    const stardragon = { system: { geneSeed: { legion: "X", chapter: "stardragons" } } };
    const ironlord   = { system: { geneSeed: { legion: "X", chapter: "ironlords" } } };
    const w = { negate: true, conditions: [{ legion: "VII" }, { legion: "X", chapter: "stardragons" }, { legion: "XIX" }] };
    expect(rulesFromItemMechanics([item("И", [gated(w)])], () => true, stardragon)).toEqual([]);
    expect(rulesFromItemMechanics([item("И", [gated(w)])], () => true, ironlord)).toHaveLength(1);
  });
});
