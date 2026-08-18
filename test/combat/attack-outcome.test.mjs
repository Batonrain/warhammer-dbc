// test/combat/attack-outcome.test.mjs
//
// Фаза 6 конвейера (последствия) — без Foundry. Здесь проверяются правила книги,
// а не разметка карточки: сколько попаданий даёт очередь, как Могучее меняет
// бонус Силы, когда Бритвенно острое удваивает Пробитие.
//
// Заглушка не импортируется намеренно: модуль attack-outcome.mjs не обращается
// ни к одной глобали Foundry, и это условие держится тестом.

import { describe, it, expect } from "vitest";
import {
  hitCount, hitLocation, locationForHit,
  meleeStrengthBonus, attackPenetration, damageFormulaFor, bonusDamageDice
} from "../../module/combat/attack-outcome.mjs";

/** Свойства оружия по умолчанию — то же, что даёт aggregateAuto на пустом списке. */
const noProps = {
  multiStrikeRating: 0, extraHits: null, tearing: false, provenRating: 0,
  razorSharp: false, meltaShort: false, mightySB: false, containedSB: false,
  accurate: false, scatter: false
};
const withProps = extra => ({ ...noProps, ...extra });

// ── Число попаданий ─────────────────────────────────────────────────────────

describe("hitCount", () => {
  const ranged = { rof_semi: 3, rof_full: 6 };

  it("одиночный выстрел — одно попадание", () => {
    expect(hitCount({ hit: true, isMelee: false, rofMode: "single", deg: 4, wp: noProps, sys: ranged }))
      .toEqual({ count: 1, label: "Одиночный" });
  });

  it("короткая очередь — попадание за каждый нечётный Успех", () => {
    // 5 степеней → 1, 3, 5 → три попадания, потолок RoF 3 не мешает.
    expect(hitCount({ hit: true, isMelee: false, rofMode: "semi", deg: 5, wp: noProps, sys: ranged }).count).toBe(3);
  });

  it("короткая очередь упирается в потолок RoF, а не в его половину", () => {
    // 6 степеней дали бы 3, но у оружия rof_semi = 2.
    expect(hitCount({ hit: true, isMelee: false, rofMode: "semi", deg: 6, wp: noProps, sys: { rof_semi: 2 } }).count).toBe(2);
  });

  it("длинная очередь считает по своему потолку", () => {
    expect(hitCount({ hit: true, isMelee: false, rofMode: "full", deg: 9, wp: noProps, sys: ranged }))
      .toEqual({ count: 5, label: "Автоматический" });
  });

  it("подавление попаданий не даёт", () => {
    expect(hitCount({ hit: true, isMelee: false, rofMode: "suppression", deg: 5, wp: noProps, sys: ranged }))
      .toEqual({ count: 0, label: "Подавление" });
  });

  it("Шторм удваивает попадания, Спаренное добавляет одно", () => {
    const storm = hitCount({ hit: true, isMelee: false, rofMode: "semi", deg: 3, wp: withProps({ extraHits: "storm" }), sys: ranged });
    const twin  = hitCount({ hit: true, isMelee: false, rofMode: "semi", deg: 3, wp: withProps({ extraHits: "twinLinked" }), sys: ranged });
    expect(storm.count).toBe(4);   // 2 × 2
    expect(twin.count).toBe(3);    // 2 + 1
  });

  it("Спаренное на промахе ничего не добавляет", () => {
    expect(hitCount({ hit: false, isMelee: false, rofMode: "semi", deg: 2, wp: withProps({ extraHits: "twinLinked" }), sys: ranged }))
      .toEqual({ count: 0, label: "Полуавтомат" });
  });

  it("рукопашная — одно попадание, Стремительная и Молниеносная считают по СУ", () => {
    const base      = hitCount({ hit: true, isMelee: true, rofMode: "melee", deg: 5, wp: noProps, sys: {} });
    const swift     = hitCount({ hit: true, isMelee: true, rofMode: "melee", deg: 5, wp: noProps, sys: {}, isSwift: true });
    const lightning = hitCount({ hit: true, isMelee: true, rofMode: "melee", deg: 5, wp: noProps, sys: {}, isLightning: true });
    expect(base.count).toBe(1);
    expect(swift.count).toBe(3);       // ceil(5/2)
    expect(lightning.count).toBe(4);   // ceil(5/2) + 1
    expect(base.label).toBe("Рукопашная");
  });

  it("Мульти-удар считает как Стремительная (1 доп. попадание за 2 Успеха сверх первого), с потолком в X", () => {
    const ms = r => hitCount({ hit: true, isMelee: true, rofMode: "melee", deg: r, wp: withProps({ multiStrikeRating: 2 }), sys: {} }).count;
    expect(ms(1)).toBe(1);   // голый Успех — доп. попаданий ещё нет
    expect(ms(2)).toBe(1);   // второй Успех не нечётный — по-прежнему одно
    expect(ms(3)).toBe(2);   // третий (нечётный) Успех открывает второе попадание
    expect(ms(4)).toBe(2);
    // deg=9 дал бы ceil(9/2)=5 попаданий, но рейтинг X=2 — потолок.
    expect(ms(9)).toBe(2);
  });

  it("промах не даёт попаданий, но подпись режима сохраняет", () => {
    expect(hitCount({ hit: false, isMelee: false, rofMode: "full", deg: 3, wp: noProps, sys: ranged }))
      .toEqual({ count: 0, label: "Автоматический" });
  });
});

