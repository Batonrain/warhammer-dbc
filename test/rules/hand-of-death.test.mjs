import { describe, it, expect } from "vitest";
import { isFusedByHandOfDeath } from "../../module/rules/hand-of-death.mjs";

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
