// test/combat/electric-arc-bestq.test.mjs
//
// wdbc-3hgd0: остаток Электродуги — Пробитие и цепные дуги Best.Q,
// электропроводящие броня+оружие, сопротивление к E(El), Электрическая
// регенерация, «Восстановление» (свойства атаки импланта выключены на 8 ч).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { arcExtraAttrs, chainArcCount, parseArcHitIds } from "../../module/rules/arc-extra.mjs";
import { aggregateAuto, resolveWeaponPropsList } from "../../module/combat/weapon-properties.mjs";
import { conductiveMeleeOf } from "../../module/rules/conductive.mjs";
import { weaponPropsFromRules } from "../../module/rules/resolve-test.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { captured } from "../support/foundry-stub.mjs";

const cap = (key, extra = {}) => ({ id: `i-${key}`, name: "Электродуга", type: "implant", system: { installed: true },
  getFlag: (_s, k) => (k === "installed" ? true : undefined),
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }], ...extra } } });

describe("Пробитие и цепная дуга", () => {
  it("свойства складываются в wp и попадают на кнопку", () => {
    const wp = aggregateAuto(resolveWeaponPropsList([
      { key: "arc", rating: 8, rating2: "2d10" }, { key: "arcPen", rating: 4 }, { key: "arcChain", rating: 8, rating2: "2d10" }]));
    expect(wp).toEqual(expect.objectContaining({ arcPen: 4, arcChainRating: 8, arcChainDamage: "2d10" }));
    expect(arcExtraAttrs(wp)).toContain('data-arc-pen="4"');
    expect(arcExtraAttrs(wp)).toContain('data-arc-chain-rating="8"');
  });

  it("без Best.Q — кнопка как раньше", () => {
    const wp = aggregateAuto(resolveWeaponPropsList([{ key: "arc", rating: 7, rating2: 5 }]));
    expect(wp.arcPen).toBeNull();
    expect(arcExtraAttrs(wp)).toBe("");
  });

  it("новая дуга на каждый кубик X+, список поражённых разбирается", () => {
    expect(chainArcCount([8, 3], 8)).toBe(1);
    expect(chainArcCount([9, 10], 8)).toBe(2);
    expect(chainArcCount([9], 0)).toBe(0);
    expect(parseArcHitIds("a, b,,c")).toEqual(["a", "b", "c"]);
  });
});

describe("электропроводящие броня и оружие", () => {
  const armour = on => ({ type: "armor", system: { equipped: on, properties: ["conductive"] } });
  const sword = { type: "weapon", system: { weaponProps: [{ key: "conductive" }] } };
  it("нужно и то, и другое", () => {
    expect(conductiveMeleeOf({ items: [armour(true)] }, sword)).toBe(true);
    expect(conductiveMeleeOf({ items: [armour(false)] }, sword)).toBe(false);
    expect(conductiveMeleeOf({ items: [armour(true)] }, { system: { weaponProps: [] } })).toBe(false);
  });

  it("область weapon:conductiveMelee — только рукопашная с признаком", () => {
    const rules = [{ id: "r", effects: [{ kind: "grantWeaponProp", target: "weapon:conductiveMelee", propKey: "shocking" }] }];
    expect(weaponPropsFromRules(rules, { kind: "attack", isMelee: true, conductive: true })).toHaveLength(1);
    expect(weaponPropsFromRules(rules, { kind: "attack", isMelee: true, conductive: false })).toEqual([]);
    expect(weaponPropsFromRules(rules, { kind: "attack", isMelee: false, conductive: true })).toEqual([]);
  });
});

describe("Восстановление: свойства атаки импланта выключены на время", () => {
  const imp = until => ({ id: "imp", type: "implant", name: "Электродуга", system: { installed: true }, getFlag: (_s, k) => (k === "installed" ? true : undefined),
    flags: { "warhammer-dbc": { attackPropsSuspendedUntil: until, mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "attackProp", apScope: "unarmed", apKey: "arc", apRating: "7", apRating2: "5" }] }] } } });
  it("до метки — свойства нет, после — есть", () => {
    game.time = { worldTime: 1000 };
    const grants = it => rulesFromItemMechanics([it], () => true, { items: [it] })
      .flatMap(r => r.effects).filter(e => e.kind === "grantWeaponProp");
    expect(grants(imp(5000))).toEqual([]);
    expect(grants(imp(500))).toHaveLength(1);
  });
});

describe("сопротивление к E(El) и Электрическая регенерация", () => {
  const target = items => {
    const a = { id: "t", name: "Друкхари", type: "character", uuid: "Actor.t",
      system: { absorption: { body: 0, toughnessBonus: 0, propFlags: {}, armorOnly: {} },
        wounds: { value: 10, max: 20, critical: 0 }, armorCorrosion: {}, piercingWounds: {}, crippledWounds: [] },
      items: Object.assign([...items], { contents: items }),
      async update(d) { for (const [p, v] of Object.entries(d)) { const k = p.split(".").slice(1); let c = a.system; for (const x of k.slice(0, -1)) c = (c[x] ??= {}); c[k.at(-1)] = v; } } };
    return a;
  };
  const hit = () => ({ rawDamage: 8, penetration: 0, damageType: "energy", damageSubtype: "electrical", hitLocation: "Торс", attackerName: "x", weaponName: "y" });

  it("сопротивление: урон E(El) после поглощения вдвое (окр. вверх)", async () => {
    const a = target([cap("damageResistance.subtype.electrical")]);
    await applyDamageToActor(a, { ...hit(), rawDamage: 7 });
    expect(a.system.wounds.value).toBe(6); // 10 − ceil(7/2)
  });

  it("регенерация: после попадания E(El), нанёсшего урон, +1d10 Ран", async () => {
    const a = target([cap("implant.electricArc.regeneration")]);
    captured.dice = [4];
    await applyDamageToActor(a, hit());
    expect(a.system.wounds.value).toBe(10 - 8 + 4);
  });
});
