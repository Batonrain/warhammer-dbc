// test/combat/ship-attack.test.mjs
//
// Движок автоматизации боевых свойств узлов корабля (wdbc-jr93) —
// havoc/terminalPenetration/volkite. Без Foundry, чистые функции. Зеркало
// test/combat/armor-properties.test.mjs по духу: правила книги, не разметка.

import { describe, it, expect } from "vitest";
import { resolveShipProps, aggregateShipAttackAuto, hitsAfterShields,
         terminalPenetrationTargets, terminalPenetrationAdjustment,
         resolveShipAttackDamage, resolveShipCritRoll, lifetakerDamage } from "../../module/combat/ship-attack.mjs";

describe("resolveShipProps", () => {
  it("разрешает известные ключи, отбрасывает неизвестные", () => {
    const item = { system: { shipProps: [{ key: "havoc", rating: 2 }, { key: "unknownKey" }, { key: "volkite" }] } };
    const props = resolveShipProps(item);
    expect(props.map(p => p.key)).toEqual(["havoc", "volkite"]);
    expect(props.every(p => p.def)).toBe(true);
  });

  it("не падает без system.shipProps", () => {
    expect(resolveShipProps({ system: {} })).toEqual([]);
    expect(resolveShipProps(null)).toEqual([]);
  });
});

describe("aggregateShipAttackAuto", () => {
  it("пустой список — всё по нулям/ложно", () => {
    expect(aggregateShipAttackAuto([])).toEqual({ havocBonus: 0, terminalPenetration: 0, volkiteDouble: false, lifetakerCP: 0, penetrating: new Set() });
  });

  it("havoc(X) → havocBonus = X", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "havoc", rating: 3 }] } });
    expect(aggregateShipAttackAuto(props).havocBonus).toBe(3);
  });

  it("terminalPenetration(X) → terminalPenetration = X", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "terminalPenetration", rating: 4 }] } });
    expect(aggregateShipAttackAuto(props).terminalPenetration).toBe(4);
  });

  it("volkite → volkiteDouble = true (свойство без рейтинга)", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "volkite" }] } });
    expect(aggregateShipAttackAuto(props).volkiteDouble).toBe(true);
  });

  it("свойства без боевого auto (armored, fast…) не поднимают ничего", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "armored", rating: 2 }, { key: "fast", rating: 1 }] } });
    expect(aggregateShipAttackAuto(props)).toEqual({ havocBonus: 0, terminalPenetration: 0, volkiteDouble: false, lifetakerCP: 0, penetrating: new Set() });
  });

  it("несколько боевых свойств разом складываются в один набор", () => {
    const props = resolveShipProps({ system: { shipProps: [
      { key: "havoc", rating: 2 }, { key: "terminalPenetration", rating: 3 }, { key: "volkite" }
    ] } });
    const a = aggregateShipAttackAuto(props);
    expect(a.havocBonus).toBe(2);
    expect(a.terminalPenetration).toBe(3);
    expect(a.volkiteDouble).toBe(true);
  });

  it("lifetaker(X) → lifetakerCP = X (wdbc-qhwb)", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "lifetaker", rating: 5 }] } });
    expect(aggregateShipAttackAuto(props).lifetakerCP).toBe(5);
  });

  it("penetrating: одно значение → Set с одним кодом (wdbc-qhwb)", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "penetrating", rating: "armour" }] } });
    expect(aggregateShipAttackAuto(props).penetrating).toEqual(new Set(["armour"]));
  });

  it("penetrating: несколько значений через запятую → все коды в Set", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "penetrating", rating: "armour,voidShields" }] } });
    expect(aggregateShipAttackAuto(props).penetrating).toEqual(new Set(["armour", "voidShields"]));
  });

  it("penetrating без rating (пустой бэкфилл) → пустой Set, не падает", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "penetrating" }] } });
    expect(aggregateShipAttackAuto(props).penetrating).toEqual(new Set());
  });
});

// wdbc-eja: применяющая арифметика одного выстрела, вынесенная из
// module/sheets/ship-sheet.mjs::_resolveShipAttack. Числа сверены с
// packs-src/books/void.json (Aspects узлов, стр. 11/19/34/42/65/70/73).

