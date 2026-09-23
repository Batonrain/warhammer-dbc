// test/sheets/gear-wrist-warning.test.mjs
//
// wdbc-x1nz.2.97 п.2: наручный предмет (Wrist, Когти.П) требует запястья, а не
// ладони. Без руки запястья нет («Раны и Урон», стр. 43) — экипировка
// отказывает с понятной причиной, а не «не хватает рук (свободно 1 из 1)».

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { equipItem } from "../../module/sheets/tabs/gear.mjs";

function weapon(id, system) {
  const it = {
    id, name: "Наручный лазер", type: "weapon",
    system: { equipped: false, weaponClass: "pistol", grips: "", weaponProps: [{ key: "wrist" }], ...system },
    updates: [], effects: { contents: [] },
    getFlag: () => undefined,
    update: async data => { it.updates.push(data); return data; }
  };
  return it;
}

function owner(conditions, items) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = { id: "a1", name: "Калека", items: list, system: { conditions, characteristics: { s: { bonus: 3 } } } };
  for (const i of items) i.parent = a;
  return a;
}

beforeEach(resetCaptured);

describe("equipItem: наручный предмет и запястья", () => {
  it("без обеих рук — «без руки запястья нет», предмет не надет", async () => {
    const gun = weapon("w1");
    owner({ lostArmsCount: 2 }, [gun]);
    await equipItem(gun, true);
    expect(gun.updates).toEqual([]);
    expect(captured.warnings.at(-1)).toContain("без руки запястья нет");
  });

  it("одно запястье уже занято — «нет свободного запястья (занято 1 из 1)»", async () => {
    const worn = weapon("w1", { equipped: true });
    const gun = weapon("w2");
    owner({ lostArmsCount: 1 }, [worn, gun]);
    await equipItem(gun, true);
    expect(gun.updates).toEqual([]);
    expect(captured.warnings.at(-1)).toContain("нет свободного запястья (занято 1 из 1)");
  });
});
