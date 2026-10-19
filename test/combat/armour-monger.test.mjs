// test/combat/armour-monger.test.mjs
//
// Бронник (Талант Стойкости, глава 3): тумблер «Броня обслужена сегодня» и
// сброс метки в полночь по Календарю (combat/condition-clock.mjs).
// Плюс порог обморока от Усталости у Ментальной Стойкости (sheets/tabs/conditions.mjs).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { toggleArmourMonger, armourMongerClock, armourMongerOn, hasArmourMonger, sweepStaleArmourMonger } from "../../module/combat/armour-monger.mjs";
import { CONDITION_CLOCK_HANDLERS, sweepConditionClock } from "../../module/combat/condition-clock.mjs";
import { fatigueChangeFields } from "../../module/sheets/tabs/conditions.mjs";

const DAY = 86400;
const monger = { type: "talent", name: "Armour-Monger / Бронник", system: {}, flags: {} };

function makeActor(items = [monger]) {
  const flags = {};
  return {
    id: "a1", name: "Бронник", items, system: { conditions: {}, characteristics: {} }, flags: { "warhammer-dbc": flags },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    unsetFlag: async (_s, k) => { delete flags[k]; }
  };
}

beforeEach(() => { resetCaptured(); globalThis.game.time = { worldTime: 10 * DAY + 3600 }; });
afterEach(() => { delete globalThis.game.time; });

describe("Бронник: тумблер", () => {
  it("кнопка есть только у носителя", () => {
    expect(hasArmourMonger(makeActor())).toBe(true);
    expect(hasArmourMonger(makeActor([]))).toBe(false);
  });

  it("первое нажатие ставит метку текущих суток, второе — снимает", async () => {
    const a = makeActor();
    expect(armourMongerOn(a)).toBe(false);
    expect(await toggleArmourMonger(a)).toBe(true);
    expect(a.getFlag("warhammer-dbc", "armourMonger")).toEqual({ day: 10 });
    expect(armourMongerOn(a)).toBe(true);
    expect(await toggleArmourMonger(a)).toBe(false);
    expect(a.getFlag("warhammer-dbc", "armourMonger")).toBeUndefined();
    expect(armourMongerOn(a)).toBe(false);
  });

  it("метка прошлых суток тумблером считается выключенной — нажатие включает заново", async () => {
    const a = makeActor();
    await a.setFlag("warhammer-dbc", "armourMonger", { day: 9 });
    expect(armourMongerOn(a)).toBe(false);
    expect(await toggleArmourMonger(a)).toBe(true);
    expect(a.getFlag("warhammer-dbc", "armourMonger")).toEqual({ day: 10 });
  });

  it("не носитель — предупреждение, метка не ставится", async () => {
    const a = makeActor([]);
    await toggleArmourMonger(a);
    expect(a.getFlag("warhammer-dbc", "armourMonger")).toBeUndefined();
  });
});

describe("Бронник: сброс в полночь по Календарю", () => {
  it("в списке часов Состояний есть обработчик armourMonger", () => {
    expect(CONDITION_CLOCK_HANDLERS.some(h => h.id === "armourMonger")).toBe(true);
  });

  it("метка прошлых суток снимается, сегодняшняя остаётся", async () => {
    const a = makeActor();
    await a.setFlag("warhammer-dbc", "armourMonger", { day: 10 });
    await armourMongerClock(a, { to: 10 * DAY + 80000 });
    expect(a.getFlag("warhammer-dbc", "armourMonger")).toEqual({ day: 10 });
    await armourMongerClock(a, { to: 11 * DAY });
    expect(a.getFlag("warhammer-dbc", "armourMonger")).toBeUndefined();
  });

  it("часы Календаря: сдвиг через полночь снимает метку (sweepConditionClock)", async () => {
    const a = makeActor();
    await a.setFlag("warhammer-dbc", "armourMonger", { day: 10 });
    await sweepConditionClock(a, { from: 10 * DAY + 80000, to: 11 * DAY + 60 });
    expect(a.getFlag("warhammer-dbc", "armourMonger")).toBeUndefined();
  });

  it("загрузка мира (ГМ): метка прошлых суток снимается, сегодняшняя остаётся", async () => {
    const stale = makeActor(); await stale.setFlag("warhammer-dbc", "armourMonger", { day: 9 });
    const fresh = makeActor(); await fresh.setFlag("warhammer-dbc", "armourMonger", { day: 10 });
    const savedActors = globalThis.game.actors, savedUser = globalThis.game.user;
    globalThis.game.actors = [stale, fresh];
    globalThis.game.user = { isGM: true };
    try {
      await sweepStaleArmourMonger();
    } finally {
      globalThis.game.actors = savedActors; globalThis.game.user = savedUser;
    }
    expect(stale.getFlag("warhammer-dbc", "armourMonger")).toBeUndefined();
    expect(fresh.getFlag("warhammer-dbc", "armourMonger")).toEqual({ day: 10 });
  });

  it("загрузка мира у не-ГМа ничего не трогает", async () => {
    const stale = makeActor(); await stale.setFlag("warhammer-dbc", "armourMonger", { day: 9 });
    const savedActors = globalThis.game.actors;
    globalThis.game.actors = [stale];
    try { await sweepStaleArmourMonger(); } finally { globalThis.game.actors = savedActors; }
    expect(stale.getFlag("warhammer-dbc", "armourMonger")).toEqual({ day: 9 });
  });

  it("без метки часы ничего не пишут", async () => {
    const a = makeActor();
    let writes = 0;
    a.unsetFlag = async () => { writes++; };
    await armourMongerClock(a, { to: 11 * DAY });
    expect(writes).toBe(0);
  });
});

describe("Ментальная Стойкость: порог обморока T.b+2×W.b (fatigueChangeFields)", () => {
  const withChars = (items, fatigue) => ({
    items, system: {
      characteristics: { t: { bonus: 4 }, wp: { bonus: 3 } },
      fatigue: { value: fatigue }, conditions: {}
    }
  });
  const mf = { type: "talent", name: "Mental Fortitude / Ментальная Стойкость", system: {}, flags: {} };

  it("без Таланта Усталость 7 = T.b+W.b — обморок", () => {
    const res = fatigueChangeFields(withChars([], 6), 7);
    expect(res.threshold).toBe(7);
    expect(res.fainted).not.toBeNull();
  });

  it("с Талантом та же Усталость 7 — на ногах, порог 10", () => {
    const res = fatigueChangeFields(withChars([mf], 6), 7);
    expect(res.threshold).toBe(10);
    expect(res.fainted).toBeNull();
    expect(res.fields["system.fatigue.max"]).toBe(10);
  });

  it("с Талантом обморок на 10", () => {
    const res = fatigueChangeFields(withChars([mf], 9), 10);
    expect(res.fainted).not.toBeNull();
  });
});