describe("hitsAfterShields", () => {
  it("щиты снимают часть попаданий (min с hitsRaw)", () => {
    expect(hitsAfterShields({ hitsRaw: 5, shields: 2, shieldsApply: true, volkiteDouble: false }))
      .toEqual({ shieldsUsed: 2, hitsAfter: 3 });
  });

  it("щитов больше, чем попаданий — используется не больше hitsRaw, hitsAfter не уходит в минус", () => {
    expect(hitsAfterShields({ hitsRaw: 2, shields: 9, shieldsApply: true, volkiteDouble: false }))
      .toEqual({ shieldsUsed: 2, hitsAfter: 0 });
  });

  it("лэнс/торпеда: shieldsApply=false — щиты не считаются вовсе", () => {
    expect(hitsAfterShields({ hitsRaw: 4, shields: 3, shieldsApply: false, volkiteDouble: false }))
      .toEqual({ shieldsUsed: 0, hitsAfter: 4 });
  });

  it("Волкитное (стр. 73) удваивает попадания, ПРОШЕДШИЕ щиты, а не сырые попадания", () => {
    // hitsRaw=5, щиты=2 → сквозь щиты прошло 3 → Волкитное даёт 6, а не 10.
    expect(hitsAfterShields({ hitsRaw: 5, shields: 2, shieldsApply: true, volkiteDouble: true }))
      .toEqual({ shieldsUsed: 2, hitsAfter: 6 });
  });

  it("Волкитное без щитов (лэнс) — тоже удваивает то, что прошло (здесь всё)", () => {
    expect(hitsAfterShields({ hitsRaw: 3, shields: 5, shieldsApply: false, volkiteDouble: true }))
      .toEqual({ shieldsUsed: 0, hitsAfter: 6 });
  });
});

describe("terminalPenetrationTargets — Глубокое Пробитие, стр. 65", () => {
  it("порог 0 (свойства нет) — ничего не перебрасывается", () => {
    expect(terminalPenetrationTargets([1, 2, 10], 0)).toEqual([]);
  });

  it("условие книги — «≤ X», не «< X»: кубик РОВНО X тоже перебрасывается", () => {
    expect(terminalPenetrationTargets([4, 5, 6], 4)).toEqual([0]);
  });

  it("несколько кубиков ниже порога — все индексы, порядок сохранён", () => {
    expect(terminalPenetrationTargets([1, 8, 2, 9, 3], 3)).toEqual([0, 2, 4]);
  });

  it("все кубики выше порога — пустой список", () => {
    expect(terminalPenetrationTargets([7, 8, 9], 3)).toEqual([]);
  });
});

describe("terminalPenetrationAdjustment — переброс окончателен, книга стр. 65", () => {
  it("новый результат выше старого — поправка положительная", () => {
    // Кубик был 2 (≤4, target), перебросили — выпало 9.
    expect(terminalPenetrationAdjustment([2, 8], [0], [9])).toBe(7);
  });

  it("новый результат НИЖЕ старого — поправка отрицательная (результат окончателен, не «бери лучшее»)", () => {
    expect(terminalPenetrationAdjustment([4, 8], [0], [1])).toBe(-3);
  });

  it("несколько перебросов — поправки складываются", () => {
    // Кубики 1 и 3 (индексы) оба ≤ порога, перебросили в 6 и 2.
    expect(terminalPenetrationAdjustment([9, 1, 5, 3], [1, 3], [6, 2])).toBe((6 - 1) + (2 - 3));
  });

  it("пустой список целей — поправка 0", () => {
    expect(terminalPenetrationAdjustment([5, 5], [], [])).toBe(0);
  });
});

