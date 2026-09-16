// test/combat/weapon-property-rating-formula.test.mjs
//
// wdbc-lui3: rating свойства оружия психосилы может быть формулой-строкой с
// «PR» («2*PR» у Blast/Devastating, «PR» у Linger), а не константой, как у
// обычного оружия. aggregateAuto читает rating как голое число — resolvePropRating(s)
// резолвит формулу ДО агрегации, тем же безопасным парсером, что и Пробитие
// психосилы (resolvePen в sheets/tabs/psychic.mjs).

import { describe, it, expect } from "vitest";
import { aggregateAuto, resolveWeaponPropsList, resolvePropRating, resolvePropRatings, filterPropsBySuccesses } from "../../module/combat/weapon-properties.mjs";

describe("resolvePropRating", () => {
  it("голое число оружия проходит как есть (Number(rating)||0, поведение не изменилось)", () => {
    expect(resolvePropRating(3, 5)).toBe(3);
    expect(resolvePropRating(0, 5)).toBe(0);
    expect(resolvePropRating(undefined, 5)).toBe(0);
  });

  it("формула-строка с PR резолвится подставленным значением эПР", () => {
    expect(resolvePropRating("2*PR", 4)).toBe(8);
    expect(resolvePropRating("PR", 4)).toBe(4);
    expect(resolvePropRating("PR+1", 4)).toBe(5);
  });

  it("недопустимая формула отдаёт 0, а не бросает (mechFormulaTotalSafe)", () => {
    expect(resolvePropRating("не число", 4)).toBe(0);
  });
});

describe("resolvePropRating — wdbc-kifa: СУ/Cor.b/дайс-рейтинги", () => {
  it("«СУ» подставляется числом degrees of success (Devastating Rain: Blast((PR+Успехи)×3))", () => {
    expect(resolvePropRating("(PR+СУ)*3", 4, { deg: 2 })).toBe(18);
  });

  it("без deg в опциях «СУ» не трогается — недопустимый символ, безопасно отдаёт 0 (не ломается на формулах без СУ)", () => {
    expect(resolvePropRating("2*PR", 4)).toBe(8); // не содержит СУ — не задет
  });

  it("Cor.b резолвится через rollData тем же путём, что и в Конструкторе (Infernal Gaze: Felling(Cor.b))", () => {
    expect(resolvePropRating("Cor.b", 4, { rollData: { cor: 3 } })).toBe(3);
  });

  it("Cor.b без rollData — cor отсутствует в KEYS-подстановке, безопасно отдаёт 0, не бросает", () => {
    expect(resolvePropRating("Cor.b", 4)).toBe(0);
  });

  it("дайс-формула (Flame «2d10», Arc «7/2d10+PR») возвращается СТРОКОЙ, не числом (0): раньше «d» вне SAFE_REST молча схлопывала её в 0, хотя buildTargetEffectButtons кормит такую строку в new Roll(), а не в арифметику", () => {
    expect(resolvePropRating("2d10", 4)).toBe("2d10");
  });

  it("«PR» ВНУТРИ дайс-строки подставляется тем же \\bPR\\b-приёмом, что и основная формула урона (wdbc-cy4z/wdbc-wv8u) — раньше долетала до new Roll() буквальной «PR» и падала исключением Unresolved StringTerm при .evaluate()", () => {
    expect(resolvePropRating("7/2d10+PR", 4)).toBe("7/2d10+4");
    expect(resolvePropRating("2d10", 4)).toBe("2d10"); // без PR — не задет
  });

  it("СУ и дайс вместе — СУ подставляется числом, дайс-часть остаётся строкой", () => {
    expect(resolvePropRating("СУd10", 4, { deg: 3 })).toBe("3d10");
  });

  // wdbc-ufns: «Х» — item-defined производное значение (Vortex of Doom:
  // Х=½Успехи(окр.▲)), опционально прокидывается через options.x, не путать
  // с книжной «X»-нотацией рейтинга (та живёт только в desc/reminder текстах,
  // этого резолвера не касается).
  it("«Х» подставляется, когда явно передан options.x — Pen «2*Х»", () => {
    expect(resolvePropRating("2*Х", 4, { x: 3 })).toBe(6);
  });

  it("без options.x «Х» не трогается — недопустимый символ формулы, безопасно отдаёт 0, не бросает", () => {
    expect(resolvePropRating("2*Х", 4)).toBe(0);
  });

  it("«Х» и «PR» вместе в одной формуле — оба подставляются", () => {
    expect(resolvePropRating("PR+Х", 4, { x: 3 })).toBe(7);
  });
});

