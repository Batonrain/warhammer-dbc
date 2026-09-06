import { describe, it, expect } from "vitest";
import { generateName, cultureForRace, nameCultures, nameCultureLabel, RACE_TO_NAME_CULTURE }
  from "../../module/rules/name-generator.mjs";
import { NAME_LISTS } from "../../module/constants/name-lists.mjs";

describe("generateName", () => {
  it("возвращает имя из списка своей культуры и пола", () => {
    for (let i = 0; i < 30; i++) {
      expect(NAME_LISTS.imperial.male).toContain(generateName("imperial", "male"));
      expect(NAME_LISTS.imperial.female).toContain(generateName("imperial", "female"));
      expect(NAME_LISTS.aeldari.male).toContain(generateName("aeldari", "male"));
      expect(NAME_LISTS.aeldari.female).toContain(generateName("aeldari", "female"));
      expect(NAME_LISTS.drukhari.male).toContain(generateName("drukhari", "male"));
      expect(NAME_LISTS.drukhari.female).toContain(generateName("drukhari", "female"));
    }
  });

  it("даёт разные результаты при разных вызовах (не константа)", () => {
    const seen = new Set();
    for (let i = 0; i < 40; i++) seen.add(generateName("imperial", "male"));
    // Список из 18 имён, 40 бросков — по крайней мере несколько разных должны выпасть.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("пол по умолчанию — мужской", () => {
    for (let i = 0; i < 15; i++) expect(NAME_LISTS.imperial.male).toContain(generateName("imperial"));
  });

  it("неизвестная культура откатывается на имперскую", () => {
    for (let i = 0; i < 15; i++) {
      const n = generateName("несуществующая-культура", "female");
      expect(NAME_LISTS.imperial.female).toContain(n);
    }
  });

  it("Астартес — только мужской список; запрос женского откатывается на него же", () => {
    for (let i = 0; i < 15; i++) {
      expect(NAME_LISTS.astartes.male).toContain(generateName("astartes", "male"));
      expect(NAME_LISTS.astartes.male).toContain(generateName("astartes", "female"));
    }
  });

  it("пол \"other\" — из объединения мужского и женского списков культуры", () => {
    const union = [...NAME_LISTS.aeldari.male, ...NAME_LISTS.aeldari.female];
    for (let i = 0; i < 20; i++) expect(union).toContain(generateName("aeldari", "other"));
  });

  it("никогда не возвращает пустую строку", () => {
    for (const culture of nameCultures()) {
      for (const gender of ["male", "female", "other", undefined]) {
        expect(generateName(culture, gender)).toBeTruthy();
      }
    }
  });
});

describe("cultureForRace", () => {
  it("человек и большинство абхуманов Империума — имперская культура", () => {
    for (const race of ["human", "ogryn", "ratling", "squat", "replicant", "yigori", "sslyth"]) {
      expect(cultureForRace(race)).toBe("imperial");
    }
  });

  it("Астартес — легионная культура", () => {
    expect(cultureForRace("astartes")).toBe("astartes");
  });

  it("расы происхождением от аэльдари — культура аэльдари", () => {
    for (const race of ["azuriane", "halfEldar", "harlequin", "exodite", "ynnari"]) {
      expect(cultureForRace(race)).toBe("aeldari");
    }
  });

  it("Друкхари — своя культура", () => {
    expect(cultureForRace("drukhari")).toBe("drukhari");
  });

  it("неизвестная/отсутствующая раса — имперская культура (запасной вариант)", () => {
    expect(cultureForRace("что-то-незнакомое")).toBe("imperial");
    expect(cultureForRace("")).toBe("imperial");
    expect(cultureForRace(undefined)).toBe("imperial");
  });

  it("каждая запись RACE_TO_NAME_CULTURE указывает на существующую культуру", () => {
    for (const culture of Object.values(RACE_TO_NAME_CULTURE)) {
      expect(NAME_LISTS[culture]).toBeTruthy();
    }
  });
});

describe("nameCultures / nameCultureLabel", () => {
  it("перечисляет все ключи NAME_LISTS", () => {
    expect(nameCultures().sort()).toEqual(Object.keys(NAME_LISTS).sort());
  });

  it("подпись культуры совпадает с её label", () => {
    expect(nameCultureLabel("imperial")).toBe(NAME_LISTS.imperial.label);
    expect(nameCultureLabel("aeldari")).toBe(NAME_LISTS.aeldari.label);
  });

  it("неизвестная культура — ключ как есть", () => {
    expect(nameCultureLabel("орк")).toBe("орк");
  });
});
