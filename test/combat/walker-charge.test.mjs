// test/combat/walker-charge.test.mjs
//
// wdbc-6wzt, п.1 книжного правила Ходовой «Шагоход»: «Двигается и атакует как
// персонаж, а не техника: может в ближний бой, включая Натиск…»
//
// Персонажный declareCharge (combat/movement-actions.mjs) Шагоходу не годится
// буквально: он пишет system.meleeBase и читает system.movement.charge —
// полей, которых у техники нет в схеме вовсе, и запись ушла бы в никуда.
// Здесь тот же смысл своими полями машины.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, char, weaponFor } from "../support/combat-fixtures.mjs";
import { declareWalkerCharge, walkerChargeActive, resolveWalkerAllArms, WALKER_CHARGE_FLAG }
  from "../../module/combat/walker.mjs";
import { TIP_OVER_LABEL } from "../../module/rules/walker.mjs";

const realFromUuid = globalThis.fromUuid;

function pilot({ ap = 2 } = {}) {
  const a = actorFor({
    characteristics: { ws: char(45), bs: char(35), s: char(40), t: char(40), ag: char(40) },
    actionPoints: { value: ap, max: 2 }
  });
  a.type = "character"; a.uuid = "Actor.pilot"; a.name = "Гвидо";
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a._updates = [];
  a.update = async data => {
    a._updates.push(data);
    for (const [path, value] of Object.entries(data)) {
      const keys = path.replace(/^system\./, "").split(".");
      let cur = a.system;
      for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {});
      cur[keys.at(-1)] = value;
    }
  };
  return a;
}

function walkerVehicle({ chassis = "walker", stations, weapons = [], damageStates = [], spd = 6 } = {}) {
  const items = [...weapons];
  items.get = id => items.find(i => i.id === id) ?? null;
  const flags = {};
  return {
    type: "vehicle", name: "«Ярость Терры»", uuid: "Actor.walker", items,
    system: {
      chassis: { type: chassis, spd }, size: 4, operate: 40,
      armour: { front: 30, side: 20, rear: 15 },
      structure: { value: 30, max: 30, critical: 0 },
      stations: stations ?? [{ id: "s1", role: "pilot", uuid: "Actor.pilot" }],
      damageStates, derived: { effSpd: spd }
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    update: async () => {}
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = { started: true, round: 2, id: "c1" };
});
afterEach(() => { globalThis.fromUuid = realFromUuid; globalThis.game.combat = undefined; });

describe("declareWalkerCharge", () => {
  it("объявляет Натиск, называет дистанцию SPD×3 и метит Раунд", async () => {
    const p = pilot();
    globalThis.fromUuid = async () => p;
    const v = walkerVehicle({ spd: 6 });

    await declareWalkerCharge(v);

    expect(captured.chat.at(-1).content).toContain("<b>18</b>");     // 6 × 3
    expect(captured.chat.at(-1).content).toContain("+20");
    expect(v.getFlag("warhammer-dbc", WALKER_CHARGE_FLAG)).toEqual({ combat: "c1", round: 2 });
    expect(walkerChargeActive(v)).toBe(true);
  });

  it("метка гаснет сама со сменой Раунда — вручную сбрасывать нечего", async () => {
    globalThis.fromUuid = async () => pilot();
    const v = walkerVehicle();
    await declareWalkerCharge(v);
    expect(walkerChargeActive(v)).toBe(true);

    globalThis.game.combat = { started: true, round: 3, id: "c1" };
    expect(walkerChargeActive(v)).toBe(false);
  });

  it("полное действие списывается у ПИЛОТА — у машины ОД нет", async () => {
    const p = pilot({ ap: 2 });
    globalThis.fromUuid = async () => p;

    await declareWalkerCharge(walkerVehicle());

    expect(p.system.actionPoints.value).toBe(0);
  });

  it("у пилота не хватает ОД — Натиск не объявлен вовсе", async () => {
    const p = pilot({ ap: 1 });
    globalThis.fromUuid = async () => p;
    const v = walkerVehicle();

    await declareWalkerCharge(v);

    expect(captured.warnings.at(-1)).toContain("не хватает ОД");
    expect(walkerChargeActive(v)).toBe(false);
  });

  it("пустая машина Натиск объявить может — платить просто не с кого", async () => {
    globalThis.fromUuid = async () => null;
    const v = walkerVehicle({ stations: [] });

    await declareWalkerCharge(v);

    expect(walkerChargeActive(v)).toBe(true);
    expect(captured.chat.at(-1).content).toContain("ОД списывать не с кого");
  });

  it("Опрокинутый Шагоход в Натиск не идёт (как Повален у персонажа)", async () => {
    globalThis.fromUuid = async () => pilot();
    const v = walkerVehicle({ damageStates: [{ id: "x", label: TIP_OVER_LABEL }] });

    await declareWalkerCharge(v);

    expect(captured.warnings.at(-1)).toContain("Опрокинута");
    expect(walkerChargeActive(v)).toBe(false);
  });

  it("не Шагоход — Натиска у техники нет", async () => {
    globalThis.fromUuid = async () => pilot();
    const v = walkerVehicle({ chassis: "tracked" });

    await declareWalkerCharge(v);

    expect(captured.warnings.at(-1)).toContain("Шагоход");
    expect(walkerChargeActive(v)).toBe(false);
  });
});

// п.6: «Пилот может использовать всё оружие машины — дальнее и ближнее — в один
// Ход, как если бы у него был Трейт Multiple Arms достаточного рейтинга.»
describe("resolveWalkerAllArms", () => {
  const gun  = () => weaponFor({ weaponClass: "heavy" }, { id: "w1", name: "Штурмовая Пушка" });
  const fist = () => weaponFor({ weaponClass: "melee" }, { id: "w2", name: "Силовой Кулак" });

  it("списывает ОДНО полное действие пилота на все орудия машины", async () => {
    const p = pilot({ ap: 2 });
    globalThis.fromUuid = async () => p;

    const res = await resolveWalkerAllArms(walkerVehicle({ weapons: [gun(), fist()] }));

    expect(res.ok).toBe(true);
    expect(res.occupant).toBe(p);
    expect(res.weapons.map(w => w.name)).toEqual(["Штурмовая Пушка", "Силовой Кулак"]);
    expect(p.system.actionPoints.value).toBe(0);        // 2 ОД за всё, а не по 2 на ствол
  });

  it("не хватает ОД — ничего не тратится и ничего не разрешается", async () => {
    const p = pilot({ ap: 1 });
    globalThis.fromUuid = async () => p;

    const res = await resolveWalkerAllArms(walkerVehicle({ weapons: [gun()] }));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("не хватает ОД");
    expect(p._updates).toEqual([]);
  });

  it("нет орудий — сказать честно, а не списывать действие впустую", async () => {
    const p = pilot();
    globalThis.fromUuid = async () => p;

    const res = await resolveWalkerAllArms(walkerVehicle({ weapons: [] }));

    expect(res).toEqual({ ok: false, error: "У машины нет ни одного орудия." });
    expect(p._updates).toEqual([]);
  });

  it("некому вести машину — правило не работает", async () => {
    globalThis.fromUuid = async () => null;
    const res = await resolveWalkerAllArms(walkerVehicle({ weapons: [gun()], stations: [] }));
    expect(res.ok).toBe(false);
    expect(res.error).toContain("некому");
  });

  it("прочая техника этого правила не получает — у неё для этого есть Залп по Черте", async () => {
    globalThis.fromUuid = async () => pilot();
    const res = await resolveWalkerAllArms(walkerVehicle({ chassis: "tracked", weapons: [gun()] }));
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Шагоход");
  });
});
