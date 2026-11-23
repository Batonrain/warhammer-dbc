// Острие Копья (Разобрать stnbt): переброс атаки/Парирования, выданный Герольдом соратникам.
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { tipOfSpearActive, tipOfSpearRules, tipOfSpearGrant, tipOfSpearOffered, tipOfSpearSource } from "../../module/rules/tip-of-spear.mjs";
import { effectAppliesTo } from "../../module/rules/resolve-test.mjs";
import { meleeAlliesOf } from "../../module/combat/tip-of-spear.mjs";

const combat = (round, turn, id = "c1") => ({ id, round, turn });
const ally = grant => ({ uuid: "Actor.a", name: "Соратник", flags: { "warhammer-dbc": grant ? { tipOfSpear: grant } : {} },
  getFlag(s, k) { return this.flags[s]?.[k]; } });

describe("Острие Копья", () => {
  const grant = tipOfSpearGrant({ uuid: "Actor.h", name: "Герольд" }, combat(3, 2));

  it("переброс живёт до Хода Герольда в следующем Раунде", () => {
    expect(tipOfSpearActive(grant, combat(3, 4))).toBe(true);
    expect(tipOfSpearActive(grant, combat(4, 1))).toBe(true);
    expect(tipOfSpearActive(grant, combat(4, 2))).toBe(false);
    expect(tipOfSpearActive(grant, combat(5, 0))).toBe(false);
    expect(tipOfSpearActive(grant, combat(3, 4, "other"))).toBe(false);
  });

  it("правило — переброс атаки и Парирования с ограничителем", () => {
    const rules = tipOfSpearRules(ally(grant), combat(3, 3));
    expect(rules).toHaveLength(1);
    const eff = rules[0].effects[0];
    expect(eff.limit).toBe("tipOfSpear");
    expect(effectAppliesTo(eff.target, { kind: "skill", skill: "parry" })).toBe(true);
    expect(effectAppliesTo(eff.target, { kind: "skill", skill: "dodge" })).toBe(false);
    expect(tipOfSpearRules(ally(null), combat(3, 3))).toEqual([]);
    expect(tipOfSpearSource(ally(grant), combat(3, 3))?.uuid).toBe("Actor.a");
    expect(tipOfSpearSource(ally(grant), combat(5, 0))).toBe(null);
  });

  it("кнопка — только на рукопашном попадании носителя", () => {
    const h = { items: [{ type: "talent", name: "Tip Of The Spear / Острие Копья" }] };
    expect(tipOfSpearOffered(h, { isMelee: true, hit: true })).toBe(true);
    expect(tipOfSpearOffered(h, { isMelee: false, hit: true })).toBe(false);
    expect(tipOfSpearOffered({ items: [] }, { isMelee: true, hit: true })).toBe(false);
  });

  it("соратники — в контакте с врагами Герольда, без него самого", () => {
    const herald = { id: "h", actor: { uuid: "Actor.h" } };
    const a1 = { id: "a1", actor: { uuid: "Actor.1" } }, a2 = { id: "a2", actor: { uuid: "Actor.2" } };
    const e1 = { id: "e1" }, e2 = { id: "e2" };
    const contacts = { h: [e1, e2], e1: [herald, a1], e2: [a1, a2] };
    expect(meleeAlliesOf(herald, t => contacts[t.id] ?? []).map(a => a.uuid)).toEqual(["Actor.1", "Actor.2"]);
  });
});
