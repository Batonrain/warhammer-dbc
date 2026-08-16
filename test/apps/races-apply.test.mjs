// test/apps/races-apply.test.mjs
//
// Применение расы: носитель на акторе + выдача Конструктора + ключ-зеркало.
// Числа Черт здесь не проверяются — их считает актор из самих Черт; проверяется
// то, что делает именно применение.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { raceCharsUpdate, actorRaceItem, actorRacePastItem, clearRace, clearSubrace, applySubrace, applyRace } from "../../module/apps/races.mjs";

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

  // Находка C2 общего ревью (wdbc-n1k): крестик «Снять расу» удалял носителя и
  // выданное, но не трогал system.race/system.subrace — ключ оставался, и всё,
  // что читает ключ (предикаты правил, CSS-тема wh-race-*, подбор элитных
  // архетипов, reqRace, вкладка Навигатора), продолжало считать персонажа этой
  // расой. Опустошить слот с листа было нельзя вообще.
  it("clearRace обнуляет и ключ расы, и ключ субрасы", async () => {
    const actor = actorStub([]);

    await clearRace(actor);

    const upd = actor.updates.find(u => "system.race" in u);
    expect(upd["system.race"]).toBe("");
    expect(actor.updates.some(u => u["system.subrace"] === "")).toBe(true);
  });

  it("clearSubrace обнуляет только ключ субрасы", async () => {
    const actor = actorStub([]);

    await clearSubrace(actor);

    expect(actor.updates.some(u => u["system.subrace"] === "")).toBe(true);
    expect(actor.updates.some(u => "system.race" in u)).toBe(false);
  });
});

// Находка (раунд правок 1, ревью документации): removesTraits субрасы
// сравнивался с именем Черты посимвольно, точным равенством. Данные книги
// называют Черту одной половиной («Natural Weapons»), а предмет в паке —
// двуязычно («Natural Weapons / Естественное Оружие») — совпадений не было
// никогда. Тзаангор — единственная субраса с непустым removesTraits, и её
// снятие Черт было мёртвым кодом с момента появления первого потребителя.
describe("applySubrace снимает Черты по removesTraits", () => {

  const traitItem = (id, name) => ({
    id, type: "trait", name,
    getFlag() { return undefined; }
  });

  function actorStub(items) {
    const actor = {
      system: { race: "beastman", subrace: "", characteristics: chars(), skills: {}, groupSkills: {}, wounds: {} },
      items: [...items], updates: [], deleted: [],
      update: async data => { actor.updates.push(data); return data; },
      deleteEmbeddedDocuments: async (_type, ids) => { actor.deleted.push(...ids); return ids; }
    };
    return actor;
  }

  it("снимает Черту, записанную в removesTraits только английской половиной имени", async () => {
    const natural = traitItem("nat-1", "Natural Weapons / Естественное Оружие");
    const actor = actorStub([natural]);

    await applySubrace(actor, "tzaangor");

    expect(actor.deleted).toContain("nat-1");
  });

  it("не трогает похожую по названию, но другую Черту", async () => {
    const deadly = traitItem("deadly-1", "Deadly Natural Weapons / Смертельное Естественное Оружие");
    const actor = actorStub([deadly]);

    await applySubrace(actor, "tzaangor");

    expect(actor.deleted).not.toContain("deadly-1");
  });
});

// Находка I2 общего ревью (wdbc-n1k): без прочитанного пака (или без записи в
// нём) raceFromConst даёт ключ и характеристики, но НОЛЬ расовых Черт — раньше
// молча. Тесты идут вне Foundry (game.packs не заведён), поэтому библиотека
// всегда на откате констант: applyRace(actor, "astartes") — как раз этот путь.
describe("применение расы без прочитанной библиотеки предупреждает громко", () => {
  function actorStub() {
    const list = [];
    list.get = id => list.find(i => i.id === id) ?? null;
    const actor = {
      system: { characteristics: chars(), skills: {}, groupSkills: {}, wounds: {} },
      items: list, updates: [],
      update: async data => { actor.updates.push(data); return data; },
      createEmbeddedDocuments: async () => [],
      deleteEmbeddedDocuments: async () => []
    };
    return actor;
  }

  it("предупреждает, что Черты не выданы, вместо тихого молчания", async () => {
    resetCaptured();
    const actor = actorStub();

    await applyRace(actor, "astartes");

    expect(captured.warnings.some(w => /библиотека рас/i.test(w) && /не выдан/i.test(w))).toBe(true);
  });
});
