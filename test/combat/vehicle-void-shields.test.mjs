// test/combat/vehicle-void-shields.test.mjs
//
// wdbc-y33b: «Пустотные Щиты (X)» — АР 30 + 20 Структуры на щит, останавливают
// ВСЮ стрельбу с расстояния >5м (не рукопашную), лишний урон при схлопывании
// теряется, Структура машины в этот раз не трогается вовсе. Дистанция —
// module/combat/facing.mjs::tokenDistance (grid.size + scene.grid.distance).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { applyDamageToVehicle } from "../../module/combat/vehicle.mjs";

/** Токен-заглушка в форме document.x/y/width/height (как в facing.test.mjs). */
function fakeToken({ x = 0, y = 0 } = {}) {
  return { document: { x, y, width: 1, height: 1, rotation: 0 } };
}

function vehicle({ shields = [20], structure = 20, side = 10, vehicleToken = fakeToken({ x: 1000, y: 0 }) } = {}) {
  const updates = [];
  return {
    type: "vehicle", name: "Rhino", uuid: "Actor.vehicle",
    system: {
      armour: { side }, structure: { value: structure, critical: 0 },
      derived: { traitFlags: {} }, voidShields: shields
    },
    getActiveTokens: () => (vehicleToken ? [vehicleToken] : []),
    update: async data => { updates.push(data); },
    _updates: updates
  };
}

const realFromUuid = globalThis.fromUuid;
/** Атакующий на расстоянии `meters` от машины (машина стоит в x=1000,y=0; 1 клетка = 100px = 1м). */
function resolveAttackerAt(meters) {
  globalThis.fromUuid = async () => ({
    getActiveTokens: () => [fakeToken({ x: 1000 - meters * 100, y: 0 })]
  });
}

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { grid: { size: 100 }, scene: { grid: { distance: 1 } } };
});
afterEach(() => { globalThis.fromUuid = realFromUuid; });

describe("Пустотные Щиты: гейт по дистанции и рукопашной", () => {
  it("издалека (>5м), урон ≤ АР щита (30) — щит держит без потерь себе", async () => {
    resolveAttackerAt(10);
    const v = vehicle({ shields: [20] });
    await applyDamageToVehicle(v, { rawDamage: 15, side: "side", attackerUuid: "Actor.gunner" });

    expect(v._updates).toEqual([{ "system.voidShields": [20] }]); // 15 ≤ АР30 — щиту 0 урона
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Пустотный Щит");
    expect(card).toContain("Структура машины не затронута");
    expect(card).toContain("Дистанция &gt;5м");
  });

  it("вблизи (≤5м) — щит не участвует, урон идёт по броне как обычно", async () => {
    resolveAttackerAt(3);
    const v = vehicle({ shields: [20], structure: 20, side: 10 });
    await applyDamageToVehicle(v, { rawDamage: 15, side: "side", attackerUuid: "Actor.gunner" });

    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("Пустотный Щит");
    expect(card).toContain("В Структуру");
    expect(v._updates.at(-1)).toEqual({ "system.structure.value": 15, "system.structure.critical": 0 });
  });

  it("рукопашная атака игнорирует щит целиком, даже издалека", async () => {
    resolveAttackerAt(10);
    const v = vehicle({ shields: [20], side: 10 });
    await applyDamageToVehicle(v, { rawDamage: 15, side: "side", melee: true, attackerUuid: "Actor.gunner" });

    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("Пустотный Щит");
  });

  it("нет активных щитов (все на 0) — урон идёт по броне как обычно", async () => {
    resolveAttackerAt(10);
    const v = vehicle({ shields: [0, 0], side: 10 });
    await applyDamageToVehicle(v, { rawDamage: 15, side: "side", attackerUuid: "Actor.gunner" });

    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("Пустотный Щит");
  });

  it("позиция неизвестна (нет токена атакующего) — щит по умолчанию защищает", async () => {
    globalThis.fromUuid = async () => null;
    const v = vehicle({ shields: [20] });
    await applyDamageToVehicle(v, { rawDamage: 15, side: "side", attackerUuid: "" });

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Пустотный Щит");
  });

  it("щит схлопывается — лишний урон теряется, следующий щит не трогается", async () => {
    resolveAttackerAt(10);
    const v = vehicle({ shields: [5, 20] }); // первый щит почти пробит
    // АР щита 30, урон 60 → урон щиту max(0,60-30)=30, у щита только 5 HP — схлопывается, 25 теряется.
    await applyDamageToVehicle(v, { rawDamage: 60, side: "side", attackerUuid: "Actor.gunner" });

    expect(v._updates).toEqual([{ "system.voidShields": [0, 20] }]);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("щит схлопнулся");
  });

  it("Пробитие снижает АР щита, как обычную броню", async () => {
    resolveAttackerAt(10);
    const v = vehicle({ shields: [20] });
    await applyDamageToVehicle(v, { rawDamage: 40, penetration: 10, side: "side", attackerUuid: "Actor.gunner" });
    // АР щита 30−10=20; урон щиту max(0,40-20)=20 → 20-20=0
    expect(v._updates).toEqual([{ "system.voidShields": [0] }]);
  });
});
