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
import { packFingerprint, packFingerprintInfo, fingerprintOf,
         FINGERPRINT_VERSION } from "../../tools/pack-fingerprint.mjs";
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
    // Утверждается отсутствие ДАННЫХ, а не отсутствие вообще всего.
    //
    // Первая попытка требовала «в папке нет ничего, кроме LOCK» — и уронила CI:
    // служебные файлы движок заводит ДО всякой проверки, и на разных системах
    // разные (на Windows LOCK, на Linux ещё и LOG). Перечислять их поимённо —
    // та же ловушка с отсрочкой: следующий такой файл снова покрасит CI, и
    // снова не потому, что что-то сломалось.
    //
    // База существует тогда, когда есть её ДАННЫЕ: MANIFEST, CURRENT, .ldb или
    // нумерованный журнал. Их отсутствие и есть проверяемое утверждение, и оно
    // не зависит ни от системы, ни от версии библиотеки.
    const isData = f => f === "CURRENT" || f.startsWith("MANIFEST")
      || f.endsWith(".ldb") || /^\d+\.log$/.test(f);
    const data = readdirSync(dir).filter(isData);
    expect(data, "функция чтения завела базу").toEqual([]);
  });
});

// ── wdbc-7qjg: «база занята» — это не «в игре правили» ────────────────────
//
// Сторож объявлял восемнадцать паков изменёнными каждый раз, когда мир был
// ЗАПУЩЕН: открытый мир держит LOCK, отпечаток становился нечитаем, а
// нечитаемый отпечаток означал «считать изменённым». Диагноз ложный, а совет
// («снимите правки через npm run packs:unpack») на занятой базе невыполним —
// unpack упирается в тот же LOCK.
describe("занятая база отличается от изменённой (wdbc-7qjg)", () => {
  it("пока база открыта, отпечаток не читается — и причина названа «занята»", async () => {
    const dir = join(tmp, "pack-busy");
    await makePack(dir, DOCS);
    expect((await packFingerprintInfo(dir)).fingerprint, "закрытая база должна читаться").toBeTruthy();

    const { ClassicLevel } = await import("classic-level");
    const held = new ClassicLevel(dir, { valueEncoding: "json" });
    await held.open();
    try {
      const info = await packFingerprintInfo(dir);
      expect(info.fingerprint, "занятую базу прочитать нечем").toBeNull();
      expect(info.busy, "и это должно быть названо занятостью, а не расхождением").toBe(true);
      expect(info.missing).toBe(false);
    } finally {
      await held.close();
    }
  });

  it("отсутствующая база — не «занята», а «её нет»", async () => {
    const info = await packFingerprintInfo(join(tmp, "нет-и-не-было"));
    expect(info.busy).toBe(false);
    expect(info.missing).toBe(true);
  });

  it("свободная база занятой не считается", async () => {
    const dir = join(tmp, "pack-free");
    await makePack(dir, DOCS);
    const info = await packFingerprintInfo(dir);
    expect(info.busy).toBe(false);
    expect(info.fingerprint).toBeTruthy();
  });
});

