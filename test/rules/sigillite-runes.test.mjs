// test/rules/sigillite-runes.test.mjs
//
// Руны Сигиллитов (wdbc-fsl9) — экономика ресурса Элитного Архетипа
// «Последователь Ордена Сигиллитов» (DoomBC — Психокеры-Жабы, стр. 101-102).
//
// Главное, что здесь проверяется, — не только числа книги, но и ГРАНИЦА: у
// псайкера без Черты «Магия Сигиллитов» подсистема не должна давать ровно
// ничего (ни максимума, ни начисления, ни цены), потому что она встраивается
// в общий конвейер психосил, которым пользуются ВСЕ псайкеры системы.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  RUNE_BASE_MAX, RUNE_STRIKE_COST, RUNE_MAGIC_FLAG,
  hasRuneMagic, talentTakes, archeotechSteps, runeMax, runeGainPerTurn,
  runeStartOfCombat, runeCalculatorBonus, runeCostForPower, runeCostTotal,
  runeStrikeMax, runeStrikeRefund, runeValue, runeUpdate
} from "../../module/rules/sigillite-runes.mjs";

/** Предмет с записью Конструктора «Возможность» — так Черта раздаёт Путь. */
function capabilityItem(key, { type = "trait", name = "Магия Сигиллитов" } = {}) {
  return {
    id: `cap-${key}`, type, name,
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  };
}

/** Талант по имени — счёт взятий идёт по числу предметов, как «Бездонная Душа». */
function talent(name, extra = {}) {
  return { id: `${name}-${Math.random()}`, type: "talent", name, system: { ...extra } };
}

function actorOf({ runeMagic = true, talents = [], archeotechRank = null,
                   int = 40, intBonus = 4, psyRating = 3, runes = 0 } = {}) {
  const items = [];
  if (runeMagic) items.push(capabilityItem(RUNE_MAGIC_FLAG));
  items.push(...talents);
  const forbiddenLore = archeotechRank
    ? [{ specKey: "archeotech", specialty: "Археотех", rank: archeotechRank }]
    : [];
  return {
    name: "Сигиллит", type: "character",
    system: {
      characteristics: { int: { total: int, bonus: intBonus } },
      psyker: { rating: psyRating, currentRating: psyRating, class: "bound" },
      groupSkills: { forbiddenLore },
      sigilliteRunes: { value: runes, max: 0 }
    },
    items: Object.assign(items.slice(), { contents: items })
  };
}

const power = pr => ({ name: "Психосила", system: { prRequired: pr } });

describe("Руны Сигиллитов — доступ к Пути", () => {
  it("Черта «Магия Сигиллитов» открывает Путь", () => {
    expect(hasRuneMagic(actorOf())).toBe(true);
  });

  it("без Черты Путь закрыт — и вся арифметика молчит", () => {
    const plain = actorOf({ runeMagic: false, archeotechRank: "expert",
      talents: [talent("Rune Library"), talent("Rune Calculator")] });
    expect(hasRuneMagic(plain)).toBe(false);
    expect(runeMax(plain)).toBe(0);
    expect(runeGainPerTurn(plain)).toBe(0);
    expect(runeStartOfCombat(plain)).toBe(0);
    expect(runeCalculatorBonus(plain)).toBe(0);
    expect(runeStrikeMax(plain, power(2))).toBe(0);
    expect(runeUpdate(plain, +5)).toBeNull();
  });
});

describe("Ступени Forbidden Lore (Archeotech)", () => {
  it("нет навыка — нет ступеней", () => {
    expect(archeotechSteps(actorOf())).toBe(0);
  });

  it("«Знает» = 1, «+10» = 2, «+20» = 3, «+30» = 4", () => {
    expect(archeotechSteps(actorOf({ archeotechRank: "knows"   }))).toBe(1);
    expect(archeotechSteps(actorOf({ archeotechRank: "trained" }))).toBe(2);
    expect(archeotechSteps(actorOf({ archeotechRank: "veteran" }))).toBe(3);
    expect(archeotechSteps(actorOf({ archeotechRank: "expert"  }))).toBe(4);
  });

  it("+30 и Талант Mastery по Археотеху дают книжные +5", () => {
    const a = actorOf({ archeotechRank: "expert",
      talents: [talent("Mastery / Мастерство", { specialization: "Forbidden Lore (Archeotech)" })] });
    expect(archeotechSteps(a)).toBe(5);
  });

  it("Mastery без +30 пятой ступени не даёт", () => {
    const a = actorOf({ archeotechRank: "veteran",
      talents: [talent("Mastery / Мастерство", { specialization: "Forbidden Lore (Archeotech)" })] });
    expect(archeotechSteps(a)).toBe(3);
  });

  it("Mastery по чужому навыку не считается", () => {
    const a = actorOf({ archeotechRank: "expert",
      talents: [talent("Mastery / Мастерство", { specialization: "Forbidden Lore (Warp)" })] });
    expect(archeotechSteps(a)).toBe(4);
  });

  it("другая специализация Запретных знаний ступеней не даёт", () => {
    const a = actorOf();
    a.system.groupSkills.forbiddenLore = [{ specKey: "warp", specialty: "Варп", rank: "expert" }];
    expect(archeotechSteps(a)).toBe(0);
  });
});

