import { describe, it, expect } from "vitest";
import { PREDICATES } from "../../module/rules/predicates.mjs";

/** Подставной актор: обычный литерал, никакого Foundry. */
const actor = ({ items = [], ...system } = {}) => ({
  system: { characteristics: {}, ...system },
  items
});

const talent = name => ({ type: "talent", name });
const trait  = name => ({ type: "trait",  name });
const chars  = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { total: v }]));

describe("race", () => {
  const race = PREDICATES.race;

  it("раса актора есть в списке", () => {
    expect(race(actor({ race: "astartes" }), {}, ["astartes", "human"])).toBe(true);
  });

  it("раса актора вне списка", () => {
    expect(race(actor({ race: "human" }), {}, ["astartes"])).toBe(false);
  });

  it("одиночное значение читается как список из одного", () => {
    expect(race(actor({ race: "human" }), {}, "human")).toBe(true);
  });
});

describe("subrace", () => {
  it("субраса актора есть в списке", () => {
    expect(PREDICATES.subrace(actor({ subrace: "navigator" }), {}, ["navigator"])).toBe(true);
  });

  it("субраса не задана", () => {
    expect(PREDICATES.subrace(actor(), {}, ["navigator"])).toBe(false);
  });
});

describe("sizeMax", () => {
  const sizeMax = PREDICATES.sizeMax;

  it("Размер по умолчанию нулевой", () => {
    expect(sizeMax(actor(), {}, 1)).toBe(true);
  });

  it("вклад Черт учитывается", () => {
    expect(sizeMax(actor({ sizeMod: 2 }), {}, 1)).toBe(false);
  });

  it("базовый Размер складывается с вкладом Черт", () => {
    expect(sizeMax(actor({ size: 1, sizeMod: 1 }), {}, 1)).toBe(false);
  });

  it("готовый sizeTotal с листа берётся как есть", () => {
    expect(sizeMax(actor({ size: 1, sizeMod: 1, sizeTotal: 1 }), {}, 1)).toBe(true);
  });
});

describe("charMin", () => {
  const charMin = PREDICATES.charMin;

  it("все пороги пройдены", () => {
    expect(charMin(actor({ characteristics: chars({ s: 45, t: 40 }) }), {}, { s: 40, t: 40 })).toBe(true);
  });

  it("один порог не пройден", () => {
    expect(charMin(actor({ characteristics: chars({ s: 45, t: 35 }) }), {}, { s: 40, t: 40 })).toBe(false);
  });

  it("отсутствующая характеристика считается нулём", () => {
    expect(charMin(actor(), {}, { s: 1 })).toBe(false);
  });
});

describe("hasTalent и hasTrait", () => {
  const soldier = actor({ items: [
    talent("Nerves of Steel / Стальные Нервы"),
    talent("Resistance (Cold) / Сопротивление (Холод)"),
    trait("Gene-Seed / Геносемя")
  ] });

  it("имя ищется по английской половине", () => {
    expect(PREDICATES.hasTalent(soldier, {}, "Nerves of Steel")).toBe(true);
  });

  it("имя ищется и по русской половине", () => {
    expect(PREDICATES.hasTalent(soldier, {}, "Стальные Нервы")).toBe(true);
  });

  it("специализация в скобках при сравнении отбрасывается", () => {
    expect(PREDICATES.hasTalent(soldier, {}, "Resistance")).toBe(true);
  });

  it("чужой Талант не находится", () => {
    expect(PREDICATES.hasTalent(soldier, {}, "Frenzy")).toBe(false);
  });

  it("список требует все имена сразу", () => {
    expect(PREDICATES.hasTalent(soldier, {}, ["Nerves of Steel", "Gene-Seed"])).toBe(true);
    expect(PREDICATES.hasTalent(soldier, {}, ["Nerves of Steel", "Frenzy"])).toBe(false);
  });

  it("hasTrait находит Черту", () => {
    expect(PREDICATES.hasTrait(soldier, {}, "Геносемя")).toBe(true);
  });

  it("предметы других типов не считаются", () => {
    expect(PREDICATES.hasTrait(actor({ items: [{ type: "weapon", name: "Gene-Seed" }] }), {}, "Gene-Seed")).toBe(false);
  });
});

describe("weaponClass", () => {
  const bolter = { system: { weaponClass: "basic" } };

  it("класс оружия из контекста есть в списке", () => {
    expect(PREDICATES.weaponClass(actor(), { weapon: bolter }, ["basic", "heavy"])).toBe(true);
  });

  it("класс оружия вне списка", () => {
    expect(PREDICATES.weaponClass(actor(), { weapon: bolter }, ["melee"])).toBe(false);
  });

  it("оружия в контексте нет", () => {
    expect(PREDICATES.weaponClass(actor(), {}, ["melee"])).toBe(false);
  });
});

describe("targetHasTrait", () => {
  it("у цели есть такая Черта", () => {
    const target = actor({ items: [trait("Daemonic / Демонический")] });
    expect(PREDICATES.targetHasTrait(actor(), { target }, "Daemonic")).toBe(true);
  });

  it("цели нет в контексте", () => {
    expect(PREDICATES.targetHasTrait(actor(), {}, "Daemonic")).toBe(false);
  });
});

describe("общее требование к предикатам", () => {
  const value = {
    race: ["human"], subrace: ["navigator"], sizeMax: 1, charMin: { s: 40 },
    hasTalent: "Frenzy", hasTrait: "Gene-Seed", weaponClass: ["melee"],
    targetHasTrait: "Daemonic"
  };

  it("на пустом акторе каждый возвращает строго true или false", () => {
    for (const [key, fn] of Object.entries(PREDICATES)) {
      expect(typeof fn({}, {}, value[key]), key).toBe("boolean");
    }
  });

  it("реестр содержит все восемь условий этапа 1", () => {
    expect(Object.keys(PREDICATES).sort()).toEqual(Object.keys(value).sort());
  });
});
