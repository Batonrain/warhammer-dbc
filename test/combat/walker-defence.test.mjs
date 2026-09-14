// test/combat/walker-defence.test.mjs
//
// wdbc-6wzt, п.5 книжного правила Ходовой «Шагоход»: «Может Парировать и
// Уклоняться со штрафом −Размер×10; Уклонение всегда комбинированное с
// Operate−10.»
//
// До этой правки техника не умела ни того, ни другого вовсе — у неё был только
// Вираж (Operate − Размер×10), другое действие книги. Здесь проверяется, что
// считает ПИЛОТ (его WS/Ag, его Навыки, его Реакция), а не машина.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, char } from "../support/combat-fixtures.mjs";
import { performWalkerParry, performWalkerDodge, walkerCrew, walkerMeleeWeapon }
  from "../../module/combat/walker.mjs";

const realFromUuid = globalThis.fromUuid;

/** Пилот: WS/Ag заданы явно — тест читается как боевой сценарий, а не как числа. */
function pilotActor({ ws = 45, ag = 45, reactions = null, ...rest } = {}) {
  const a = actorFor({
    characteristics: { ws: char(ws), bs: char(35), s: char(40), t: char(40), ag: char(ag) },
    skills: {}, ...rest
  });
  a.uuid = "Actor.pilot";
  a.name = "Пилот";
  if (reactions) a.system.reactions = reactions;
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a.update = async data => { a._updates = [...(a._updates ?? []), data]; };
  return a;
}

/** Машина-Шагоход: рукопашное орудие корпуса + место пилота. */
function walkerVehicle({ size = 4, operate = 40, weapons = [], stations = null, chassis = "walker" } = {}) {
  const items = [...weapons];
  items.get = id => items.find(i => i.id === id) ?? null;
  const flags = {};
  return {
    type: "vehicle", name: "«Ярость Терры»", uuid: "Actor.walker", items,
    system: {
      chassis: { type: chassis, spd: 6 }, size, operate,
      armour: { front: 30, side: 20, rear: 15 },
      structure: { value: 30, max: 30, critical: 0 },
      stations: stations ?? [{ id: "s1", role: "pilot", uuid: "Actor.pilot", name: "Пилот" }],
      damageStates: [], derived: {}
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    update: async () => {}
  };
}

const fist = () => {
  const w = weaponFor({ weaponClass: "melee", balance: 0, damage: "2d10+8" },
    { id: "w-fist", name: "Силовой Кулак" });
  return w;
};

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
});
afterEach(() => { globalThis.fromUuid = realFromUuid; globalThis.game.combat = undefined; });

describe("walkerCrew: кто отбивается за машину", () => {
  it("берёт пилота", async () => {
    const pilot = pilotActor();
    globalThis.fromUuid = async () => pilot;
    const crew = await walkerCrew(walkerVehicle());
    expect(crew.actor).toBe(pilot);
    expect(crew.role).toBe("pilot");
  });

  it("нет пилота — идёт мехвод, а не стрелок", async () => {
    const driver = pilotActor();
    globalThis.fromUuid = async () => driver;
    const crew = await walkerCrew(walkerVehicle({ stations: [
      { id: "s1", role: "gunner", uuid: "Actor.gunner" },
      { id: "s2", role: "driver", uuid: "Actor.driver" }
    ] }));
    expect(crew.role).toBe("driver");
  });

  it("пустая машина — никого (это состояние стола, а не ошибка)", async () => {
    globalThis.fromUuid = async () => null;
    expect(await walkerCrew(walkerVehicle({ stations: [] }))).toBe(null);
  });
});

describe("walkerMeleeWeapon", () => {
  it("находит рукопашное орудие корпуса", () => {
    const w = fist();
    expect(walkerMeleeWeapon(walkerVehicle({ weapons: [w] }))).toBe(w);
  });

  it("стрелковое орудие рукопашным не считает", () => {
    const gun = weaponFor({ weaponClass: "heavy" }, { id: "w-gun", name: "Штурмовая Пушка" });
    expect(walkerMeleeWeapon(walkerVehicle({ weapons: [gun] }))).toBe(null);
  });
});

