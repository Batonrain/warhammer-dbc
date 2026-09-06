// Иммунитет и смягчение Состояний из Конструктора (wdbc-tl0f, kind:"condition",
// режимы "immunity"/"mitigate"). Чистый модуль — заглушка Foundry не нужна.

import { describe, it, expect } from "vitest";
import { isConditionEntry, conditionEntriesOf, conditionImmunities,
         isImmuneToCondition, conditionMitigation } from "../../module/rules/condition-guards.mjs";

const SYSTEM = "warhammer-dbc";

/** Запись «Состояние» Конструктора. */
const cond = (over = {}) => ({
  id: "e1", kind: "condition", condKey: "stunned", condMode: "immunity",
  condLevel: "1", condMitigate: "ignore", ...over
});

const group = (...entries) => ({ id: "g", operator: "AND", entries });

/** Предмет с Механикой — и через getFlag (документ), и голым флагом (данные пака). */
const item = (groups, viaFlag = true) => viaFlag
  ? { name: "Предмет", getFlag: (scope, key) => (scope === SYSTEM && key === "mechanics" ? groups : undefined) }
  : { name: "Предмет", flags: { [SYSTEM]: { mechanics: groups } } };

const actor = (items = [], system = {}) => ({ name: "Подставной", items, system });

describe("isConditionEntry", () => {
  it("заполненная запись годится", () => {
    expect(isConditionEntry(cond())).toBe(true);
  });

  it("без ключа Состояния или с чужим режимом — нет", () => {
    expect(isConditionEntry(cond({ condKey: "" }))).toBe(false);
    expect(isConditionEntry(cond({ condMode: "неизвестно" }))).toBe(false);
  });

  it("другой вид записи — нет", () => {
    expect(isConditionEntry({ kind: "fatigue", condKey: "stunned" })).toBe(false);
    expect(isConditionEntry(null)).toBe(false);
  });
});

describe("conditionEntriesOf", () => {
  it("отбирает только записи запрошенного режима", () => {
    const a = actor([item([group(cond({ id: "i", condMode: "immunity" }),
                                cond({ id: "m", condMode: "mitigate" }),
                                cond({ id: "a", condMode: "apply" }))])]);
    expect(conditionEntriesOf(a, "immunity").map(x => x.entry.id)).toEqual(["i"]);
    expect(conditionEntriesOf(a, "mitigate").map(x => x.entry.id)).toEqual(["m"]);
  });

  it("достаёт записи из вложенных подгрупп", () => {
    const nested = { id: "sub", kind: "group", group: group(cond({ id: "inner" })) };
    const a = actor([item([group(nested)])]);
    expect(conditionEntriesOf(a, "immunity").map(x => x.entry.id)).toEqual(["inner"]);
  });

  it("выключенный источник не считается", () => {
    const a = actor([item([group(cond())], false)]);
    expect(conditionEntriesOf(a, "immunity", () => false)).toEqual([]);
    expect(conditionEntriesOf(a, "immunity", () => true).length).toBe(1);
  });
});

describe("conditionImmunities / isImmuneToCondition", () => {
  it("ключ из записи попадает в набор иммунитетов", () => {
    const a = actor([item([group(cond({ condKey: "blinded" }))])]);
    expect([...conditionImmunities(a)]).toEqual(["blinded"]);
    expect(isImmuneToCondition(a, "blinded")).toBe(true);
    expect(isImmuneToCondition(a, "stunned")).toBe(false);
  });

  it("гейт «Когда» отсекает запись — иммунитета нет, пока условие не выполнено", () => {
    const gated = cond({ when: { requireRage: true } });
    const calm  = actor([item([group(gated)])], { inRage: false });
    const raged = actor([item([group(gated)])], { inRage: true });
    expect(isImmuneToCondition(calm, "stunned")).toBe(false);
    expect(isImmuneToCondition(raged, "stunned")).toBe(true);
  });

  it("без актора или без ключа — не иммунен", () => {
    expect(isImmuneToCondition(null, "stunned")).toBe(false);
    expect(isImmuneToCondition(actor(), "")).toBe(false);
  });
});

describe("conditionMitigation", () => {
  it("возвращает вид смягчения только для СВОЕГО Состояния", () => {
    const a = actor([item([group(cond({ condMode: "mitigate", condKey: "prone", condMitigate: "half" }))])]);
    expect(conditionMitigation(a, "prone")).toBe("half");
    expect(conditionMitigation(a, "deafened")).toBe("");
  });

  it("полное снятие сильнее половины, в любом порядке источников", () => {
    const half   = cond({ id: "h", condMode: "mitigate", condKey: "prone", condMitigate: "half" });
    const ignore = cond({ id: "g", condMode: "mitigate", condKey: "prone", condMitigate: "ignore" });
    expect(conditionMitigation(actor([item([group(half, ignore)])]), "prone")).toBe("ignore");
    expect(conditionMitigation(actor([item([group(ignore, half)])]), "prone")).toBe("ignore");
  });

  it("записи режима «иммунитет» смягчением не считаются", () => {
    const a = actor([item([group(cond({ condMode: "immunity", condKey: "prone" }))])]);
    expect(conditionMitigation(a, "prone")).toBe("");
  });
});
