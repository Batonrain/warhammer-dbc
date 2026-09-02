// test/constants/ship.test.mjs
//
// module/constants/ship.mjs — константы пустотных кораблей: разбор Орудийной
// оснащённости, грузы/редкость партии, пороговые таблицы экипажа.

import { describe, it, expect } from "vitest";
import {
  WC_CODE, parseWeaponCapacity,
  CARGO_TYPES, getCargoType, buildCargoTypeOptions, cargoRarity,
  CREW_POP_TABLE, CREW_MORALE_TABLE, CREW_RATING_TABLE, crewActiveRows,
  crewActionsPerSR, moralePerInfluence
} from "../../module/constants/ship.mjs";

describe("parseWeaponCapacity", () => {
  it("пустая/отсутствующая строка — все дуги по нулям", () => {
    expect(parseWeaponCapacity("")).toEqual({ prow: 0, dorsal: 0, port: 0, star: 0, keel: 0 });
    expect(parseWeaponCapacity(null)).toEqual({ prow: 0, dorsal: 0, port: 0, star: 0, keel: 0 });
  });

  it("«Н1, ПБ1, ЛБ1» — по одному слоту на три дуги", () => {
    expect(parseWeaponCapacity("Н1, ПБ1, ЛБ1")).toEqual({ prow: 1, dorsal: 0, port: 1, star: 1, keel: 0 });
  });

  it("порядок число-буква тоже понимается: «1НП, 1ПБ»", () => {
    expect(parseWeaponCapacity("1НП, 1ПБ")).toEqual({ prow: 0, dorsal: 1, port: 0, star: 1, keel: 0 });
  });

  it("буквы без числа — считается за 1: «НП2» / голое «К»", () => {
    expect(parseWeaponCapacity("НП2")).toEqual({ prow: 0, dorsal: 2, port: 0, star: 0, keel: 0 });
    expect(parseWeaponCapacity("К")).toEqual({ prow: 0, dorsal: 0, port: 0, star: 0, keel: 1 });
  });

  it("повтор той же дуги суммируется, а не перезаписывается", () => {
    expect(parseWeaponCapacity("Н1, Н2")).toEqual({ prow: 3, dorsal: 0, port: 0, star: 0, keel: 0 });
  });

  it("все коды WC_CODE распознаются", () => {
    for (const [ru, key] of Object.entries(WC_CODE)) {
      expect(parseWeaponCapacity(`${ru}1`)[key]).toBe(1);
    }
  });
});

describe("getCargoType / buildCargoTypeOptions", () => {
  it("находит груз по ключу, неизвестный ключ — null", () => {
    expect(getCargoType("fuel")?.label).toBe("Топливо");
    expect(getCargoType("no-such-cargo")).toBeNull();
  });

  it("HTML-опции: по одному <option> на груз, сгруппированы по optgroup", () => {
    const html = buildCargoTypeOptions("fuel");
    for (const c of CARGO_TYPES) expect(html).toContain(`value="${c.key}"`);
    expect(html).toContain('value="fuel" selected');
    expect((html.match(/<optgroup/g) || []).length).toBe(new Set(CARGO_TYPES.map(c => c.group)).size);
  });
});

describe("cargoRarity", () => {
  it("ручная редкость (rarityManual) побеждает расчёт от типа", () => {
    expect(cargoRarity({ cargoType: "fuel", rarity: 99, rarityManual: true })).toBe(99);
  });

  it("известный тип: база — среднее rMin/rMax, плюс качество", () => {
    // fuel: rMin -2, rMax 0 → база -1; качество good = +1 → -1+1 = 0
    const r = cargoRarity({ cargoType: "fuel", quality: "good" });
    expect(r.known).toBe(true);
    expect(r.value).toBe(0);
  });

  it("тип с «Различным» диапазоном (rMin/rMax null) — база 0, known:false", () => {
    const r = cargoRarity({ cargoType: "weaponry" });
    expect(r.known).toBe(false);
    expect(r.value).toBe(0);
  });

  it("метки ксено/астартес суммируются модификатором +1 каждая", () => {
    const r = cargoRarity({ cargoType: "fuel", xenos: true, astartes: true });
    // база -1, качество common(+0) + xenos(+1) + astartes(+1) = 1
    expect(r.value).toBe(1);
  });

  it("неизвестный тип груза — база 0, известность false, min/max null", () => {
    const r = cargoRarity({ cargoType: "no-such-cargo" });
    expect(r).toEqual({ value: 0, known: false, min: null, max: null });
  });
});

describe("crewActiveRows", () => {
  it("активны строки, чей порог >= текущего значения (значение просело до порога и ниже)", () => {
    const rows = crewActiveRows(CREW_POP_TABLE, 45);
    expect(rows.map(r => r.t)).toEqual([80, 60, 50]);
  });

  it("значение выше самого высокого порога — ни одной активной строки", () => {
    expect(crewActiveRows(CREW_POP_TABLE, 100)).toEqual([]);
  });

  it("нечисловое значение — ни одной активной строки (не NaN <= t)", () => {
    expect(crewActiveRows(CREW_POP_TABLE, "не число")).toEqual([]);
  });

  it("CREW_MORALE_TABLE отдельно помечает строки бунта (mutiny:true)", () => {
    const rows = crewActiveRows(CREW_MORALE_TABLE, 5);
    expect(rows.filter(r => r.mutiny).map(r => r.t)).toEqual([70, 40, 10]);
  });
});

describe("crewActionsPerSR", () => {
  it("действия НИП за СР = ⌊skill/10⌋ по метке качества", () => {
    expect(crewActionsPerSR("Умелый")).toBe(3);
    expect(crewActionsPerSR("Ветераны")).toBe(5);
  });

  it("неизвестная метка — 0", () => {
    expect(crewActionsPerSR("Легендарный")).toBe(0);
  });

  it("все метки CREW_RATING_TABLE дают неотрицательный результат", () => {
    for (const r of CREW_RATING_TABLE) expect(crewActionsPerSR(r.label)).toBeGreaterThan(0);
  });
});

describe("moralePerInfluence", () => {
  it("лёгкие корпуса (transport/raider/frigate) — 1d10, тяжелее — 1d5", () => {
    expect(moralePerInfluence("frigate")).toBe("1d10");
    expect(moralePerInfluence("cruiser")).toBe("1d5");
    expect(moralePerInfluence("battleship")).toBe("1d5");
  });
});
