// test/warhammer-dbc-fixed-facing-auto-rotate.test.mjs
//
// Баг: «перед» токена Корабля (и Техники — то же обращение, тот же механизм)
// сам менялся при обычном перемещении (drag). Причина — не код системы, а
// мировая настройка ядра Foundry v13 core.tokenAutoRotate (включена по
// умолчанию): она доворачивает ЛЮБОЙ токен по направлению движения, если
// система явно не погасит movement.autoRotate в preMoveToken. Для этих двух
// типов это ломает игровой смысл «переда»: у Корабля — сектора орудий/щитов,
// у Техники — vehicleMount.hArc/vArc (module/rules/facing.mjs::isWithinMountArc),
// от которых зависит, какие цели фронтальное/бортовое орудие может достать
// (sheets/vehicle-sheet.mjs) — см. warhammer-dbc.mjs::disableFixedFacingAutoRotate.
//
// Второй слой (по просьбе пользователя, тот же вечер): сама настройка мира
// core.tokenAutoRotate тоже сама больше не должна давать повод для этого
// бага у остальных типов (Cloak/Скрытная Атака читают rotation защищающегося
// не только у Корабля/Техники) — applyTokenAutoRotateDefaultOnce выключает
// её ОДИН раз, только ГМ, по тому же принципу, что applyBookDiagonalDefaultOnce
// (module/combat/tactical-map.mjs, стр. 31): once — значит once.

import "./support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";

const { disableFixedFacingAutoRotate, shouldApplyTokenAutoRotateDefault, applyTokenAutoRotateDefaultOnce } =
  await import("../warhammer-dbc.mjs");

describe("disableFixedFacingAutoRotate — preMoveToken гасит автоповорот у Корабля/Техники", () => {
  it.each(["ship", "vehicle"])("actor.type === '%s' — movement.autoRotate выключается", (type) => {
    const tokenDoc = { actor: { type } };
    const movement = { autoRotate: true };

    disableFixedFacingAutoRotate(tokenDoc, movement);

    expect(movement.autoRotate).toBe(false);
  });

  it("прочие типы актора (персонаж, Орда) — не трогает autoRotate", () => {
    for (const type of ["character", "horde", "squad", "formation"]) {
      const tokenDoc = { actor: { type } };
      const movement = { autoRotate: true };

      disableFixedFacingAutoRotate(tokenDoc, movement);

      expect(movement.autoRotate).toBe(true);
    }
  });

  it("нет актора на токене (непривязанный/удалённый) — не падает", () => {
    const movement = { autoRotate: true };
    expect(() => disableFixedFacingAutoRotate({ actor: null }, movement)).not.toThrow();
    expect(movement.autoRotate).toBe(true);
  });
});

describe("shouldApplyTokenAutoRotateDefault — разовый системный дефолт core.tokenAutoRotate", () => {
  it("ещё не применялось, стоит дефолт ядра (true) — применить (выключить)", () => {
    expect(shouldApplyTokenAutoRotateDefault({ alreadyApplied: false, currentAutoRotate: true })).toBe(true);
  });

  it("уже применялось раньше — не применять снова, даже если опять true", () => {
    expect(shouldApplyTokenAutoRotateDefault({ alreadyApplied: true, currentAutoRotate: true })).toBe(false);
  });

  it("ГМ уже выключил сам (false) — не наше дело, уже так, как надо", () => {
    expect(shouldApplyTokenAutoRotateDefault({ alreadyApplied: false, currentAutoRotate: false })).toBe(false);
  });
});

/** Мини-заглушка game.settings поверх ключа "scope.key" — свой стор на тест. */
function settingsStub(initial) {
  const store = { ...initial };
  const sets = [];
  return {
    sets,
    api: {
      get: (scope, key) => store[`${scope}.${key}`],
      set: async (scope, key, value) => { sets.push([scope, key, value]); store[`${scope}.${key}`] = value; }
    }
  };
}

describe("applyTokenAutoRotateDefaultOnce — Foundry-обвязка (только ГМ, только once)", () => {
  it("не ГМ — ничего не трогает", async () => {
    const { sets, api } = settingsStub({
      "warhammer-dbc.tokenAutoRotateDefaultApplied": false, "core.tokenAutoRotate": true
    });
    globalThis.game.user = { isGM: false };
    globalThis.game.settings = api;

    await applyTokenAutoRotateDefaultOnce();

    expect(sets).toEqual([]);
  });

  it("ГМ, дефолт ядра ещё не тронут — выключает core.tokenAutoRotate и помечает применённым", async () => {
    const { sets, api } = settingsStub({
      "warhammer-dbc.tokenAutoRotateDefaultApplied": false, "core.tokenAutoRotate": true
    });
    globalThis.game.user = { isGM: true };
    globalThis.game.settings = api;

    await applyTokenAutoRotateDefaultOnce();

    expect(sets).toContainEqual(["core", "tokenAutoRotate", false]);
    expect(sets).toContainEqual(["warhammer-dbc", "tokenAutoRotateDefaultApplied", true]);
  });

  it("ГМ, уже применялось раньше — core.tokenAutoRotate не трогает", async () => {
    const { sets, api } = settingsStub({
      "warhammer-dbc.tokenAutoRotateDefaultApplied": true, "core.tokenAutoRotate": true
    });
    globalThis.game.user = { isGM: true };
    globalThis.game.settings = api;

    await applyTokenAutoRotateDefaultOnce();

    expect(sets.some(([scope, key]) => scope === "core" && key === "tokenAutoRotate")).toBe(false);
  });

  it("ГМ, настройка мира уже false (ГМ сам выключил) — не трогает, но метку once всё равно ставит", async () => {
    const { sets, api } = settingsStub({
      "warhammer-dbc.tokenAutoRotateDefaultApplied": false, "core.tokenAutoRotate": false
    });
    globalThis.game.user = { isGM: true };
    globalThis.game.settings = api;

    await applyTokenAutoRotateDefaultOnce();

    expect(sets.some(([scope, key]) => scope === "core" && key === "tokenAutoRotate")).toBe(false);
    expect(sets).toContainEqual(["warhammer-dbc", "tokenAutoRotateDefaultApplied", true]);
  });
});
