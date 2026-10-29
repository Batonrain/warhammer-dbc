// test/rules/requisition.test.mjs
//
// Тест «Реквизиция» (Sahara peer-ancient-warrior-lord-of-war-excessive-wealth,
// часть «б», решение владельца 24.10.2026). Книга, DoomBC — Основная книга:
//   • глава «Бесчестие и Порча», «Реквизиция»: «тест на Inf+0 с модификаторами
//     Редкости, Качества и Количества того, что он хочет добыть»;
//   • стр. 165, «Редкость и Качество»: таблицы Редкости (+70…−70), Количества
//     (+10…−60) и Качества; «расходное снаряжение, вроде гранат и медикаментов,
//     считается на 2 уровня количества выше (т.е. 5-10 гранат реквизируется с
//     +10 вместо −10)».
//
// Чистая логика — без Foundry.

import { describe, it, expect } from "vitest";
import {
  rarityMod, QUANTITY_TIERS, quantityTier, qualityMod,
  itemRarity, itemClass, isConsumableItem, rarityShifts, effectiveRarity,
  requisitionModifier, requisitionPlan, requisitionSummaryLines,
  REQUISITION_TALENTS, REQUISITION_PACKS
} from "../../module/rules/requisition.mjs";

const talent = name => ({ type: "talent", name, system: {} });
const actorWith = (...names) => ({ items: names.map(talent), system: { characteristics: { inf: { total: 45 } } } });
const weapon = (system = {}, name = "Болтер") => ({ type: "weapon", name, system: { availability: 2, ...system } });

describe("rarityMod: таблица Редкости (стр. 165; сами числа — requisition-vs-data против книги)", () => {
  it("rarityMod: за пределами −5..+5 прижимает к краю, мусор — ноль", () => {
    expect(rarityMod(2)).toBe(-20);
    expect(rarityMod(-5)).toBe(70);
    expect(rarityMod(9)).toBe(-70);
    expect(rarityMod(-9)).toBe(70);
    expect(rarityMod("3")).toBe(-30);
    expect(rarityMod(undefined)).toBe(0);
    expect(rarityMod("abc")).toBe(0);
  });
});

describe("таблица Количества (стр. 165)", () => {
  const modOf = (q, opts) => quantityTier(q, opts).mod;
  it("границы ступеней: 1 / 2-4 / 5-10 / 11-100 / 101-1000 / 1001+", () => {
    expect(QUANTITY_TIERS.map(t => t.mod)).toEqual([10, 0, -10, -20, -40, -60]);
    expect([1, 2, 4, 5, 10, 11, 100, 101, 1000, 1001, 50000].map(q => modOf(q)))
      .toEqual([10, 0, 0, -10, -10, -20, -20, -40, -40, -60, -60]);
  });
  it("количество меньше 1 или не число считается за 1", () => {
    expect(modOf(0)).toBe(10);
    expect(modOf(-3)).toBe(10);
    expect(modOf("x")).toBe(10);
    expect(modOf(7.9)).toBe(-10);
  });
  it("расходное — на 2 ступени легче: 5-10 гранат = +10 вместо −10 (пример книги)", () => {
    expect(modOf(5, { consumable: true })).toBe(10);
    expect(modOf(10, { consumable: true })).toBe(10);
  });
  it("расходное: остальные ступени и упор в первую ступень", () => {
    expect(modOf(1, { consumable: true })).toBe(10);   // выше +10 нет — упор
    expect(modOf(3, { consumable: true })).toBe(10);   // 2-4 → 1 предмет
    expect(modOf(50, { consumable: true })).toBe(0);   // 11-100 → 2-4
    expect(modOf(500, { consumable: true })).toBe(-10);
    expect(modOf(5000, { consumable: true })).toBe(-20);
  });
});

describe("Качество: незнакомое значение (числа таблицы — requisition-vs-data против книги)", () => {
  it("неизвестное Качество — Обычное", () => {
    expect(qualityMod("zzz")).toBe(0);
    expect(qualityMod(undefined)).toBe(0);
  });
});

