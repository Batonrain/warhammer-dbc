// test/migrations/gear-equipped.test.mjs
//
// wdbc-9h7g: одноразовая простановка «надето» носимому снаряжению уже
// собранных персонажей. Смысл миграции — НЕ включить новое правило, а не дать
// ему молча погасить то, что работало вчера: без неё у всех разом пропали бы
// бонусы противогазов, плащей и визоров, и игрок узнал бы об этом посреди боя.

import { describe, it, expect, afterEach } from "vitest";
import { gearNeedingEquipped, migrateGearEquipped } from "../../module/migrations/gear-equipped.mjs";

const gear = (id, system) => ({ id, type: "gear", system });

describe("gearNeedingEquipped: кого миграция отмечает надетым", () => {
  it("носимое снаряжение — берёт", () => {
    const items = [gear("mask", { worn: "Голова (И)", equipped: false })];
    expect(gearNeedingEquipped(items).map(i => i.id)).toEqual(["mask"]);
  });

  it("ненадеваемое (нет пометки «Носится») — не трогает: оно и так работает", () => {
    const items = [gear("lab", { worn: "", equipped: false })];
    expect(gearNeedingEquipped(items)).toEqual([]);
  });

  it("уже надетое — не трогает (идемпотентность повторного прогона)", () => {
    const items = [gear("cloak", { worn: "Плащ", equipped: true })];
    expect(gearNeedingEquipped(items)).toEqual([]);
  });

  it("не-снаряжение мимо: у брони и оружия свой тумблер, он проставлен давно", () => {
    const items = [
      { id: "armor", type: "armor",  system: { equipped: false } },
      { id: "gun",   type: "weapon", system: { equipped: false } },
      { id: "visor", type: "gear",   system: { worn: "Глаза (визор)", equipped: false } }
    ];
    expect(gearNeedingEquipped(items).map(i => i.id)).toEqual(["visor"]);
  });

  it("пустой список и пустой system не роняют отбор", () => {
    expect(gearNeedingEquipped()).toEqual([]);
    expect(gearNeedingEquipped([gear("x", undefined)])).toEqual([]);
  });
});

// wdbc-dyi: было — один try на ВЕСЬ цикл по акторам. Сбой на одном акторе
// глушил обработку остальных молча, а версия миграции всё равно штамповалась
// как «выполнено полностью» — повторный запуск недомигрированных уже не
// подхватывал (гейт по версии пройден). Плюс проход шёл только по
// game.actors: несвязанные токены сцен (actorLink:false, предметы в их
// ActorDelta) не попадали в миграцию вовсе.
describe("migrateGearEquipped: изоляция сбоя одного актора/токена (wdbc-dyi)", () => {
  afterEach(() => { delete globalThis.game; delete globalThis.ui; });

  function actorWith(id, items, { throwOnUpdate = false } = {}) {
    return {
      id, name: `Actor ${id}`, items,
      async updateEmbeddedDocuments(type, updates) {
        if (throwOnUpdate) throw new Error(`boom on ${id}`);
        for (const u of updates) {
          const item = items.find(i => i.id === u._id);
          if (item) item.system.equipped = u["system.equipped"];
        }
      }
    };
  }

  it("сбой на одном акторе не прерывает обработку остальных", async () => {
    const bad = actorWith("bad", [gear("mask1", { worn: "Голова (И)", equipped: false })], { throwOnUpdate: true });
    const good = actorWith("good", [gear("mask2", { worn: "Голова (И)", equipped: false })]);

    globalThis.game = { user: { isGM: true }, actors: [bad, good], scenes: [] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateGearEquipped();

    expect(res.updated).toBe(1);           // good — отработал
    expect(res.failed).toBe(1);            // bad — сбойнул, но не остановил цикл
    expect(good.items[0].system.equipped).toBe(true);
    expect(bad.items[0].system.equipped).toBe(false); // не тронут, попробуется заново
  });

  it("несвязанный токен сцены (actorLink:false) мигрируется через свою ActorDelta", async () => {
    const tokenActor = actorWith("tok1", [gear("cloak", { worn: "Плащ", equipped: false })]);
    const linkedTokenActor = actorWith("linkedActorId", [gear("visor", { worn: "Глаза (визор)", equipped: false })]);

    globalThis.game = {
      user: { isGM: true },
      actors: [linkedTokenActor],   // связанный токен пользуется этим же документом
      scenes: [{
        name: "Сцена 1",
        tokens: { contents: [
          { id: "t1", name: "Токен 1", actorLink: false, actor: tokenActor },
          { id: "t2", name: "Токен 2", actorLink: true,  actor: linkedTokenActor }
        ] }
      }]
    };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateGearEquipped();

    expect(tokenActor.items[0].system.equipped).toBe(true);     // несвязанный — надет
    expect(linkedTokenActor.items[0].system.equipped).toBe(true);
    expect(res.updated).toBe(2);
    expect(res.failed).toBe(0);
  });

  it("сбой на несвязанном токене учитывается в failed и не трогает прочих", async () => {
    const badTokenActor = actorWith("tokBad", [gear("mask", { worn: "Голова (И)", equipped: false })], { throwOnUpdate: true });

    globalThis.game = {
      user: { isGM: true },
      actors: [],
      scenes: [{ name: "Сцена 1", tokens: { contents: [
        { id: "t1", name: "Токен сбойный", actorLink: false, actor: badTokenActor }
      ] } }]
    };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateGearEquipped();

    expect(res.updated).toBe(0);
    expect(res.failed).toBe(1);
  });
});
