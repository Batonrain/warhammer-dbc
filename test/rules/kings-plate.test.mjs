// test/rules/kings-plate.test.mjs
//
// wdbc-173l: Талант «King's Plate / Латы Короля» — поглощение Роя даёт
// аблативные Раны = Магнитуде Роя (нет поля Wounds у Орды в этой системе).

import { describe, it, expect } from "vitest";
import { isKingsPlateItem, kingsPlateGrant, kingsPlateShrinkToFit } from "../../module/rules/kings-plate.mjs";

describe("isKingsPlateItem", () => {
  it("узнаёт Талант по книжному двуязычному имени", () => {
    expect(isKingsPlateItem({ type: "talent", name: "King's Plate / Латы Короля" })).toBe(true);
  });
  it("не путает с другим Талантом", () => {
    expect(isKingsPlateItem({ type: "talent", name: "Blood Shield / Кровавый Щит" })).toBe(false);
  });
});

describe("kingsPlateGrant: += Магнитуда Роя, складывается с прошлыми поглощениями", () => {
  it("первое поглощение с нуля", () => {
    const system = { wounds: { ablative: 0, ablativeMax: 0 } };
    expect(kingsPlateGrant(system, 0, 6)).toEqual({ ablative: 6, ablativeMax: 6, contribution: 6, granted: 6 });
  });

  it("второе поглощение складывается с первым", () => {
    const system = { wounds: { ablative: 6, ablativeMax: 6 } };
    expect(kingsPlateGrant(system, 6, 4)).toEqual({ ablative: 10, ablativeMax: 10, contribution: 10, granted: 4 });
  });

  it("не трогает посторонний аблатив на том же акторе", () => {
    // Пул 9: 6 своих Лат (прошлый раз) + 3 постороннего.
    const system = { wounds: { ablative: 9, ablativeMax: 9 } };
    expect(kingsPlateGrant(system, 6, 4)).toMatchObject({ ablative: 13, contribution: 10 }); // 3 чужого + 10 своего
  });

  it("Магнитуда Роя 0 или меньше — null, поглощать нечего", () => {
    const system = { wounds: { ablative: 0, ablativeMax: 0 } };
    expect(kingsPlateGrant(system, 0, 0)).toBeNull();
    expect(kingsPlateGrant(system, 0, -3)).toBeNull();
  });
});

describe("kingsPlateShrinkToFit: доля не больше, чем реально осталось", () => {
  it("пул уменьшился (урон) — доля Лат ужимается вслед", () => {
    const system = { wounds: { ablative: 4, ablativeMax: 10 } }; // было 10, поглотили 6
    expect(kingsPlateShrinkToFit(system, 10)).toEqual({ ablativeMax: 4, contribution: 4 });
  });
  it("пул не трогали — null", () => {
    const system = { wounds: { ablative: 10, ablativeMax: 10 } };
    expect(kingsPlateShrinkToFit(system, 10)).toBeNull();
  });
});
