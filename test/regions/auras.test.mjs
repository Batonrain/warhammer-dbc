// test/regions/auras.test.mjs
//
// Аура (wdbc-1pa) — чистая логика движка: отношение по диспозициям,
// дескрипторы с предметов актора, решение «задет ли». Foundry-обвязка
// (sweepAurasOnScene) канвас-зависима и здесь не тестируется — см. план
// в тикете: canvas-стаб под токены/grid ещё не готов, а сама обвязка
// тонкая (только create/delete по готовому решению чистой функции).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { tokenRelationship, auraDescriptorsOf, auraAffects, targetIsAuraImmune } from "../../module/regions/auras.mjs";

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

  it("immune гасит попадание независимо от радиуса/отношения/self (wdbc-995w: Daemonic Presence)", () => {
    const d = { ...base, affects: "enemies", includesSelf: true };
    expect(auraAffects(d, { isSelf: false, relationship: "enemy", distance: 1, immune: true })).toBe(false);
    expect(auraAffects(d, { isSelf: true, relationship: "ally", distance: 0, immune: true })).toBe(false);
  });

  it("immune по умолчанию false — старые вызовы без ctx.immune ведут себя как раньше", () => {
    expect(auraAffects(base, { isSelf: false, relationship: "ally", distance: 5 })).toBe(true);
  });
});

describe("targetIsAuraImmune", () => {
  const traitNamed = name => ({ name });

  it("пустой список иммунитета — иммунитета нет ни у кого", () => {
    expect(targetIsAuraImmune({ items: [traitNamed("Daemonic")] }, [])).toBe(false);
  });

  it("нет актора — не иммунен (нечего проверять)", () => {
    expect(targetIsAuraImmune(null, ["Daemonic"])).toBe(false);
  });

  it("у цели есть одна из перечисленных Черт — иммунен", () => {
    const actor = { items: [traitNamed("Machine")] };
    expect(targetIsAuraImmune(actor, ["Daemonic", "From Beyond", "Machine", "Stuff of Nightmares"])).toBe(true);
  });

  it("совпадение терпит суффикс рейтинга и двуязычное имя (itemHasName)", () => {
    const actor = { items: [traitNamed("Machine / Машина (3)")] };
    expect(targetIsAuraImmune(actor, ["Machine"])).toBe(true);
  });

  it("ни одной подходящей Черты — не иммунен", () => {
    const actor = { items: [traitNamed("Nimble")] };
    expect(targetIsAuraImmune(actor, ["Daemonic", "Machine"])).toBe(false);
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
    const item = itemWith({
      aura: { radius: 5, affects: "enemies", includesSelf: true, grant: [{ uuid: "Item.abc", rating: 1 }] }
    });
    const [d] = auraDescriptorsOf(actorWith(item));
    expect(d).toMatchObject({
      sourceItemUuid: item.uuid, radius: 5, affects: "enemies", includesSelf: true,
      grant: [{ uuid: "Item.abc", rating: 1 }]
    });
  });

  it("grant в устаревшем формате (голый uuid) нормализуется, а не теряется", () => {
    // Старая документация в шапке auras.mjs предлагала ставить флаг руками
    // именно так — миры с ручными аурами не должны молча терять выдачу.
    const item = itemWith({ aura: { radius: 5, affects: "allies", grant: ["Item.abc"] } });
    const [d] = auraDescriptorsOf(actorWith(item));
    expect(d.grant).toEqual([{ uuid: "Item.abc", rating: null }]);
  });

  it("affects по умолчанию — allies, если значение неизвестно", () => {
    const item = itemWith({ aura: { radius: 5, affects: "что-то не то" } });
    const [d] = auraDescriptorsOf(actorWith(item));
    expect(d.affects).toBe("allies");
  });

  it("immuneTraitNames нормализуется в дескрипторе (пусто, если флаг его не несёт)", () => {
    const item = itemWith({ aura: { radius: 5, affects: "allies" } });
    const [d] = auraDescriptorsOf(actorWith(item));
    expect(d.immuneTraitNames).toEqual([]);
  });

  it("immuneTraitNames с пустыми/мусорными элементами фильтруется", () => {
    const item = itemWith({
      aura: { radius: 5, affects: "enemies", immuneTraitNames: ["Daemonic", "", null, "Machine"] }
    });
    const [d] = auraDescriptorsOf(actorWith(item));
    expect(d.immuneTraitNames).toEqual(["Daemonic", "Machine"]);
  });
});

// ── Дистанция по документам ─────────────────────────────────────────────────
import { tokenDocDistance } from "../../module/regions/auras.mjs";

describe("tokenDocDistance — замер по документам, без placeable", () => {
  const grid = { size: 100, distance: 2 };   // клетка 100px = 2 метра

  it("центр-к-центру в единицах сцены", () => {
    const a = { x: 0,   y: 0, width: 1, height: 1 };
    const b = { x: 300, y: 0, width: 1, height: 1 };
    expect(tokenDocDistance(a, b, grid)).toBe(6);   // 3 клетки × 2 м
  });

  it("центр большого токена считается от его габарита", () => {
    const big   = { x: 0,   y: 0, width: 2, height: 2 };  // центр (100,100)
    const small = { x: 300, y: 50, width: 1, height: 1 }; // центр (350,100)
    expect(tokenDocDistance(big, small, grid)).toBe(5);   // 250px = 2.5 кл × 2 м
  });

  it("высота участвует: аура не достаёт до токена на 10 м выше", () => {
    const a = { x: 0, y: 0, width: 1, height: 1, elevation: 0 };
    const b = { x: 0, y: 0, width: 1, height: 1, elevation: 10 };
    expect(tokenDocDistance(a, b, grid)).toBe(10);
  });

  it("дефолты сетки не роняют замер", () => {
    const a = { x: 0, y: 0, width: 1, height: 1 };
    const b = { x: 100, y: 0, width: 1, height: 1 };
    expect(tokenDocDistance(a, b, undefined)).toBe(1);
  });
});
