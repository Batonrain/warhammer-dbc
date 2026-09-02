import { describe, it, expect } from "vitest";
import { isHandOfDeathItem, isFusedByHandOfDeath } from "../../module/rules/hand-of-death.mjs";

describe("isHandOfDeathItem", () => {
  it("совпадает по двуязычному имени пака, регистронезависимо", () => {
    expect(isHandOfDeathItem({ type: "mutation", name: "Hand of Death / Рука Смерти" })).toBe(true);
    expect(isHandOfDeathItem({ type: "mutation", name: "hand of death / рука смерти" })).toBe(true);
  });

  it("совпадает и по одной только английской половине (itemHasName сравнивает по частям)", () => {
    expect(isHandOfDeathItem({ type: "mutation", name: "Hand of Death" })).toBe(true);
  });

  it("другой тип предмета — false, даже с тем же именем", () => {
    expect(isHandOfDeathItem({ type: "trait", name: "Hand of Death / Рука Смерти" })).toBe(false);
  });

  it("другое имя — false", () => {
    expect(isHandOfDeathItem({ type: "mutation", name: "Tentacle / Щупальце" })).toBe(false);
  });

  it("нет предмета — false", () => {
    expect(isHandOfDeathItem(null)).toBe(false);
    expect(isHandOfDeathItem(undefined)).toBe(false);
  });
});

describe("isFusedByHandOfDeath", () => {
  const weapon = (source) => ({ type: "weapon", getFlag: (ns, key) => (key === "handOfDeathSource" ? source : undefined) });

  it("оружие несёт метку именно ЭТОГО источника — true", () => {
    expect(isFusedByHandOfDeath(weapon("mut1"), "mut1")).toBe(true);
  });

  it("метка другого источника — false", () => {
    expect(isFusedByHandOfDeath(weapon("mut2"), "mut1")).toBe(false);
  });

  it("метки нет вовсе — false", () => {
    expect(isFusedByHandOfDeath(weapon(undefined), "mut1")).toBe(false);
  });

  it("не оружие — false, даже с меткой", () => {
    expect(isFusedByHandOfDeath({ type: "trait", getFlag: () => "mut1" }, "mut1")).toBe(false);
  });

  describe("без mutationItemId — просто «слито ли хоть с какой-то Рукой Смерти»", () => {
    it("метка есть — true, id мутации не важен", () => {
      expect(isFusedByHandOfDeath(weapon("mut1"))).toBe(true);
      expect(isFusedByHandOfDeath(weapon("mut2"))).toBe(true);
    });
    it("метки нет — false", () => {
      expect(isFusedByHandOfDeath(weapon(undefined))).toBe(false);
    });
  });
});
