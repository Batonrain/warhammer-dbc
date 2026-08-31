// test/combat/ship-attack.test.mjs
//
// Движок автоматизации боевых свойств узлов корабля (wdbc-jr93) —
// havoc/terminalPenetration/volkite. Без Foundry, чистые функции. Зеркало
// test/combat/armor-properties.test.mjs по духу: правила книги, не разметка.

import { describe, it, expect } from "vitest";
import { resolveShipProps, aggregateShipAttackAuto } from "../../module/combat/ship-attack.mjs";

describe("resolveShipProps", () => {
  it("разрешает известные ключи, отбрасывает неизвестные", () => {
    const item = { system: { shipProps: [{ key: "havoc", rating: 2 }, { key: "unknownKey" }, { key: "volkite" }] } };
    const props = resolveShipProps(item);
    expect(props.map(p => p.key)).toEqual(["havoc", "volkite"]);
    expect(props.every(p => p.def)).toBe(true);
  });

  it("не падает без system.shipProps", () => {
    expect(resolveShipProps({ system: {} })).toEqual([]);
    expect(resolveShipProps(null)).toEqual([]);
  });
});

describe("aggregateShipAttackAuto", () => {
  it("пустой список — всё по нулям/ложно", () => {
    expect(aggregateShipAttackAuto([])).toEqual({ havocBonus: 0, terminalPenetration: 0, volkiteDouble: false, lifetakerCP: 0, penetrating: new Set() });
  });

  it("havoc(X) → havocBonus = X", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "havoc", rating: 3 }] } });
    expect(aggregateShipAttackAuto(props).havocBonus).toBe(3);
  });

  it("terminalPenetration(X) → terminalPenetration = X", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "terminalPenetration", rating: 4 }] } });
    expect(aggregateShipAttackAuto(props).terminalPenetration).toBe(4);
  });

  it("volkite → volkiteDouble = true (свойство без рейтинга)", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "volkite" }] } });
    expect(aggregateShipAttackAuto(props).volkiteDouble).toBe(true);
  });

  it("свойства без боевого auto (armored, fast…) не поднимают ничего", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "armored", rating: 2 }, { key: "fast", rating: 1 }] } });
    expect(aggregateShipAttackAuto(props)).toEqual({ havocBonus: 0, terminalPenetration: 0, volkiteDouble: false, lifetakerCP: 0, penetrating: new Set() });
  });

  it("несколько боевых свойств разом складываются в один набор", () => {
    const props = resolveShipProps({ system: { shipProps: [
      { key: "havoc", rating: 2 }, { key: "terminalPenetration", rating: 3 }, { key: "volkite" }
    ] } });
    const a = aggregateShipAttackAuto(props);
    expect(a.havocBonus).toBe(2);
    expect(a.terminalPenetration).toBe(3);
    expect(a.volkiteDouble).toBe(true);
  });

  it("lifetaker(X) → lifetakerCP = X (wdbc-qhwb)", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "lifetaker", rating: 5 }] } });
    expect(aggregateShipAttackAuto(props).lifetakerCP).toBe(5);
  });

  it("penetrating: одно значение → Set с одним кодом (wdbc-qhwb)", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "penetrating", rating: "armour" }] } });
    expect(aggregateShipAttackAuto(props).penetrating).toEqual(new Set(["armour"]));
  });

  it("penetrating: несколько значений через запятую → все коды в Set", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "penetrating", rating: "armour,voidShields" }] } });
    expect(aggregateShipAttackAuto(props).penetrating).toEqual(new Set(["armour", "voidShields"]));
  });

  it("penetrating без rating (пустой бэкфилл) → пустой Set, не падает", () => {
    const props = resolveShipProps({ system: { shipProps: [{ key: "penetrating" }] } });
    expect(aggregateShipAttackAuto(props).penetrating).toEqual(new Set());
  });
});
