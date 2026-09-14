// test/constants/psy-focus-disciplines.test.mjs
//
// Дисциплины, у которых Фокуса не бывает по книге (wdbc-l6zg, core.json
// стр.293 + desc самих дисциплин: «не могут быть выучены через Фокус
// Дисциплины», и runesFateBattle: «У Рун Судьбы и Битвы нет фокуса»).

import { describe, it, expect } from "vitest";
import { PSY_DISCIPLINES, NO_FOCUS_DISCIPLINES, canHaveFocusDiscipline } from "../../module/constants/disciplines.mjs";

describe("canHaveFocusDiscipline", () => {
  it("Регулярные дисциплины и Руны Судьбы/Битвы — Фокуса не бывает", () => {
    for (const key of ["thaumaturgy", "sorcery", "highSorcery", "daemonology", "runesFateBattle"]) {
      expect(canHaveFocusDiscipline(key)).toBe(false);
    }
  });

  it("Фундаментальные дисциплины — Фокус возможен", () => {
    for (const key of ["telekinesis", "telepathy", "divination", "biomancy", "pyromancy"]) {
      expect(canHaveFocusDiscipline(key)).toBe(true);
    }
  });

  it("Редкие дисциплины — Фокус возможен (книга: «крайне редки», не «невозможны»)", () => {
    expect(canHaveFocusDiscipline("chronomancy")).toBe(true);
    expect(canHaveFocusDiscipline("librarium")).toBe(true);
  });

  it("несуществующий ключ — false, а не исключение", () => {
    expect(canHaveFocusDiscipline("")).toBe(false);
    expect(canHaveFocusDiscipline("nonexistent")).toBe(false);
    expect(canHaveFocusDiscipline(undefined)).toBe(false);
  });

  it("исключение — реальные ключи PSY_DISCIPLINES (защита от опечатки при правке реестра)", () => {
    for (const key of NO_FOCUS_DISCIPLINES) expect(PSY_DISCIPLINES[key]).toBeTruthy();
  });
});
