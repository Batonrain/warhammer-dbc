// test/sheets/archetype-gate.test.mjs
//
// Талант из дерева «Дополнительных Талантов» Элитного архетипа несёт гейт в
// system.specialization («Элитный архетип: X»), а не в system.requirement —
// без archetypeGateOk пикер это поле не читал вовсе, и персонаж без архетипа
// мог купить любой его Талант.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { archetypeGateOk, talentGroupLock } from "../../module/sheets/item-picker.mjs";
import { isHaemonculus } from "../../module/constants/haemonculus.mjs";

const actorWith = (names = [], system = {}) => ({
  system,
  items: names.map(name => ({ type: "eliteArchetype", name }))
});

describe("archetypeGateOk", () => {
  it("не гейт архетипа (обычное требование Таланта) — null, ни к чему не относится", () => {
    expect(archetypeGateOk(actorWith([]), "")).toBeNull();
    expect(archetypeGateOk(actorWith([]), "WS, BS")).toBeNull();
    expect(archetypeGateOk(actorWith([]), undefined)).toBeNull();
  });

  it.each([
    ["гейт есть, архетипа у актора нет — false",
      ["Corsair Prince / Барон Корсаров"], "Элитный архетип: Felarch / Феларх", false],
    ["гейт есть, архетип взят — true (сверка по английской половине имени)",
      ["Felarch / Феларх"], "Элитный архетип: Felarch / Феларх", true],
    ["не чувствителен к регистру и к префиксу [WIP]",
      ["[WIP] Felarch / Феларх"], "Элитный архетип: felarch / Феларх", true],
    ["другой архетип с тем же актором не проходит",
      ["Felarch / Феларх"], "Элитный архетип: Corsair Prince / Барон Корсаров", false],
    ["58 старых архетипов пишут только русскую половину — тоже проходит",
      ["Archmage / Архимаг"], "Элитный архетип: Архимаг", true],
    ["русская специализация без взятого архетипа — false, не null",
      ["Felarch / Феларх"], "Элитный архетип: Архимаг", false]
  ])("%s", (_title, names, spec, expected) => {
    expect(archetypeGateOk(actorWith(names), spec)).toBe(expected);
  });

  // wdbc-91o8: гейт смотрел ТОЛЬКО предметы. Архетип, вписанный строкой в
  // шапку (старый лист, ручной ввод) или взятый вторым в «дополнительных»,
  // дерево своих Талантов не отпирал, хотя архетип у персонажа есть.
  it("архетип строкой в шапке отпирает гейт наравне с предметом", () => {
    const actor = actorWith([], { eliteArchetype: "Felarch / Феларх" });
    expect(archetypeGateOk(actor, "Элитный архетип: Felarch / Феларх")).toBe(true);
    expect(archetypeGateOk(actor, "Элитный архетип: Феларх")).toBe(true);
    expect(archetypeGateOk(actor, "Элитный архетип: Архимаг")).toBe(false);
  });

  it("архетип в списке дополнительных отпирает гейт", () => {
    const actor = actorWith([], { eliteArchetypesExtra: ["Архимаг"] });
    expect(archetypeGateOk(actor, "Элитный архетип: Archmage / Архимаг")).toBe(true);
  });
});

describe("talentGroupLock, папка «Элитные архетипы» (wdbc-91o8)", () => {
  const lock = (actor, folder) => talentGroupLock(actor, "talent", "Элитные архетипы", folder);

  it("архетип предметом — папка открыта", () => {
    expect(lock(actorWith(["Felarch / Феларх"]), "Felarch / Феларх")).toBeNull();
  });

  it("архетипа нет вовсе — папка закрыта с причиной", () => {
    expect(lock(actorWith([]), "Felarch / Феларх")).toContain("Нужен Элитный архетип");
  });

  // Раньше сверка шла ТОЧНЫМ равенством строк: старый лист с одной половиной
  // имени («Феларх») не открывал папку «Felarch / Феларх».
  it("одна половина имени в шапке открывает папку с полным двуязычным именем", () => {
    expect(lock(actorWith([], { eliteArchetype: "Феларх" }), "Felarch / Феларх")).toBeNull();
  });

  it("одна половина имени в дополнительных — тоже открывает", () => {
    expect(lock(actorWith([], { eliteArchetypesExtra: ["Архимаг"] }), "Archmage / Архимаг")).toBeNull();
  });
});

describe("isHaemonculus — три источника архетипа (wdbc-91o8)", () => {
  it("строкой в шапке, как и было", () => {
    expect(isHaemonculus(actorWith([], { eliteArchetype: "Haemonculus / Гемункул" }))).toBe(true);
    expect(isHaemonculus(actorWith([], { eliteArchetype: "Гемункул" }))).toBe(true);
  });

  // Раньше — regex только по строке шапки: Гемункул вторым архетипом или
  // купленный пикером предметом терял Unnatural I + Fear в расчёте актора.
  it("вторым архетипом в дополнительных", () => {
    expect(isHaemonculus(actorWith([], { eliteArchetypesExtra: ["Гемункул"] }))).toBe(true);
  });

  it("предметом, купленным пикером", () => {
    expect(isHaemonculus(actorWith(["Haemonculus / Гемункул"]))).toBe(true);
  });

  it("другой архетип Гемункулом не делает", () => {
    expect(isHaemonculus(actorWith(["Felarch / Феларх"], { eliteArchetype: "Ведьма" }))).toBe(false);
    expect(isHaemonculus(actorWith([]))).toBe(false);
  });
});
