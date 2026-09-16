// test/rules/wrapped-in-chaos.test.mjs
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { wrappedInChaosKindByLabel, fliesAttackPenalty, isWrappedInChaosItem, targetHasActiveFlies,
         realityRendingPenalty, REALITY_RENDING_EXCLUDED_FLAG,
         hasPhantomCopies, phantomCopiesDodgePenalty, phantomCopiesFeintBonus, wrathHeatAttackPenalty }
  from "../../module/rules/wrapped-in-chaos.mjs";

describe("wrappedInChaosKindByLabel", () => {
  it("распознаёт подписи Группы A", () => {
    expect(wrappedInChaosKindByLabel("4-5")).toBe("smokeScreen");
    expect(wrappedInChaosKindByLabel("7")).toBe("flies");
  });
  it("остальные подписи распознаются, но код для них пока не пишет обработчик", () => {
    expect(wrappedInChaosKindByLabel("1")).toBe("shadow");
    expect(wrappedInChaosKindByLabel("2-3")).toBe("phantomCopies");
  });
  it("пустая/нераспознанная подпись — пустая строка", () => {
    expect(wrappedInChaosKindByLabel("")).toBe("");
    expect(wrappedInChaosKindByLabel("11")).toBe("");
  });
});

describe("fliesAttackPenalty", () => {
  it("здоров — −5/−10 (Избирательная)", () => {
    expect(fliesAttackPenalty("healthy", false)).toBe(-5);
    expect(fliesAttackPenalty("healthy", true)).toBe(-10);
  });
  it("лёгко ранен — −10/−20", () => {
    expect(fliesAttackPenalty("light", false)).toBe(-10);
    expect(fliesAttackPenalty("light", true)).toBe(-20);
  });
  it("тяжело ранен — −15/−30", () => {
    expect(fliesAttackPenalty("heavy", false)).toBe(-15);
    expect(fliesAttackPenalty("heavy", true)).toBe(-30);
  });
  it("критически ранен (displayKey \"dying\") — −20/−40", () => {
    expect(fliesAttackPenalty("dying", false)).toBe(-20);
    expect(fliesAttackPenalty("dying", true)).toBe(-40);
  });
  it("неизвестный тир — как здоров", () => {
    expect(fliesAttackPenalty("", false)).toBe(-5);
  });
});

function mutationItem(capabilityKey, label, name = "Wrapped in Chaos / Укутанный в Хаос") {
  return {
    type: "mutation", name,
    system: { submutation: { label } },
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey, label: "" }
    ] }] } }
  };
}

describe("targetHasActiveFlies", () => {
  it("да — предмет «Укутанный в Хаос» с выпавшей субмутацией «7»", () => {
    const actor = { items: [mutationItem("mutation.wrappedInChaos", "7")] };
    expect(targetHasActiveFlies(actor)).toBe(true);
  });
  it("нет — та же Мутация, но другая субмутация", () => {
    const actor = { items: [mutationItem("mutation.wrappedInChaos", "4-5")] };
    expect(targetHasActiveFlies(actor)).toBe(false);
  });
  it("нет — нет такой Мутации вовсе", () => {
    const actor = { items: [mutationItem("mutation.boneless", "7", "Boneless / Бескостный")] };
    expect(targetHasActiveFlies(actor)).toBe(false);
  });
  it("нет актора/предметов — false, не падает", () => {
    expect(targetHasActiveFlies(null)).toBe(false);
    expect(targetHasActiveFlies({})).toBe(false);
  });
});

describe("isWrappedInChaosItem", () => {
  it("опознаёт по capabilityKey", () => {
    expect(isWrappedInChaosItem(mutationItem("mutation.wrappedInChaos", ""))).toBe(true);
  });
  it("не путает с другой Мутацией", () => {
    expect(isWrappedInChaosItem(mutationItem("mutation.boneless", "", "Boneless / Бескостный"))).toBe(false);
  });
});

