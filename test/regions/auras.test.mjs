// test/regions/auras.test.mjs
//
// Аура (wdbc-1pa) — чистая логика движка: отношение по диспозициям,
// дескрипторы с предметов актора, решение «задет ли». Foundry-обвязка
// (sweepAurasOnScene) канвас-зависима и здесь не тестируется — см. план
// в тикете: canvas-стаб под токены/grid ещё не готов, а сама обвязка
// тонкая (только create/delete по готовому решению чистой функции).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { tokenRelationship, auraDescriptorsOf, auraAffects } from "../../module/regions/auras.mjs";

describe("tokenRelationship", () => {
  it("оба FRIENDLY — союзники", () => {
    expect(tokenRelationship(1, 1)).toBe("ally");
  });
  it("оба HOSTILE — союзники (друг другу)", () => {
    expect(tokenRelationship(-1, -1)).toBe("ally");
  });
  it("FRIENDLY против HOSTILE — враги", () => {
    expect(tokenRelationship(1, -1)).toBe("enemy");
    expect(tokenRelationship(-1, 1)).toBe("enemy");
  });
  it("NEUTRAL ни с кем не союзник и не враг", () => {
    expect(tokenRelationship(0, 1)).toBe("neutral");
    expect(tokenRelationship(1, 0)).toBe("neutral");
    expect(tokenRelationship(0, 0)).toBe("neutral");
    expect(tokenRelationship(0, -1)).toBe("neutral");
  });
  it("SECRET (-2) не считается союзником даже другому SECRET", () => {
    expect(tokenRelationship(-2, -2)).toBe("neutral");
  });
});

describe("auraAffects", () => {
  const base = { radius: 10, affects: "allies", includesSelf: false };

  it("self: задет только если includesSelf", () => {
    expect(auraAffects(base, { isSelf: true, relationship: "ally", distance: 0 })).toBe(false);
    expect(auraAffects({ ...base, includesSelf: true }, { isSelf: true, relationship: "ally", distance: 0 }))
      .toBe(true);
  });

  it("вне радиуса — не задет, независимо от отношения", () => {
    expect(auraAffects(base, { isSelf: false, relationship: "ally", distance: 11 })).toBe(false);
  });

  it("ровно на границе радиуса — задет", () => {
    expect(auraAffects(base, { isSelf: false, relationship: "ally", distance: 10 })).toBe(true);
  });

  it("affects:allies — только союзников в радиусе", () => {
    expect(auraAffects(base, { isSelf: false, relationship: "ally", distance: 5 })).toBe(true);
    expect(auraAffects(base, { isSelf: false, relationship: "enemy", distance: 5 })).toBe(false);
    expect(auraAffects(base, { isSelf: false, relationship: "neutral", distance: 5 })).toBe(false);
  });

  it("affects:enemies — только врагов в радиусе", () => {
    const d = { ...base, affects: "enemies" };
    expect(auraAffects(d, { isSelf: false, relationship: "enemy", distance: 5 })).toBe(true);
    expect(auraAffects(d, { isSelf: false, relationship: "ally", distance: 5 })).toBe(false);
  });

  it("affects:all — любой в радиусе, включая нейтральных", () => {
    const d = { ...base, affects: "all" };
    expect(auraAffects(d, { isSelf: false, relationship: "ally", distance: 5 })).toBe(true);
    expect(auraAffects(d, { isSelf: false, relationship: "enemy", distance: 5 })).toBe(true);
    expect(auraAffects(d, { isSelf: false, relationship: "neutral", distance: 5 })).toBe(true);
  });
});

/** Предмет-фикстура: минимум полей, которые трогает isItemActive/getFlag. */
function itemWith({ type = "trait", aura = null, flags = {}, system = {} } = {}) {
  const allFlags = { "warhammer-dbc": { ...(flags["warhammer-dbc"] || {}), ...(aura ? { aura } : {}) } };
  return {
    type, system, uuid: `Item.${Math.random().toString(36).slice(2)}`,
    getFlag: (scope, key) => allFlags[scope]?.[key]
  };
}

function actorWith(...items) {
  return { items };
}

describe("auraDescriptorsOf", () => {
  it("предмет без флага aura игнорируется", () => {
    expect(auraDescriptorsOf(actorWith(itemWith()))).toEqual([]);
  });

  it("radius <= 0 игнорируется", () => {
    const item = itemWith({ aura: { radius: 0, affects: "allies" } });
    expect(auraDescriptorsOf(actorWith(item))).toEqual([]);
  });

  it("неактивный предмет (не экипирована броня) игнорируется", () => {
    const item = itemWith({
      type: "armor",
      system: { equipped: false },
      aura: { radius: 5, affects: "allies" }
    });
    expect(auraDescriptorsOf(actorWith(item))).toEqual([]);
  });

  it("активный талант с аурой попадает в список с нормализованными полями", () => {
    const item = itemWith({ aura: { radius: 5, affects: "enemies", includesSelf: true, grant: ["Item.abc"] } });
    const [d] = auraDescriptorsOf(actorWith(item));
    expect(d).toMatchObject({
      sourceItemUuid: item.uuid, radius: 5, affects: "enemies", includesSelf: true, grant: ["Item.abc"]
    });
  });

  it("affects по умолчанию — allies, если значение неизвестно", () => {
    const item = itemWith({ aura: { radius: 5, affects: "что-то не то" } });
    const [d] = auraDescriptorsOf(actorWith(item));
    expect(d.affects).toBe("allies");
  });
});
