// test/rules/aoe-target.test.mjs
//
// tokensWithinRadius (module/rules/aoe-target.mjs, wdbc-sk8s) — разовая
// выборка «все токены в радиусе N м», нужна находкам вида «Костяная Песнь:
// вся техника в радиусе 10 м». Переиспользует tokenDocDistance
// (module/regions/auras.mjs), эта пара тестов проверяет только обвязку
// (фильтры self/hidden/actorType), не саму формулу замера.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { tokensWithinRadius } from "../../module/rules/aoe-target.mjs";

const grid = { size: 100, distance: 2 }; // клетка 100px = 2 метра

function token(id, { x = 0, y = 0, actorType = "vehicle", hidden = false } = {}) {
  return { id, x, y, width: 1, height: 1, hidden, actor: { type: actorType } };
}

function scene(tokens) {
  return { grid, tokens: { contents: tokens } };
}

describe("tokensWithinRadius", () => {
  it("без сцены (токен не на канвасе) — пустой список", () => {
    const caster = token("caster");
    expect(tokensWithinRadius(caster, 10)).toEqual([]);
  });

  it("возвращает только токены в пределах радиуса, кастера не включает", () => {
    const caster = token("caster", { x: 0 });
    const near   = token("near",   { x: 300 });  // 3 клетки × 2м = 6м
    const far    = token("far",    { x: 1000 }); // 10 клеток × 2м = 20м
    const sc = scene([caster, near, far]);
    caster.parent = sc; near.parent = sc; far.parent = sc;

    const result = tokensWithinRadius(caster, 10);
    expect(result.map(t => t.id)).toEqual(["near"]);
  });

  it("includeSelf:true включает кастера с дистанцией 0", () => {
    const caster = token("caster");
    const sc = scene([caster]);
    caster.parent = sc;
    expect(tokensWithinRadius(caster, 0, { includeSelf: true }).map(t => t.id)).toEqual(["caster"]);
    expect(tokensWithinRadius(caster, 0).map(t => t.id)).toEqual([]);
  });

  it("actorType фильтрует по типу актора", () => {
    const caster = token("caster");
    const veh    = token("veh", { actorType: "vehicle" });
    const npc    = token("npc", { actorType: "character" });
    const sc = scene([caster, veh, npc]);
    caster.parent = sc; veh.parent = sc; npc.parent = sc;

    expect(tokensWithinRadius(caster, 10, { actorType: "vehicle" }).map(t => t.id)).toEqual(["veh"]);
  });

  it("скрытые токены исключены по умолчанию, includeHidden их возвращает", () => {
    const caster = token("caster");
    const hidden = token("hidden", { hidden: true });
    const sc = scene([caster, hidden]);
    caster.parent = sc; hidden.parent = sc;

    expect(tokensWithinRadius(caster, 10).map(t => t.id)).toEqual([]);
    expect(tokensWithinRadius(caster, 10, { includeHidden: true }).map(t => t.id)).toEqual(["hidden"]);
  });

  it("токены без актора игнорируются", () => {
    const caster = token("caster");
    const noActor = { id: "noActor", x: 0, y: 0, width: 1, height: 1, hidden: false, actor: null };
    const sc = scene([caster, noActor]);
    caster.parent = sc; noActor.parent = sc;

    expect(tokensWithinRadius(caster, 10).map(t => t.id)).toEqual([]);
  });
});
