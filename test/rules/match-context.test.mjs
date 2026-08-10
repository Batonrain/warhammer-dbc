import { describe, it, expect } from "vitest";
import { matchesContext } from "../../module/rules/match-context.mjs";
import { matchesContext as reexported, homeworldRollMods } from "../../module/constants/homeworlds.mjs";

describe("matchesContext: вид теста", () => {
  it("вид совпадает", () => {
    expect(matchesContext({ kind: "skill" }, { kind: "skill" })).toBe(true);
  });

  it("вид не совпадает", () => {
    expect(matchesContext({ kind: "skill" }, { kind: "attack" })).toBe(false);
  });
});

describe("matchesContext: навык, группа, характеристика", () => {
  it("нужный навык", () => {
    expect(matchesContext({ kind: "skill", skill: "techUse" }, { kind: "skill", skill: "techUse" })).toBe(true);
  });

  it("другой навык", () => {
    expect(matchesContext({ kind: "skill", skill: "techUse" }, { kind: "skill", skill: "command" })).toBe(false);
  });

  it("групповой навык", () => {
    const when = { kind: "skill", group: "navigation", specialty: "Surface" };
    expect(matchesContext(when, { kind: "skill", group: "navigation", specialty: "Surface (Hive)" })).toBe(true);
    expect(matchesContext(when, { kind: "skill", group: "navigation", specialty: "Stellar" })).toBe(false);
  });

  it("специализация сравнивается без учёта регистра и по вхождению", () => {
    expect(matchesContext({ kind: "skill", specialty: "surface" }, { kind: "skill", specialty: "Surface" })).toBe(true);
  });

  it("характеристика", () => {
    expect(matchesContext({ kind: "char", char: "wp" }, { kind: "char", char: "wp" })).toBe(true);
    expect(matchesContext({ kind: "char", char: "wp" }, { kind: "char", char: "t" })).toBe(false);
  });
});

describe("matchesContext: флаговые контексты", () => {
  it("suppression просится только в помеченный бросок", () => {
    const when = { kind: "char", char: "wp", suppression: true };
    expect(matchesContext(when, { kind: "char", char: "wp", suppression: true })).toBe(true);
    expect(matchesContext(when, { kind: "char", char: "wp" })).toBe(false);
  });

  it("addiction засчитывается вместо suppression", () => {
    const when = { kind: "char", char: "t", suppression: true, addiction: true };
    expect(matchesContext(when, { kind: "char", char: "t", addiction: true })).toBe(true);
  });

  it("single и target", () => {
    expect(matchesContext({ kind: "attack", single: true }, { kind: "attack", single: true })).toBe(true);
    expect(matchesContext({ kind: "attack", single: true }, { kind: "attack" })).toBe(false);
    expect(matchesContext({ kind: "attack", target: true }, { kind: "attack", target: true })).toBe(true);
    expect(matchesContext({ kind: "attack", target: true }, { kind: "attack" })).toBe(false);
  });

  it("пустое условие подходит к любому броску того же вида", () => {
    expect(matchesContext({ kind: "attack" }, { kind: "attack", single: true })).toBe(true);
  });
});

describe("переезд из constants/homeworlds.mjs", () => {
  it("реэкспорт указывает на ту же функцию", () => {
    expect(reexported).toBe(matchesContext);
  });

  it("Особенности Происхождения по-прежнему отбираются", () => {
    const mods = homeworldRollMods("frontier", { kind: "skill", skill: "techUse" });
    expect(mods.map(m => m.key)).toEqual(["frontier-mod", "frontier-repair"]);
    expect(homeworldRollMods("frontier", { kind: "skill", skill: "command" })).toEqual([]);
  });
});
