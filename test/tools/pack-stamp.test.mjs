// test/tools/pack-stamp.test.mjs
//
// Сторож ручных правок компендиумов. Сборка сносит базу пака целиком, поэтому
// всё, что правили прямо в Foundry и не сняли в исходники, она потеряла бы
// молча — со стороны это выглядит как «компендиум откатился сам».
//
// Обе команды (сборка и извлечение) оставляют отметку времени, а сборка перед
// работой сверяется с ней. Проверяется именно сравнение: работа с файлами
// вынесена наружу, чтобы правило читалось без файловой системы.

import { describe, it, expect } from "vitest";
import { packsChangedSince, STAMP_FILE } from "../../tools/pack-stamp.mjs";

/** Пак с временем последней записи в его базу. */
const pack = (name, mtimeMs) => ({ name, mtimeMs });

const STAMP = Date.parse("2026-08-17T12:00:00Z");
const минуту = 60_000;

describe("сторож несохранённых правок", () => {
  it("база новее отметки — в игре правили после синхронизации", () => {
    const changed = packsChangedSince(STAMP, [
      pack("talents", STAMP + минуту),
      pack("traits",  STAMP - минуту)
    ]);
    expect(changed).toEqual(["talents"]);
  });

  it("базы старше отметки — сборке ничего не грозит", () => {
    expect(packsChangedSince(STAMP, [pack("gear", STAMP - минуту), pack("weapons", 0)])).toEqual([]);
  });

  // Собственная запись сборки не должна читаться как чужая правка: она идёт в
  // те же миллисекунды, что и отметка.
  it("допуск в секунду гасит запись самой сборки", () => {
    expect(packsChangedSince(STAMP, [pack("gear", STAMP + 300)])).toEqual([]);
    expect(packsChangedSince(STAMP, [pack("gear", STAMP + 5000)])).toEqual(["gear"]);
  });

  it("отметки ещё нет — сказать нечего, это первая сборка на машине", () => {
    expect(packsChangedSince(null, [pack("gear", Date.now())])).toEqual([]);
  });

  it("пака нет вовсе — терять нечего", () => {
    expect(packsChangedSince(STAMP, [pack("races", 0)])).toEqual([]);
  });

  // Отметка — состояние рабочей машины, а не содержимое системы: она обязана
  // лежать в packs/, который в .gitignore, иначе полезет в коммиты.
  it("отметка лежит рядом с базами, а не в исходниках", () => {
    expect(STAMP_FILE.startsWith("packs/")).toBe(true);
    expect(STAMP_FILE.includes("packs-src")).toBe(false);
  });
});
