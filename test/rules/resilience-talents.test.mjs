// test/rules/resilience-talents.test.mjs
//
// Таланты Стойкости (глава 3, пакет A): чистая логика rules/resilience-talents.mjs.
// Крепкое Телосложение, Неутомимый, Ментальная Стойкость, Бронник, Укреплённая
// Душа, Настоящая Выдержка, Сопротивление, Декаданс, Пожиратель Змей.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  RESILIENCE_TALENTS, hasResilienceTalent,
  soundConstitutionCopies, soundConstitutionCap, soundConstitutionWounds, soundConstitutionWoundsMods,
  tirelessExempt, fatigueFaintThreshold,
  ARMOUR_MONGER_AP, ARMOUR_MONGER_FLAG, armourMongerDayOf, armourMongerStamp, armourMongerActive,
  armourMongerBonus, armourMongerExpired,
  hardenedSoulSoakBonus, hardenedSoulDice,
  trueGritDamage,
  resistanceSpecs, resistanceTestSpec, resistanceBonus, resilienceTalentRules,
  snakeEaterHalve
} from "../../module/rules/resilience-talents.mjs";

const talent = (name, extra = {}) => ({ type: "talent", name, system: {}, flags: {}, ...extra });
const actorWith = (items = [], system = {}, flags = {}) => ({
  items: items.map(i => (typeof i === "string" ? talent(i) : i)),
  system: {
    race: "human",
    characteristics: { t: { bonus: 4 }, wp: { bonus: 3 }, int: { bonus: 5 } },
    ...system
  },
  flags: { "warhammer-dbc": flags },
  getFlag: (_s, k) => flags[k]
});