describe("realityRendingPenalty", () => {
  function mockActor(name, uuid, { wpBonus = 0 } = {}) {
    const actor = { name, uuid, system: { characteristics: { wp: { bonus: wpBonus } } }, items: [] };
    actor.getActiveTokens = () => (actor._token ? [actor._token] : []);
    return actor;
  }
  function linkToken(actor, x, y, parent) {
    const token = { x, y, width: 1, height: 1, parent };
    actor._token = token;
    return token;
  }
  function realityRendingSource(excluded = []) {
    const flags = { [REALITY_RENDING_EXCLUDED_FLAG]: excluded };
    return {
      ...mutationItem("mutation.wrappedInChaos", "9"),
      getFlag: (_s, k) => flags[k]
    };
  }

  beforeEach(() => { globalThis.game = { actors: [] }; });
  afterEach(() => { delete globalThis.game; });

  it("нет game (юнит-тест без Foundry) — 0, не падает", () => {
    delete globalThis.game;
    expect(realityRendingPenalty(mockActor("Жертва", "Actor.v"))).toBe(0);
  });

  it("владелец в радиусе — -3", () => {
    const victim = mockActor("Жертва", "Actor.v");
    const owner = mockActor("Владелец", "Actor.o");
    owner.items = [realityRendingSource()];
    const grid = { size: 100, distance: 1 };
    const parent = { grid };
    linkToken(victim, 0, 0, parent);
    linkToken(owner, 100, 0, parent); // 1м
    globalThis.game.actors = [victim, owner];

    expect(realityRendingPenalty(victim)).toBe(-3);
  });

  it("владелец дальше 3м — не действует", () => {
    const victim = mockActor("Жертва", "Actor.v");
    const owner = mockActor("Владелец", "Actor.o");
    owner.items = [realityRendingSource()];
    const grid = { size: 100, distance: 1 };
    const parent = { grid };
    linkToken(victim, 0, 0, parent);
    linkToken(owner, 500, 0, parent); // 5м
    globalThis.game.actors = [victim, owner];

    expect(realityRendingPenalty(victim)).toBe(0);
  });

  it("владелец сам себе не наносит штраф", () => {
    const owner = mockActor("Владелец", "Actor.o");
    owner.items = [realityRendingSource()];
    const grid = { size: 100, distance: 1 };
    linkToken(owner, 0, 0, { grid });
    globalThis.game.actors = [owner];

    expect(realityRendingPenalty(owner)).toBe(0);
  });

  it("жертва в списке исключённых владельца — не действует", () => {
    const victim = mockActor("Жертва", "Actor.v");
    const owner = mockActor("Владелец", "Actor.o", { wpBonus: 3 });
    owner.items = [realityRendingSource(["Actor.v"])];
    const grid = { size: 100, distance: 1 };
    const parent = { grid };
    linkToken(victim, 0, 0, parent);
    linkToken(owner, 100, 0, parent);
    globalThis.game.actors = [victim, owner];

    expect(realityRendingPenalty(victim)).toBe(0);
  });

  it("исключений больше, чем W.b владельца — лишние не считаются", () => {
    const victim = mockActor("Жертва", "Actor.v");
    const owner = mockActor("Владелец", "Actor.o", { wpBonus: 0 }); // W.b=0 → 0 исключений разрешено
    owner.items = [realityRendingSource(["Actor.v"])]; // выбран, но сверх лимита
    const grid = { size: 100, distance: 1 };
    const parent = { grid };
    linkToken(victim, 0, 0, parent);
    linkToken(owner, 100, 0, parent);
    globalThis.game.actors = [victim, owner];

    expect(realityRendingPenalty(victim)).toBe(-3); // исключение не сработало — лимит 0
  });

  it("два независимых владельца в радиусе — штрафы складываются", () => {
    const victim = mockActor("Жертва", "Actor.v");
    const ownerA = mockActor("Владелец A", "Actor.oa");
    const ownerB = mockActor("Владелец B", "Actor.ob");
    ownerA.items = [realityRendingSource()];
    ownerB.items = [realityRendingSource()];
    const grid = { size: 100, distance: 1 };
    const parent = { grid };
    linkToken(victim, 0, 0, parent);
    linkToken(ownerA, 100, 0, parent);
    linkToken(ownerB, 0, 100, parent);
    globalThis.game.actors = [victim, ownerA, ownerB];

    expect(realityRendingPenalty(victim)).toBe(-6);
  });

  it("нет токена у жертвы или владелец на другой сцене — не действует", () => {
    const victim = mockActor("Жертва", "Actor.v");
    const owner = mockActor("Владелец", "Actor.o");
    owner.items = [realityRendingSource()];
    linkToken(owner, 0, 0, { grid: { size: 100, distance: 1 } }); // другая сцена (другой parent)
    globalThis.game.actors = [victim, owner];

    expect(realityRendingPenalty(victim)).toBe(0); // у жертвы нет токена вовсе
  });
});

