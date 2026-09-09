// test/rules/armiger-veil-range.test.mjs
//
// masterWithinVeilRange (module/rules/armiger-veil-range.mjs, wdbc-1rno шаг F)
// — «...считает Завесу на Cor.b персонажа тоньше, если не отходит от него
// дальше чем на Cor м». Дальность — ПОЛНОЕ значение Порчи Хозяина (не бонус),
// измеряется по живым токенам на текущей сцене (тот же приём замера, что и
// tokensWithinRadius, test/rules/aoe-target.test.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { masterWithinVeilRange } from "../../module/rules/armiger-veil-range.mjs";

const grid = { size: 100, distance: 2 }; // клетка 100px = 2 метра

function placeToken(scene, id, actorUuid, pos) {
  const doc = { id, x: pos?.x ?? 0, y: pos?.y ?? 0, width: 1, height: 1, parent: scene };
  return { actor: { uuid: actorUuid }, document: doc };
}

function scene(tokens) { return { grid, tokens: { contents: tokens } }; }

const demon = { uuid: "Actor.demon" };
const master = corValue => ({ uuid: "Actor.master", system: { corruption: { value: corValue } } });

beforeEach(() => { globalThis.canvas = { tokens: { placeables: [] } }; });

describe("masterWithinVeilRange", () => {
  it("оба токена на одной сцене, в пределах Cor м — true", () => {
    const sc = scene([]);
    const demonPlace  = placeToken(sc, "d", "Actor.demon", { x: 0 });
    const masterPlace = placeToken(sc, "m", "Actor.master", { x: 300 }); // 3 клетки × 2м = 6м
    globalThis.canvas.tokens.placeables = [demonPlace, masterPlace];

    expect(masterWithinVeilRange(demon, master(10))).toBe(true); // 6м ≤ Cor 10
  });

  it("дальше Cor м — false", () => {
    const sc = scene([]);
    const demonPlace  = placeToken(sc, "d", "Actor.demon", { x: 0 });
    const masterPlace = placeToken(sc, "m", "Actor.master", { x: 1000 }); // 20м
    globalThis.canvas.tokens.placeables = [demonPlace, masterPlace];

    expect(masterWithinVeilRange(demon, master(10))).toBe(false); // 20м > Cor 10
  });

  it("ровно на границе Cor м — true (не строгое неравенство)", () => {
    const sc = scene([]);
    const demonPlace  = placeToken(sc, "d", "Actor.demon", { x: 0 });
    const masterPlace = placeToken(sc, "m", "Actor.master", { x: 500 }); // 10м
    globalThis.canvas.tokens.placeables = [demonPlace, masterPlace];

    expect(masterWithinVeilRange(demon, master(10))).toBe(true);
  });

  it("демон не размещён на сцене — false", () => {
    const sc = scene([]);
    const masterPlace = placeToken(sc, "m", "Actor.master", { x: 0 });
    globalThis.canvas.tokens.placeables = [masterPlace];

    expect(masterWithinVeilRange(demon, master(10))).toBe(false);
  });

  it("Хозяин не размещён на сцене — false", () => {
    const sc = scene([]);
    const demonPlace = placeToken(sc, "d", "Actor.demon", { x: 0 });
    globalThis.canvas.tokens.placeables = [demonPlace];

    expect(masterWithinVeilRange(demon, master(10))).toBe(false);
  });

  it("токены на РАЗНЫХ сценах — false, дистанцию между сценами не считаем", () => {
    const sceneA = scene([]);
    const sceneB = scene([]);
    const demonPlace  = { actor: { uuid: "Actor.demon" }, document: { id: "d", x: 0, y: 0, width: 1, height: 1, parent: sceneA } };
    const masterPlace = { actor: { uuid: "Actor.master" }, document: { id: "m", x: 0, y: 0, width: 1, height: 1, parent: sceneB } };
    globalThis.canvas.tokens.placeables = [demonPlace, masterPlace];

    expect(masterWithinVeilRange(demon, master(10))).toBe(false);
  });

  it("Cor 0 (нет Порчи) — только совпадение позиций проходит", () => {
    const sc = scene([]);
    const demonPlace  = placeToken(sc, "d", "Actor.demon", { x: 0 });
    const masterPlace = placeToken(sc, "m", "Actor.master", { x: 0 });
    globalThis.canvas.tokens.placeables = [demonPlace, masterPlace];

    expect(masterWithinVeilRange(demon, master(0))).toBe(true);
  });

  it("нет демона/Хозяина или их uuid — false, не падает", () => {
    expect(masterWithinVeilRange(null, master(10))).toBe(false);
    expect(masterWithinVeilRange(demon, null)).toBe(false);
    expect(masterWithinVeilRange({}, master(10))).toBe(false);
  });
});
