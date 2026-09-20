// test/combat/legacy-weapon-mutations.test.mjs
//
// Кровожадное/fearsome 1-2, Оружие Наследия, стрелковая ветка (wdbc-1rno.35,
// стр. 427): «+20 на попадание по ближайшей неповреждённой цели.»

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { nearestUndamagedEnemyToken, isNearestUndamagedEnemy }
  from "../../module/combat/legacy-weapon-mutations.mjs";

const HOSTILE = -1, FRIENDLY = 1;

function token({ x = 0, y = 0, width = 1, height = 1, disposition = HOSTILE, wounds = { value: 10, max: 10 }, name = "" } = {}) {
  return { actor: { name, system: { wounds } }, document: { x, y, width, height, disposition } };
}

beforeEach(() => {
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
});

describe("nearestUndamagedEnemyToken", () => {
  it("выбирает ближайшего НЕПОВРЕЖДЁННОГО врага, игнорируя раненого ближе", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const woundedClose = token({ x: 2, y: 0, disposition: HOSTILE, wounds: { value: 5, max: 10 }, name: "Раненый" });
    const undamagedFar  = token({ x: 6, y: 0, disposition: HOSTILE, wounds: { value: 10, max: 10 }, name: "Целый" });
    globalThis.canvas.tokens.placeables = [attacker, woundedClose, undamagedFar];
    expect(nearestUndamagedEnemyToken(attacker)).toBe(undamagedFar);
  });

  it("союзник не считается, даже неповреждённый и рядом", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const ally = token({ x: 1, y: 0, disposition: FRIENDLY, wounds: { value: 10, max: 10 } });
    globalThis.canvas.tokens.placeables = [attacker, ally];
    expect(nearestUndamagedEnemyToken(attacker)).toBe(null);
  });

  it("нет неповреждённых врагов вовсе — null", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const wounded = token({ x: 1, y: 0, disposition: HOSTILE, wounds: { value: 1, max: 10 } });
    globalThis.canvas.tokens.placeables = [attacker, wounded];
    expect(nearestUndamagedEnemyToken(attacker)).toBe(null);
  });
});

describe("isNearestUndamagedEnemy", () => {
  it("текущая цель совпала с ближайшим неповреждённым — true", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const target    = token({ x: 2, y: 0, disposition: HOSTILE });
    globalThis.canvas.tokens.placeables = [attacker, target];
    expect(isNearestUndamagedEnemy({ attackerToken: attacker, targetToken: target })).toBe(true);
  });

  it("есть более близкий неповреждённый — текущая цель не совпадает, false", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const closer    = token({ x: 1, y: 0, disposition: HOSTILE, name: "Ближе" });
    const target    = token({ x: 5, y: 0, disposition: HOSTILE, name: "Цель" });
    globalThis.canvas.tokens.placeables = [attacker, closer, target];
    expect(isNearestUndamagedEnemy({ attackerToken: attacker, targetToken: target })).toBe(false);
  });
});
