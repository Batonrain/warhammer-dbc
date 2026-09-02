// test/rules/wound-tier.test.mjs
//
// woundLevel — чистая функция, книжное правило «Уровни Ранения»: Легко раненный
// потерял до T.b×2 Ран включительно, Тяжело — больше, Критически — Раны в
// минусе (wounds.critical > 0). displayKey/displayLabel — то же самое для
// подписи на листе, только lost=0 показывается отдельным «Здоров».

import { describe, it, expect } from "vitest";
import { woundLevel } from "../../module/rules/wound-tier.mjs";

const sys = ({ value = 10, max = 10, critical = 0, tb = 3 } = {}) => ({
  wounds: { value, max, critical },
  characteristics: { t: { bonus: tb } }
});

describe("woundLevel: мехническая классификация (light/heavy/critical)", () => {
  it("полное здоровье — light", () => {
    expect(woundLevel(sys({ value: 10, max: 10 })).key).toBe("light");
  });

  it("потеряно ровно T.b×2 — всё ещё light (включительно)", () => {
    expect(woundLevel(sys({ value: 4, max: 10, tb: 3 })).key).toBe("light");
  });

  it("потеряно T.b×2 + 1 — heavy", () => {
    expect(woundLevel(sys({ value: 3, max: 10, tb: 3 })).key).toBe("heavy");
  });

  it("Раны в минусе (critical > 0) — critical, даже если формально lost небольшой", () => {
    expect(woundLevel(sys({ value: 0, max: 10, critical: 1, tb: 3 })).key).toBe("critical");
  });

  it("T.b 0 — любая потеря сразу heavy", () => {
    expect(woundLevel(sys({ value: 9, max: 10, tb: 0 })).key).toBe("heavy");
  });
});

describe("woundLevel: displayKey/displayLabel для листа", () => {
  it("lost=0 — «Здоров», не «Легко ранен»", () => {
    const lvl = woundLevel(sys({ value: 10, max: 10 }));
    expect(lvl.displayKey).toBe("healthy");
    expect(lvl.displayLabel).toBe("Здоров");
  });

  it("lost>0 в пределах T.b×2 — «Легко ранен»", () => {
    const lvl = woundLevel(sys({ value: 8, max: 10, tb: 3 }));
    expect(lvl.displayKey).toBe("light");
    expect(lvl.displayLabel).toBe("Легко ранен");
  });

  it("heavy — «Тяжело ранен»", () => {
    const lvl = woundLevel(sys({ value: 2, max: 10, tb: 3 }));
    expect(lvl.displayKey).toBe("heavy");
    expect(lvl.displayLabel).toBe("Тяжело ранен");
  });

  it("critical — «При смерти», не «Критическое»", () => {
    const lvl = woundLevel(sys({ value: 0, max: 10, critical: 5, tb: 3 }));
    expect(lvl.displayKey).toBe("dying");
    expect(lvl.displayLabel).toBe("При смерти");
  });
});

describe("woundLevel: безопасность к отсутствию данных", () => {
  it("пустой system не падает — читается как здоровый с T.b 0", () => {
    expect(woundLevel({})).toMatchObject({ key: "light", displayKey: "healthy", lost: 0, tb: 0, crit: 0 });
  });
});

describe("woundLevel: effectiveMax Саркофага Дредноута (wdbc-drn) идёт вместо max", () => {
  it("effectiveMax ниже max — lost считается от него", () => {
    const sysWithEff = { wounds: { value: 20, max: 25, effectiveMax: 20, critical: 0 },
                          characteristics: { t: { bonus: 3 } } };
    expect(woundLevel(sysWithEff)).toMatchObject({ lost: 0, displayKey: "healthy" });
  });

  it("без effectiveMax — как раньше, от обычного max", () => {
    const sysNoEff = { wounds: { value: 20, max: 25, critical: 0 },
                        characteristics: { t: { bonus: 3 } } };
    expect(woundLevel(sysNoEff).lost).toBe(5);
  });
});
