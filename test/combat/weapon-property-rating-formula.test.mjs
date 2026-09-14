// test/combat/weapon-property-rating-formula.test.mjs
//
// wdbc-lui3: rating свойства оружия психосилы может быть формулой-строкой с
// «PR» («2*PR» у Blast/Devastating, «PR» у Linger), а не константой, как у
// обычного оружия. aggregateAuto читает rating как голое число — resolvePropRating(s)
// резолвит формулу ДО агрегации, тем же безопасным парсером, что и Пробитие
// психосилы (resolvePen в sheets/tabs/psychic.mjs).

import { describe, it, expect } from "vitest";
import { aggregateAuto, resolveWeaponPropsList, resolvePropRating, resolvePropRatings } from "../../module/combat/weapon-properties.mjs";

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

  it("дайс-формула (Flame «2d10», Arc «7/2d10+PR») возвращается СТРОКОЙ как есть — не 0: раньше «d» вне SAFE_REST молча схлопывала её в 0, хотя buildTargetEffectButtons кормит такую строку в new Roll(), а не в арифметику", () => {
    expect(resolvePropRating("2d10", 4)).toBe("2d10");
    expect(resolvePropRating("7/2d10+PR", 4)).toBe("7/2d10+PR");
  });

  it("СУ и дайс вместе — СУ подставляется числом, дайс-часть остаётся строкой", () => {
    expect(resolvePropRating("СУd10", 4, { deg: 3 })).toBe("3d10");
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
});