describe("Максимум Рун", () => {
  it("базово 20", () => {
    expect(runeMax(actorOf())).toBe(RUNE_BASE_MAX);
  });

  it("«Библиотека Рун»: +I.b и +1 за ступень, за каждое взятие", () => {
    // I.b 4, Археотех «+20» = 3 ступени → +7 за взятие.
    const one = actorOf({ archeotechRank: "veteran", talents: [talent("Библиотека Рун")] });
    expect(runeMax(one)).toBe(20 + 7);
    const three = actorOf({ archeotechRank: "veteran",
      talents: [talent("Rune Library"), talent("Rune Library"), talent("Rune Library")] });
    expect(runeMax(three)).toBe(20 + 21);
  });

  it("больше трёх взятий не считаются — книжный потолок «до 3 раз»", () => {
    const four = actorOf({ talents: Array.from({ length: 4 }, () => talent("Rune Library")) });
    expect(talentTakes(four, ["Rune Library", "Библиотека Рун"])).toBe(3);
    expect(runeMax(four)).toBe(20 + 3 * 4);
  });
});

describe("Начисление Рун", () => {
  it("в начале Хода — бPR плюс ступени Археотеха", () => {
    expect(runeGainPerTurn(actorOf({ psyRating: 5, archeotechRank: "trained" }))).toBe(7);
  });

  it("в начале боя — ровно бPR, и не выше максимума", () => {
    expect(runeStartOfCombat(actorOf({ psyRating: 6 }))).toBe(6);
    const weak = actorOf({ psyRating: 60 });   // абсурдный бPR упирается в 20
    expect(runeStartOfCombat(weak)).toBe(20);
  });

  it("«Вычислитель Рун» даёт +I.b за взятие, до трёх", () => {
    expect(runeCalculatorBonus(actorOf({ talents: [talent("Rune Calculator")] }))).toBe(4);
    expect(runeCalculatorBonus(actorOf({
      talents: Array.from({ length: 5 }, () => talent("Вычислитель Рун")) }))).toBe(12);
  });

  it("без «Вычислителя» первый Ход ничего не добавляет", () => {
    expect(runeCalculatorBonus(actorOf())).toBe(0);
  });
});

describe("Цена манифестации", () => {
  it("бPR психосилы × 2", () => {
    expect(runeCostForPower(power(1))).toBe(2);
    expect(runeCostForPower(power(4))).toBe(8);
  });

  it("сила без требования PR всё равно стоит пару Рун", () => {
    expect(runeCostForPower(power(0))).toBe(2);
  });

  it("«Рунный Удар»: каждые +1 эPR стоят четыре Руны сверху", () => {
    expect(runeCostTotal(power(3), 0)).toBe(6);
    expect(runeCostTotal(power(3), 2)).toBe(6 + 2 * RUNE_STRIKE_COST);
  });

  it("сколько эPR по карману — считается по остатку после базовой цены", () => {
    // 20 Рун, сила бPR 2 → база 4, остаток 16 → четыре шага по 4.
    const a = actorOf({ runes: 20, talents: [talent("Rune Strike")] });
    expect(runeStrikeMax(a, power(2))).toBe(4);
  });

  it("без Таланта «Рунный Удар» усиления нет даже при полном пуле", () => {
    expect(runeStrikeMax(actorOf({ runes: 20 }), power(2))).toBe(0);
  });

  it("если Рун не хватает даже на базовую цену — усилений ноль", () => {
    const a = actorOf({ runes: 3, talents: [talent("Rune Strike")] });
    expect(runeStrikeMax(a, power(2))).toBe(0);
  });

  it("провал «Рунного Удара» возвращает I.b Рун", () => {
    expect(runeStrikeRefund(actorOf({ intBonus: 5 }))).toBe(5);
  });
});

describe("Запись пула", () => {
  it("трата уменьшает значение", () => {
    const a = actorOf({ runes: 10 });
    expect(runeUpdate(a, -6)).toEqual({ "system.sigilliteRunes.value": 4 });
  });

  it("ниже нуля не уходит", () => {
    const a = actorOf({ runes: 3 });
    expect(runeUpdate(a, -9)).toEqual({ "system.sigilliteRunes.value": 0 });
  });

  it("выше максимума не поднимается", () => {
    const a = actorOf({ runes: 18 });
    expect(runeUpdate(a, +9)).toEqual({ "system.sigilliteRunes.value": 20 });
  });

  it("когда менять нечего — обновления нет вовсе", () => {
    const a = actorOf({ runes: 20 });
    expect(runeUpdate(a, +5)).toBeNull();
    expect(runeUpdate(actorOf({ runes: 0 }), -5)).toBeNull();
  });

  it("начало боя ставит значение, а не прибавляет", () => {
    const a = actorOf({ runes: 17, psyRating: 4 });
    expect(runeUpdate(a, 0, { set: runeStartOfCombat(a) }))
      .toEqual({ "system.sigilliteRunes.value": 4 });
  });

  it("текущее значение читается из пула", () => {
    expect(runeValue(actorOf({ runes: 7 }))).toBe(7);
    expect(runeValue({})).toBe(0);
  });
});
