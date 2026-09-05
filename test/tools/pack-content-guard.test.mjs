// test/tools/pack-content-guard.test.mjs
//
// Сторож ручных правок компендиумов смотрит на СОДЕРЖИМОЕ, а не на дату
// файлов (wdbc-1c10).
//
// Что было. Сторож считал пак изменённым, если mtime его файлов данных новее
// отметки последней синхронизации. Но classic-level переписывает .ldb при
// открытии базы (уплотнение), не меняя ни одного документа — а мир открывает
// все паки на чтение при каждом запуске. В результате гейт packs:build
// краснел ПОСЛЕ КАЖДОГО ОТКРЫТИЯ МИРА, то есть ровно тогда, когда он нужнее
// всего: после того, как в мире что-то делали руками.
//
// Проверено 05.09.2026 трижды: все 18 «изменённых» паков менялись в окне 1–4
// секунды (момент открытия мира), а полное извлечение давало НОЛЬ изменений в
// packs-src — то есть правок не было ни одной.
//
// Что стало. Дата файлов осталась быстрым предфильтром «стоит ли вообще
// смотреть», а решение принимает отпечаток содержимого: пак объявляется
// изменённым, только если его отпечаток разошёлся с записанным при последней
// синхронизации. Отпечаток не зависит от того, как LevelDB разложил байты по
// файлам — он считается по документам.

import { describe, it, expect } from "vitest";
import { packsChangedSince } from "../../tools/pack-stamp.mjs";
import { fingerprintOf } from "../../tools/pack-fingerprint.mjs";

const STAMP = Date.parse("2026-08-17T12:00:00Z");
const минуту = 60_000;

/** Пак: имя, время последней записи в базу, отпечаток её содержимого. */
const pack = (name, mtimeMs, fingerprint) => ({ name, mtimeMs, fingerprint });

describe("отпечаток содержимого пака", () => {
  it("одинаковые документы — одинаковый отпечаток, порядок ключей не важен", () => {
    // LevelDB отдаёт ключи в своём порядке, и он может смениться после
    // уплотнения. Отпечаток обязан это переживать.
    const a = fingerprintOf([["!items!b", { name: "Меч" }], ["!items!a", { name: "Щит" }]]);
    const b = fingerprintOf([["!items!a", { name: "Щит" }], ["!items!b", { name: "Меч" }]]);
    expect(a).toBe(b);
  });

  it("изменённое поле документа меняет отпечаток", () => {
    const before = fingerprintOf([["!items!a", { name: "Меч", system: { damage: "1d10" } }]]);
    const after = fingerprintOf([["!items!a", { name: "Меч", system: { damage: "2d10" } }]]);
    expect(after).not.toBe(before);
  });

  it("добавленный документ меняет отпечаток", () => {
    const before = fingerprintOf([["!items!a", { name: "Меч" }]]);
    const after = fingerprintOf([["!items!a", { name: "Меч" }], ["!items!b", { name: "Щит" }]]);
    expect(after).not.toBe(before);
  });

  it("удалённый документ меняет отпечаток", () => {
    const before = fingerprintOf([["!items!a", { name: "Меч" }], ["!items!b", { name: "Щит" }]]);
    const after = fingerprintOf([["!items!a", { name: "Меч" }]]);
    expect(after).not.toBe(before);
  });

  it("пустой пак даёт устойчивый отпечаток, а не пустую строку", () => {
    expect(fingerprintOf([])).toBe(fingerprintOf([]));
    expect(fingerprintOf([])).toMatch(/^[0-9a-f]{8,}$/);
  });
});

describe("решение сторожа", () => {
  it("дата новее, а содержимое то же — НЕ правка (мир просто открывали)", () => {
    const same = fingerprintOf([["!items!a", { name: "Меч" }]]);
    expect(packsChangedSince(
      { when: STAMP, packs: { gear: same } },
      [pack("gear", STAMP + минуту, same)]
    )).toEqual([]);
  });

  it("дата новее и содержимое разошлось — правка, сборку останавливаем", () => {
    const before = fingerprintOf([["!items!a", { name: "Меч" }]]);
    const after = fingerprintOf([["!items!a", { name: "Меч-2" }]]);
    expect(packsChangedSince(
      { when: STAMP, packs: { gear: before } },
      [pack("gear", STAMP + минуту, after)]
    )).toEqual(["gear"]);
  });

  it("дата НЕ новее — содержимое даже не смотрим", () => {
    // Предфильтр по дате остаётся: читать 53 базы на каждую сборку незачем.
    expect(packsChangedSince(
      { when: STAMP, packs: { gear: "старый" } },
      [pack("gear", STAMP - минуту, "совсем другой")]
    )).toEqual([]);
  });

  it("отпечатка на пак ещё нет — верим дате, как раньше", () => {
    // Первая сборка после обновления инструмента: отпечатков в отметке нет,
    // и молча пропускать правку нельзя.
    expect(packsChangedSince(
      { when: STAMP, packs: {} },
      [pack("gear", STAMP + минуту, "какой-то")]
    )).toEqual(["gear"]);
  });

  it("отпечаток пака не посчитан — тоже верим дате", () => {
    // База не открылась (занята миром) — судить о содержимом нечем.
    expect(packsChangedSince(
      { when: STAMP, packs: { gear: "старый" } },
      [pack("gear", STAMP + минуту, null)]
    )).toEqual(["gear"]);
  });

  it("старая отметка одним числом понимается по-прежнему", () => {
    // Отметки на машинах разработчиков уже лежат в старом формате — простой
    // строкой времени. Обновление инструмента не должно требовать пересборки.
    expect(packsChangedSince(STAMP, [pack("gear", STAMP + минуту, "неважно")])).toEqual(["gear"]);
    expect(packsChangedSince(STAMP, [pack("gear", STAMP - минуту, "неважно")])).toEqual([]);
  });

  it("отметки нет вовсе — первая сборка на машине, жаловаться не на что", () => {
    expect(packsChangedSince(null, [pack("gear", Date.now(), "что-то")])).toEqual([]);
  });

  it("допуск в секунду сохранён — собственная запись сборки не считается правкой", () => {
    expect(packsChangedSince(
      { when: STAMP, packs: {} },
      [pack("gear", STAMP + 300, "x")]
    )).toEqual([]);
  });
});
