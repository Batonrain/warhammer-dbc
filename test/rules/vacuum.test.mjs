// test/rules/vacuum.test.mjs
//
// Вакуум (core, «Вакуум» и «Взрывная Декомпрессия», стр. 483, Sahara
// trade-voidfarer-10-wdbc-dbveg) — чистая часть: кто защищён, какой Порог у
// теста, сколько урона за Провал, радиус Декомпрессии. Бросок, урон и карточки
// — module/combat/vacuum.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import {
  voidArmourOf, voidfarerBase, vacuumTestPlan, vacuumDamage, decompressionRadius, vacuumApplies, isDecompressionVictim,
  VACUUM_BREATH_PENALTY, VOIDFARER_BONUS
} from "../../module/rules/vacuum.mjs";
import { effectAppliesTo } from "../../module/rules/resolve-test.mjs";

const armour = (props, over = {}) => ({
  type: "armor", name: "Броня", system: { equipped: true, breached: false, properties: props, ...over }
});

/** Актор-литерал: T.total и (по желанию) запись Trade (Voidfarer) в той форме, что считает character.mjs. */
function actor({ t = 40, items = [], voidfarer = null } = {}) {
  return {
    type: "character",
    items,
    system: {
      characteristics: { t: { total: t }, int: { total: 35 } },
      groupSkills: { trade: voidfarer ? [voidfarer] : [] }
    }
  };
}

describe("Stuff of Nightmares — иммунитет к вакууму (книга: «иммунитет к ядам/болезням/…/вакууму»)", () => {
  const son = { type: "trait", name: "Stuff of Nightmares / Существо из Кошмаров", system: {}, flags: {} };
  it("существо с Трейтом вакуума и Декомпрессии не боится", () => {
    expect(vacuumApplies(actor({ items: [son] }))).toBe(false);
    expect(isDecompressionVictim(actor({ items: [son] }))).toBe(false);
  });
  it("без Трейта — как обычно", () => {
    expect(vacuumApplies(actor())).toBe(true);
    expect(isDecompressionVictim(actor())).toBe(true);
  });
});

describe("voidArmourOf — защита пустотной бронёй", () => {
  it("надетая броня со свойством void защищает", () => {
    const a = actor({ items: [armour(["void", "sealed"])] });
    expect(voidArmourOf(a)?.name).toBe("Броня");
  });

  it("снятая броня не защищает", () => {
    expect(voidArmourOf(actor({ items: [armour(["void"], { equipped: false })] }))).toBeNull();
  });

  it("броня без свойства void (только sealed) не защищает от вакуума", () => {
    expect(voidArmourOf(actor({ items: [armour(["sealed"])] }))).toBeNull();
  });

  it("пробитая броня теряет герметичность — не защищает", () => {
    expect(voidArmourOf(actor({ items: [armour(["void"], { breached: true })] }))).toBeNull();
  });

  it("пробитая броня с Wraithbone Regeneration у псайкера остаётся герметичной", () => {
    const a = actor({ items: [{ ...armour(["void", "wraithboneRegen"], { breached: true }), parent: { system: { isPsyker: true } } }] });
    expect(voidArmourOf(a)).not.toBeNull();
  });

  it("предмет не из брони со свойством void не считается", () => {
    const a = actor({ items: [{ type: "gear", name: "Баллон", system: { equipped: true, properties: ["void"] } }] });
    expect(voidArmourOf(a)).toBeNull();
  });
});

describe("voidfarerBase — Trade (Voidfarer) на базе Стойкости", () => {
  it("нет записи навыка — null", () => {
    expect(voidfarerBase(actor())).toBeNull();
  });

  it("запись пересчитывается с её характеристики (Int) на T: ранг и модификатор сохраняются", () => {
    // Int 35, ранг «+10» и мод 3 → total 48; на T 40 это 40 + 10 + 3 = 53.
    const a = actor({ t: 40, voidfarer: { specialty: "Voidfarer", specKey: "voidfarer", rank: "trained", total: 35 + 10 + 3 } });
    expect(voidfarerBase(a)).toBe(53);
  });

  it("запись с собственной характеристикой берёт её, а не Int", () => {
    const a = actor({ t: 40, voidfarer: { specKey: "voidfarer", char: "t", rank: "knows", total: 40 + 0 } });
    expect(voidfarerBase(a)).toBe(40);
  });

  it("нетренированная запись (штраф −20) даёт T−20, а не молча T", () => {
    const a = actor({ t: 40, voidfarer: { specKey: "voidfarer", rank: "untrained", total: 35 - 20 } });
    expect(voidfarerBase(a)).toBe(20);
  });
});

