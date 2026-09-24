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
// Второй слой был ошибкой (wdbc-t3c3t.12): applyTokenAutoRotateDefaultOnce
// выключал core.tokenAutoRotate на весь мир, а конус обзора 210°
// (migrations/sight-angle.mjs) смотрит туда же, куда rotation — персонажи
// переставали поворачиваться при движении и видели только «вперёд» от
// исходного положения. Теперь существа поворачиваются по ходу движения (их
// «перед» — куда идут), Корабль/Техника по-прежнему нет — это держит хук
// preMoveToken выше независимо от настройки мира. restoreTokenAutoRotateOnce
// один раз возвращает настройку в мирах, где её выключила система.

import "./support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";

const { disableFixedFacingAutoRotate, shouldRestoreTokenAutoRotate, restoreTokenAutoRotateOnce } =
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

describe("shouldRestoreTokenAutoRotate — разовый возврат core.tokenAutoRotate", () => {
  it("система выключала, ещё не возвращали, стоит false — вернуть", () => {
    expect(shouldRestoreTokenAutoRotate({ restored: false, systemDisabled: true, currentAutoRotate: false })).toBe(true);
  });

  it("уже возвращали — не трогать, даже если ГМ снова выключил", () => {
    expect(shouldRestoreTokenAutoRotate({ restored: true, systemDisabled: true, currentAutoRotate: false })).toBe(false);
  });

  it("система не выключала (новый мир) — не трогать", () => {
    expect(shouldRestoreTokenAutoRotate({ restored: false, systemDisabled: false, currentAutoRotate: false })).toBe(false);
  });

  it("уже включено — нечего возвращать", () => {
    expect(shouldRestoreTokenAutoRotate({ restored: false, systemDisabled: true, currentAutoRotate: true })).toBe(false);
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

describe("restoreTokenAutoRotateOnce — Foundry-обвязка (только ГМ, только once)", () => {
  it("не ГМ — ничего не трогает", async () => {
    const { sets, api } = settingsStub({
      "warhammer-dbc.tokenAutoRotateDefaultApplied": true, "warhammer-dbc.tokenAutoRotateRestored": false,
      "core.tokenAutoRotate": false
    });
    globalThis.game.user = { isGM: false };
    globalThis.game.settings = api;

    await restoreTokenAutoRotateOnce();

    expect(sets).toEqual([]);
  });

  it("ГМ, система выключала автоповорот — включает обратно и помечает", async () => {
    const { sets, api } = settingsStub({
      "warhammer-dbc.tokenAutoRotateDefaultApplied": true, "warhammer-dbc.tokenAutoRotateRestored": false,
      "core.tokenAutoRotate": false
    });
    globalThis.game.user = { isGM: true };
    globalThis.game.settings = api;

    await restoreTokenAutoRotateOnce();

    expect(sets).toContainEqual(["core", "tokenAutoRotate", true]);
    expect(sets).toContainEqual(["warhammer-dbc", "tokenAutoRotateRestored", true]);
  });

  it("ГМ, уже возвращали — core.tokenAutoRotate не трогает", async () => {
    const { sets, api } = settingsStub({
      "warhammer-dbc.tokenAutoRotateDefaultApplied": true, "warhammer-dbc.tokenAutoRotateRestored": true,
      "core.tokenAutoRotate": false
    });
    globalThis.game.user = { isGM: true };
    globalThis.game.settings = api;

    await restoreTokenAutoRotateOnce();

    expect(sets.some(([scope, key]) => scope === "core" && key === "tokenAutoRotate")).toBe(false);
  });
});