describe("Редкость предмета (itemRarity)", () => {
  it("обычный предмет — его availability", () => {
    expect(itemRarity(weapon({ availability: 3 }))).toBe(3);
    expect(itemRarity(weapon({ availability: -2 }))).toBe(-2);
  });
  it("настоящий R0 — это 0, а не «нет Редкости» (решение r0)", () => {
    expect(itemRarity(weapon({ availability: 0 }))).toBe(0);
  });
  it("Ритуал: Редкость Записи — system.record; record 0 → нет Редкости", () => {
    expect(itemRarity({ type: "ritual", system: { record: 3 } })).toBe(3);
    expect(itemRarity({ type: "ritual", system: { record: 0 } })).toBeNull();
  });
  it("Имплант без Редкости — нет Редкости, с Редкостью 0 — 0", () => {
    expect(itemRarity({ type: "implant", system: { availability: null } })).toBeNull();
    expect(itemRarity({ type: "implant", system: {} })).toBeNull();
    expect(itemRarity({ type: "implant", system: { availability: 0 } })).toBe(0);
  });
  it("предмета нет — null", () => {
    expect(itemRarity(null)).toBeNull();
  });
});

describe("класс предмета (для Талантов)", () => {
  it("экзотическое оружие — weaponType exotic", () => {
    expect(itemClass(weapon({ weaponType: "exotic" })).exotic).toBe(true);
    expect(itemClass(weapon({ weaponType: "bolt" })).exotic).toBe(false);
  });
  it("имплант-техника — тип cybernetic или Имплант Кибернетики, Бионики, Псибернетики, Механикус и Скитариев (решение владельца 26.10.2026)", () => {
    expect(itemClass({ type: "cybernetic", system: {} }).cybernetic).toBe(true);
    for (const category of ["cybernetic", "bionic", "bionic-arm", "bionic-leg", "psybernetic",
      "mechanicus", "mechEnergy", "mechFocus", "mechOther", "mechadendrite", "skitarii"]) {
      expect(itemClass({ type: "implant", system: { category } }).cybernetic, category).toBe(true);
    }
  });
  it("органы Астартес, биоимпланты Друкхари и Археотех в имплант-технику не входят", () => {
    for (const category of ["astartes", "bioimplant", "archeotech", "", undefined]) {
      expect(itemClass({ type: "implant", system: { category } }).cybernetic, String(category)).toBe(false);
    }
    // категория имплант-техники у НЕ-импланта ничего не значит
    expect(itemClass({ type: "gear", system: { category: "bionic" } }).cybernetic).toBe(false);
  });
  it("Легион — свойство legion в weaponProps оружия", () => {
    expect(itemClass(weapon({ weaponProps: [{ key: "precise" }, { key: "legion" }] })).legion).toBe(true);
    expect(itemClass(weapon({ weaponProps: [{ key: "precise" }] })).legion).toBe(false);
    expect(itemClass(weapon({ weaponProps: ["legion"] })).legion).toBe(true);
    expect(itemClass(weapon({})).legion).toBe(false);
  });
  it("Запись ритуала — Ритуал с record больше нуля", () => {
    expect(itemClass({ type: "ritual", system: { record: 2 } }).ritual).toBe(true);
    expect(itemClass({ type: "ritual", system: { record: 0 } }).ritual).toBe(false);
    expect(itemClass(weapon()).ritual).toBe(false);
  });
  it("предмета нет — все признаки выключены", () => {
    expect(itemClass(null)).toEqual({ exotic: false, cybernetic: false, legion: false, ritual: false });
  });
});

describe("расходное снаряжение (isConsumableItem)", () => {
  it("боеприпасы, препараты и гранаты", () => {
    expect(isConsumableItem({ type: "ammo", system: {} })).toBe(true);
    expect(isConsumableItem({ type: "drug", system: {} })).toBe(true);
    expect(isConsumableItem(weapon({ weaponType: "grenade" }))).toBe(true);
  });
  it("инструменты из папки «Расходники» — да, из других папок — нет", () => {
    expect(isConsumableItem({ type: "tool", folder: { name: "Расходники" }, system: {} })).toBe(true);
    expect(isConsumableItem({ type: "tool", folder: { name: "Общие" }, system: {} })).toBe(false);
    expect(isConsumableItem({ type: "tool", system: {} })).toBe(false);
  });
  it("обычное оружие, броня, снаряжение — нет", () => {
    expect(isConsumableItem(weapon({ weaponType: "bolt" }))).toBe(false);
    expect(isConsumableItem({ type: "armor", system: {} })).toBe(false);
    expect(isConsumableItem({ type: "gear", system: {} })).toBe(false);
    expect(isConsumableItem(null)).toBe(false);
  });
});

