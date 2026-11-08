// test/rules/radiant-presence-sight.test.mjs
//
// Блистательное Присутствие (wdbc-051qb): «видит» по геометрии сцены — союзный
// носитель Таланта в поле зрения цели теста Морали. Чистая функция, без Foundry.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { radiantHoldersInSight } from "../../module/rules/radiant-presence-sight.mjs";

const grid = { size: 100, distance: 1 };
const tok = (id, x, { y = 0, disposition = 1, rotation = 0, angle = 360, range = 0, hidden = false } = {}) =>
  ({ id, x, y, width: 1, height: 1, elevation: 0, disposition, rotation, hidden, sight: { range, angle } });
const holder = (actorId, token, hasTalent = true) => ({ actorId, hasTalent, token });

describe("radiantHoldersInSight", () => {
  it("союзный носитель в поле зрения цели — найден", () => {
    const own = tok("t-own", 0);
    const found = radiantHoldersInSight({ ownTokens: [own], candidates: [holder("h", tok("t-h", 300))], grid });
    expect(found.map(c => c.actorId)).toEqual(["h"]);
  });

  it("нет носителей Таланта — пусто", () => {
    const own = tok("t-own", 0);
    expect(radiantHoldersInSight({ ownTokens: [own], candidates: [holder("h", tok("t-h", 300), false)], grid })).toEqual([]);
    expect(radiantHoldersInSight({ ownTokens: [own], candidates: [], grid })).toEqual([]);
    expect(radiantHoldersInSight({ ownTokens: [own], grid })).toEqual([]);
  });

  it("у цели нет токена на сцене — пусто", () => {
    expect(radiantHoldersInSight({ ownTokens: [], candidates: [holder("h", tok("t-h", 300))], grid })).toEqual([]);
  });

  it("носитель — враг цели — не считается", () => {
    const own = tok("t-own", 0);
    expect(radiantHoldersInSight({ ownTokens: [own], candidates: [holder("h", tok("t-h", 300, { disposition: -1 }))], grid })).toEqual([]);
  });

  it("нейтральный носитель считается (решение владельца: «Нейтральный или Союзник»)", () => {
    const own = tok("t-own", 0);
    expect(radiantHoldersInSight({ ownTokens: [own], candidates: [holder("h", tok("t-h", 300, { disposition: 0 }))], grid }).length).toBe(1);
    const hostileOwn = tok("t-own", 0, { disposition: -1 });
    expect(radiantHoldersInSight({ ownTokens: [hostileOwn], candidates: [holder("h", tok("t-h", 300, { disposition: -1 }))], grid }).length).toBe(1);
    expect(radiantHoldersInSight({ ownTokens: [hostileOwn], candidates: [holder("h", tok("t-h", 300, { disposition: 1 }))], grid })).toEqual([]);
  });

  it("далеко за дальностью обзора цели (30 м по умолчанию) — не виден", () => {
    const own = tok("t-own", 0);
    expect(radiantHoldersInSight({ ownTokens: [own], candidates: [holder("h", tok("t-h", 100 * 50))], grid })).toEqual([]);
  });

  it("настроенная sight.range цели короче расстояния — не виден", () => {
    const own = tok("t-own", 0, { range: 2 });
    expect(radiantHoldersInSight({ ownTokens: [own], candidates: [holder("h", tok("t-h", 500))], grid })).toEqual([]);
  });

  it("вне сектора обзора цели (взгляд на север, носитель на востоке при угле 90°) — не виден", () => {
    const own = tok("t-own", 0, { rotation: 0, angle: 90 });
    expect(radiantHoldersInSight({ ownTokens: [own], candidates: [holder("h", tok("t-h", 300))], grid })).toEqual([]);
  });

  it("в секторе обзора цели (взгляд на восток) — виден", () => {
    const own = tok("t-own", 0, { rotation: 90, angle: 90 });
    expect(radiantHoldersInSight({ ownTokens: [own], candidates: [holder("h", tok("t-h", 300))], grid }).length).toBe(1);
  });

  it("направление — цель смотрит на носителя, а не носитель на цель", () => {
    const own = tok("t-own", 0, { rotation: 90, angle: 90 });
    const h = tok("t-h", 300, { rotation: 0, angle: 90 });
    expect(radiantHoldersInSight({ ownTokens: [own], candidates: [holder("h", h)], grid }).length).toBe(1);
    const ownAway = tok("t-own", 0, { rotation: 0, angle: 90 });
    const hFacing = tok("t-h", 300, { rotation: 270, angle: 90 });
    expect(radiantHoldersInSight({ ownTokens: [ownAway], candidates: [holder("h", hFacing)], grid })).toEqual([]);
  });

  it("сам токен цели не считается носителем для себя", () => {
    const own = tok("t-own", 0);
    expect(radiantHoldersInSight({ ownTokens: [own], candidates: [holder("me", own)], grid })).toEqual([]);
  });

  it("носитель — источник самого теста («кроме вызванных самим персонажем») — не считается", () => {
    const own = tok("t-own", 0);
    const cands = [holder("source", tok("t-s", 300))];
    expect(radiantHoldersInSight({ ownTokens: [own], candidates: cands, grid, sourceActorId: "source" })).toEqual([]);
    expect(radiantHoldersInSight({ ownTokens: [own], candidates: cands, grid, sourceActorId: "other" }).length).toBe(1);
  });

  it("скрытый токен носителя — не виден", () => {
    const own = tok("t-own", 0);
    expect(radiantHoldersInSight({ ownTokens: [own], candidates: [holder("h", tok("t-h", 300, { hidden: true }))], grid })).toEqual([]);
  });

  it("у цели несколько токенов — достаточно, чтобы один видел носителя", () => {
    const far = tok("t-far", 100 * 80);
    const near = tok("t-near", 100 * 79);
    const h = tok("t-h", 100 * 80 + 200);
    expect(radiantHoldersInSight({ ownTokens: [tok("t-own", 0), far, near], candidates: [holder("h", h)], grid }).length).toBe(1);
  });
});
