// test/rules/race.test.mjs
//
// effectiveRace/raceMatches — «настоящая» раса персонажа с учётом Прошлого
// Иннари/Арлекина (wdbc-f4z5). 4 комбинации: обычная раса, Иннари/Арлекин
// без выбранного Прошлого, Иннари/Арлекин с выбранным Прошлого.

import { describe, it, expect } from "vitest";
import { effectiveRace, raceMatches, pastRaceKey } from "../../module/rules/race.mjs";

describe("effectiveRace: раса с учётом Прошлого", () => {
  it("обычная раса — возвращается как есть, Прошлое не участвует", () => {
    expect(effectiveRace({ race: "drukhari" })).toBe("drukhari");
  });

  it("Иннари без выбранного Прошлого — остаётся ynnari", () => {
    expect(effectiveRace({ race: "ynnari", ynnariPast: "" })).toBe("ynnari");
  });

  it("Иннари с Прошлым Друкхари — эффективная раса drukhari", () => {
    expect(effectiveRace({ race: "ynnari", ynnariPast: "drukhari" })).toBe("drukhari");
  });

  it("Арлекин с Прошлым Азуриан — эффективная раса azuriane", () => {
    expect(effectiveRace({ race: "harlequin", harlequinPast: "azuriane" })).toBe("azuriane");
  });

  it("harlequinPast игнорируется у не-Арлекина, ynnariPast — у не-Иннари", () => {
    expect(effectiveRace({ race: "aeldari", ynnariPast: "drukhari", harlequinPast: "azuriane" })).toBe("aeldari");
  });
});

describe("raceMatches: короткая форма для точечных проверок", () => {
  it("совпадает по обычной расе", () => {
    expect(raceMatches({ race: "astartes" }, "astartes")).toBe(true);
  });

  it("совпадает по Прошлому Иннари", () => {
    expect(raceMatches({ race: "ynnari", ynnariPast: "drukhari" }, "drukhari")).toBe(true);
  });

  it("не совпадает, если раса другая и Прошлого нет", () => {
    expect(raceMatches({ race: "harlequin", harlequinPast: "" }, "drukhari")).toBe(false);
  });

  it("не проваливается на пустом/отсутствующем system", () => {
    expect(raceMatches(undefined, "drukhari")).toBe(false);
    expect(raceMatches({}, "drukhari")).toBe(false);
  });
});

describe("pastRaceKey: сырой ключ Прошлого", () => {
  it("пусто у обычной расы", () => {
    expect(pastRaceKey({ race: "drukhari", ynnariPast: "drukhari" })).toBe("");
  });

  it("возвращает выбранный ключ у Иннари/Арлекина", () => {
    expect(pastRaceKey({ race: "ynnari", ynnariPast: "aeldari" })).toBe("aeldari");
    expect(pastRaceKey({ race: "harlequin", harlequinPast: "azuriane" })).toBe("azuriane");
  });
});