describe("vacuumTestPlan — Порог теста вакуума", () => {
  it("без навыка: T+0", () => {
    const p = vacuumTestPlan(actor({ t: 42 }));
    expect(p).toMatchObject({ base: 42, mod: 0, skill: "T", threshold: 42 });
  });

  it("с Voidfarer: Trade (Voidfarer)(T)+10 вместо T+0, если выгоднее", () => {
    const a = actor({ t: 40, voidfarer: { specKey: "voidfarer", rank: "knows", total: 35 } });
    const p = vacuumTestPlan(a);
    // Voidfarer на T = 40 + 0 = 40, плюс 10 книги → 50 > 40.
    expect(p).toMatchObject({ skill: "Voidfarer", base: 40, mod: VOIDFARER_BONUS, threshold: 50 });
  });

  it("Voidfarer берётся, только когда он лучше T+0 (нетренированный не вредит)", () => {
    const a = actor({ t: 40, voidfarer: { specKey: "voidfarer", rank: "untrained", total: 15 } });
    // T−20+10 = 30 < 40 → остаётся обычное T+0
    const p = vacuumTestPlan(a);
    expect(p).toMatchObject({ skill: "T", threshold: 40 });
  });

  it("задержка дыхания: −30 к тесту", () => {
    const p = vacuumTestPlan(actor({ t: 40 }), { holdBreath: true });
    expect(p.mod).toBe(VACUUM_BREATH_PENALTY);
    expect(p.threshold).toBe(10);
    expect(p.parts.join(" ")).toMatch(/дыхани/);
  });

  it("Voidfarer и задержка дыхания складываются: +10 −30", () => {
    const a = actor({ t: 40, voidfarer: { specKey: "voidfarer", rank: "knows", total: 35 } });
    const p = vacuumTestPlan(a, { holdBreath: true });
    expect(p.threshold).toBe(40 + 10 - 30);
  });
});

describe("vacuumDamage — Провалы непоглощаемого X", () => {
  it("урон равен числу Провалов (степеней провала)", () => {
    expect(vacuumDamage(3)).toEqual({ amount: 3, breath: 0 });
  });

  it("при задержке дыхания к урону добавляется +1d5 (подставляется броском)", () => {
    expect(vacuumDamage(3, { holdBreath: true, breathRoll: 4 })).toEqual({ amount: 7, breath: 4 });
  });

  it("задержка дыхания без значения кубика — 0, а не NaN", () => {
    expect(vacuumDamage(2, { holdBreath: true }).amount).toBe(2);
  });

  it("не может уйти в минус и не принимает нецелые", () => {
    expect(vacuumDamage(-2).amount).toBe(0);
    expect(vacuumDamage(undefined).amount).toBe(0);
  });
});

describe("decompressionRadius — радиус Взрывной Декомпрессии", () => {
  it("в 10 раз больше ширины пробоя", () => {
    expect(decompressionRadius(1)).toBe(10);
    expect(decompressionRadius(2.5)).toBe(25);
  });

  it("нет ширины или она не число — 0", () => {
    expect(decompressionRadius(0)).toBe(0);
    expect(decompressionRadius("abc")).toBe(0);
    expect(decompressionRadius(-3)).toBe(0);
  });
});

describe("vacuumApplies — на кого действует вакуум сцены", () => {
  it("на персонажа без пустотной брони — да", () => {
    expect(vacuumApplies(actor())).toBe(true);
  });

  it("на надевшего пустотную броню — нет", () => {
    expect(vacuumApplies(actor({ items: [armour(["void"])] }))).toBe(false);
  });

  it("на миньона и демона — да (у них T и Раны, как у персонажа)", () => {
    expect(vacuumApplies({ ...actor(), type: "minion" })).toBe(true);
    expect(vacuumApplies({ ...actor(), type: "daemon" })).toBe(true);
  });

  it("на технику/корабль — нет (тест T и Раны не про них)", () => {
    expect(vacuumApplies({ ...actor(), type: "vehicle" })).toBe(false);
    expect(vacuumApplies({ ...actor(), type: "ship" })).toBe(false);
  });

  it("без актора — нет", () => {
    expect(vacuumApplies(null)).toBe(false);
  });
});

describe("isDecompressionVictim — кого накрывает Взрывная Декомпрессия", () => {
  it("существо без пустотной брони — жертва, в пустотной броне — нет", () => {
    expect(isDecompressionVictim(actor())).toBe(true);
    expect(isDecompressionVictim(actor({ items: [armour(["void"])] }))).toBe(false);
  });

  it("демоны и миньоны — жертвы (книга: «всем существам»), техника и корабли — нет", () => {
    expect(isDecompressionVictim({ ...actor(), type: "daemon" })).toBe(true);
    expect(isDecompressionVictim({ ...actor(), type: "minion" })).toBe(true);
    expect(isDecompressionVictim({ ...actor(), type: "vehicle" })).toBe(false);
    expect(isDecompressionVictim({ ...actor(), type: "ship" })).toBe(false);
    expect(isDecompressionVictim(null)).toBe(false);
  });
});

// Преимущество Крепкого как Камень на тесте вакуума проверяется на НАСТОЯЩЕЙ
// Черте из packs-src — test/rules/squat-traits.test.mjs.

describe("область теста «vacuum» в конвейере правил", () => {
  it("эффект с target «vacuum» срабатывает только на тесте вакуума", () => {
    expect(effectAppliesTo("vacuum", { vacuumTest: true })).toBe(true);
    expect(effectAppliesTo("vacuum", { kind: "skill", char: "t" })).toBe(false);
    expect(effectAppliesTo("vacuum", {})).toBe(false);
  });
});
