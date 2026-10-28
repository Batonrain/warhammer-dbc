// test/combat/token-teleport.test.mjs
//
// Телепорт токена своей способностью (Sahara task-bbe1): Тень, Туманоходец, Туманный Прыжок.
// Токен двигается через TokenDocument#move с action «blink» (телепорт ядра: лимит пути его не
// считает, СТЕНЫ ядро проверяет). Форма move — как у ядра: Promise<boolean>, false и при отказе,
// и при остановке стеной на полпути; различаем по положению токена.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { pickTeleportPoint, teleportToken } from "../../module/combat/token-teleport.mjs";

function makeTokenDoc({ x = 0, y = 0, result = true, stopAt = null } = {}) {
  const doc = {
    x, y, width: 1, height: 1, calls: [],
    move: async (destination, options) => {
      doc.calls.push({ destination, options });
      if (stopAt !== null) { doc.x = stopAt; return false; } // стена
      if (result) { doc.x = destination.x; doc.y = destination.y; }
      return result;
    }
  };
  return doc;
}

beforeEach(() => { globalThis.canvas = { ready: true, grid: { size: 100 } }; });
afterEach(() => { delete globalThis.canvas; });

describe("teleportToken", () => {
  it("в пределах дальности: токен встаёт центром в точку, action blink, без флага принудительного", async () => {
    const tok = makeTokenDoc();
    const res = await teleportToken(tok, { x: 550, y: 50 }, { maxMeters: 10 }); // центр токена (50,50): 5 м
    expect(res).toMatchObject({ ok: true, stopped: false, requestedMeters: 5, movedMeters: 5 });
    expect(tok.calls[0].destination).toEqual({ x: 500, y: 0, action: "blink" });
    expect(tok.calls[0].options.whDBC?.forcedMove).toBeUndefined();
  });

  it("дальше maxMeters — отказ без движения", async () => {
    const tok = makeTokenDoc();
    const res = await teleportToken(tok, { x: 2050, y: 50 }, { maxMeters: 10 });
    expect(res).toMatchObject({ ok: false, reason: "farther", requestedMeters: 20 });
    expect(tok.calls).toHaveLength(0);
  });

  it("ядро отклонило перемещение (токен не сдвинулся) — refused", async () => {
    const tok = makeTokenDoc({ result: false });
    expect(await teleportToken(tok, { x: 550, y: 50 })).toMatchObject({ ok: false, reason: "refused" });
  });

  it("стена на пути: move вернул false, но токен сдвинулся — ok и stopped с реальной дистанцией", async () => {
    const tok = makeTokenDoc({ stopAt: 300 });
    const res = await teleportToken(tok, { x: 1050, y: 50 });
    expect(res).toMatchObject({ ok: true, stopped: true, requestedMeters: 10, movedMeters: 3 });
  });

  it("walls:false — сквозь стены (action displace)", async () => {
    const tok = makeTokenDoc();
    await teleportToken(tok, { x: 550, y: 50 }, { walls: false });
    expect(tok.calls[0].destination.action).toBe("displace");
  });
});

describe("pickTeleportPoint", () => {
  it("нет холста или отмена размещения — null; иначе точка, временный регион удалён", async () => {
    globalThis.canvas = { ready: false };
    expect(await pickTeleportPoint()).toBeNull();
    globalThis.canvas = { ready: true, regions: { placeRegion: async () => null } };
    expect(await pickTeleportPoint()).toBeNull();
    let deleted = false;
    globalThis.canvas = { ready: true, regions: { placeRegion: async () => ({ shapes: [{ x: 7, y: 9 }], delete: async () => { deleted = true; } }) } };
    expect(await pickTeleportPoint()).toEqual({ x: 7, y: 9 });
    expect(deleted).toBe(true);
  });
});
