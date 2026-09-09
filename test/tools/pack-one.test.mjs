// test/tools/pack-one.test.mjs
//
// tools/_pack-one.mjs пересобирает ОДИН пак и после этого дописывает в
// отметку синхронизации (tools/pack-stamp.mjs) свежий отпечаток именно этого
// пака, не трогая записи остальных (wdbc-tn92). Без этого следующая общая
// сборка (tools/pack.mjs) сравнивала бы свежепересобранную базу со старым
// отпечатком и ложно объявляла «в компендиумах есть правки» — хотя в игре
// никто ничего не правил, просто пересобрали один пак руками.
//
// Здесь проверяется только чистая часть решения — stampAfterPackBuild: что
// именно писать в отметку и когда писать нельзя вовсе. Файловая система и
// настоящая LevelDB не участвуют.

import { describe, it, expect } from "vitest";
import { stampAfterPackBuild } from "../../tools/_pack-one.mjs";
import { FINGERPRINT_VERSION } from "../../tools/pack-fingerprint.mjs";

/** Готовый отпечаток после успешной пересборки — обычный случай. */
const okFp = (fingerprint = "abc123") => ({ fingerprint, busy: false, missing: false });

describe("stampAfterPackBuild — отметка после точечной пересборки одного пака", () => {
  it("отметки нет вовсе — писать точечно некуда, отметку не трогаем", () => {
    const decision = stampAfterPackBuild(null, "mutations", okFp());
    expect(decision.action).toBe("skip");
    expect(decision.reason).toMatch(/отметки .* нет/);
  });

  it("отметка в старом формате (простая строка времени) — дописать один ключ некуда", () => {
    const oldStamp = Date.parse("2026-08-17T12:00:00Z");
    const decision = stampAfterPackBuild(oldStamp, "mutations", okFp());
    expect(decision.action).toBe("skip");
    expect(decision.reason).toMatch(/старом формате/);
  });

  it("версия отпечатка в отметке не совпадает с текущей — сравнивать не с чем", () => {
    const stamp = { when: Date.now(), fpVersion: FINGERPRINT_VERSION - 1, packs: { gear: "старый-отпечаток" } };
    const decision = stampAfterPackBuild(stamp, "mutations", okFp());
    expect(decision.action).toBe("skip");
    expect(decision.reason).toMatch(/другой версией отпечатка/);
    expect(decision.reason).toContain(String(FINGERPRINT_VERSION - 1));
    expect(decision.reason).toContain(String(FINGERPRINT_VERSION));
  });

  it("база пака занята (мир открыт) — отпечаток нечитаем, отметку не трогаем", () => {
    const stamp = { when: Date.now(), fpVersion: FINGERPRINT_VERSION, packs: {} };
    const decision = stampAfterPackBuild(stamp, "mutations", { fingerprint: null, busy: true, missing: false });
    expect(decision.action).toBe("skip");
    expect(decision.reason).toMatch(/занята/);
  });

  it("отпечаток почему-то не посчитался, хотя база не занята — тоже не пишем", () => {
    const stamp = { when: Date.now(), fpVersion: FINGERPRINT_VERSION, packs: {} };
    const decision = stampAfterPackBuild(stamp, "mutations", { fingerprint: null, busy: false, missing: false });
    expect(decision.action).toBe("skip");
    expect(decision.reason).toMatch(/не удалось посчитать/);
  });

  it("обычный случай — переписывается ровно один ключ, чужие остаются как были", () => {
    const stamp = {
      when: Date.parse("2026-09-07T10:00:00Z"),
      fpVersion: FINGERPRINT_VERSION,
      packs: { gear: "отпечаток-gear", weapons: "отпечаток-weapons", mutations: "старый-отпечаток-mutations" }
    };
    const decision = stampAfterPackBuild(stamp, "mutations", okFp("новый-отпечаток-mutations"));
    expect(decision.action).toBe("write");
    expect(decision.packs).toEqual({
      gear: "отпечаток-gear",
      weapons: "отпечаток-weapons",
      mutations: "новый-отпечаток-mutations"
    });
  });

  it("пака ещё не было в отметке (первая точечная сборка после появления пака) — ключ добавляется", () => {
    const stamp = { when: Date.now(), fpVersion: FINGERPRINT_VERSION, packs: { gear: "отпечаток-gear" } };
    const decision = stampAfterPackBuild(stamp, "новый-пак", okFp("свежий-отпечаток"));
    expect(decision.action).toBe("write");
    expect(decision.packs).toEqual({ gear: "отпечаток-gear", "новый-пак": "свежий-отпечаток" });
  });

  it("отметка нового формата, но packs пуст или отсутствует — не падаем, пишем с нуля", () => {
    const stamp = { when: Date.now(), fpVersion: FINGERPRINT_VERSION, packs: {} };
    const decision = stampAfterPackBuild(stamp, "mutations", okFp("отпечаток"));
    expect(decision.action).toBe("write");
    expect(decision.packs).toEqual({ mutations: "отпечаток" });
  });
});
