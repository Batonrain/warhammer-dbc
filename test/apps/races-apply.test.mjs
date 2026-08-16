// test/apps/races-apply.test.mjs
//
// Применение расы: носитель на акторе + выдача Конструктора + ключ-зеркало.
// Числа Черт здесь не проверяются — их считает актор из самих Черт; проверяется
// то, что делает именно применение.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { raceCharsUpdate, actorRaceItem, actorRacePastItem, clearRace } from "../../module/apps/races.mjs";

const chars = over => ({
  ws: { base: 0 }, bs: { base: 0 }, s: { base: 0 }, t: { base: 0 }, ag: { base: 0 },
  int: { base: 0 }, per: { base: 0 }, wp: { base: 0 }, fel: { base: 0 }, inf: { base: 0 },
  ...over
});

describe("стартовые характеристики расы", () => {

  it("пустые поля заполняются значениями расы", () => {
    const actor = { system: { characteristics: chars() } };

    expect(raceCharsUpdate(actor, { ws: 30, bs: 30 })).toEqual({
      "system.characteristics.ws.base": 30,
      "system.characteristics.bs.base": 30
    });
  });

  // Заполненное поле — это уже выбор игрока или бросок Мастера. Молча затирать
  // его нельзя: раса даёт основу, а не переписывает готового персонажа.
  it("заполненные поля не трогаются", () => {
    const actor = { system: { characteristics: chars({ ws: { base: 41 } }) } };

    expect(raceCharsUpdate(actor, { ws: 30, bs: 30 })).toEqual({
      "system.characteristics.bs.base": 30
    });
  });

  it("характеристики, которых у расы нет, не появляются", () => {
    const actor = { system: { characteristics: chars() } };

    expect(raceCharsUpdate(actor, {})).toEqual({});
  });
});

// Прошлое Иннари/Арлекина кладёт документ ТОЙ ЖЕ расы — тип "race", как и
// сама раса. Различать их можно только по флагу originGrant (раунд правок 1,
// Находка 1): поиск первого предмета типа "race" без тега путал носитель
// расы с носителем Прошлого, и смена расы могла снести не тот из двух.
describe("предметы-носители расы и Прошлого не путаются по типу", () => {

  const raceItem = (id, tag) => ({
    id, type: "race",
    flags: { "warhammer-dbc": { originGrant: tag } },
    getFlag(scope, key) { return this.flags[scope]?.[key]; }
  });

  function actorStub(items) {
    const list = [...items];
    list.get = id => list.find(i => i.id === id) ?? null;
    const actor = {
      system: { characteristics: chars(), skills: {}, groupSkills: {}, wounds: {} },
      items: list, updates: [], deleted: [],
      update: async data => { actor.updates.push(data); return data; },
      deleteEmbeddedDocuments: async (_type, ids) => { actor.deleted.push(...ids); return ids; }
    };
    return actor;
  }

  it("actorRaceItem/actorRacePastItem находят каждый свой предмет, а не первый попавшийся", () => {
    // Прошлое лежит ПЕРВЫМ в списке предметов — старый поиск по типу вернул бы его.
    const actor = actorStub([raceItem("past-1", "racePast"), raceItem("race-1", "race")]);

    expect(actorRaceItem(actor)?.id).toBe("race-1");
    expect(actorRacePastItem(actor)?.id).toBe("past-1");
  });

  // Находка 2: смена расы должна уносить и Прошлое — иначе бонусы бывшей расы
  // остаются висеть на персонаже, который к ней больше не относится.
  it("clearRace снимает и расу, и Прошлое — а не случайный из двух", async () => {
    const actor = actorStub([raceItem("past-1", "racePast"), raceItem("race-1", "race")]);

    await clearRace(actor);

    expect(actor.deleted.sort()).toEqual(["past-1", "race-1"]);
  });
});
