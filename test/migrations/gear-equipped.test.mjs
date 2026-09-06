// test/migrations/gear-equipped.test.mjs
//
// wdbc-9h7g: одноразовая простановка «надето» носимому снаряжению уже
// собранных персонажей. Смысл миграции — НЕ включить новое правило, а не дать
// ему молча погасить то, что работало вчера: без неё у всех разом пропали бы
// бонусы противогазов, плащей и визоров, и игрок узнал бы об этом посреди боя.

import { describe, it, expect } from "vitest";
import { gearNeedingEquipped } from "../../module/migrations/gear-equipped.mjs";

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
