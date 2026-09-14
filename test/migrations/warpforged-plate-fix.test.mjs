// test/migrations/warpforged-plate-fix.test.mjs
//
// Стопка #478-#481 перевела Черту «Закалённые Варпом Латы» с надбавки на
// «броню-замену»: из документа пака убраны `system.effects.armourAll: 12` и
// ActiveEffect с шестью `system.armorBonus.<локация> add 12`, а код держит
// ПОЛ в 12 AP (rules/character.mjs::armorFloorLoc, тот же приём, что у
// Чёрного Панциря).
//
// Пак догоняет только НОВЫЕ копии. У живого Варп-Кузнеца предмет — снимок
// момента выдачи, эффект на нём остался, и итоговая формула складывает пол с
// надбавкой: 12 + 12 = 24 вместо книжных 12. Молча — на листе просто большое
// число. Отсюда этот починочный проход.

import { describe, it, expect } from "vitest";
import { isWarpforgedPlateItem, warpforgedPlateHasStaleArmour, fixWarpforgedPlateItem }
  from "../../module/migrations/warpforged-plate-fix.mjs";

const AP_KEYS = ["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"];

/** Копия Черты в том виде, в каком она лежит на живом акторе до правки. */
function staleItem({ name = "Warpforged Plate / Закалённые Варпом Латы", extraChange = null } = {}) {
  const changes = AP_KEYS.map(k => ({ key: `system.armorBonus.${k}`, type: "add", value: 12, phase: "initial", priority: 0 }));
  if (extraChange) changes.push(extraChange);
  const effect = {
    id: "fx-1", name: "Warpforged Plate (перенесено)",
    system: { changes },
    update: async (patch) => { effect.system.changes = patch["system.changes"]; return effect; }
  };
  const item = {
    id: "it-1", type: "trait", name, effects: [effect],
    deleteEmbeddedDocuments: async (_t, ids) => {
      item.effects = item.effects.filter(f => !ids.includes(f.id));
      return ids;
    }
  };
  return item;
}

describe("Опознание копии", () => {
  it("Черта с книжным именем — узнаётся по любой половине", () => {
    expect(isWarpforgedPlateItem(staleItem())).toBe(true);
    expect(isWarpforgedPlateItem(staleItem({ name: "Закалённые Варпом Латы" }))).toBe(true);
  });

  it("другой предмет и другой тип — не трогаем", () => {
    expect(isWarpforgedPlateItem({ type: "trait", name: "Чёрный Панцирь" })).toBe(false);
    expect(isWarpforgedPlateItem({ type: "armor", name: "Warpforged Plate" })).toBe(false);
    expect(isWarpforgedPlateItem(null)).toBe(false);
  });
});

describe("Снятие запечённой надбавки брони", () => {
  it("копия со старым эффектом опознаётся как требующая правки", () => {
    expect(warpforgedPlateHasStaleArmour(staleItem())).toBe(true);
  });

  it("эффект, в котором остались ТОЛЬКО надбавки брони, удаляется целиком", async () => {
    const item = staleItem();
    expect(await fixWarpforgedPlateItem(item)).toBe(true);
    expect(item.effects).toEqual([]);
  });

  it("чужие изменения в том же эффекте сохраняются, снимаются только надбавки брони", async () => {
    const other = { key: "system.characteristics.t.totalFx", type: "add", value: 3, phase: "initial", priority: 0 };
    const item = staleItem({ extraChange: other });
    await fixWarpforgedPlateItem(item);
    expect(item.effects).toHaveLength(1);
    expect(item.effects[0].system.changes).toEqual([other]);
  });

  it("идемпотентно: второй прогон уже ничего не находит", async () => {
    const item = staleItem();
    expect(await fixWarpforgedPlateItem(item)).toBe(true);
    expect(warpforgedPlateHasStaleArmour(item)).toBe(false);
    expect(await fixWarpforgedPlateItem(item)).toBe(false);
  });

  it("свежая копия из пака (эффекта нет) правки не требует", async () => {
    const fresh = { id: "it-2", type: "trait", name: "Warpforged Plate / Закалённые Варпом Латы", effects: [] };
    expect(warpforgedPlateHasStaleArmour(fresh)).toBe(false);
    expect(await fixWarpforgedPlateItem(fresh)).toBe(false);
  });
});
