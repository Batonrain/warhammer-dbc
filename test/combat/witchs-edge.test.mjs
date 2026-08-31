// test/combat/witchs-edge.test.mjs
//
// Колдовское Лезвие (стр. 74 Книги Аэльдари): выбор перед боем — Force (если
// есть) либо набор Dueling Weapon/Reinforced/Power Field/Precise/Mighty.
// Независимо от выбора оружие всегда считается имеющим Force для прочих
// механик — {key:"force"} подмешивается безусловно, выбор влияет только на
// присутствие бандла из пяти доп. свойств.

import { describe, it, expect } from "vitest";
import { hasWitchsEdge, witchsEdgeExtraEntries, withWitchsEdge } from "../../module/combat/witchs-edge.mjs";
import { weaponFor } from "../support/combat-fixtures.mjs";

function withChoice(item, choice) {
  item.getFlag = (scope, key) => (scope === "warhammer-dbc" && key === "witchsEdgeChoice") ? choice : undefined;
  return item;
}

describe("hasWitchsEdge", () => {
  it("true, если в weaponProps есть witchsEdge", () => {
    const w = weaponFor({ weaponProps: [{ key: "witchsEdge", rating: 0, rating2: 0 }] });
    expect(hasWitchsEdge(w)).toBe(true);
  });
  it("false для обычного оружия", () => {
    const w = weaponFor({ weaponProps: [{ key: "defensive", rating: 0, rating2: 0 }] });
    expect(hasWitchsEdge(w)).toBe(false);
  });
});

describe("witchsEdgeExtraEntries", () => {
  it("оружие без Witch's Edge — пустой массив", () => {
    const w = weaponFor({ weaponProps: [] });
    expect(witchsEdgeExtraEntries(w)).toEqual([]);
  });

  it("без сохранённого выбора (флаг не стоит) — только {key:'force'}", () => {
    const w = withChoice(weaponFor({ weaponProps: [{ key: "witchsEdge", rating: 0, rating2: 0 }] }), undefined);
    expect(witchsEdgeExtraEntries(w)).toEqual([{ key: "force" }]);
  });

  it("выбор 'force' — только {key:'force'}, бандл не добавляется", () => {
    const w = withChoice(weaponFor({ weaponProps: [{ key: "witchsEdge", rating: 0, rating2: 0 }] }), "force");
    expect(witchsEdgeExtraEntries(w)).toEqual([{ key: "force" }]);
  });

  it("выбор 'bundle' — force + пять свойств бандла", () => {
    const w = withChoice(weaponFor({ weaponProps: [{ key: "witchsEdge", rating: 0, rating2: 0 }] }), "bundle");
    const keys = witchsEdgeExtraEntries(w).map(e => e.key);
    expect(keys).toEqual(["force", "duelingWeapon", "reinforced", "powerField", "precise", "mighty"]);
  });
});

describe("withWitchsEdge", () => {
  it("без Witch's Edge — возвращает entries как есть (тот же состав)", () => {
    const w = weaponFor({ weaponProps: [{ key: "defensive", rating: 0, rating2: 0 }] });
    const entries = [{ key: "defensive" }];
    expect(withWitchsEdge(w, entries)).toEqual([{ key: "defensive" }]);
  });

  it("с бандлом — доп. записи идут ПОСЛЕ исходных, исходные не теряются", () => {
    const w = withChoice(weaponFor({ weaponProps: [{ key: "witchsEdge", rating: 0, rating2: 0 }] }), "bundle");
    const entries = [{ key: "witchsEdge" }, { key: "flexible" }];
    const merged = withWitchsEdge(w, entries);
    expect(merged.map(e => e.key)).toEqual(
      ["witchsEdge", "flexible", "force", "duelingWeapon", "reinforced", "powerField", "precise", "mighty"]);
  });
});
