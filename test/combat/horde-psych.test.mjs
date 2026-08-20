// test/combat/horde-psych.test.mjs
//
// Психологический урон Орды. Порог у всех трёх тестов один — Воля плюс
// Магнитуда, — а стоит провал по-разному: массивные потери ×3, Страх ×2,
// Запугивание ×1. Несломляемая Орда таких тестов не проваливает вовсе.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { rollHordePsychTest, psychThreshold, applyPsychDamage,
         healPsychDamage, psychHealLocked, lockPsychHealing, PSYCH_LOCK_FLAG }
  from "../../module/combat/horde-psych.mjs";

function hordeActor({ magnitude = 40, start = 40, wp = 30, wpBonus = 3,
                      psychDamage = 0, immuneFear = false, state = "steady",
                      flags = {} } = {}) {
  return {
    id: "horde1", name: "Орда рабов", type: "horde",
    system: {
      magnitude: { value: magnitude, start }, psychDamage, immuneFear,
      characteristics: { wp: { total: wp, bonus: wpBonus } },
      derived: { state }
    },
    async update(data) {
      if (data["system.magnitude.value"] !== undefined)
        this.system.magnitude.value = data["system.magnitude.value"];
      if (data["system.psychDamage"] !== undefined)
        this.system.psychDamage = data["system.psychDamage"];
    },
    getFlag: (_ns, key) => flags[key],
    async setFlag(_ns, key, value) { flags[key] = value; }
  };
}

beforeEach(() => { resetCaptured(); globalThis.game.time = { worldTime: 0 }; });

describe("порог психологического теста", () => {
  it("Воля плюс Магнитуда — толпа держится числом", () => {
    expect(psychThreshold(hordeActor({ wp: 30, magnitude: 40 }))).toBe(70);
  });

  it("Ослабленная Орда катит Волю с −10", () => {
    expect(psychThreshold(hordeActor({ wp: 30, magnitude: 40, state: "weakened" }))).toBe(60);
  });

  it("модификатор теста (рейтинг Страха) складывается с порогом", () => {
    expect(psychThreshold(hordeActor({ wp: 30, magnitude: 40 }), -20)).toBe(50);
  });
});

describe("провал психологического теста", () => {
  it("массивные потери стоят Провалы×3 Магнитуды", async () => {
    const horde = hordeActor({ wp: 10, magnitude: 5 });   // порог 15
    captured.nextRoll = 45;                               // 3 Провала
    const res = await rollHordePsychTest(horde, "massDamage");
    expect(res).toMatchObject({ passed: false, degrees: 4, psychDamage: 12 });
  });

  it("Страх стоит Провалы×2, Запугивание — Провалы×1", async () => {
    captured.nextRoll = 45;
    expect((await rollHordePsychTest(hordeActor({ wp: 10, magnitude: 5 }), "fear")).psychDamage)
      .toBe(8);
    expect((await rollHordePsychTest(hordeActor({ wp: 10, magnitude: 5 }), "intimidate")).psychDamage)
      .toBe(4);
  });

  it("урон уходит и в Магнитуду, и в счётчик психологического", async () => {
    const horde = hordeActor({ wp: 10, magnitude: 5, start: 40 });
    captured.nextRoll = 45;
    await rollHordePsychTest(horde, "intimidate");
    expect(horde.system.magnitude.value).toBe(1);
    expect(horde.system.psychDamage).toBe(4);
  });

  it("успешный тест не стоит ничего", async () => {
    const horde = hordeActor({ magnitude: 40 });
    captured.nextRoll = 10;
    const res = await rollHordePsychTest(horde, "fear");
    expect(res.passed).toBe(true);
    expect(horde.system.magnitude.value).toBe(40);
  });
});

describe("несломляемая Орда", () => {
  it("проходит психологические тесты автоматически", async () => {
    const horde = hordeActor({ immuneFear: true, magnitude: 40 });
    captured.nextRoll = 99;
    const res = await rollHordePsychTest(horde, "fear");
    expect(res).toMatchObject({ immune: true, psychDamage: 0 });
    expect(horde.system.magnitude.value).toBe(40);
  });

  it("не получает психологического урона и напрямую", async () => {
    const horde = hordeActor({ immuneFear: true, magnitude: 40 });
    expect(await applyPsychDamage(horde, 7)).toBe(0);
    expect(horde.system.magnitude.value).toBe(40);
  });
});

describe("лечение психологического урона", () => {
  it("возвращает Магнитуду, но только за счёт психологического урона", async () => {
    const horde = hordeActor({ magnitude: 30, start: 40, psychDamage: 5 });
    expect(await healPsychDamage(horde, 3)).toBe(3);
    expect(horde.system.magnitude.value).toBe(33);
    expect(horde.system.psychDamage).toBe(2);
  });

  it("больше накопленного психологического урона не лечит", async () => {
    const horde = hordeActor({ magnitude: 30, start: 40, psychDamage: 2 });
    expect(await healPsychDamage(horde, 10)).toBe(2);
    expect(horde.system.magnitude.value).toBe(32);
  });

  it("обычные потери речью не восполняются", async () => {
    const horde = hordeActor({ magnitude: 20, start: 40, psychDamage: 0 });
    expect(await healPsychDamage(horde, 10)).toBe(0);
    expect(horde.system.magnitude.value).toBe(20);
  });

  it("выше стартовой Магнитуды лечение не поднимает", async () => {
    const horde = hordeActor({ magnitude: 39, start: 40, psychDamage: 10 });
    await healPsychDamage(horde, 10);
    expect(horde.system.magnitude.value).toBe(40);
  });
});

describe("запрет лечения у Ослабленной Орды", () => {
  it("держится 10−W.b часов от момента просадки", async () => {
    const flags = {};
    const horde = hordeActor({ wpBonus: 3, flags });
    expect(await lockPsychHealing(horde)).toBe(7);
    expect(flags[PSYCH_LOCK_FLAG]).toBe(7 * 3600);
    expect(psychHealLocked(horde)).toMatchObject({ hoursLeft: 7 });
  });

  it("по истечении срока лечение снова доступно", async () => {
    const flags = {};
    const horde = hordeActor({ wpBonus: 3, flags });
    await lockPsychHealing(horde);
    globalThis.game.time.worldTime = 7 * 3600;
    expect(psychHealLocked(horde)).toBeNull();
  });

  it("Орде с высокой Волей запрет не ставится вовсе", async () => {
    const flags = {};
    expect(await lockPsychHealing(hordeActor({ wpBonus: 12, flags }))).toBe(0);
    expect(flags[PSYCH_LOCK_FLAG]).toBeUndefined();
  });
});