// ── Место попадания ─────────────────────────────────────────────────────────

describe("hitLocation", () => {
  it("место читается с перевёрнутого броска", () => {
    expect(hitLocation({ rv: 23, hit: true })).toEqual({ locRoll: 32, label: "Торс" });
    expect(hitLocation({ rv: 41, hit: true })).toEqual({ locRoll: 14, label: "П. Рука" });
    expect(hitLocation({ rv: 90, hit: true })).toEqual({ locRoll: 9,  label: "Голова" });
  });

  it("однозначный бросок дополняется нулём слева", () => {
    expect(hitLocation({ rv: 5, hit: true }).locRoll).toBe(50);
  });

  it("Избирательная атака кладёт попадание в выбранное место", () => {
    expect(hitLocation({ rv: 23, hit: true, aimTarget: { value: "head" } }).label).toBe("Голова");
    expect(hitLocation({ rv: 23, hit: true, aimTarget: { value: "eye" } }).label).toBe("Глаз (Голова)");
  });

  it("сдвиг от Таланта двигает результат и не выходит за 1–100", () => {
    expect(hitLocation({ rv: 23, hit: true, shift: -3 }).locRoll).toBe(29);
    expect(hitLocation({ rv: 1,  hit: true, shift: -50 }).locRoll).toBe(1);
    expect(hitLocation({ rv: 99, hit: true, shift: 50 }).locRoll).toBe(100);
  });

  it("на промахе место не определяется", () => {
    expect(hitLocation({ rv: 77, hit: false }).label).toBe("Торс");
  });
});

describe("locationForHit", () => {
  it("у существа третье и дальше попадания уходят в торс", () => {
    const ctx = { label: "Голова", hitsCount: 4, targetIsVehicle: false, vehiclePart: null };
    expect(locationForHit(0, ctx)).toBe("Голова");
    expect(locationForHit(1, ctx)).toBe("Голова");
    expect(locationForHit(2, ctx)).toBe("Торс");
  });

  it("одиночное попадание остаётся в своём месте", () => {
    expect(locationForHit(0, { label: "П. Нога", hitsCount: 1, targetIsVehicle: false })).toBe("П. Нога");
  });

  it("у техники первые два попадания в часть, остальные в корпус", () => {
    const ctx = { label: "Двигатель", hitsCount: 3, targetIsVehicle: true, vehiclePart: "Двигатель" };
    expect(locationForHit(1, ctx)).toBe("Двигатель");
    expect(locationForHit(2, ctx)).toBe("Корпус");
  });
});

// ── Урон и Пробитие ─────────────────────────────────────────────────────────

describe("meleeStrengthBonus", () => {
  it("обычное оружие берёт бонус Силы как есть", () => {
    expect(meleeStrengthBonus({ sb: 4, wp: noProps })).toBe(4);
  });

  it("Могучее удваивает, Сдержанное обнуляет", () => {
    expect(meleeStrengthBonus({ sb: 4, wp: withProps({ mightySB: true }) })).toBe(8);
    expect(meleeStrengthBonus({ sb: 4, wp: withProps({ containedSB: true }) })).toBe(0);
  });

  it("хват с ½S.b берёт половину с округлением вверх", () => {
    expect(meleeStrengthBonus({ sb: 5, wp: noProps, sbHalf: true })).toBe(3);
    expect(meleeStrengthBonus({ sb: 4, wp: noProps, sbHalf: true })).toBe(2);
  });

  it("½ считается после Могучего и не воскрешает Сдержанное", () => {
    expect(meleeStrengthBonus({ sb: 5, wp: withProps({ mightySB: true }), sbHalf: true })).toBe(5);
    expect(meleeStrengthBonus({ sb: 5, wp: withProps({ containedSB: true }), sbHalf: true })).toBe(0);
  });
});

