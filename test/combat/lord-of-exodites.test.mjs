// test/combat/lord-of-exodites.test.mjs
//
// Lord of the Exodites / Повелитель Экзодитов (wdbc-zepq) — части составной
// Черты, реализованные кодом (не декларативной Механикой на предмете):
// групповое снятие Страха/Шока/Подавления, восстановление Судьбы Отряду,
// переключатель бонус↔штраф ауры по исходу собственного проваленного теста.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  hasLordOfExodites, unnaturalFHint, clearMoraleConditions,
  exoditeSquadmatesOf, rallyExoditeSquad, applyLordOfExoditesFailPenalty
} from "../../module/combat/lord-of-exodites.mjs";

const LORD_TRAIT = { type: "trait", name: "Lord of the Exodites / Повелитель Экзодитов" };

function makeActor(overrides = {}) {
  const updates = [];
  const flags = {};
  const a = {
    id: overrides.id || "lord-1", uuid: overrides.uuid || `Actor.${overrides.id || "lord-1"}`,
    name: overrides.name || "Владыка",
    items: overrides.items || [],
    system: {
      characteristics: { fel: { bonus: 3, total: 40 }, wp: { total: 40 } },
      fate: { value: 2, max: 5 },
      skills: { command: { total: 50 } },
      ...overrides.system
    },
    updates,
    async update(data) { updates.push(data); return data; },
    async setFlag(scope, key, value) { flags[key] = value; },
    async unsetFlag(scope, key) { delete flags[key]; },
    getFlag: (scope, key) => flags[key]
  };
  return a;
}

beforeEach(resetCaptured);

describe("hasLordOfExodites", () => {
  it("находит Черту по английской половине двуязычного имени", () => {
    expect(hasLordOfExodites(makeActor({ items: [LORD_TRAIT] }))).toBe(true);
  });
  it("без Черты — false, без падения на пустом/несуществующем items", () => {
    expect(hasLordOfExodites(makeActor({ items: [] }))).toBe(false);
    expect(hasLordOfExodites({})).toBe(false);
    expect(hasLordOfExodites(null)).toBe(false);
  });
});

describe("unnaturalFHint", () => {
  it("находит величину из ActiveEffect предмета с «Unnatural» в имени, правящего fel.bonusFx", () => {
    const actor = makeActor({ items: [{
      name: "Unnatural F, I, W (+2) / Сверхъест. Общительность, Интеллект, Воля",
      effects: [{ changes: [
        { key: "system.characteristics.fel.bonusFx", value: 2 },
        { key: "system.characteristics.int.bonusFx", value: 2 }
      ] }]
    }] });
    expect(unnaturalFHint(actor)).toBe(2);
  });

  it("нет подходящего предмета — 0, не ошибка", () => {
    expect(unnaturalFHint(makeActor({ items: [] }))).toBe(0);
  });

  it("предмет с «Unnatural» в имени, но без fel.bonusFx — не даёт ложного числа", () => {
    const actor = makeActor({ items: [{
      name: "Unnatural Toughness / Сверхъестественная Стойкость",
      effects: [{ changes: [{ key: "system.characteristics.t.bonusFx", value: 2 }] }]
    }] });
    expect(unnaturalFHint(actor)).toBe(0);
  });
});

describe("clearMoraleConditions", () => {
  it("снимает Шок и Подавление со всех переданных целей и публикует карточку", async () => {
    const lord = makeActor();
    const mate1 = makeActor({ id: "m1", system: { conditions: { shocked: true, pinned: true } } });
    const mate2 = makeActor({ id: "m2", system: { conditions: { pinned: true } } });

    await clearMoraleConditions(lord, [mate1, mate2]);

    expect(mate1.updates).toContainEqual({ "system.conditions.shocked": false, "system.conditions.pinned": false });
    expect(mate2.updates).toContainEqual({ "system.conditions.shocked": false, "system.conditions.pinned": false });
    expect(captured.chat.at(-1).content).toContain(mate1.name);
    expect(captured.chat.at(-1).content).toContain(mate2.name);
  });

  it("сам Владыка не может быть указан как своя же цель", async () => {
    const lord = makeActor();
    await clearMoraleConditions(lord, [lord]);
    expect(lord.updates).toHaveLength(0);
    expect(captured.warnings).toHaveLength(1);
  });

  it("пустой список целей — предупреждение, не тихий провал", async () => {
    await clearMoraleConditions(makeActor(), []);
    expect(captured.warnings).toHaveLength(1);
    expect(captured.chat).toHaveLength(0);
  });
});