describe("hasResilienceTalent", () => {
  it("по имени Таланта (любая половина двуязычного имени)", () => {
    expect(hasResilienceTalent(actorWith(["Tireless / Неутомимый"]), "tireless")).toBe(true);
    expect(hasResilienceTalent(actorWith(["Tireless"]), "tireless")).toBe(true);
  });
  it("по записи Конструктора kind:capability на любом предмете", () => {
    const item = { type: "trait", name: "Что-то", flags: { "warhammer-dbc": { mechanics: [{ entries: [
      { kind: "capability", capabilityKey: "resilience.core.tireless" }] }] } } };
    expect(hasResilienceTalent(actorWith([item]), "tireless")).toBe(true);
  });
  it("без Таланта и по неизвестному ключу — false", () => {
    expect(hasResilienceTalent(actorWith(), "tireless")).toBe(false);
    expect(hasResilienceTalent(actorWith(["Tireless / Неутомимый"]), "нет-такого")).toBe(false);
  });
  it("у каждого Таланта свой ключ resilience.core.*", () => {
    const keys = Object.values(RESILIENCE_TALENTS).map(t => t.key);
    for (const k of keys) expect(k).toMatch(/^resilience\.core\./);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("Крепкое Телосложение: +1 Рана за копию, потолок T.b (+2 не-Космодесантнику)", () => {
  it("потолок: T.b для Космодесантника, T.b+2 для остальных", () => {
    expect(soundConstitutionCap(4, true)).toBe(4);
    expect(soundConstitutionCap(4, false)).toBe(6);
    expect(soundConstitutionCap(-1, false)).toBe(2);
  });
  it("копий меньше потолка — по +1 за каждую", () => {
    expect(soundConstitutionWounds({ copies: 3, tb: 4, astartes: false })).toBe(3);
    expect(soundConstitutionWounds({ copies: 0, tb: 4, astartes: false })).toBe(0);
  });
  it("копий больше потолка — упирается в потолок", () => {
    expect(soundConstitutionWounds({ copies: 9, tb: 4, astartes: true })).toBe(4);
    expect(soundConstitutionWounds({ copies: 9, tb: 4, astartes: false })).toBe(6);
  });
  it("копии считаются по предметам-Талантам с этим именем", () => {
    const a = actorWith(["Sound Constitution / Крепкое Телосложение", "Sound Constitution / Крепкое Телосложение", "Hardy / Крепкий"]);
    expect(soundConstitutionCopies(a)).toBe(2);
  });
  it("поправка к максимуму Ран: подпись и значение; без Таланта — пусто", () => {
    const a = actorWith(["Sound Constitution", "Sound Constitution", "Sound Constitution"]);
    expect(soundConstitutionWoundsMods(a, 4)).toEqual([{ label: "Крепкое Телосложение ×3", value: 3 }]);
    expect(soundConstitutionWoundsMods(actorWith(), 4)).toEqual([]);
  });
  it("Космодесантник (раса) получает потолок T.b: пять копий при T.b 4 дают +4", () => {
    const names = Array(5).fill("Sound Constitution");
    expect(soundConstitutionWoundsMods(actorWith(names, { race: "astartes" }), 4)[0].value).toBe(4);
    expect(soundConstitutionWoundsMods(actorWith(names, { race: "human" }), 4)[0].value).toBe(5);
  });
  it("Космодесантник по Черте Astartes тоже получает потолок T.b", () => {
    const a = actorWith([...Array(6).fill("Sound Constitution"), { type: "trait", name: "Astartes", system: {}, flags: {} }]);
    expect(soundConstitutionWoundsMods(a, 4)[0].value).toBe(4);
  });
});

describe("Неутомимый: нет штрафа Усталости на WS, BS, S, T, A", () => {
  it("у носителя освобождены WS, BS, S, T, Ag", () => {
    const a = actorWith(["Tireless / Неутомимый"]);
    for (const c of ["ws", "bs", "s", "t", "ag"]) expect(tirelessExempt(a, c)).toBe(true);
  });
  it("I, P, W, F остаются под штрафом", () => {
    const a = actorWith(["Tireless / Неутомимый"]);
    for (const c of ["int", "per", "wp", "fel"]) expect(tirelessExempt(a, c)).toBe(false);
  });
  it("регистр ключа не важен; пустой ключ — не освобождён", () => {
    const a = actorWith(["Tireless / Неутомимый"]);
    expect(tirelessExempt(a, "WS")).toBe(true);
    expect(tirelessExempt(a, "")).toBe(false);
    expect(tirelessExempt(a, undefined)).toBe(false);
  });
  it("без Таланта — не освобождён никто", () => {
    expect(tirelessExempt(actorWith(), "ws")).toBe(false);
  });
});

describe("Ментальная Стойкость: обморок при T.b+2×W.b", () => {
  it("без Таланта порог T.b+W.b", () => {
    expect(fatigueFaintThreshold(actorWith())).toBe(7);
  });
  it("с Талантом T.b+2×W.b", () => {
    expect(fatigueFaintThreshold(actorWith(["Mental Fortitude / Ментальная Стойкость"]))).toBe(10);
  });
  it("нет актора/характеристик — ноль", () => {
    expect(fatigueFaintThreshold(null)).toBe(0);
    expect(fatigueFaintThreshold({ items: [], system: {} })).toBe(0);
  });
});

describe("Бронник: +2 AP, тумблер до полуночи", () => {
  const DAY = 86400;
  it("сутки Календаря — целая часть worldTime / 86400", () => {
    expect(armourMongerDayOf(5 * DAY + 100)).toBe(5);
    expect(armourMongerDayOf(5 * DAY - 1)).toBe(4);
  });
  it("метка хранит сутки включения", () => {
    expect(armourMongerStamp(7 * DAY + 3600)).toEqual({ day: 7 });
  });
  it("активна в те же сутки, гаснет в полночь", () => {
    const a = actorWith(["Armour-Monger / Бронник"], {}, { [ARMOUR_MONGER_FLAG]: { day: 7 } });
    expect(armourMongerActive(a, 7 * DAY + 5)).toBe(true);
    expect(armourMongerActive(a, 8 * DAY)).toBe(false);
    expect(armourMongerActive(a, 8 * DAY - 1)).toBe(true);
  });
  it("время неизвестно (мир ещё грузится) — верим метке", () => {
    const a = actorWith(["Armour-Monger / Бронник"], {}, { [ARMOUR_MONGER_FLAG]: { day: 7 } });
    expect(armourMongerActive(a, null)).toBe(true);
    expect(armourMongerActive(a, undefined)).toBe(true);
  });
  it("без Таланта метка ничего не даёт", () => {
    const a = actorWith([], {}, { [ARMOUR_MONGER_FLAG]: { day: 7 } });
    expect(armourMongerActive(a, 7 * DAY)).toBe(false);
    expect(armourMongerBonus(a, 7 * DAY)).toBe(0);
  });
  it("без метки — нет бонуса; с меткой +2", () => {
    expect(armourMongerBonus(actorWith(["Armour-Monger"]), 7 * DAY)).toBe(0);
    const a = actorWith(["Armour-Monger"], {}, { [ARMOUR_MONGER_FLAG]: { day: 7 } });
    expect(armourMongerBonus(a, 7 * DAY)).toBe(ARMOUR_MONGER_AP);
    expect(ARMOUR_MONGER_AP).toBe(2);
  });
  it("часы Календаря: метка прошлых суток просрочена, сегодняшняя и пустая — нет", () => {
    expect(armourMongerExpired({ day: 7 }, 8 * DAY)).toBe(true);
    expect(armourMongerExpired({ day: 7 }, 7 * DAY + 50)).toBe(false);
    expect(armourMongerExpired(undefined, 8 * DAY)).toBe(false);
    expect(armourMongerExpired(null, 8 * DAY)).toBe(false);
  });
});

describe("Укреплённая Душа: ½ I.b (окр.▲)", () => {
  it("прибавка к поглощению варп-оружия: I.b 5 → 3, I.b 4 → 2, I.b 0 → 0", () => {
    const talentActor = ib => actorWith(["Hardened Soul / Укреплённая Душа"], { characteristics: { int: { bonus: ib }, t: { bonus: 4 }, wp: { bonus: 3 } } });
    expect(hardenedSoulSoakBonus(talentActor(5))).toBe(3);
    expect(hardenedSoulSoakBonus(talentActor(4))).toBe(2);
    expect(hardenedSoulSoakBonus(talentActor(0))).toBe(0);
  });
  it("без Таланта прибавки нет", () => {
    expect(hardenedSoulSoakBonus(actorWith())).toBe(0);
  });
  it("кубики Выжигания Души: минус ½ I.b, но не меньше одного", () => {
    expect(hardenedSoulDice(5, 5)).toBe(2);
    expect(hardenedSoulDice(2, 8)).toBe(1);
    expect(hardenedSoulDice(1, 8)).toBe(1);
    expect(hardenedSoulDice(3, 0)).toBe(3);
  });
});

describe("Настоящая Выдержка: −T.b урона при Ранах ниже 0, минимум 1", () => {
  const tg = (o) => trueGritDamage({ net: 10, tb: 4, value: 0, critical: 2, ablative: 0, ...o });
  it("уже в минусе: урон −T.b", () => {
    expect(tg({ net: 10 })).toEqual({ net: 6, reduced: 4 });
  });
  it("уже в минусе: не меньше 1", () => {
    expect(tg({ net: 3 })).toEqual({ net: 1, reduced: 2 });
    expect(tg({ net: 1 })).toEqual({ net: 1, reduced: 0 });
  });
  it("в плюсе и урон не пересекает ноль — Выдержка не действует", () => {
    expect(tg({ net: 5, value: 8, critical: 0 })).toEqual({ net: 5, reduced: 0 });
    expect(tg({ net: 8, value: 8, critical: 0 })).toEqual({ net: 8, reduced: 0 });
  });
  it("попадание пересекает ноль: урон −T.b, но Раны опускаются хотя бы до −1", () => {
    // 8 Ран, урон 10: без Выдержки −2; с T.b 4 урон 6 довёл бы только до +2 — нельзя, нужен 9 (до −1)
    expect(tg({ net: 10, value: 8, critical: 0 })).toEqual({ net: 9, reduced: 1 });
    // 2 Раны, урон 10: 10−4 = 6 ≥ 3 (до −1) — урон срезается целиком
    expect(tg({ net: 10, value: 2, critical: 0 })).toEqual({ net: 6, reduced: 4 });
  });
  it("аблативные Раны входят в запас до нуля", () => {
    expect(tg({ net: 10, value: 4, critical: 0, ablative: 4 })).toEqual({ net: 9, reduced: 1 });
  });
  it("нулевой T.b и нулевой урон — ничего не меняется", () => {
    expect(tg({ tb: 0 })).toEqual({ net: 10, reduced: 0 });
    expect(tg({ net: 0 })).toEqual({ net: 0, reduced: 0 });
  });
});

describe("Сопротивление: +10 на тесты сопротивления специализации", () => {
  const resistance = spec => ({ type: "talent", name: "Resistance / Сопротивление", system: { specialization: spec }, flags: {} });
  it("специализации читаются из поля предмета, разделитель — запятая", () => {
    const a = actorWith([resistance("Cold, Heat")]);
    expect([...resistanceSpecs(a)].sort()).toEqual(["cold", "heat"]);
  });
  it("и из скобок в имени: «Resistance (Fear)»", () => {
    const a = actorWith([{ type: "talent", name: "Resistance (Fear)", system: {}, flags: {} }]);
    expect([...resistanceSpecs(a)]).toEqual(["fear"]);
  });
  it("несколько копий складывают специализации", () => {
    const a = actorWith([resistance("Fear"), resistance("Poison")]);
    expect([...resistanceSpecs(a)].sort()).toEqual(["fear", "poison"]);
  });
  it("русские названия и синонимы распознаются", () => {
    expect([...resistanceSpecs(actorWith([resistance("Страх, Яд")]))].sort()).toEqual(["fear", "poison"]);
    expect([...resistanceSpecs(actorWith([resistance("Psychic Powers")]))]).toEqual(["psychic"]);
  });
  it("полный перечень из библиотеки (специализацию не выбрали) — не даёт ничего", () => {
    const all = "Cold, Blindness, Deafness, Disease, Fear, Heat, Poison, Psychic Powers, Stun";
    expect(resistanceSpecs(actorWith([resistance(all)])).size).toBe(0);
  });
  it("Талант без специализации — пустой набор", () => {
    expect(resistanceSpecs(actorWith([resistance("")])).size).toBe(0);
    expect(resistanceSpecs(actorWith()).size).toBe(0);
  });
  it("тег теста → специализация", () => {
    expect(resistanceTestSpec({ fearTest: true })).toBe("fear");
    expect(resistanceTestSpec({ poisonTest: true })).toBe("poison");
    expect(resistanceTestSpec({ psychicThreat: true })).toBe("psychic");
    expect(resistanceTestSpec({ stunTest: true })).toBe("stun");
    expect(resistanceTestSpec({ morale: true })).toBe(null);
    expect(resistanceTestSpec({})).toBe(null);
    expect(resistanceTestSpec(undefined)).toBe(null);
  });
  it("бонус +10 только на тест своей специализации", () => {
    const a = actorWith([resistance("Fear")]);
    expect(resistanceBonus(a, { fearTest: true, morale: true })).toBe(10);
    expect(resistanceBonus(a, { poisonTest: true })).toBe(0);
    expect(resistanceBonus(a, { morale: true })).toBe(0);
    expect(resistanceBonus(actorWith(), { fearTest: true })).toBe(0);
  });
  it("правило реестра: автоматическая строка +10 с подписью", () => {
    const a = actorWith([resistance("Poison")]);
    const rules = resilienceTalentRules(a, { poisonTest: true });
    expect(rules).toHaveLength(1);
    expect(rules[0].effects[0]).toMatchObject({ kind: "rollBonus", value: 10, auto: true, target: "all" });
    expect(rules[0].label).toMatch(/Сопротивление/);
    expect(resilienceTalentRules(a, { fearTest: true })).toEqual([]);
  });
});

describe("Декаданс: +10 на тесты Зависимости", () => {
  it("правило реестра на ctx.addictionTest у носителя", () => {
    const rules = resilienceTalentRules(actorWith(["Decadence / Декаданс"]), { addictionTest: true });
    expect(rules).toHaveLength(1);
    expect(rules[0].effects[0]).toMatchObject({ kind: "rollBonus", value: 10, auto: true });
  });
  it("без Таланта или на другом тесте — пусто", () => {
    expect(resilienceTalentRules(actorWith(), { addictionTest: true })).toEqual([]);
    expect(resilienceTalentRules(actorWith(["Decadence / Декаданс"]), { kind: "skill", char: "t" })).toEqual([]);
  });
});

describe("Пожиратель Змей: вдвое меньше (окр.▲)", () => {
  it("урон/срок режется до ceil(n/2)", () => {
    const a = actorWith(["Snake Eater / Пожиратель Змей"]);
    expect(snakeEaterHalve(a, 7)).toBe(4);
    expect(snakeEaterHalve(a, 6)).toBe(3);
    expect(snakeEaterHalve(a, 1)).toBe(1);
    expect(snakeEaterHalve(a, 0)).toBe(0);
  });
  it("без Таланта число не меняется", () => {
    expect(snakeEaterHalve(actorWith(), 7)).toBe(7);
  });
});