describe("resolvePropRatings + aggregateAuto — Blast/Devastating/Linger психосилы с эПР-формулой", () => {
  it("Devastating(2×PR) при эПР=3 даёт devastatingRating=6", () => {
    const props = resolvePropRatings([{ key: "devastating", rating: "2*PR" }], 3);
    const wp = aggregateAuto(resolveWeaponPropsList(props));
    expect(wp.devastatingRating).toBe(6);
  });

  it("Wrecker(3) с фиксированным (не-формульным) рейтингом не ломается резолвом", () => {
    const props = resolvePropRatings([{ key: "wrecker", rating: 3 }], 7);
    const wp = aggregateAuto(resolveWeaponPropsList(props));
    expect(wp.wreckerRating).toBe(3);
  });

  it("Linger(PR) с rating2 — оба поля резолвятся независимо", () => {
    const props = resolvePropRatings([{ key: "linger", rating: "PR", rating2: "PR-1" }], 5);
    const wp = aggregateAuto(resolveWeaponPropsList(props));
    expect(wp.lingerRating).toBe(5);
    expect(wp.lingerDrift).toBe(4);
  });

  it("Haywire(PR×3, 2d10+5) — rating2 попадает в haywireDamage2 строкой, PR уже подставлен (wdbc-cy4z, Death of Machines)", () => {
    const props = resolvePropRatings([{ key: "haywire", rating: "PR*3", rating2: "2d10+5" }], 4);
    const wp = aggregateAuto(resolveWeaponPropsList(props));
    expect(wp.haywireRating).toBe(12);
    expect(wp.haywireDamage2).toBe("2d10+5");
  });

  it("Haywire без rating2 — haywireDamage2 остаётся пустым (обычное оружие с Haywire не задето)", () => {
    const props = resolvePropRatings([{ key: "haywire", rating: 3 }], 4);
    const wp = aggregateAuto(resolveWeaponPropsList(props));
    expect(wp.haywireDamage2).toBe("");
  });
});

describe("filterPropsBySuccesses (wdbc-zlx7): свойства активны только при N+ Успехах психотеста", () => {
  it("без requiredSuccesses — проходит при любом deg, поведение не изменилось", () => {
    const props = [{ key: "flame" }];
    expect(filterPropsBySuccesses(props, 0)).toHaveLength(1);
    expect(filterPropsBySuccesses(props, 99)).toHaveLength(1);
    expect(filterPropsBySuccesses(props, undefined)).toHaveLength(1);
  });

  it("requiredSuccesses: 3 — отсекается при deg<3, проходит при deg>=3", () => {
    const props = [{ key: "flame", requiredSuccesses: 3 }];
    expect(filterPropsBySuccesses(props, 2)).toEqual([]);
    expect(filterPropsBySuccesses(props, 3)).toHaveLength(1);
    expect(filterPropsBySuccesses(props, 5)).toHaveLength(1);
  });

  it("список из нескольких свойств — фильтр применяется к каждому независимо (Neural Storm: Shocking/Haywire оба @3)", () => {
    const props = [
      { key: "shocking", requiredSuccesses: 3 },
      { key: "haywire", requiredSuccesses: 3 }
    ];
    expect(filterPropsBySuccesses(props, 2)).toEqual([]);
    expect(filterPropsBySuccesses(props, 3)).toHaveLength(2);
  });

  it("requiredSuccesses: 0 — считается как «не задан», не как «нужно 0 Успехов, всегда проходит по >= 0»", () => {
    const props = [{ key: "flame", requiredSuccesses: 0 }];
    expect(filterPropsBySuccesses(props, 0)).toHaveLength(1);
  });

  it("пустой/отсутствующий список — не бросает", () => {
    expect(filterPropsBySuccesses(undefined, 5)).toEqual([]);
    expect(filterPropsBySuccesses([], 5)).toEqual([]);
  });
});