describe("performWalkerParry", () => {
  it("Порог = WS пилота со штрафом −Размер×10, бросок и карточка от машины", async () => {
    const pilot = pilotActor({ ws: 65 });          // Навык Парирования не изучен: −20
    globalThis.fromUuid = async () => pilot;
    captured.nextRoll = 5;

    await performWalkerParry(walkerVehicle({ size: 4, weapons: [fist()] }));

    const card = captured.chat.at(-1).content;
    // 65 − 20 (навык) − 40 (Размер 4) = 5
    expect(card).toContain("Порог: <b>5</b>");
    expect(card).toContain("Размер -40");
    expect(card).toContain("Парирование (Шагоход)");
    expect(card).toContain("Парирование успешно");
    expect(card).toContain("Силовой Кулак");
  });

  it("Размер меняет Порог ровно на ×10 за ступень", async () => {
    const pilot = pilotActor({ ws: 65 });
    globalThis.fromUuid = async () => pilot;

    captured.nextRoll = 5;
    await performWalkerParry(walkerVehicle({ size: 4, weapons: [fist()] }));
    const small = captured.chat.at(-1).content;
    await performWalkerParry(walkerVehicle({ size: 6, weapons: [fist()] }));
    const big = captured.chat.at(-1).content;

    expect(small).toContain("Порог: <b>5</b>");
    expect(big).toContain("Порог: <b>-15</b>");
  });

  it("пустая машина — отказ, а не бросок нулями", async () => {
    globalThis.fromUuid = async () => null;
    await performWalkerParry(walkerVehicle({ stations: [], weapons: [fist()] }));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Парировать некому");
    expect(captured.rolls).toEqual([]);
  });

  it("нет рукопашного орудия — отказ, а не парирование голым корпусом", async () => {
    globalThis.fromUuid = async () => pilotActor();
    await performWalkerParry(walkerVehicle({ weapons: [] }));
    expect(captured.chat.at(-1).content).toContain("Парировать нечем");
    expect(captured.rolls).toEqual([]);
  });

  it("не Шагоход — правила нет, предупреждение и ни одного броска", async () => {
    globalThis.fromUuid = async () => pilotActor();
    await performWalkerParry(walkerVehicle({ chassis: "tracked", weapons: [fist()] }));
    expect(captured.warnings.at(-1)).toContain("Шагоход");
    expect(captured.rolls).toEqual([]);
  });

  it("Реакцию тратит ПИЛОТ — у машины Реакций нет вовсе", async () => {
    const pilot = pilotActor({ ws: 65, reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 } });
    pilot.type = "character";
    globalThis.fromUuid = async () => pilot;
    globalThis.game.combat = { started: true, round: 1, id: "c1" };
    captured.nextRoll = 5;

    await performWalkerParry(walkerVehicle({ weapons: [fist()] }));

    expect(pilot._updates).toEqual([{ "system.reactions.value": 0 }]);
  });

  it("Реакций у пилота не осталось — Парирования нет", async () => {
    const pilot = pilotActor({ ws: 65, reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 0 } });
    pilot.type = "character";
    globalThis.fromUuid = async () => pilot;
    globalThis.game.combat = { started: true, round: 1, id: "c1" };

    await performWalkerParry(walkerVehicle({ weapons: [fist()] }));

    expect(captured.chat.at(-1).content).toContain("Нет доступных Реакций");
    expect(captured.rolls).toEqual([]);
  });
});

describe("performWalkerDodge", () => {
  it("бросок идёт против НАИМЕНЬШЕГО из двух Пределов (комбинированный тест)", async () => {
    // Уклонение пилота: Ag 75 − 20 (не изучено) − 40 (Размер 4) = 15.
    // Operate машины 90 − 10 = 80. Наименьший — 15.
    const pilot = pilotActor({ ag: 75 });
    globalThis.fromUuid = async () => pilot;
    captured.nextRoll = 15;

    await performWalkerDodge(walkerVehicle({ size: 4, operate: 90 }));

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Порог <b>15</b>");
    expect(card).toContain("Operate машины <b>80</b>");
    expect(card).toContain("Уклонение успешно");
  });

  it("плохой Operate тянет Порог вниз, даже если пилот проворен", async () => {
    const pilot = pilotActor({ ag: 95 });
    globalThis.fromUuid = async () => pilot;
    captured.nextRoll = 99;

    await performWalkerDodge(walkerVehicle({ size: 1, operate: 25 }));

    const card = captured.chat.at(-1).content;
    // Уклонение 95−20−10 = 65, Operate 25−10 = 15 → Порог 15.
    expect(card).toContain("Порог <b>15</b>");
    expect(card).toContain("Ниже оказался Operate");
    expect(card).toContain("Уклонение провалено");
  });

  it("модификатор приёма атаки ложится на половину Уклонения", async () => {
    const pilot = pilotActor({ ag: 75 });
    globalThis.fromUuid = async () => pilot;
    captured.nextRoll = 10;

    await performWalkerDodge(walkerVehicle({ size: 4, operate: 90 }), { extraMod: 20 });

    // 75 − 20 + 20 (приём) − 40 = 35, Operate 80 → Порог 35.
    expect(captured.chat.at(-1).content).toContain("Порог <b>35</b>");
  });

  it("пустая машина — отказ", async () => {
    globalThis.fromUuid = async () => null;
    await performWalkerDodge(walkerVehicle({ stations: [] }));
    expect(captured.chat.at(-1).content).toContain("Уклоняться некому");
    expect(captured.rolls).toEqual([]);
  });

  it("не Шагоход — Уклонения у техники нет", async () => {
    globalThis.fromUuid = async () => pilotActor();
    await performWalkerDodge(walkerVehicle({ chassis: "wheeled" }));
    expect(captured.warnings.at(-1)).toContain("Шагоход");
    expect(captured.rolls).toEqual([]);
  });
});