describe("снижение Редкости Талантами", () => {
  const EXOTIC = { exotic: true, cybernetic: false, legion: false, ritual: false };
  const CYBER = { exotic: false, cybernetic: true, legion: false, ritual: false };
  const LEGION = { exotic: false, cybernetic: false, legion: true, ritual: false };
  const RITUAL = { exotic: false, cybernetic: false, legion: false, ritual: true };
  const NONE = { exotic: false, cybernetic: false, legion: false, ritual: false };
  const sum = shifts => shifts.reduce((s, x) => s + x.value, 0);

  it("без Талантов сдвигов нет", () => {
    expect(rarityShifts(actorWith(), EXOTIC)).toEqual([]);
  });
  it("Повелитель Войны: −1 Экзотическому и Кибернетике, обычному — нет", () => {
    const a = actorWith("Lord of War / Повелитель Войны");
    expect(sum(rarityShifts(a, EXOTIC))).toBe(-1);
    expect(sum(rarityShifts(a, CYBER))).toBe(-1);
    expect(sum(rarityShifts(a, NONE))).toBe(0);
    expect(sum(rarityShifts(a, LEGION))).toBe(0);
  });
  it("Древний Воин: −1 Легион-снаряжению", () => {
    const a = actorWith("Ancient Warrior / Древний Воин");
    expect(sum(rarityShifts(a, LEGION))).toBe(-1);
    expect(sum(rarityShifts(a, EXOTIC))).toBe(0);
  });
  it("Разгадыватель Ритуалов: −1 Записи ритуала", () => {
    const a = actorWith("Rite Puzzler / Разгадыватель Ритуалов");
    expect(sum(rarityShifts(a, RITUAL))).toBe(-1);
    expect(sum(rarityShifts(a, NONE))).toBe(0);
  });
  it("два Таланта на один предмет складываются (Легион-экзотика)", () => {
    const a = actorWith("Lord of War / Повелитель Войны", "Ancient Warrior / Древний Воин");
    expect(sum(rarityShifts(a, { ...LEGION, exotic: true }))).toBe(-2);
  });
  it("Экзотика и Кибернетика одним Талантом дают один раз, не дважды", () => {
    const a = actorWith("Lord of War / Повелитель Войны");
    expect(sum(rarityShifts(a, { ...EXOTIC, cybernetic: true }))).toBe(-1);
  });
  it("Талант чужого имени не считается (Peerless, Know the Enemy)", () => {
    const a = actorWith("Lord of Wars", "Ancient Warrior Spirit");
    expect(rarityShifts(a, { ...EXOTIC, legion: true })).toEqual([]);
  });
  it("в сдвиге есть подпись для карточки", () => {
    const [s] = rarityShifts(actorWith("Lord of War / Повелитель Войны"), EXOTIC);
    expect(s.label).toMatch(/Повелитель Войны/);
    expect(s.id).toBe(REQUISITION_TALENTS.lordOfWar.id);
  });
  it("effectiveRarity: сумма сдвигов, но не ниже −5 и не выше +5", () => {
    expect(effectiveRarity(2, [{ value: -1 }])).toBe(1);
    expect(effectiveRarity(-5, [{ value: -1 }])).toBe(-5);
    expect(effectiveRarity(5, [])).toBe(5);
    expect(effectiveRarity(0, [{ value: -1 }, { value: -1 }])).toBe(-2);
  });
});

describe("requisitionModifier — сумма трёх таблиц", () => {
  it("R2, 1 предмет, Обычное: −20 +10 +0 = −10", () => {
    const m = requisitionModifier({ rarity: 2, quantity: 1, quality: "common" });
    expect(m.rarityMod).toBe(-20);
    expect(m.quantityMod).toBe(10);
    expect(m.qualityMod).toBe(0);
    expect(m.total).toBe(-10);
  });
  it("R-2, 11-100, Poor: +20 −20 +10 = +10", () => {
    expect(requisitionModifier({ rarity: -2, quantity: 30, quality: "poor" }).total).toBe(10);
  });
  it("R5, 1001+, Best: −70 −60 −20 = −150", () => {
    expect(requisitionModifier({ rarity: 5, quantity: 2000, quality: "best" }).total).toBe(-150);
  });
  it("модификатор ГМа (местная распространённость) прибавляется и подписывается", () => {
    const m = requisitionModifier({ rarity: 0, quantity: 3, quality: "common", local: -20 });
    expect(m.total).toBe(-20);
    expect(m.parts.some(p => /ГМ|мест/i.test(p))).toBe(true);
  });
  it("подписи слагаемых для карточки, нулевые не показываются", () => {
    const m = requisitionModifier({ rarity: 0, quantity: 3, quality: "common" });
    expect(m.total).toBe(0);
    expect(m.parts).toEqual([]);
  });
  it("«расходное» отражено в подписи Количества", () => {
    const m = requisitionModifier({ rarity: 0, quantity: 8, quality: "common", consumable: true });
    expect(m.quantityMod).toBe(10);
    expect(m.parts.join(" ")).toMatch(/расход/i);
  });
  it("нет Редкости (null) считается за 0 в расчёте, но помечается", () => {
    const m = requisitionModifier({ rarity: null, quantity: 1, quality: "common" });
    expect(m.rarityMod).toBe(0);
    expect(m.unrated).toBe(true);
  });
});

