// test/rules/attack-prop.test.mjs
//
// «Свойство атаки» Конструктора (kind:"attackProp", wdbc-rmrm9 — Электродуга:
// «Все безоружные атаки персонажа получают свойства Arc (7/2d10+T.b) и
// Shocking»). Запись → правило grantWeaponProp (rules/item-rules.mjs) →
// weaponPropsFromRules отдаёт свойство только атакам своей области; рейтинг-
// формула («2d10+T.b») доезжает строкой, а не обнуляется Number().

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { weaponPropsFromRules } from "../../module/rules/resolve-test.mjs";

function implant(entries) {
  const flags = { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries }] } };
  return { id: "arc", name: "Electric Arc / Электродуга", type: "implant", system: {}, flags,
    getFlag: (s, k) => flags[s]?.[k] };
}

const arcEntry = { id: "e2", kind: "attackProp", apScope: "unarmed", apKey: "arc", apRating: "7", apRating2: "2d10+T.b" };

describe("attackProp → grantWeaponProp", () => {
  const rules = rulesFromItemMechanics([implant([arcEntry])]);

  it("безоружная атака получает Дугу с формулой урона строкой", () => {
    const props = weaponPropsFromRules(rules, { kind: "attack", isMelee: true, unarmed: true });
    expect(props).toEqual([expect.objectContaining({ key: "arc", rating: 7, rating2: "2d10+T.b" })]);
  });

  it("рукопашная атака оружием — нет", () => {
    expect(weaponPropsFromRules(rules, { kind: "attack", isMelee: true, unarmed: false })).toEqual([]);
  });

  it("область «melee» — любая рукопашная", () => {
    const r = rulesFromItemMechanics([implant([{ ...arcEntry, apScope: "melee" }])]);
    expect(weaponPropsFromRules(r, { kind: "attack", isMelee: true, unarmed: false })).toHaveLength(1);
    expect(weaponPropsFromRules(r, { kind: "attack", isMelee: false })).toHaveLength(0);
  });

  it("запись без свойства правила не даёт", () => {
    expect(rulesFromItemMechanics([implant([{ ...arcEntry, apKey: "" }])])).toEqual([]);
  });
});
