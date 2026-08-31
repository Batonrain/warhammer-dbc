// test/combat/tactical-map.test.mjs
//
// meleeContactCount (wdbc: автоматизация Дуэлянтского, стр. 73 Книги Аэльдари) —
// считает вражеские токены сцены в Базовом/Глубоком контакте с атакующим, чтобы
// диалог атаки сам отмечал галочку «бой 1-на-1», а не спрашивал игрока на глаз.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { meleeContactCount } from "../../module/combat/tactical-map.mjs";

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
