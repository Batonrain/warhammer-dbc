// test/tools/pack-fingerprint-survives-open.test.mjs
//
// Главное утверждение починки wdbc-1c10, проверенное на НАСТОЯЩЕЙ базе того же
// движка, что у Foundry: открытие базы меняет дату её файлов, но не меняет
// отпечаток содержимого.
//
// Именно на этом гейт packs:build и краснел после каждого сеанса игры. Мир
// открывает все паки на чтение при запуске, classic-level при открытии
// уплотняет базу и переписывает .ldb — а сторож смотрел на дату файлов и
// объявлял восемнадцать паков «изменёнными в игре», хотя не менялся ни один
// документ.
//
// База заводится своя, во временной папке, а не копируется из packs/: живые
// паки держит запущенный мир, и тест не должен зависеть от того, играют ли
// сейчас.

import { describe, it, expect, afterAll } from "vitest";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packFingerprint } from "../../tools/pack-fingerprint.mjs";
import { latestDbChange } from "../../tools/pack-stamp.mjs";

const tmp = mkdtempSync(join(tmpdir(), "dbc-fp-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** Заводит базу пака с парой документов — как её оставила бы сборка. */
async function makePack(dir, docs) {
  const { ClassicLevel } = await import("classic-level");
  const db = new ClassicLevel(dir, { valueEncoding: "json" });
  await db.open();
  for (const [key, value] of docs) await db.put(key, value);
  await db.close();
}

/** Ровно то, что делает мир при запуске: открыть базу и закрыть. */
async function openAndClose(dir) {
  const { ClassicLevel } = await import("classic-level");
  const db = new ClassicLevel(dir, { valueEncoding: "json" });
  await db.open();
  for await (const _ of db.keys()) { /* мир читает индекс пака */ }
  await db.close();
}

const DOCS = [
  ["!items!aaaaaaaaaaaaaaaa", { name: "Меч", type: "weapon", system: { damage: "1d10" } }],
  ["!items!bbbbbbbbbbbbbbbb", { name: "Щит", type: "armor", system: { ap: 2 } }],
  ["!folders!cccccccccccccccc", { name: "Рукопашное", type: "Item" }]
];

describe("отпечаток переживает открытие базы", () => {
  it("мир открыл пак — отпечаток тот же, дата не убывает", async () => {
    const dir = join(tmp, "pack1");
    await makePack(dir, DOCS);

    const before = await packFingerprint(dir);
    expect(before, "отпечаток свежей базы не посчитался").toBeTruthy();
    const mtimeBefore = latestDbChange(dir);

    await openAndClose(dir);

    expect(await packFingerprint(dir), "открытие базы не должно менять содержимое").toBe(before);
    // Дата — то, на что смотрел старый сторож. Уплотнение может её сдвинуть, и
    // именно этот сдвиг он принимал за правку.
    expect(latestDbChange(dir)).toBeGreaterThanOrEqual(mtimeBefore);
  });

  it("а настоящая правка в игре отпечаток меняет", async () => {
    const dir = join(tmp, "pack2");
    await makePack(dir, DOCS);
    const before = await packFingerprint(dir);

    const { ClassicLevel } = await import("classic-level");
    const db = new ClassicLevel(dir, { valueEncoding: "json" });
    await db.open();
    await db.put(DOCS[0][0], { ...DOCS[0][1], name: "Меч (переименован в игре)" });
    await db.close();

    expect(await packFingerprint(dir)).not.toBe(before);
  });

  it("удаление документа в игре тоже видно", async () => {
    const dir = join(tmp, "pack3");
    await makePack(dir, DOCS);
    const before = await packFingerprint(dir);

    const { ClassicLevel } = await import("classic-level");
    const db = new ClassicLevel(dir, { valueEncoding: "json" });
    await db.open();
    await db.del(DOCS[1][0]);
    await db.close();

    expect(await packFingerprint(dir)).not.toBe(before);
  });

  it("отсутствующая база даёт null, а не выдуманный отпечаток", async () => {
    expect(await packFingerprint(join(tmp, "нет-такой-папки"))).toBeNull();
  });

  it("папка есть, а базы в ней нет — тоже null, и база НЕ заводится", async () => {
    // Две проверки в одной. Первая: пустой отпечаток нельзя выдавать за
    // ответ — вызывающий обязан счесть пак «не проверенным» и остановиться.
    // Вторая: функция только читает. Без createIfMissing:false classic-level
    // завёл бы здесь новую пустую базу, и отпечаток пустоты выглядел бы
    // законным ответом.
    const dir = join(tmp, "не-база");
    mkdirSync(dir, { recursive: true });
    expect(await packFingerprint(dir)).toBeNull();
    // LOCK движок заводит до всякой проверки — это не данные. Важно, что не
    // появилось ни MANIFEST, ни CURRENT, ни .ldb, то есть базы не возникло.
    const created = readdirSync(dir).filter(f => f !== "LOCK");
    expect(created, "функция чтения завела базу").toEqual([]);
  });
});
