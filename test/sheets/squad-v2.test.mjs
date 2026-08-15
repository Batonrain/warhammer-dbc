// test/sheets/squad-v2.test.mjs
//
// Лист Отряда на ApplicationV2 (wdbc-ff4.10.6). Общий договор с шаблоном —
// в describeV2Sheet; здесь своё: командная вертикаль, вместимость Командования
// и права игрока-не-владельца, который приводит в отряд своего персонажа.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { WarhammerSquadSheet } from "../../module/sheets/squad-sheet.mjs";

describeV2Sheet(WarhammerSquadSheet, {
  sheet: "module/sheets/squad-sheet.mjs",
  template: "templates/actor/squad-sheet.hbs"
});

const actions = WarhammerSquadSheet.DEFAULT_OPTIONS.actions;

function squadActor(over = {}) {
  return {
    name: "Копьё Императора", uuid: "Actor.sq1", isOwner: true, img: "sq.png",
    system: {
      posts: {}, members: [], risk: 1,
      cohesion: { value: 0, base: 0, start: 0 },
      derived: { cohesion: 0 },
      ...over
    },
    update: async () => {}
  };
}

function sheetLike(actor, extra = {}) {
  return Object.assign(Object.create(WarhammerSquadSheet.prototype),
    { actor, isEditable: true, tabGroups: { primary: "roster" } }, extra);
}

/** Актор-персонаж, каким его отдаёт fromUuidSync. */
function pers(name, over = {}) {
  return {
    name, img: `${name}.png`, type: "character",
    system: {
      characteristics: { fel: { total: 45, bonus: 4 }, wp: { total: 40 }, int: { total: 38 }, per: { bonus: 3 } },
      skills: { command: { total: 50 }, logic: { total: 40 } },
      wounds: { value: 8, max: 12 },
      ...over
    }
  };
}

const realFromUuidSync = globalThis.fromUuidSync;
const resolveAs = map => { globalThis.fromUuidSync = uuid => map[uuid] ?? null; };

beforeEach(() => { globalThis.game.user.isGM = true; });
afterEach(() => { globalThis.fromUuidSync = realFromUuidSync; });

describe("_prepareContext: командная вертикаль", () => {
  it("три поста идут в порядке Лидер → Командир → Координатор", async () => {
    const ctx = await WarhammerSquadSheet.prototype._prepareContext.call(sheetLike(squadActor()), {});
    expect(ctx.posts.map(p => p.key)).toEqual(["leader", "commander", "coordinator"]);
    expect(ctx.posts.every(p => !p.filled)).toBe(true);
    expect(ctx.activeCommander).toBe(null);
  });

  it("Командует Командир, а без него — Лидер", async () => {
    resolveAs({ "Actor.a": pers("Крейн"), "Actor.b": pers("Ворн") });
    const actor = squadActor({ posts: { leader: { uuid: "Actor.a" }, commander: { uuid: "Actor.b" } } });
    const ctx = await WarhammerSquadSheet.prototype._prepareContext.call(sheetLike(actor), {});

    expect(ctx.activeCommander.name).toBe("Ворн");
    // Одновременно под Командованием держат F.b × 2 подчинённых.
    expect(ctx.capacity).toBe(8);
  });

  it("состав сверх вместимости помечается", async () => {
    resolveAs({ "Actor.a": pers("Крейн", { characteristics: { fel: { total: 30, bonus: 1 } } }) });
    const members = [1, 2, 3].map(i => ({ id: `m${i}`, uuid: `Actor.m${i}`, name: `Боец ${i}` }));
    const actor = squadActor({ posts: { leader: { uuid: "Actor.a" } }, members });
    const ctx = await WarhammerSquadSheet.prototype._prepareContext.call(sheetLike(actor), {});

    expect(ctx.capacity).toBe(2);
    expect(ctx.memberCount).toBe(3);
    expect(ctx.capacityOver).toBe(true);
  });
});

describe("_prepareContext: живучесть участника по его типу", () => {
  it("орда показывает Магнитуду, техника — Структуру, персонаж — Раны", async () => {
    resolveAs({
      "Actor.h": { name: "Культисты", type: "horde", system: { magnitude: { value: 20, start: 30 } } },
      "Actor.v": { name: "Химера",    type: "vehicle", system: { structure: { value: 15, max: 40 } } },
      "Actor.c": pers("Крейн")
    });
    const members = [
      { id: "m1", uuid: "Actor.h" }, { id: "m2", uuid: "Actor.v" }, { id: "m3", uuid: "Actor.c" }
    ];
    const ctx = await WarhammerSquadSheet.prototype._prepareContext.call(sheetLike(squadActor({ members })), {});

    expect(ctx.members.map(m => m.hp)).toEqual(["Магн. 20/30", "Стр. 15/40", "Раны 8/12"]);
  });
});

// Кнопки «События миссии» несли класс sq-event, а обработчик искал
// .sq-coh-event — до перевода на V2 ни одна из них не срабатывала.
describe("события миссии", () => {
  it("кнопка события двигает Слаженность на свою дельту", async () => {
    const calls = [];
    const sheet = sheetLike(squadActor(), { _changeCohesion: (d, label) => calls.push([d, label]) });

    await actions.cohEvent.call(sheet, {}, { dataset: { delta: "-5", label: "Потеря союзника" } });

    expect(calls).toEqual([[-5, "Потеря союзника"]]);
  });
});

describe("права", () => {
  it("правящее действие на нередактируемом листе молчит", async () => {
    const upd = [];
    const actor = squadActor({ members: [{ id: "m1", uuid: "", moraleLost: true }] });
    actor.update = async u => upd.push(u);
    await actions.moraleReset.call(sheetLike(actor, { isEditable: false }));
    expect(upd).toEqual([]);
  });

  it("вывести из отряда своего персонажа можно и без прав на лист", async () => {
    const persisted = [];
    const actor = squadActor({ members: [{ id: "m1", uuid: "Actor.own", name: "Свой" }] });
    const sheet = sheetLike(actor, { isEditable: false, _persistSquad: async u => persisted.push(u) });
    globalThis.fromUuid = async () => ({ isOwner: true });

    await actions.memberRemove.call(sheet, {}, { closest: () => ({ dataset: { memberId: "m1" } }) });

    expect(persisted).toHaveLength(1);
    expect(persisted[0]["system.members"]).toEqual([]);
  });
});