describe("resolveShipAttackDamage — броня + Разрушительное, стр. 19", () => {
  it("sumDamage: броня вычитается один раз из суммы всех попаданий (макробатарея/лэнс)", () => {
    const totalHI = resolveShipAttackDamage({
      dmgParts: [10, 8, 6], ignoreArmour: false, effArmour: 5, sumDamage: true,
      devastatingBonus: 0, hitsAfter: 3
    });
    expect(totalHI).toBe(10 + 8 + 6 - 5); // 19
  });

  it("sumDamage: сумма ниже брони — урон не уходит в минус", () => {
    const totalHI = resolveShipAttackDamage({
      dmgParts: [2, 1], ignoreArmour: false, effArmour: 20, sumDamage: true,
      devastatingBonus: 0, hitsAfter: 2
    });
    expect(totalHI).toBe(0);
  });

  it("!sumDamage: броня вычитается ИЗ КАЖДОГО попадания отдельно (торпеды/нова)", () => {
    const totalHI = resolveShipAttackDamage({
      dmgParts: [10, 3, 8], ignoreArmour: false, effArmour: 5, sumDamage: false,
      devastatingBonus: 0, hitsAfter: 3
    });
    // (10-5) + max(0,3-5) + (8-5) = 5 + 0 + 3
    expect(totalHI).toBe(8);
  });

  it("ignoreArmour — броня не вычитается вовсе (лэнс/звуковая боеголовка)", () => {
    const totalHI = resolveShipAttackDamage({
      dmgParts: [10, 8], ignoreArmour: true, effArmour: 99, sumDamage: true,
      devastatingBonus: 0, hitsAfter: 2
    });
    expect(totalHI).toBe(18);
  });

  it("Devastating(X) прибавляется ОДИН раз на весь залп, а не за каждое попадание", () => {
    const totalHI = resolveShipAttackDamage({
      dmgParts: [4, 4, 4], ignoreArmour: true, effArmour: 0, sumDamage: true,
      devastatingBonus: 5, hitsAfter: 3
    });
    expect(totalHI).toBe(4 + 4 + 4 + 5); // не +5×3
  });

  it("Devastating прибавляется ПОСЛЕ вычета брони (сам бонус бронёй не режется)", () => {
    const totalHI = resolveShipAttackDamage({
      dmgParts: [3], ignoreArmour: false, effArmour: 10, sumDamage: true,
      devastatingBonus: 5, hitsAfter: 1
    });
    // Урон кубиков полностью съеден бронёй (3-10 → 0), но Devastating всё равно доходит.
    expect(totalHI).toBe(5);
  });

  it("Devastating не прибавляется, если по цели не было ни одного попадания (hitsAfter=0)", () => {
    const totalHI = resolveShipAttackDamage({
      dmgParts: [], ignoreArmour: false, effArmour: 0, sumDamage: true,
      devastatingBonus: 5, hitsAfter: 0
    });
    expect(totalHI).toBe(0);
  });
});

describe("resolveShipCritRoll — Опустошительное + Цепная реакция/Испарение (стр. 11, 34, 70)", () => {
  it("без Havoc — критический результат равен сырому броску", () => {
    const { critRollVal } = resolveShipCritRoll(3, 0, []);
    expect(critRollVal).toBe(3);
  });

  it("Havoc(X) прибавляется к результату ДО поиска по таблице", () => {
    const { critRollVal, entry } = resolveShipCritRoll(2, 3, []);
    expect(critRollVal).toBe(5);
    expect(entry?.name).toBeTruthy();
  });

  it("Цепная реакция срабатывает, когда ИТОГОВЫЙ (после Havoc) результат ≤ 2", () => {
    const { multiNode } = resolveShipCritRoll(1, 0, [{ key: "chainReaction", rating: 3 }]);
    expect(multiNode).toEqual({ type: "chainReaction", count: 3 });
  });

  it("Havoc отодвигает результат за порог ≤2 — Цепная реакция НЕ срабатывает, хотя сырой бросок был 1", () => {
    // Книга даёт Havoc и Цепную реакцию как бонусы к ОДНОМУ и тому же
    // «критическому результату» — они не считаются от разных чисел.
    const { critRollVal, multiNode } = resolveShipCritRoll(1, 2, [{ key: "chainReaction", rating: 3 }]);
    expect(critRollVal).toBe(3);
    expect(multiNode).toBeNull();
  });

  it("без Цепной реакции, но с Испарением — тоже 1–2, но всегда ×2 узла", () => {
    const { multiNode } = resolveShipCritRoll(2, 0, [{ key: "vapourisation" }]);
    expect(multiNode).toEqual({ type: "vapourisation", count: 2 });
  });

  it("Цепная реакция приоритетнее Испарения, если оба свойства на узле", () => {
    const { multiNode } = resolveShipCritRoll(1, 0, [{ key: "chainReaction", rating: 4 }, { key: "vapourisation" }]);
    expect(multiNode).toEqual({ type: "chainReaction", count: 4 });
  });

  it("результат вне 1–2 — multiNode нет, даже если свойство есть", () => {
    const { multiNode } = resolveShipCritRoll(3, 0, [{ key: "chainReaction", rating: 3 }]);
    expect(multiNode).toBeNull();
  });
});

describe("lifetakerDamage — Забирающее жизни, стр. 42", () => {
  it("нет свойства (X=0) — урона CP нет", () => {
    expect(lifetakerDamage(0, 5)).toBe(0);
  });

  it("ни одно попадание не прошло щиты (hitsAfter=0) — урона CP нет", () => {
    expect(lifetakerDamage(3, 0)).toBe(0);
  });

  it("урон CP считается ЗА КАЖДОЕ непоглощённое попадание залпа (X × hitsAfter)", () => {
    expect(lifetakerDamage(2, 4)).toBe(8);
  });
});
