// test/combat/walker-turn-about.test.mjs
//
// wdbc-6wzt, п.8 книжного правила Ходовой «Шагоход»: «Раз в Раунд вне своего
// Хода может повернуться на до 180° (обычно — подставить лобовую броню). Талант
// Combat Master позволяет пилоту делать это до ½WS.b (окр. вверх) раз в Раунд.»
//
// Считает не машина, а её пилот: Талант и WS.b берутся с его листа. Счётчик —
// общая плоскость «до N раз за Раунд» (rules/cooldown.mjs).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, char } from "../support/combat-fixtures.mjs";
import { performWalkerTurnAbout } from "../../module/combat/walker.mjs";
import { throttleCount } from "../../module/rules/cooldown.mjs";
import { WALKER_TURN_CAPABILITY } from "../../module/rules/walker.mjs";

const realFromUuid = globalThis.fromUuid;

function pilot({ ws = 45, talents = [] } = {}) {
  const a = actorFor({
    characteristics: { ws: char(ws), bs: char(35), s: char(40), t: char(40), ag: char(40) },
    items: talents
  });
  a.uuid = "Actor.pilot"; a.name = "Пилот";
  return a;
}

function walkerVehicle(chassis = "walker") {
  const flags = {};
  return {
    type: "vehicle", name: "«Ярость Терры»", uuid: "Actor.walker", items: [],
    system: {
      chassis: { type: chassis, spd: 6 }, size: 4, operate: 40,
      stations: [{ id: "s1", role: "pilot", uuid: "Actor.pilot" }],
      damageStates: [], derived: {}
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    update: async () => {}
  };
}

const combatMaster = () => ({ id: "t1", type: "talent", name: "Combat Master / Мастер Боя", system: {} });

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = { started: true, round: 1, id: "c1" };
});
afterEach(() => { globalThis.fromUuid = realFromUuid; globalThis.game.combat = undefined; });

describe("performWalkerTurnAbout", () => {
  it("без Таланта — один поворот за Раунд, второй отклоняется", async () => {
    globalThis.fromUuid = async () => pilot();
    const v = walkerVehicle();

    await performWalkerTurnAbout(v);
    expect(captured.chat.at(-1).content).toContain("Поворот вне Хода");
    expect(captured.chat.at(-1).content).toContain("Использовано в этом Раунде: <b>1</b> из 1");

    const chatLen = captured.chat.length;
    await performWalkerTurnAbout(v);
    expect(captured.warnings.at(-1)).toContain("исчерпаны");
    expect(captured.chat.length).toBe(chatLen);           // второй карточки нет
  });

  it("новый Раунд открывает поворот снова — сбрасывать вручную нечего", async () => {
    globalThis.fromUuid = async () => pilot();
    const v = walkerVehicle();

    await performWalkerTurnAbout(v);
    globalThis.game.combat = { started: true, round: 2, id: "c1" };
    await performWalkerTurnAbout(v);

    expect(captured.warnings).toEqual([]);
    expect(throttleCount(v, WALKER_TURN_CAPABILITY, "round")).toBe(1);
  });

  it("Combat Master у пилота: ½WS.b (окр. вверх) поворотов, WS 55 → 3", async () => {
    globalThis.fromUuid = async () => pilot({ ws: 55, talents: [combatMaster()] });
    const v = walkerVehicle();

    await performWalkerTurnAbout(v);
    expect(captured.chat.at(-1).content).toContain("Combat Master");
    expect(captured.chat.at(-1).content).toContain("из 3");

    await performWalkerTurnAbout(v);
    await performWalkerTurnAbout(v);
    expect(captured.warnings).toEqual([]);

    await performWalkerTurnAbout(v);
    expect(captured.warnings.at(-1)).toContain("исчерпаны");
  });

  it("Талант считается с листа ПИЛОТА, а не машины", async () => {
    // Тот же Талант лежит на машине — он не должен ничего давать.
    globalThis.fromUuid = async () => pilot({ ws: 55 });
    const v = walkerVehicle();
    v.items = [combatMaster()];

    await performWalkerTurnAbout(v);
    expect(captured.chat.at(-1).content).toContain("из 1");
  });

  it("вне боя счётчик не ведётся, но поворот не отнимается", async () => {
    globalThis.game.combat = undefined;
    globalThis.fromUuid = async () => pilot();
    const v = walkerVehicle();

    await performWalkerTurnAbout(v);
    await performWalkerTurnAbout(v);

    expect(captured.warnings).toEqual([]);
    expect(captured.chat.at(-1).content).toContain("счётчик поворотов не ведётся");
  });

  it("не Шагоход — правила нет вовсе", async () => {
    globalThis.fromUuid = async () => pilot();
    await performWalkerTurnAbout(walkerVehicle("tracked"));
    expect(captured.warnings.at(-1)).toContain("Шагоход");
    expect(captured.chat).toEqual([]);
  });

  it("пустая машина — поворот доступен по обычному лимиту (крутит хоть что-то)", async () => {
    globalThis.fromUuid = async () => null;
    const v = walkerVehicle();
    v.system.stations = [];

    await performWalkerTurnAbout(v);
    expect(captured.chat.at(-1).content).toContain("из 1");
  });
});
