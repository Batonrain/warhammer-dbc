// test/tools/pack-stamp.test.mjs
//
// Сторож ручных правок компендиумов. Сборка сносит базу пака целиком, поэтому
// всё, что правили прямо в Foundry и не сняли в исходники, она потеряла бы
// молча — со стороны это выглядит как «компендиум откатился сам».
//
// Обе команды (сборка и извлечение) оставляют отметку времени, а сборка перед
// работой сверяется с ней. Проверяется именно сравнение: работа с файлами
// вынесена наружу, чтобы правило читалось без файловой системы.

import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../tools/packs.mjs";
import { packsChangedSince, latestDbChange, STAMP_FILE } from "../../tools/pack-stamp.mjs";

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

describe("latestDbChange — только настоящая запись в базу", () => {
  const DIR = "test/tools/.tmp-latest-db-change";
  const abs = (name) => join(ROOT, DIR, name);
  const touch = (name, mtimeMs) => {
    writeFileSync(abs(name), "");
    const t = mtimeMs / 1000;
    utimesSync(abs(name), t, t);
  };

  afterEach(() => rmSync(join(ROOT, DIR), { recursive: true, force: true }));

  it("пака нет вовсе — 0, собирать нечего", () => {
    expect(latestDbChange(DIR)).toBe(0);
  });

  // Просто открытие мира в Foundry трогает служебные файлы LevelDB
  // (LOG, MANIFEST-*, CURRENT, пустой текущий .log) у каждого загруженного
  // пака, даже если внутри ничего не редактировали — это не должно читаться
  // как правка.
  it("служебные файлы LevelDB без .ldb не считаются правкой", () => {
    mkdirSync(join(ROOT, DIR), { recursive: true });
    const old = Date.parse("2026-08-01T00:00:00Z");
    const now = Date.parse("2026-08-24T00:00:00Z");
    touch("000005.ldb", old);
    touch("LOG", now);
    touch("LOG.old", now);
    touch("MANIFEST-000004", now);
    touch("CURRENT", now);
    touch("000006.log", now); // пустой текущий журнал — тоже служебный
    expect(latestDbChange(DIR)).toBe(old);
  });

  it("новый или переписанный .ldb — настоящая запись", () => {
    mkdirSync(join(ROOT, DIR), { recursive: true });
    const old = Date.parse("2026-08-01T00:00:00Z");
    const written = Date.parse("2026-08-24T00:00:00Z");
    touch("000005.ldb", old);
    touch("LOG", old);
    touch("000007.ldb", written);
    expect(latestDbChange(DIR)).toBe(written);
  });

  // classic-level пишет документ в memtable + WAL, а в .ldb сбрасывает только
  // при переполнении write-buffer или при следующем открытии базы. «Поправил
  // пару предметов → выключил Foundry → сборка» оставляет правку ТОЛЬКО в
  // непустом NNNNNN.log — фильтр по одним .ldb молча терял бы её.
  it("непустой текущий журнал — несброшенная правка, а не служебный файл", () => {
    mkdirSync(join(ROOT, DIR), { recursive: true });
    const old = Date.parse("2026-08-01T00:00:00Z");
    const edited = Date.parse("2026-08-24T00:00:00Z");
    touch("000005.ldb", old);
    writeFileSync(abs("000006.log"), "данные несброшенной записи");
    const t = edited / 1000;
    utimesSync(abs("000006.log"), t, t);
    expect(latestDbChange(DIR)).toBe(edited);
  });

  it("пак, живущий одним журналом без .ldb, тоже виден сторожу", () => {
    mkdirSync(join(ROOT, DIR), { recursive: true });
    const edited = Date.parse("2026-08-24T00:00:00Z");
    writeFileSync(abs("000003.log"), "данные");
    const t = edited / 1000;
    utimesSync(abs("000003.log"), t, t);
    expect(latestDbChange(DIR)).toBe(edited);
  });
});