describe("attackPenetration", () => {
  it("без свойств Пробитие остаётся базовым", () => {
    expect(attackPenetration({ base: 4, wp: noProps, hit: true, deg: 1 })).toBe(4);
  });

  it("Бритвенно острое удваивает от трёх степеней успеха", () => {
    const wp = withProps({ razorSharp: true });
    expect(attackPenetration({ base: 4, wp, hit: true, deg: 2 })).toBe(4);
    expect(attackPenetration({ base: 4, wp, hit: true, deg: 3 })).toBe(8);
  });

  it("Бритвенно острое на промахе не удваивает", () => {
    expect(attackPenetration({ base: 4, wp: withProps({ razorSharp: true }), hit: false, deg: 5 })).toBe(4);
  });

  it("Мельта удваивает на короткой дистанции", () => {
    const wp = withProps({ meltaShort: true });
    expect(attackPenetration({ base: 6, wp, hit: true, deg: 1, shortRange: true })).toBe(12);
    expect(attackPenetration({ base: 6, wp, hit: true, deg: 1, shortRange: false })).toBe(6);
  });

  it("Максимальный режим, полоса дальности и Психосиловое складываются после удвоений", () => {
    expect(attackPenetration({
      base: 4, wp: noProps, hit: true, deg: 1,
      maximal: true, band: { pen: 3 }, forceBonus: 5
    })).toBe(14);   // 4 + 2 + 3 + 5
  });
});

describe("damageFormulaFor", () => {
  const chars = { s: { bonus: 4 }, i: { bonus: 3 } };

  it("плоский бонус приписывается к формуле оружия", () => {
    expect(damageFormulaFor({ damage: "1d10+5", flatBonus: 3, chars, wp: noProps })).toBe("1d10+5 + 3");
  });

  it("нулевой бонус формулу не трогает", () => {
    expect(damageFormulaFor({ damage: "1d10+5", flatBonus: 0, chars, wp: noProps })).toBe("1d10+5");
  });

  it("тип урона, затёкший в формулу, отбрасывается — иначе бросок падает на букве", () => {
    expect(damageFormulaFor({ damage: "1d10+4 R", flatBonus: 0, chars, wp: noProps })).toBe("1d10+4");
    expect(damageFormulaFor({ damage: "1d10+3 E(Ls)", flatBonus: 0, chars, wp: noProps })).toBe("1d10+3");
  });

  it("у стрелкового пустой урон становится 1d10, у рукопашного — только бонусом", () => {
    expect(damageFormulaFor({ damage: "", flatBonus: 0, chars, wp: noProps, isMelee: false })).toBe("1d10");
    expect(damageFormulaFor({ damage: "", flatBonus: 4, chars, wp: noProps, isMelee: true })).toBe("4");
  });

  it("характеристики в формуле заменяются бонусами владельца", () => {
    expect(damageFormulaFor({ damage: "1d10+S.b", flatBonus: 0, chars, wp: noProps })).toBe("1d10+4");
  });

  it("Рвущее добавляет куб и оставляет лучший, Проверенное поднимает минимум", () => {
    expect(damageFormulaFor({ damage: "1d10+2", flatBonus: 0, chars, wp: withProps({ tearing: true }) }))
      .toBe("2d10kh1+2");
    expect(damageFormulaFor({ damage: "1d10+2", flatBonus: 0, chars, wp: withProps({ provenRating: 3 }) }))
      .toBe("1d10min3+2");
  });
});

describe("bonusDamageDice", () => {
  it("Меткое даёт кубы по степеням успеха только на одиночном выстреле", () => {
    const wp = withProps({ accurate: true });
    expect(bonusDamageDice({ wp, rofMode: "single", hit: true, deg: 3 })).toBe(1);
    expect(bonusDamageDice({ wp, rofMode: "single", hit: true, deg: 5 })).toBe(2);
    expect(bonusDamageDice({ wp, rofMode: "single", hit: true, deg: 2 })).toBe(0);
    expect(bonusDamageDice({ wp, rofMode: "semi",   hit: true, deg: 5 })).toBe(0);
  });

  it("Рассеивание, Максимальный режим, полоса и боеприпас складываются", () => {
    expect(bonusDamageDice({
      wp: withProps({ scatter: true }), rofMode: "single", hit: true, deg: 1,
      shortRange: true, maximal: true, band: { dice: 2 }, ammoDice: 1
    })).toBe(5);
  });
});