describe("exoditeSquadmatesOf / rallyExoditeSquad", () => {
  const withActors = (list, fn) => async () => {
    const saved = globalThis.game.actors;
    globalThis.game.actors = list;
    try { await fn(); } finally { globalThis.game.actors = saved; }
  };

  function squad(commanderUuid, memberUuids) {
    return {
      type: "squad", uuid: "Squad.1",
      system: { posts: { commander: { uuid: commanderUuid }, leader: {}, coordinator: {} },
                members: memberUuids.map(uuid => ({ uuid })) }
    };
  }

  it("фильтрует по расе (AELDARI_RACES) — люди из списка выпадают", withActors([], async () => {
    const lord = makeActor({ system: { race: "exodite" } });
    const eldarMate = makeActor({ id: "e1", system: { race: "harlequin" } });
    const humanMate = makeActor({ id: "h1", system: { race: "human" } });
    globalThis.game.actors = [lord, eldarMate, humanMate, squad(lord.uuid, [eldarMate.uuid, humanMate.uuid])];

    const mates = exoditeSquadmatesOf(lord, globalThis.game.actors);
    expect(mates.map(a => a.id)).toEqual(expect.arrayContaining([lord.id, eldarMate.id]));
    expect(mates.map(a => a.id)).not.toContain(humanMate.id);
  }));

  it("Владыка не-эльдар (редкий случай) не включает себя в список", withActors([], async () => {
    const lord = makeActor({ system: { race: "human" } });
    const eldarMate = makeActor({ id: "e1", system: { race: "exodite" } });
    globalThis.game.actors = [lord, eldarMate, squad(lord.uuid, [eldarMate.uuid])];

    const mates = exoditeSquadmatesOf(lord, globalThis.game.actors);
    expect(mates.map(a => a.id)).toEqual([eldarMate.id]);
  }));

  it("rallyExoditeSquad: не Командир ни одного Отряда — предупреждение, без броска", withActors([], async () => {
    const lord = makeActor();
    globalThis.game.actors = [lord];
    await rallyExoditeSquad(lord);
    expect(captured.warnings).toHaveLength(1);
    expect(captured.chat).toHaveLength(0);
  }));

  it("rallyExoditeSquad: успех восстанавливает Судьбу себе и эльдарам Отряда", withActors([], async () => {
    const lord = makeActor({ system: { race: "exodite", skills: { command: { total: 50 } } } });
    const mate = makeActor({ id: "e1", system: { race: "exodite", fate: { value: 0, max: 3 } } });
    globalThis.game.actors = [lord, mate, squad(lord.uuid, [mate.uuid])];
    captured.nextRoll = 10; // порог 50-10=40, 10 ≤ 40 успех

    const { ok, healedNames } = await rallyExoditeSquad(lord);

    expect(ok).toBe(true);
    expect(healedNames).toEqual(expect.arrayContaining([lord.name, mate.name]));
    // changeInfamy пишет обычным update — проверяем сам факт записи в fate.value.
    expect(lord.updates.some(u => "system.fate.value" in u)).toBe(true);
    expect(mate.updates.some(u => "system.fate.value" in u)).toBe(true);
  }));

  it("rallyExoditeSquad: провал — никому ничего не восстанавливается", withActors([], async () => {
    const lord = makeActor({ system: { race: "exodite" } });
    const mate = makeActor({ id: "e1", system: { race: "exodite" } });
    globalThis.game.actors = [lord, mate, squad(lord.uuid, [mate.uuid])];
    captured.nextRoll = 90; // порог 40, провал

    const { ok, healedNames } = await rallyExoditeSquad(lord);
    expect(ok).toBe(false);
    expect(healedNames).toEqual([]);
    expect(mate.updates.some(u => "system.fate.value" in u)).toBe(false);
  }));
});

describe("applyLordOfExoditesFailPenalty", () => {
  it("без Черты — ничего не происходит", async () => {
    const actor = makeActor({ items: [] });
    await applyLordOfExoditesFailPenalty(actor, { dof: 3, usedReroll: true });
    expect(actor.updates).toHaveLength(0);
    expect(captured.chat).toHaveLength(0);
  });

  it("провал без переброса — не срабатывает даже с Чертой и 2+ степенями", async () => {
    const actor = makeActor({ items: [LORD_TRAIT] });
    await applyLordOfExoditesFailPenalty(actor, { dof: 3, usedReroll: false });
    expect(actor.updates).toHaveLength(0);
  });

  it("провал с переброском на 1 степень — недостаточно (нужно 2+)", async () => {
    const actor = makeActor({ items: [LORD_TRAIT] });
    await applyLordOfExoditesFailPenalty(actor, { dof: 1, usedReroll: true });
    expect(actor.updates).toHaveLength(0);
  });

  it("провал с переброском на 2+ степени — списывает 1 Судьбы и публикует карточку", async () => {
    const savedActors = globalThis.game.actors;
    globalThis.game.actors = [];
    const actor = makeActor({ items: [LORD_TRAIT] });
    await applyLordOfExoditesFailPenalty(actor, { dof: 2, usedReroll: true });

    expect(actor.updates.some(u => "system.fate.value" in u)).toBe(true);
    expect(captured.chat.at(-1).content).toContain("провал с перебросом");
    globalThis.game.actors = savedActors;
  });
});
