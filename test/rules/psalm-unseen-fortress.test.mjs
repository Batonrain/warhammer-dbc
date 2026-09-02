// test/rules/psalm-unseen-fortress.test.mjs
//
// wdbc-173l: Техночудо «Psalm of the Unseen Fortress» — +2 аблативных Раны
// за Успех активации, переоформляет прошлую контрибуцию.

import { describe, it, expect } from "vitest";
import { isPsalmUnseenFortressItem, psalmUnseenFortressGrant, psalmUnseenFortressShrinkToFit }
  from "../../module/rules/psalm-unseen-fortress.mjs";

describe("isPsalmUnseenFortressItem", () => {
  it("узнаёт Техночудо по книжному двуязычному имени", () => {
    expect(isPsalmUnseenFortressItem({ type: "techPower", name: "Psalm of the Unseen Fortress / Псалом Незримой Крепости" })).toBe(true);
  });
  it("не путает с похожим Техночудом (Missing Mosaic)", () => {
    expect(isPsalmUnseenFortressItem({ type: "techPower", name: "Psalm of the Missing Mosaic / Псалом Недостающей Мозаики" })).toBe(false);
  });
});

describe("psalmUnseenFortressGrant: 2×Успех, переоформляет прошлую активацию", () => {
  it("первая активация — 3 Успеха", () => {
    const system = { wounds: { ablative: 0, ablativeMax: 0 } };
    expect(psalmUnseenFortressGrant(system, 0, 3)).toEqual({ ablative: 6, ablativeMax: 6, contribution: 6 });
  });

  it("вторая активация переоформляет, не складывает", () => {
    const system = { wounds: { ablative: 6, ablativeMax: 6 } };
    expect(psalmUnseenFortressGrant(system, 6, 1)).toEqual({ ablative: 2, ablativeMax: 2, contribution: 2 });
  });

  it("не трогает посторонний аблатив", () => {
    const system = { wounds: { ablative: 9, ablativeMax: 9 } }; // 3 постороннего + 6 своего
    expect(psalmUnseenFortressGrant(system, 6, 2)).toMatchObject({ ablative: 7, contribution: 4 }); // 3+4
  });
});

describe("psalmUnseenFortressShrinkToFit: доля не больше, чем реально осталось", () => {
  it("пул уменьшился (урон) — доля Купола ужимается вслед", () => {
    const system = { wounds: { ablative: 2, ablativeMax: 6 } };
    expect(psalmUnseenFortressShrinkToFit(system, 6)).toEqual({ ablativeMax: 2, contribution: 2 });
  });
});
