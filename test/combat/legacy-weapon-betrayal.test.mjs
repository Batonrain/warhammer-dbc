// test/combat/legacy-weapon-betrayal.test.mjs
//
// Наследие Предательства, Оружие Наследия (wdbc-1rno.35, История 4, стр.
// 427): «На нат. 100 на попадание оружие попадает по случайному союзнику» —
// геометрия «союзники рядом» для обеих книжных веток (контакт в рукопашной /
// 3м от цели в стрелковой). Тот же приём токена-заглушки, что
// test/combat/tactical-map.test.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { alliesInMeleeContact, alliesNearTarget, betrayalRandomAllyToken }
  from "../../module/combat/legacy-weapon-betrayal.mjs";

const HOSTILE = -1, FRIENDLY = 1;

function token({ x = 0, y = 0, width = 2, height = 2, disposition = FRIENDLY, name = "" } = {}) {
  return { actor: { name }, document: { x, y, width, height, disposition } };
}

beforeEach(() => {
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
});

describe("alliesInMeleeContact (рукопашная ветка)", () => {
  it("союзник вплотную — в списке", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const ally      = token({ x: 2, y: 0, disposition: FRIENDLY, name: "Соратник" });
    canvas.tokens.placeables = [attacker, ally];
    expect(alliesInMeleeContact(attacker)).toEqual([ally]);
  });

  it("враг вплотную не считается союзником", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const enemy     = token({ x: 2, y: 0, disposition: HOSTILE });
    canvas.tokens.placeables = [attacker, enemy];
    expect(alliesInMeleeContact(attacker)).toEqual([]);
  });

  it("союзник далеко — не в контакте", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const ally      = token({ x: 20, y: 20, disposition: FRIENDLY });
    canvas.tokens.placeables = [attacker, ally];
    expect(alliesInMeleeContact(attacker)).toEqual([]);
  });

  it("сам атакующий не считает себя союзником (даже когда attackerToken — TokenDocument, не placeable)", () => {
    // resolveAttackerToken (facing.mjs) отдаёт ИМЕННО document, а не сам
    // placeable из canvas.tokens.placeables — сравнение обязано идти по
    // документу, не по ссылке (см. legacy-weapon-betrayal.mjs::alliesOf).
    const attackerPlaceable = token({ x: 0, y: 0, disposition: FRIENDLY });
    const attackerAsDocument = attackerPlaceable.document;
    canvas.tokens.placeables = [attackerPlaceable];
    expect(alliesInMeleeContact(attackerAsDocument)).toEqual([]);
  });
});

describe("alliesNearTarget (стрелковая ветка, 3м)", () => {
  // width/height:1 — тот же приём, что test/combat/attack-burst-secondary-
  // targets.test.mjs: при grid.size:1 разница координат читается прямо в
  // метрах (edge-дистанция между смежными краями 1×1 токенов).
  const t = (over = {}) => token({ width: 1, height: 1, ...over });

  it("союзник в 3м от ЦЕЛИ — в списке", () => {
    const target = t({ x: 0, y: 0, disposition: HOSTILE });
    const ally    = t({ x: 4, y: 0, disposition: HOSTILE, name: "Собрат" }); // disposition цели — тоже HOSTILE, союзник ей
    canvas.tokens.placeables = [target, ally];
    expect(alliesNearTarget(target)).toEqual([ally]);
  });

  it("союзник в 5м — за пределами радиуса", () => {
    const target = t({ x: 0, y: 0, disposition: HOSTILE });
    const ally    = t({ x: 5, y: 0, disposition: HOSTILE });
    canvas.tokens.placeables = [target, ally];
    expect(alliesNearTarget(target)).toEqual([]);
  });

  it("враг цели рядом не считается", () => {
    const target = t({ x: 0, y: 0, disposition: HOSTILE });
    const foe     = t({ x: 1, y: 0, disposition: FRIENDLY });
    canvas.tokens.placeables = [target, foe];
    expect(alliesNearTarget(target)).toEqual([]);
  });
});

describe("betrayalRandomAllyToken", () => {
  it("рукопашная — выбирает из контактных союзников атакующего", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    const ally      = token({ x: 2, y: 0, disposition: FRIENDLY });
    canvas.tokens.placeables = [attacker, ally];
    expect(betrayalRandomAllyToken({ isMelee: true, attackerToken: attacker, targetToken: null })).toBe(ally);
  });

  it("стрелковая — выбирает из союзников рядом с целью", () => {
    const target = token({ x: 0, y: 0, disposition: HOSTILE });
    const ally    = token({ x: 1, y: 0, disposition: HOSTILE });
    canvas.tokens.placeables = [target, ally];
    expect(betrayalRandomAllyToken({ isMelee: false, attackerToken: null, targetToken: target })).toBe(ally);
  });

  it("нет кандидатов — null", () => {
    const attacker = token({ x: 0, y: 0, disposition: FRIENDLY });
    canvas.tokens.placeables = [attacker];
    expect(betrayalRandomAllyToken({ isMelee: true, attackerToken: attacker, targetToken: null })).toBe(null);
  });
});
