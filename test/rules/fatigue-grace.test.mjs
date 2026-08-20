import { describe, it, expect } from "vitest";
import { flattenMechEntries, isFatigueEntry, fatigueGraceForActor }
  from "../../module/rules/fatigue-grace.mjs";

/** Запись «Усталость» Конструктора. */
const fatigueEntry = (char = "t") => ({
  id: "e1", kind: "fatigue", fatigueAction: "threshold", fatigueThresholdChar: char
});

/** Предмет с Механикой: и через getFlag, и просто флагом-литералом. */
const item = (groups, viaFlag = true) => viaFlag
  ? { getFlag: (scope, key) => (scope === "warhammer-dbc" && key === "mechanics" ? groups : undefined) }
  : { flags: { "warhammer-dbc": { mechanics: groups } } };

const group = (...entries) => ({ id: "g", operator: "AND", entries });

const actor = (items = [], { tb = 3, wb = 5 } = {}) => ({
  system: { characteristics: { t: { bonus: tb }, wp: { bonus: wb } } },
  items
});

describe("flattenMechEntries", () => {
  it("разворачивает записи всех групп", () => {
    const got = flattenMechEntries([group({ id: "a" }), group({ id: "b" }, { id: "c" })]);
    expect(got.map(e => e.id)).toEqual(["a", "b", "c"]);
  });

  it("достаёт записи из вложенных подгрупп", () => {
    const nested = { id: "sub", kind: "group", group: group({ id: "inner" }) };
    expect(flattenMechEntries([group({ id: "outer" }, nested)]).map(e => e.id))
      .toEqual(["outer", "sub", "inner"]);
  });

  it("пустое и битое не роняет", () => {
    expect(flattenMechEntries(null)).toEqual([]);
    expect(flattenMechEntries([{}])).toEqual([]);
  });
});

describe("isFatigueEntry", () => {
  it("заполненная запись годится", () => {
    expect(isFatigueEntry(fatigueEntry("t"))).toBe(true);
  });

  it("без характеристики или с чужим действием — нет", () => {
    expect(isFatigueEntry({ kind: "fatigue", fatigueAction: "threshold" })).toBe(false);
    expect(isFatigueEntry({ kind: "fatigue", fatigueAction: "иное", fatigueThresholdChar: "t" })).toBe(false);
  });

  it("другой вид записи — нет", () => {
    expect(isFatigueEntry({ kind: "terrainIgnore" })).toBe(false);
  });
});

describe("fatigueGraceForActor", () => {
  it("без предметов порог не поднят", () => {
    expect(fatigueGraceForActor(actor())).toBe(0);
    expect(fatigueGraceForActor(null)).toBe(0);
  });

  it("Бонус Стойкости", () => {
    expect(fatigueGraceForActor(actor([item([group(fatigueEntry("t"))])]))).toBe(3);
  });

  it("Бонус Воли", () => {
    expect(fatigueGraceForActor(actor([item([group(fatigueEntry("wp"))])]))).toBe(5);
  });

  // Это терпимость к усталости, а не складывающийся бонус: два предмета не
  // должны давать двойной запас.
  it("несколько источников — максимум, а не сумма", () => {
    const a = actor([item([group(fatigueEntry("t"))]), item([group(fatigueEntry("wp"))])]);
    expect(fatigueGraceForActor(a)).toBe(5);
  });

  it("запись в подгруппе действует наравне с верхней", () => {
    const nested = { id: "sub", kind: "group", group: group(fatigueEntry("wp")) };
    expect(fatigueGraceForActor(actor([item([group(nested)])]))).toBe(5);
  });

  it("незаполненная запись ничего не даёт", () => {
    const bad = { id: "e", kind: "fatigue", fatigueAction: "threshold" };
    expect(fatigueGraceForActor(actor([item([group(bad)])]))).toBe(0);
  });

  it("читает Механику и у литерала без getFlag", () => {
    expect(fatigueGraceForActor(actor([item([group(fatigueEntry("t"))], false)]))).toBe(3);
  });

  // entry.when — тот же гейт по Геносемени, что у разовой выдачи/testMod
  // (module/rules/mech-when.mjs): чужому легиону запись не должна доставаться
  // даже в живом запросе, не только при выдаче предмета.
  it("entry.when — Бонус Воли достаётся только своему легиону", () => {
    const gated = { ...fatigueEntry("wp"), when: { negate: false, conditions: [{ legion: "XII" }] } };
    const wrongLegion = { ...actor([item([group(gated)])]), system: {
      characteristics: { t: { bonus: 3 }, wp: { bonus: 5 } }, geneSeed: { legion: "VI", chapter: "" } } };
    const rightLegion = { ...actor([item([group(gated)])]), system: {
      characteristics: { t: { bonus: 3 }, wp: { bonus: 5 } }, geneSeed: { legion: "XII", chapter: "" } } };
    expect(fatigueGraceForActor(wrongLegion)).toBe(0);
    expect(fatigueGraceForActor(rightLegion)).toBe(5);
  });
});
