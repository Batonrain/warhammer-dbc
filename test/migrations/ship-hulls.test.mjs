// test/migrations/ship-hulls.test.mjs
//
// Корпус стал отдельным типом shipHull, а у старых кораблей он — узел
// component[kind=hull]. Миграция обязана найти соответствие в паке (по
// источнику, затем по любой половине двуязычного имени) и не трогать узлы
// без соответствия — данные дороже чистоты.

import { describe, it, expect, afterEach } from "vitest";
import { legacyHullItems, matchHullDoc, migrateShipHulls } from "../../module/migrations/ship-hulls.mjs";

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

// wdbc-059h: по образцу gear-equipped/wdbc-dyi — было один try на ВЕСЬ цикл по
// акторам, сбой на одном глушил перевод остальным молча. Для кораблей это
// особенно чувствительно: их токены на сцене по умолчанию НЕ привязаны
// (actorLink:false), т.е. живут в собственной ActorDelta токена.
describe("migrateShipHulls: изоляция сбоя одного корабля/токена (wdbc-059h)", () => {
  afterEach(() => { delete globalThis.game; delete globalThis.ui; });

  const sword = doc("Compendium.warhammer-dbc.ship-components.Item.s1", "Sword / Меч");
  const packDoc = { ...sword, toObject: () => ({ _id: "new1", type: "shipHull", name: sword.name }) };

  function shipWith(id, items, { throwOnCreate = false } = {}) {
    return {
      id, name: `Корабль ${id}`, type: "ship", items,
      async createEmbeddedDocuments(type, docs) { if (throwOnCreate) throw new Error(`boom on ${id}`); },
      async deleteEmbeddedDocuments(type, ids) {}
    };
  }

  it("сбой на одном корабле не прерывает перевод остальным и не топит их результат", async () => {
    const bad = shipWith("bad", [legacy({ id: "hullBad", name: "Sword / Меч" })], { throwOnCreate: true });
    const good = shipWith("good", [legacy({ id: "hullGood", name: "Sword / Меч" })]);

    globalThis.game = {
      user: { isGM: true },
      actors: [bad, good],
      scenes: [],
      packs: { get: () => ({ getDocuments: async () => [packDoc] }) }
    };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateShipHulls();

    expect(res.migrated).toBe(1);
    expect(res.failed).toBe(1);
  });

  it("непривязанный токен корабля (actorLink:false) обрабатывается через свою ActorDelta", async () => {
    const tokenShip = shipWith("tok1", [legacy({ id: "hullTok", name: "Sword / Меч" })]);

    globalThis.game = {
      user: { isGM: true },
      actors: [],
      scenes: [{ name: "Сцена 1", tokens: { contents: [
        { id: "t1", name: "Токен корабля", actorLink: false, actor: tokenShip }
      ] } }],
      packs: { get: () => ({ getDocuments: async () => [packDoc] }) }
    };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateShipHulls();

    expect(res.migrated).toBe(1);
    expect(res.failed).toBe(0);
  });
});