// ── wdbc-7qjg, вторая половина: служебный флаг системы — не правка автора ──
//
// Найдено 06.09.2026, когда мир наконец закрыли: сборка объявила пак
// weapon-mods отредактированным, а документ-в-документ расходился РОВНО один
// предмет и ровно тремя полями — _stats.coreVersion, _stats.modifiedTime и
// flags.warhammer-dbc.migratedEffect. Первые два отпечаток и так выбрасывал.
// Третий ставит наша же миграция (module/migrations/item-effects.mjs) каждому
// предмету при загрузке мира, в том числе внутри компендиума: документ,
// заведённый в packs-src без этого флага, получает его при первом же открытии
// мира. Автор к этому непричастен так же, как к _stats.
describe("служебные флаги системы не считаются правкой (wdbc-7qjg)", () => {
  const DOC = ["!items!dddddddddddddddd",
               { name: "Ноктиковый Щит", type: "weaponMod", system: { availability: 4 } }];

  it("дописанный migratedEffect отпечаток НЕ меняет", () => {
    const before = fingerprintOf([DOC]);
    const stamped = ["!items!dddddddddddddddd",
                     { ...DOC[1], flags: { "warhammer-dbc": { migratedEffect: true } } }];
    expect(fingerprintOf([stamped])).toBe(before);
  });

  it("а настоящий авторский флаг рядом с ним — меняет", () => {
    const stamped = ["!items!dddddddddddddddd",
                     { ...DOC[1], flags: { "warhammer-dbc": { migratedEffect: true } } }];
    const authored = ["!items!dddddddddddddddd",
                      { ...DOC[1], flags: { "warhammer-dbc": { migratedEffect: true,
                                                               mechanics: [{ id: "g" }] } } }];
    expect(fingerprintOf([authored])).not.toBe(fingerprintOf([stamped]));
  });

  it("чужие области флагов не трогаются", () => {
    const other = ["!items!dddddddddddddddd",
                   { ...DOC[1], flags: { "some-module": { migratedEffect: true } } }];
    expect(fingerprintOf([other])).not.toBe(fingerprintOf([DOC]));
  });

  it("версия алгоритма объявлена числом — по ней отметка понимает, сравнима ли она", () => {
    expect(Number.isInteger(FINGERPRINT_VERSION)).toBe(true);
    expect(FINGERPRINT_VERSION).toBeGreaterThan(1);
  });
});

// ── wdbc-1c10, третий случай: разметку таблиц достраивает сам редактор ─────
//
// 06.09.2026 сборка снова встала: четыре книги (Аэльдари, Ветви Аэльдари,
// Техника Эльдар, Некроны) объявлены изменёнными после сеанса игры. Полное
// извлечение дало 226 расхождений на 435 страницах — и ни одного
// содержательного: ProseMirror достраивает таблицу тегом <tbody> и сохраняет
// книгу такой. Происходит это при ЗАГРУЗКЕ МИРА, всей книге разом, а не при
// открытии конкретной страницы — измерено вечером того же дня, см. комментарий
// к EDITOR_WRITTEN_MARKUP в tools/pack-fingerprint.mjs.
//
// Починка подтверждена не только здесь: после настоящего сеанса игры база
// расходилась по <tbody> на 45 страницах из 84, файлы были новее отметки
// синхронизации (то есть предфильтр по дате сторож не пропустил и отпечатки
// считались по-настоящему) — и сборка прошла молча.
describe("<tbody> от редактора не считается правкой (wdbc-1c10)", () => {
  const KEY = "!journal.pages!aaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb";
  const html = "<h2>Некроны</h2><table><tr><td><p>WS</p></td></tr></table>";
  const page = content => [KEY, { name: "Скарабеи", type: "text", text: { format: 1, content } }];

  /** Ровно то, что делает редактор Foundry при открытии книги. */
  const asEditorSaves = s => s.replace(/<table>/g, "<table><tbody>")
                              .replace(/<\/table>/g, "</tbody></table>");

  it("страница после сеанса игры даёт тот же отпечаток", () => {
    const opened = asEditorSaves(html);
    expect(opened, "заготовка теста должна отличаться от исходной").not.toBe(html);
    expect(fingerprintOf([page(opened)])).toBe(fingerprintOf([page(html)]));
  });

  it("а правка текста внутри той же таблицы — видна", () => {
    const edited = asEditorSaves(html).replace("<p>WS</p>", "<p>БС</p>");
    expect(fingerprintOf([page(edited)])).not.toBe(fingerprintOf([page(html)]));
  });

  it("удаление строки таблицы тоже видно", () => {
    const cut = asEditorSaves(html).replace("<tr><td><p>WS</p></td></tr>", "");
    expect(fingerprintOf([page(cut)])).not.toBe(fingerprintOf([page(html)]));
  });

  it("поправка не трогает документы, которые не являются страницами", () => {
    // У предмета то же самое не измерено, и молчаливо слепнуть там нельзя:
    // описание с таблицей — авторское поле, а не вывод редактора книги.
    const item = c => ["!items!cccccccccccccccc",
                       { name: "Гаусс-бластер", type: "weapon", system: { description: c } }];
    expect(fingerprintOf([item(asEditorSaves(html))])).not.toBe(fingerprintOf([item(html)]));
  });
});
