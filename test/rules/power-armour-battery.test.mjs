// test/rules/power-armour-battery.test.mjs
//
// Батарея силовой брони (стр. 233, глава «СИЛОВАЯ БРОНЯ», wdbc-x1nz.4):
// «Требует питания от перезаряжаемой батареи, которой хватает на 24ч
// работы. С разряженной батареей... броня не даёт три предыдущих бонуса...
// все её системы выключаются, и она даёт штрафы выключенной силовой брони.»
// Время надевания/снятия — 30 мин (ритуал, 2 ассистента) или 15/5 мин
// (без ритуала, ассистенты те же); специализированная стойка убирает нужду
// в ассистентах, время не меняет.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import {
  POWER_ARMOUR_BATTERY_HOURS, powerArmourBatteryRemainingSeconds, isPowerArmourBatteryDead,
  chargePowerArmourBattery, powerArmourBatteryRemainingDisplay, checkPowerArmourBattery,
  powerArmourDressMinutes, powerArmourAssistantsNeeded
} from "../../module/rules/power-armour-battery.mjs";

function powerArmour({ active = true } = {}) {
  const store = {};
  const item = {
    system: { armorType: "power", equipped: true, active },
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete store[`${scope}.${key}`]; },
    update: async patch => { if ("system.active" in patch) item.system.active = patch["system.active"]; }
  };
  return item;
}

describe("POWER_ARMOUR_BATTERY_HOURS", () => {
  it("24 часа, фикс (книга про Качество не говорит)", () => {
    expect(POWER_ARMOUR_BATTERY_HOURS).toBe(24);
  });
});

describe("powerArmourBatteryRemainingSeconds / chargePowerArmourBattery", () => {
  it("никогда не проверялась (таймер не запущен) — полный заряд", () => {
    globalThis.game.time = { worldTime: 100000 };
    expect(powerArmourBatteryRemainingSeconds(powerArmour())).toBe(24 * 3600);
  });

  it("chargePowerArmourBattery запускает таймер, расход считается от момента подзарядки", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = powerArmour();
    await chargePowerArmourBattery(item);
    globalThis.game.time = { worldTime: 100000 + 3600 };
    expect(powerArmourBatteryRemainingSeconds(item)).toBe(23 * 3600);
  });

  it("заряд исчерпан — 0, не в минус", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = powerArmour();
    await chargePowerArmourBattery(item);
    globalThis.game.time = { worldTime: 100000 + 30 * 3600 };
    expect(powerArmourBatteryRemainingSeconds(item)).toBe(0);
  });

  it("повторная подзарядка сбрасывает счётчик (не «не перезапускает», как у Void Air — Подзарядить это НОВАЯ батарея)", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = powerArmour();
    await chargePowerArmourBattery(item);
    globalThis.game.time = { worldTime: 100000 + 23 * 3600 }; // почти разряжена
    await chargePowerArmourBattery(item);
    expect(powerArmourBatteryRemainingSeconds(item)).toBe(24 * 3600);
  });
});

describe("isPowerArmourBatteryDead", () => {
  it("полный заряд — не разряжена", () => {
    globalThis.game.time = { worldTime: 100000 };
    expect(isPowerArmourBatteryDead(powerArmour())).toBe(false);
  });

  it("истекли 24ч — разряжена", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = powerArmour();
    await chargePowerArmourBattery(item);
    globalThis.game.time = { worldTime: 100000 + 24 * 3600 };
    expect(isPowerArmourBatteryDead(item)).toBe(true);
  });
});

describe("powerArmourBatteryRemainingDisplay", () => {
  it("считает часы и минуты остатка", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = powerArmour();
    await chargePowerArmourBattery(item);
    globalThis.game.time = { worldTime: 100000 + 3600 + 1800 }; // 1ч30м прошло
    expect(powerArmourBatteryRemainingDisplay(item)).toEqual({ hours: 22, minutes: 30 });
  });
});

describe("checkPowerArmourBattery — кнопка-проверка выключает броню тем же полем, что ручной тумблер", () => {
  it("батарея в порядке — active не трогается", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = powerArmour({ active: true });
    const dead = await checkPowerArmourBattery(item);
    expect(dead).toBe(false);
    expect(item.system.active).toBe(true);
  });

  it("батарея разряжена — active переключается в false", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = powerArmour({ active: true });
    await chargePowerArmourBattery(item);
    globalThis.game.time = { worldTime: 100000 + 24 * 3600 };
    const dead = await checkPowerArmourBattery(item);
    expect(dead).toBe(true);
    expect(item.system.active).toBe(false);
  });

  it("уже выключена вручную — повторно update не зовёт", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = powerArmour({ active: false });
    const updates = [];
    item.update = async patch => updates.push(patch);
    await chargePowerArmourBattery(item);
    globalThis.game.time = { worldTime: 100000 + 24 * 3600 };
    await checkPowerArmourBattery(item);
    expect(updates).toEqual([]);
  });
});

describe("powerArmourDressMinutes", () => {
  it("надевание: ритуал — 30 мин, без ритуала — 15 мин", () => {
    expect(powerArmourDressMinutes("don", true)).toBe(30);
    expect(powerArmourDressMinutes("don", false)).toBe(15);
  });

  it("снятие: ритуал — 30 мин, без ритуала — 5 мин", () => {
    expect(powerArmourDressMinutes("doff", true)).toBe(30);
    expect(powerArmourDressMinutes("doff", false)).toBe(5);
  });
});

describe("powerArmourAssistantsNeeded", () => {
  it("без специализированной стойки — 2 ассистента", () => {
    expect(powerArmourAssistantsNeeded(false)).toBe(2);
  });

  it("со стойкой (R1) — ассистенты не нужны", () => {
    expect(powerArmourAssistantsNeeded(true)).toBe(0);
  });
});
