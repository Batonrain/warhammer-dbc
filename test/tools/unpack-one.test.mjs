// test/tools/unpack-one.test.mjs
//
// tools/_unpack-one.mjs снимает правки ОДНОГО пака из LevelDB в packs-src.
// Извлечение не меняет саму базу, поэтому её отпечаток остаётся прежним — но
// именно ЭТИМ отпечатком нужно обновить отметку синхронизации
// (tools/pack-stamp.mjs), иначе следующая общая сборка сравнит базу со
// СТАРЫМ отпечатком (записанным до правок, которые здесь как раз сняли в
// исходники) и снова потребует unpack — хотя он уже сделан (wdbc-tn92,
// симметрично tools/_pack-one.mjs).
//
// Здесь проверяется только чистая часть решения — stampAfterPackUnpack: что
// именно писать в отметку и когда писать нельзя вовсе. Файловая система и
// настоящая LevelDB не участвуют.

import { describe, it, expect } from "vitest";
import { stampAfterPackUnpack } from "../../tools/_unpack-one.mjs";
import { FINGERPRINT_VERSION } from "../../tools/pack-fingerprint.mjs";

const okFp = (fingerprint = "abc123") => ({ fingerprint, busy: false, missing: false });

describe("stampAfterPackUnpack — отметка после точечного извлечения одного пака", () => {
  it("отметки нет вовсе — писать точечно некуда, отметку не трогаем", () => {
    const decision = stampAfterPackUnpack(null, "mutations", okFp());
    expect(decision.action).toBe("skip");
    expect(decision.reason).toMatch(/отметки .* нет/);
  });

  it("отметка в старом формате (простая строка времени) — дописать один ключ некуда", () => {
    const oldStamp = Date.parse("2026-08-17T12:00:00Z");
    const decision = stampAfterPackUnpack(oldStamp, "mutations", okFp());
    expect(decision.action).toBe("skip");
    expect(decision.reason).toMatch(/старом формате/);
  });

  it("версия отпечатка в отметке не совпадает с текущей — сравнивать не с чем", () => {
    const stamp = { when: Date.now(), fpVersion: FINGERPRINT_VERSION - 1, packs: { gear: "старый-отпечаток" } };
    const decision = stampAfterPackUnpack(stamp, "mutations", okFp());
    expect(decision.action).toBe("skip");
    expect(decision.reason).toMatch(/другой версией отпечатка/);
  });

  it("база пака занята (мир открыт) — отпечаток нечитаем, отметку не трогаем", () => {
    const stamp = { when: Date.now(), fpVersion: FINGERPRINT_VERSION, packs: {} };
    const decision = stampAfterPackUnpack(stamp, "mutations", { fingerprint: null, busy: true, missing: false });
    expect(decision.action).toBe("skip");
    expect(decision.reason).toMatch(/занята/);
  });

  it("отпечаток не посчитался, хотя база не занята — тоже не пишем", () => {
    const stamp = { when: Date.now(), fpVersion: FINGERPRINT_VERSION, packs: {} };
    const decision = stampAfterPackUnpack(stamp, "mutations", { fingerprint: null, busy: false, missing: false });
    expect(decision.action).toBe("skip");
    expect(decision.reason).toMatch(/не удалось посчитать/);
  });

  it("обычный случай — переписывается ровно один ключ, чужие остаются как были", () => {
    const stamp = {
      when: Date.parse("2026-09-07T10:00:00Z"),
      fpVersion: FINGERPRINT_VERSION,
      packs: { gear: "отпечаток-gear", weapons: "отпечаток-weapons", mutations: "отпечаток-до-правки-в-игре" }
    };
    // Извлечение не меняет базу — сюда приходит её ТЕКУЩИЙ отпечаток, который
    // теперь и стал новым отпечатком синхронизированного состояния.
    const decision = stampAfterPackUnpack(stamp, "mutations", okFp("отпечаток-после-правки-в-игре"));
    expect(decision.action).toBe("write");
    expect(decision.packs).toEqual({
      gear: "отпечаток-gear",
      weapons: "отпечаток-weapons",
      mutations: "отпечаток-после-правки-в-игре"
    });
  });

  it("отметка нового формата, но packs пуст или отсутствует — не падаем, пишем с нуля", () => {
    const stamp = { when: Date.now(), fpVersion: FINGERPRINT_VERSION, packs: {} };
    const decision = stampAfterPackUnpack(stamp, "mutations", okFp("отпечаток"));
    expect(decision.action).toBe("write");
    expect(decision.packs).toEqual({ mutations: "отпечаток" });
  });
});
