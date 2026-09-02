// test/constants/ship-properties.test.mjs
//
// module/constants/ship-properties.mjs — реестр свойств узлов корабля
// (аналог свойств оружия персонажей). Чисто структурный тест реестра:
// ловит опечатки в ключах/категориях, не расчётную логику (её здесь нет).

import { describe, it, expect } from "vitest";
import { SHIP_PROPERTIES, SHIP_PROPERTIES_LIST, WTYPE_OPTIONS } from "../../module/constants/ship-properties.mjs";

const CATS = new Set(["char", "weapon", "crew", "hull", "misc"]);

describe("SHIP_PROPERTIES", () => {
  it("ключ объекта совпадает с полем key записи", () => {
    for (const [k, v] of Object.entries(SHIP_PROPERTIES)) {
      expect(v.key, k).toBe(k);
    }
  });

  it("у каждой записи есть label/en/desc/cat, cat из допустимого набора", () => {
    for (const [k, v] of Object.entries(SHIP_PROPERTIES)) {
      expect(v.label, k).toBeTruthy();
      expect(v.en, k).toBeTruthy();
      expect(v.desc, k).toBeTruthy();
      expect(CATS.has(v.cat), `${k}: cat=${v.cat}`).toBe(true);
    }
  });

  it("rating2 не встречается без rating (второй рейтинг без первого бессмыслен)", () => {
    for (const [k, v] of Object.entries(SHIP_PROPERTIES)) {
      if (v.rating2) expect(v.rating, k).toBe(true);
    }
  });

  it("ratingOptions/rating2Options, если заданы, — непустой список {value,label}", () => {
    for (const [k, v] of Object.entries(SHIP_PROPERTIES)) {
      for (const field of ["ratingOptions", "rating2Options"]) {
        if (!v[field]) continue;
        expect(v[field].length, `${k}.${field}`).toBeGreaterThan(0);
        for (const opt of v[field]) {
          expect(opt.value, `${k}.${field}`).toBeTruthy();
          expect(opt.label, `${k}.${field}`).toBeTruthy();
        }
      }
    }
  });

  it("SHIP_PROPERTIES_LIST — те же записи, что и в реестре, в том же количестве", () => {
    expect(SHIP_PROPERTIES_LIST).toHaveLength(Object.keys(SHIP_PROPERTIES).length);
    for (const v of SHIP_PROPERTIES_LIST) expect(SHIP_PROPERTIES[v.key]).toBe(v);
  });
});

describe("WTYPE_OPTIONS", () => {
  it("значения уникальны и совпадают с rating2Options у devastating/effectiveDistance", () => {
    const values = WTYPE_OPTIONS.map(o => o.value);
    expect(new Set(values).size).toBe(values.length);
    expect(SHIP_PROPERTIES.devastating.rating2Options).toBe(WTYPE_OPTIONS);
    expect(SHIP_PROPERTIES.effectiveDistance.rating2Options).toBe(WTYPE_OPTIONS);
  });
});
