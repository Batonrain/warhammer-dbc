// test/combat/tactical-map.test.mjs
//
// meleeContactCount (wdbc: автоматизация Дуэлянтского, стр. 73 Книги Аэльдари) —
// считает вражеские токены сцены в Базовом/Глубоком контакте с атакующим, чтобы
// диалог атаки сам отмечал галочку «бой 1-на-1», а не спрашивал игрока на глаз.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { meleeContactCount, actorBaseSizeCells, isBaseTrackedActor, applyBookDiagonalDefaultOnce }
  from "../../module/combat/tactical-map.mjs";

const HOSTILE = -1, FRIENDLY = 1, NEUTRAL = 0;

/** Токен-заглушка: клетки те же единицы, что использует tokenRect (x/y/width/height). */
function token({ x = 0, y = 0, width = 2, height = 2, disposition = HOSTILE } = {}) {
  return { document: { x, y, width, height, disposition } };
}

beforeEach(() => {
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
});

describe("meleeContactCount: враги в контакте с атакующим", () => {
  it("один враг вплотную — 1", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const enemy     = token({ x: 2, y: 0, disposition: HOSTILE });
    canvas.tokens.placeables = [attacker, enemy];
    expect(meleeContactCount(attacker)).toBe(1);
  });

  it("два врага вплотную — 2 (не 1-на-1)", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const enemy1    = token({ x: 2, y: 0, disposition: HOSTILE });
    const enemy2    = token({ x: 0, y: 2, disposition: HOSTILE });
    canvas.tokens.placeables = [attacker, enemy1, enemy2];
    expect(meleeContactCount(attacker)).toBe(2);
  });

  it("враг далеко — 0", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const enemy     = token({ x: 20, y: 20, disposition: HOSTILE });
    canvas.tokens.placeables = [attacker, enemy];
    expect(meleeContactCount(attacker)).toBe(0);
  });

  it("союзник вплотную не считается — 0", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const ally      = token({ x: 2, y: 0, disposition: FRIENDLY });
    canvas.tokens.placeables = [attacker, ally];
    expect(meleeContactCount(attacker)).toBe(0);
  });

  it("нейтральный токен вплотную не считается врагом — 0", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const neutral   = token({ x: 2, y: 0, disposition: NEUTRAL });
    canvas.tokens.placeables = [attacker, neutral];
    expect(meleeContactCount(attacker)).toBe(0);
  });

  it("враг, союзник и дальний враг разом — считает только контактного врага", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const enemyClose = token({ x: 2, y: 0, disposition: HOSTILE });
    const ally       = token({ x: 0, y: 2, disposition: FRIENDLY });
    const enemyFar   = token({ x: 30, y: 30, disposition: HOSTILE });
    canvas.tokens.placeables = [attacker, enemyClose, ally, enemyFar];
    expect(meleeContactCount(attacker)).toBe(1);
  });

  it("сам атакующий в списке placeables не считает себя", () => {
    const attacker = token({ x: 0, y: 0, disposition: HOSTILE });
    canvas.tokens.placeables = [attacker];
    expect(meleeContactCount(attacker)).toBe(0);
  });
});

// wdbc-x1nz.2.20 (стр. 31): «с существами Размером 2 и больше размер их Баз
// остаётся на откуп ГМу» — actorBaseSizeCells (и синк токена, который на неё
// опирается) должны вернуть null и ничего не трогать для такого актора,
// независимо от расы/брони.
describe("actorBaseSizeCells: Размер 2+ — на откуп ГМу", () => {
  it("Огрин (largeBase раса) с обычным system.size — 3×3, как раньше", () => {
    const actor = { system: { race: "ogryn", size: 1 }, items: [] };
    expect(actorBaseSizeCells(actor)).toBe(3);
  });

  it("system.size 2 — null, даже у Огрина (largeBase не переопределяет откуп ГМу)", () => {
    const actor = { system: { race: "ogryn", size: 2 }, items: [] };
    expect(actorBaseSizeCells(actor)).toBeNull();
  });

  it("system.size 3 без крупной расы/брони — тоже null, не 2×2 по умолчанию", () => {
    const actor = { system: { race: "human", size: 3 }, items: [] };
    expect(actorBaseSizeCells(actor)).toBeNull();
  });

  it("обычный персонаж (size 0/1) — 2×2 как раньше", () => {
    expect(actorBaseSizeCells({ system: { race: "human", size: 0 }, items: [] })).toBe(2);
    expect(actorBaseSizeCells({ system: { race: "human", size: 1 }, items: [] })).toBe(2);
  });
});

