// test/migrations/char-damage-sign.test.mjs
//
// Поле charDamage сменило смысл: было «Урон в характеристику» (плюс = штраф,
// вычиталось), стало знаковым «Мод.» (прибавляется). Миграция обязана обратить
// знак сохранённых значений — иначе старый штраф 10 превращается в бонус +10 —
// и не плодить пустых обновлений там, где всё по нулям.

import { describe, it, expect, afterEach } from "vitest";
import { charDamageSignUpdate, migrateCharDamageSign } from "../../module/migrations/char-damage-sign.mjs";

describe("инверсия знака Мод. характеристик", () => {
  it("положительный штраф старого мира становится отрицательным Мод.", () => {
    expect(charDamageSignUpdate({ charDamage: { s: 10, t: 5, ws: 0 } })).toEqual({
      "system.charDamage.s": -10,
      "system.charDamage.t": -5
    });
  });

  it("нули и отсутствие поля не рождают обновления", () => {
    expect(charDamageSignUpdate({ charDamage: { s: 0, t: 0 } })).toEqual({});
    expect(charDamageSignUpdate({})).toEqual({});
  });

  it("инверсия симметрична (повторный запуск гейтится версией настройки)", () => {
    expect(charDamageSignUpdate({ charDamage: { s: -10 } })).toEqual({
      "system.charDamage.s": 10
    });
  });
});

// wdbc-059h: по образцу gear-equipped/wdbc-dyi — было один try на ВЕСЬ цикл по
// акторам, сбой на одном глушил инверсию остальным молча.
describe("migrateCharDamageSign: изоляция сбоя одного актора (wdbc-059h)", () => {
  afterEach(() => { delete globalThis.game; delete globalThis.ui; });

  function actorWith(id, system, { throwOnUpdate = false } = {}) {
    return {
      id, name: `Actor ${id}`, system,
      async update(upd) {
        if (throwOnUpdate) throw new Error(`boom on ${id}`);
        for (const [key, val] of Object.entries(upd)) {
          const path = key.split(".").slice(1); // "system.charDamage.s" → ["charDamage","s"]
          let obj = system;
          for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
          obj[path[path.length - 1]] = val;
        }
      }
    };
  }

  it("сбой на одном акторе не прерывает инверсию остальным и не топит их результат", async () => {
    const bad = actorWith("bad", { charDamage: { s: 10 } }, { throwOnUpdate: true });
    const good = actorWith("good", { charDamage: { s: 10 } });

    globalThis.game = { user: { isGM: true }, actors: [bad, good], scenes: [] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateCharDamageSign();

    expect(res.actorCount).toBe(1);
    expect(res.failed).toBe(1);
    expect(good.system.charDamage.s).toBe(-10);
    expect(bad.system.charDamage.s).toBe(10);
  });
});
