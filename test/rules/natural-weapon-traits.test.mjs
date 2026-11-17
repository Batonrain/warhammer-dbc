// test/rules/natural-weapon-traits.test.mjs
//
// dbc-114 / 55-15 (13.11.2026): Черты Токсичный (X) и Варп-Оружие дают
// ЕСТЕСТВЕННОМУ оружию (интегральные атаки) свойство через запись Механики
// kind:"attackProp" на самой Черте. Тест читает НАСТОЯЩИЕ пак-файлы
// (зелёный тест на выдуманной фикстуре не доказывает, что фича жива).

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { weaponPropsFromRules } from "../../module/rules/resolve-test.mjs";

const DIR = path.resolve("packs-src/traits");
const packTrait = prefix => {
  const f = fs.readdirSync(DIR).find(x => x.startsWith(prefix + "___"));
  const j = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  return { ...j, id: "t-" + prefix, type: "trait", getFlag: () => undefined };
};
const grants = (item, rating = 1) => {
  item.system = { ...item.system, rating, hasRating: true };
  return rulesFromItemMechanics([item], () => true, { items: [item] })
    .flatMap(r => r.effects).filter(e => e.kind === "grantWeaponProp");
};

describe("Естественное оружие получает свойство от Черты (пак-данные)", () => {
  it("Варп-Оружие: свойство warpWeapon, только для безоружной/интегральной атаки", () => {
    const g = grants(packTrait("Warp_Weapon"));
    expect(g).toHaveLength(1);
    expect(g[0].propKey).toBe("warpWeapon");
    const rules = [{ id: "r", effects: g }];
    expect(weaponPropsFromRules(rules, { kind: "attack", unarmed: true }).map(p => p.key)).toContain("warpWeapon");
    expect(weaponPropsFromRules(rules, { kind: "attack", unarmed: false })).toEqual([]);
  });

  it("Токсичный (X): свойство toxic с Рейтингом Черты", () => {
    const g = grants(packTrait("Toxic"), 3);
    expect(g).toHaveLength(1);
    expect(g[0].propKey).toBe("toxic");
  });
});