// wdbc-x1nz.2.21 (стр. 31): «Машины вроде шагоходов... имеют Базы точно так
// же, как обычные персонажи» — isBaseTrackedActor допускает Шагоход в систему
// контакта, но НЕ прочую Технику/Здания (та явно Баз не имеет, см. соседний
// пункт книги «Техника и Здания»).
describe("isBaseTrackedActor: личный масштаб + Шагоход (wdbc-x1nz.2.21)", () => {
  it("персонаж/демон/minion — как раньше", () => {
    expect(isBaseTrackedActor({ type: "character" })).toBe(true);
    expect(isBaseTrackedActor({ type: "daemon" })).toBe(true);
    expect(isBaseTrackedActor({ type: "minion" })).toBe(true);
  });

  it("Шагоход (vehicle, chassis.type walker) — допущен", () => {
    const dreadnought = { type: "vehicle", system: { chassis: { type: "walker" } } };
    expect(isBaseTrackedActor(dreadnought)).toBe(true);
  });

  it("обычная техника (не Шагоход) — не допущена", () => {
    const tank = { type: "vehicle", system: { chassis: { type: "tracked" } } };
    expect(isBaseTrackedActor(tank)).toBe(false);
  });

  it("Орда/Отряд/без актора — не допущены", () => {
    expect(isBaseTrackedActor({ type: "horde" })).toBe(false);
    expect(isBaseTrackedActor({ type: "squad" })).toBe(false);
    expect(isBaseTrackedActor(null)).toBe(false);
  });

  it("Шагоход с Размером ≥2 (обычный случай) — actorBaseSizeCells отдаёт null, автосинк его не трогает", () => {
    const dreadnought = { type: "vehicle", system: { chassis: { type: "walker" }, size: 4 }, items: [] };
    expect(actorBaseSizeCells(dreadnought)).toBeNull();
  });
});

// wdbc-x1nz.2 (стр. 31): дефолт диагонали мира на APPROXIMATE (1,5м/клетку),
// один раз, только ГМ, не трогая осознанный выбор ГМа впредь.
describe("applyBookDiagonalDefaultOnce", () => {
  /** Мини-заглушка game.settings с реальной персистентностью get/set. */
  function fakeSettings(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
      get: (scope, key) => store.get(`${scope}.${key}`),
      set: async (scope, key, value) => { store.set(`${scope}.${key}`, value); },
      _store: store
    };
  }

  it("не ГМ — ничего не делает", async () => {
    globalThis.game.user = { isGM: false };
    globalThis.game.settings = fakeSettings({ "core.gridDiagonals": 0 });
    await applyBookDiagonalDefaultOnce();
    expect(globalThis.game.settings.get("core", "gridDiagonals")).toBe(0);
    expect(globalThis.game.settings.get("warhammer-dbc", "diagonalDefaultApplied")).toBeUndefined();
  });

  it("ГМ, ещё не применялось, стоит дефолт ядра (0) — ставит APPROXIMATE (2) и флаг", async () => {
    globalThis.game.user = { isGM: true };
    globalThis.game.settings = fakeSettings({ "core.gridDiagonals": 0 });
    await applyBookDiagonalDefaultOnce();
    expect(globalThis.game.settings.get("core", "gridDiagonals")).toBe(2);
    expect(globalThis.game.settings.get("warhammer-dbc", "diagonalDefaultApplied")).toBe(true);
  });

  it("ГМ уже выбрал своё значение — не трогает core-настройку, но флаг всё равно ставит (once — значит once)", async () => {
    globalThis.game.user = { isGM: true };
    globalThis.game.settings = fakeSettings({ "core.gridDiagonals": 3 }); // RECTILINEAR, например
    await applyBookDiagonalDefaultOnce();
    expect(globalThis.game.settings.get("core", "gridDiagonals")).toBe(3);
    expect(globalThis.game.settings.get("warhammer-dbc", "diagonalDefaultApplied")).toBe(true);
  });

  it("уже применялось раньше — не трогает core-настройку, даже если она снова 0", async () => {
    globalThis.game.user = { isGM: true };
    globalThis.game.settings = fakeSettings({
      "core.gridDiagonals": 0, "warhammer-dbc.diagonalDefaultApplied": true
    });
    await applyBookDiagonalDefaultOnce();
    expect(globalThis.game.settings.get("core", "gridDiagonals")).toBe(0);
  });
});
