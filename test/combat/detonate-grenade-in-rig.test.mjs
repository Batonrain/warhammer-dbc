// test/combat/detonate-grenade-in-rig.test.mjs
//
// «Взять» → снять чеку с гранаты НА СВОЕЙ РАЗГРУЗКЕ и детонировать на месте
// (стр. 27): Полудействие, не атака, Уклонения нет. wdbc-x1nz.2.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useDetonateGrenadeInRig } from "../../module/combat/draw-action.mjs";

function grenade({ id = "gr-1", name = "Фраг", quantity = 1 } = {}) {
  const g = {
    id, name, type: "weapon", uuid: `Actor.a1.Item.${id}`,
    system: {
      weaponType: "grenade", damage: "2d10", damageType: "impact",
      penetration: 0, quantity,
      weaponProps: [{ key: "blast", rating: 3 }, { key: "tearing" }]
    },
    update: async data => { Object.assign(g.system, Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k.replace("system.", ""), v]))); return data; },
    delete: async () => { g.deleted = true; }
  };
  return g;
}

function actor({ ap = 2, type = "character" } = {}) {
  return {
    id: "a1", name: "Гвардеец", type, uuid: "Actor.a1",
    system: { actionPoints: { value: ap, max: 2 } },
    update: async () => {}
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 0 };
});
afterEach(() => { delete globalThis.game.combat; });

describe("useDetonateGrenadeInRig", () => {
  it("не оружие/не граната — ничего не делает", async () => {
    const a = actor();
    await useDetonateGrenadeInRig(a, { type: "weapon", system: { weaponType: "pistol" } });
    expect(captured.chat.length).toBe(0);
  });

  it("вне боя — тратит Полудействие свободно, наносит урон гранаты, расходует одну штуку", async () => {
    captured.nextRoll = 12;
    const a = actor();
    const g = grenade({ quantity: 3 });

    await useDetonateGrenadeInRig(a, g);

    expect(captured.chat.length).toBe(1);
    expect(g.system.quantity).toBe(2);       // одна граната израсходована
    expect(g.deleted).toBeUndefined();
    const card = captured.chat[0].content;
    expect(card).toContain("Не считается атакой");
    expect(card).toContain("Уклонение недоступно");
    expect(card).toContain("wh-place-template-btn");
    expect(card).toContain("wh-apply-dmg-btn");
    expect(card).toContain("data-meters=\"3\"");     // Blast(3)
    expect(card).toContain("data-damage=\"12\"");
  });

  it("последняя граната — удаляется предмет целиком, а не quantity:0", async () => {
    captured.nextRoll = 10;
    const a = actor();
    const g = grenade({ quantity: 1 });

    await useDetonateGrenadeInRig(a, g);

    expect(g.deleted).toBe(true);
  });

  it("в бою, не хватает ОД — предупреждает, не бросает кубы, граната цела", async () => {
    globalThis.game.combat = { started: true };
    const a = actor({ ap: 0 });
    const g = grenade();

    await useDetonateGrenadeInRig(a, g);

    expect(captured.warnings.length).toBe(1);
    expect(captured.chat.length).toBe(0);
    expect(g.system.quantity).toBe(1);
  });

  it("в бою, хватает ОД — списывает 1 ОД (Полудействие)", async () => {
    globalThis.game.combat = { started: true };
    captured.nextRoll = 5;
    const a = actor({ ap: 2 });
    const g = grenade();
    const updates = [];
    a.update = async data => { updates.push(data); Object.assign(a.system.actionPoints, data["system.actionPoints.value"] !== undefined ? { value: data["system.actionPoints.value"] } : {}); };

    await useDetonateGrenadeInRig(a, g);

    expect(updates).toContainEqual({ "system.actionPoints.value": 1 });
  });
});
