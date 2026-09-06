// test/rules/cover-locations.test.mjs
//
// wdbc-qkua: Укрытие перестало быть одним числом на всего персонажа.
//
// Главное, что здесь проверяется, — не арифметика, а ДВА решения, каждое из
// которых можно было принять иначе:
//   • два источника AP (ручное поле листа и разовый бонус объявленного Отскока)
//     складываются или побеждает больший — здесь БОЛЬШИЙ, это одна и та же стена;
//   • ни одна галочка не отмечена значит «укрытие общее», а не «укрытия нет» —
//     иначе правка молча отняла бы укрытие у каждого уже существующего листа.

import { describe, it, expect } from "vitest";

import { coverApForLocation, hasCoveredLocations }
  from "../../module/rules/cover-locations.mjs";

const cover = (over = {}) => ({
  ap: 0, head: false, leftArm: false, rightArm: false,
  body: false, leftLeg: false, rightLeg: false, ...over
});

describe("coverApForLocation: какие части тела прикрыты (wdbc-qkua)", () => {
  it("нет ни числа, ни зоны — укрытия нет", () => {
    expect(coverApForLocation(cover(), "head", 0)).toBe(0);
  });

  it("ни одна галочка не отмечена — укрытие общее, как было до правки", () => {
    const c = cover({ ap: 4 });
    for (const loc of ["head", "body", "leftArm", "rightLeg"]) {
      expect(coverApForLocation(c, loc, 0), loc).toBe(4);
    }
  });

  it("отмечены торс и ноги — голова и руки остаются открытыми", () => {
    // Ровно случай из тикета: выглянул из-за стены головой и рукой стрелять.
    const c = cover({ ap: 6, body: true, leftLeg: true, rightLeg: true });
    expect(coverApForLocation(c, "body", 0)).toBe(6);
    expect(coverApForLocation(c, "leftLeg", 0)).toBe(6);
    expect(coverApForLocation(c, "head", 0)).toBe(0);
    expect(coverApForLocation(c, "rightArm", 0)).toBe(0);
  });

  it("объявленный Отскок работает без единой галочки — прежнее поведение цело", () => {
    expect(coverApForLocation(cover(), "head", 5)).toBe(5);
  });

  it("Отскок и ручное число НЕ складываются — берётся большее", () => {
    // Сумма дала бы 9: двойная защита от одной стены тому, кто и стоял за
    // ней, и нырнул за неё Отскоком.
    expect(coverApForLocation(cover({ ap: 4 }), "head", 5)).toBe(5);
    expect(coverApForLocation(cover({ ap: 7 }), "head", 5)).toBe(7);
  });

  it("галочки ограничивают и Отскок тоже, а не только ручное число", () => {
    const c = cover({ body: true });
    expect(coverApForLocation(c, "body", 5)).toBe(5);
    expect(coverApForLocation(c, "head", 5)).toBe(0);
  });
});

describe("hasCoveredLocations", () => {
  it("пустое укрытие — ни одной отмеченной части", () => {
    expect(hasCoveredLocations(cover())).toBe(false);
  });

  it("отмеченная часть видна", () => {
    expect(hasCoveredLocations(cover({ body: true }))).toBe(true);
  });

  it("отсутствующее поле не роняет расчёт — старый актор без system.cover", () => {
    expect(hasCoveredLocations(undefined)).toBe(false);
    expect(coverApForLocation(undefined, "head", 3)).toBe(3);
  });
});
