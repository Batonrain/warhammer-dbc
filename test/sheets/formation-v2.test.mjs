// test/sheets/formation-v2.test.mjs
//
// Лист Формирования на ApplicationV2 (wdbc-ff4.10.7). Общий договор с шаблоном —
// в describeV2Sheet; здесь своё: откуда берётся порог теста (приданный командир
// или плоская Выучка войск), недоступные роду войск приказы и права игрока,
// придавшего формированию своего героя.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { WarhammerFormationSheet } from "../../module/sheets/formation-sheet.mjs";

describeV2Sheet(WarhammerFormationSheet, {
  sheet: "module/sheets/formation-sheet.mjs",
  template: "templates/actor/formation-sheet.hbs"
});

const actions = WarhammerFormationSheet.DEFAULT_OPTIONS.actions;

function formationActor(over = {}) {
  return {
    name: "217-й Кадийский", uuid: "Actor.fm1", isOwner: true, img: "fm.png",
    system: {
      posts: {}, attached: [], troopType: "infantry", size: "company",
      techLevel: "imperial", training: "trained", gearQuality: "average", terrain: "open",
      status: {}, order: {},
      derived: { skillValue: 33 },
      ...over
    },
    update: async () => {}
  };
}

function sheetLike(actor, extra = {}) {
  return Object.assign(Object.create(WarhammerFormationSheet.prototype),
    { actor, isEditable: true, tabGroups: { primary: "unit" } }, extra);
}

const realFromUuidSync = globalThis.fromUuidSync;
const resolveAs = map => { globalThis.fromUuidSync = uuid => map[uuid] ?? null; };

beforeEach(() => { globalThis.game.user.isGM = true; });
afterEach(() => { globalThis.fromUuidSync = realFromUuidSync; });

// Книга: без приданного командира формирование «использует показатели умения
// и характеристик формирования», то есть плоскую Выучку войск.
describe("_testValue: чьими показателями бросают", () => {
  const test = { skill: "command", char: "fel", mod: -10 };

  it("без командира — Выучка войск", () => {
    const sheet = sheetLike(formationActor());
    expect(WarhammerFormationSheet.prototype._testValue.call(sheet, test))
      .toMatchObject({ value: 33, source: "Выучка войск" });
  });

  it("с командиром — его собственный навык", () => {
    resolveAs({ "Actor.cmd": {
      name: "Полковник Штраубе",
      system: { skills: { command: { total: 58 } }, characteristics: { fel: { total: 42 } } }
    }});
    const sheet = sheetLike(formationActor({ posts: { commander: { uuid: "Actor.cmd" } } }));

    expect(WarhammerFormationSheet.prototype._testValue.call(sheet, test))
      .toMatchObject({ value: 58, source: "Полковник Штраубе" });
  });

  it("командир без нужного навыка не отменяет Выучку", () => {
    resolveAs({ "Actor.cmd": { name: "Комиссар", system: { skills: {}, characteristics: {} } } });
    const sheet = sheetLike(formationActor({ posts: { commander: { uuid: "Actor.cmd" } } }));

    expect(WarhammerFormationSheet.prototype._testValue.call(sheet, test))
      .toMatchObject({ value: 33, source: "Выучка войск" });
  });
});

describe("_prepareContext: приказы по роду войск", () => {
  it("авиация не окапывается, наземные не патрулируют воздух", async () => {
    const air = await WarhammerFormationSheet.prototype._prepareContext
      .call(sheetLike(formationActor({ derived: { skillValue: 30, isAir: true } })), {});
    const ground = await WarhammerFormationSheet.prototype._prepareContext
      .call(sheetLike(formationActor()), {});

    // Флаг проверяется на истинность, а не на строгое false: шаблон читает его
    // через {{#if}}, и для доступного приказа выражение даёт undefined.
    const blocked = ctx => ctx.orders.filter(o => o.unavailable).map(o => o.key);

    expect(blocked(air)).toContain("digIn");
    expect(blocked(air)).not.toContain("airPatrol");
    expect(blocked(ground)).toContain("airPatrol");
    expect(blocked(ground)).not.toContain("digIn");
  });
});

describe("права", () => {
  it("правящее действие на нередактируемом листе молчит", async () => {
    const upd = [];
    const actor = formationActor();
    actor.update = async u => upd.push(u);
    await actions.statusReset.call(sheetLike(actor, { isEditable: false }));
    expect(upd).toEqual([]);
  });

  it("отозвать своего героя можно и без прав на формирование", async () => {
    const persisted = [];
    const actor = formationActor({ attached: [{ id: "a1", uuid: "Actor.own", name: "Свой" }] });
    const sheet = sheetLike(actor, { isEditable: false, _persistFormation: async u => persisted.push(u) });
    globalThis.fromUuid = async () => ({ isOwner: true });

    await actions.attachedRemove.call(sheet, {}, { closest: () => ({ dataset: { attachedId: "a1" } }) });

    expect(persisted).toHaveLength(1);
    expect(persisted[0]["system.attached"]).toEqual([]);
  });
});