describe("hasPhantomCopies / phantomCopiesDodgePenalty / phantomCopiesFeintBonus", () => {
  it("hasPhantomCopies — да, с выпавшей «2-3»", () => {
    const actor = { items: [mutationItem("mutation.wrappedInChaos", "2-3")] };
    expect(hasPhantomCopies(actor)).toBe(true);
  });
  it("hasPhantomCopies — нет, другая субмутация той же Мутации", () => {
    const actor = { items: [mutationItem("mutation.wrappedInChaos", "7")] };
    expect(hasPhantomCopies(actor)).toBe(false);
  });

  it("phantomCopiesDodgePenalty — атакующий с «2-3», рукопашная — −10", () => {
    const attacker = { items: [mutationItem("mutation.wrappedInChaos", "2-3")] };
    expect(phantomCopiesDodgePenalty(attacker, true)).toBe(-10);
  });
  it("phantomCopiesDodgePenalty — та же атака, но стрелковая — 0", () => {
    const attacker = { items: [mutationItem("mutation.wrappedInChaos", "2-3")] };
    expect(phantomCopiesDodgePenalty(attacker, false)).toBe(0);
  });
  it("phantomCopiesDodgePenalty — атакующий без «2-3» — 0", () => {
    expect(phantomCopiesDodgePenalty({ items: [] }, true)).toBe(0);
    expect(phantomCopiesDodgePenalty(null, true)).toBe(0);
  });

  it("phantomCopiesFeintBonus — владелец «2-3» — +20", () => {
    const actor = { items: [mutationItem("mutation.wrappedInChaos", "2-3")] };
    expect(phantomCopiesFeintBonus(actor)).toBe(20);
  });
  it("phantomCopiesFeintBonus — без «2-3» — 0", () => {
    expect(phantomCopiesFeintBonus({ items: [] })).toBe(0);
  });
});

describe("wrathHeatAttackPenalty", () => {
  function mockActor2(name, uuid) {
    const actor = { name, uuid, items: [] };
    actor.getActiveTokens = () => (actor._token ? [actor._token] : []);
    return actor;
  }
  function linkToken2(actor, x, y, parent) {
    const token = { x, y, width: 1, height: 1, parent };
    actor._token = token;
    return token;
  }

  beforeEach(() => { globalThis.game = { actors: [] }; });
  afterEach(() => { delete globalThis.game; });

  it("не рукопашная атака — 0, даже если цель держит «8»", () => {
    const target = mockActor2("Держатель", "Actor.h");
    target.items = [mutationItem("mutation.wrappedInChaos", "8")];
    expect(wrathHeatAttackPenalty(target, false)).toBe(0);
  });

  it("цель сама держит «8» — −10, без game/токенов не падает", () => {
    delete globalThis.game;
    const target = { items: [mutationItem("mutation.wrappedInChaos", "8")] };
    expect(wrathHeatAttackPenalty(target, true)).toBe(-10);
  });

  it("цель без «8» и без держателя рядом — 0", () => {
    const target = mockActor2("Цель", "Actor.t");
    globalThis.game.actors = [target];
    expect(wrathHeatAttackPenalty(target, true)).toBe(0);
  });

  it("союзник-держатель «8» в 3м от цели — −10", () => {
    const target = mockActor2("Союзник цели", "Actor.t");
    const holder = mockActor2("Держатель", "Actor.h");
    holder.items = [mutationItem("mutation.wrappedInChaos", "8")];
    const grid = { size: 100, distance: 1 };
    const parent = { grid };
    linkToken2(target, 0, 0, parent);
    linkToken2(holder, 300, 0, parent); // 3м — на границе
    globalThis.game.actors = [target, holder];

    expect(wrathHeatAttackPenalty(target, true)).toBe(-10);
  });

  it("держатель «8» дальше 3м от цели — 0", () => {
    const target = mockActor2("Цель", "Actor.t");
    const holder = mockActor2("Держатель", "Actor.h");
    holder.items = [mutationItem("mutation.wrappedInChaos", "8")];
    const grid = { size: 100, distance: 1 };
    const parent = { grid };
    linkToken2(target, 0, 0, parent);
    linkToken2(holder, 500, 0, parent); // 5м
    globalThis.game.actors = [target, holder];

    expect(wrathHeatAttackPenalty(target, true)).toBe(0);
  });

  it("нет токена у цели — 0, не падает", () => {
    const target = mockActor2("Цель без токена", "Actor.t");
    const holder = mockActor2("Держатель", "Actor.h");
    holder.items = [mutationItem("mutation.wrappedInChaos", "8")];
    linkToken2(holder, 0, 0, { grid: { size: 100, distance: 1 } });
    globalThis.game.actors = [target, holder];

    expect(wrathHeatAttackPenalty(target, true)).toBe(0);
  });
});