describe("requisitionPlan — всё вместе для окна и карточки", () => {
  it("Повелитель Войны, экзотический болтер R2 → R1: −10, а не −20", () => {
    const a = actorWith("Lord of War / Повелитель Войны");
    const item = weapon({ weaponType: "exotic", availability: 2 });
    const plan = requisitionPlan(a, { item, rarity: itemRarity(item), quantity: 1, quality: "common" });
    expect(plan.baseRarity).toBe(2);
    expect(plan.rarity).toBe(1);
    expect(plan.mods.rarityMod).toBe(-10);
    expect(plan.total).toBe(0);                       // −10 (R1) +10 (1 шт.)
    expect(plan.rollContext).toMatchObject({ requisition: true, requisitionRarity: 1, requisitionQuantity: 1 });
  });
  it("Rite Puzzler: Запись R3 → R2", () => {
    const a = actorWith("Rite Puzzler / Разгадыватель Ритуалов");
    const item = { type: "ritual", name: "Ритуал", system: { record: 3 } };
    const plan = requisitionPlan(a, { item, rarity: itemRarity(item), quantity: 1, quality: "common" });
    expect(plan.rarity).toBe(2);
  });
  it("без предмета (ручной ввод) класс берётся из явного cls", () => {
    const a = actorWith("Ancient Warrior / Древний Воин");
    const plan = requisitionPlan(a, { rarity: 2, cls: { legion: true }, quantity: 1, quality: "common" });
    expect(plan.rarity).toBe(1);
  });
  it("расходное по предмету определяется само, если не сказано иное", () => {
    const grenade = weapon({ weaponType: "grenade", availability: 0 });
    const plan = requisitionPlan(actorWith(), { item: grenade, rarity: 0, quantity: 8, quality: "common" });
    expect(plan.consumable).toBe(true);
    expect(plan.mods.quantityMod).toBe(10);
    const forced = requisitionPlan(actorWith(), { item: grenade, rarity: 0, quantity: 8, quality: "common", consumable: false });
    expect(forced.mods.quantityMod).toBe(-10);
  });
  it("подпись в карточку: что добывается", () => {
    const plan = requisitionPlan(actorWith(), { name: "Лазган", rarity: -2, quantity: 5, quality: "common" });
    expect(plan.label).toBe("Лазган ×5");
  });
});

describe("requisitionSummaryLines — строки карточки", () => {
  it("со сдвигом Таланта: откуда взялась Редкость и итог таблиц", () => {
    const a = actorWith("Lord of War / Повелитель Войны");
    const item = weapon({ weaponType: "exotic", availability: 2 });
    const lines = requisitionSummaryLines(requisitionPlan(a, { item, quantity: 5, quality: "good" }));
    expect(lines[0]).toMatch(/R2 → R1.*Повелитель Войны/);
    expect(lines.some(l => /Количество.*5-10.*−10/.test(l))).toBe(true);
    expect(lines.some(l => /Качество Good\.Q: −10/.test(l))).toBe(true);
    expect(lines.at(-1)).toBe("Модификатор таблиц книги (стр. 165): −30");   // −10 (R1) −10 (5-10 шт.) −10 (Good.Q)
  });
  it("без сдвигов и без модификаторов — одна итоговая строка с нулём", () => {
    const lines = requisitionSummaryLines(requisitionPlan(actorWith(), { rarity: 0, quantity: 3 }));
    expect(lines).toEqual(["Модификатор таблиц книги (стр. 165): 0"]);
  });
  it("предмет без Редкости помечен", () => {
    const item = { type: "implant", name: "Имплант", system: {} };
    const lines = requisitionSummaryLines(requisitionPlan(actorWith(), { item, quantity: 1 }));
    expect(lines.some(l => /нет Редкости/.test(l))).toBe(true);
  });
});

describe("паки выбора", () => {
  it("включают оружие, броню, снаряжение, химию и Записи ритуалов", () => {
    for (const p of ["weapons", "armor", "gear", "ammunition", "chemistry", "rituals", "implants"]) {
      expect(REQUISITION_PACKS).toContain(p);
    }
  });
});
