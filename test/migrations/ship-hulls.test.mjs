// test/migrations/ship-hulls.test.mjs
//
// Корпус стал отдельным типом shipHull, а у старых кораблей он — узел
// component[kind=hull]. Миграция обязана найти соответствие в паке (по
// источнику, затем по любой половине двуязычного имени) и не трогать узлы
// без соответствия — данные дороже чистоты.

import { describe, it, expect } from "vitest";
import { legacyHullItems, matchHullDoc } from "../../module/migrations/ship-hulls.mjs";

const legacy = ({ id = "l1", name, src } = {}) => ({
  id, name, type: "component",
  system: { kind: "hull" },
  _stats: src ? { compendiumSource: src } : {}
});

const doc = (uuid, name) => ({ uuid, name, type: "shipHull" });

describe("перевод Корпусов на shipHull", () => {
  it("легаси-Корпус — только узел kind=hull, прочие узлы не в счёт", () => {
    const items = [
      legacy({ id: "hull", name: "Меч" }),
      { id: "drive", type: "component", system: { kind: "drive" } },
      { id: "new", type: "shipHull", system: {} }
    ];
    expect(legacyHullItems(items).map(i => i.id)).toEqual(["hull"]);
  });

  it("соответствие: сперва по compendiumSource, затем по имени", () => {
    const sword = doc("Compendium.warhammer-dbc.ship-components.Item.s1", "Sword / Меч");
    const docs = [sword];
    expect(matchHullDoc(legacy({ src: sword.uuid, name: "Другое" }), docs)).toBe(sword);
    expect(matchHullDoc(legacy({ name: "Sword / Меч" }), docs)).toBe(sword);
  });

  it("двуязычное имя пака матчится любой половиной", () => {
    const sword = doc("Compendium...s1", "Sword / Меч");
    expect(matchHullDoc(legacy({ name: "Меч" }), [sword])).toBe(sword);
    expect(matchHullDoc(legacy({ name: "sword" }), [sword])).toBe(sword);
  });

  it("нет соответствия — null, узел остаётся хозяину", () => {
    expect(matchHullDoc(legacy({ name: "Самодельный корпус" }), [doc("u", "Sword / Меч")])).toBe(null);
    expect(matchHullDoc(legacy({ name: "" }), [doc("u", "Sword / Меч")])).toBe(null);
  });
});
