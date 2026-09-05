import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { JOURNAL_PACKS, LIBRARY_PACKS, SRC_ROOT, abs } from "../../tools/packs.mjs";
import { PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

// Сборка релиза берёт содержимое компендиумов из packs-src/. Пак, объявленный
// в system.json, но без исходника, соберётся пустым, и потеря заметится только
// в игре. Здесь проверяется, что список паков и список исходников совпадают.

/** Число JSON-документов в папке пака. Файлы не разбираются: проверка дешёвая. */
function countDocs(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!e.isDirectory() && e.name.endsWith(".json") && e.name !== "_Folder.json") n++;
  }
  return n;
}

describe("исходники паков-библиотек", () => {
  it.each(LIBRARY_PACKS.map(p => [p.name, p]))("%s: JSON на месте и не пуст", (_name, pack) => {
    expect(existsSync(abs(pack.src))).toBe(true);
    expect(countDocs(abs(pack.src))).toBeGreaterThan(0);
  });

  it("лишних папок в packs-src нет", () => {
    const known = new Set([...LIBRARY_PACKS.map(p => p.name), "books"]);
    const orphans = readdirSync(abs(SRC_ROOT), { withFileTypes: true })
      .filter(d => d.isDirectory() && !known.has(d.name))
      .map(d => d.name);
    expect(orphans).toEqual([]);
  });
});

// Двупрофильный предмет — носитель (снаряжение, инструмент, имплант) со ссылкой
// `linkedWeapon` на своё оружие: хук createItem в warhammer-dbc.mjs заводит по
// ней пару. Ссылка живёт только в packs-src (wdbc-ff4.8), запасного поиска по
// библиотекам констант больше нет — значит, битая ссылка молча оставит игрока
// без боевого профиля и предупреждением в чате.
describe("двупрофильные предметы", () => {
  /**
   * Имена оружия и ссылки linkedWeapon по всем документам паков.
   *
   * Раньше здесь был единый byName: имя → тип (последний документ с этим
   * именем выигрывал слот). Носитель и его боевой профиль иногда специально
   * называются одинаково (Икона Хаоса, Нуль Жезл, Возвышенная Икона, Force
   * Rod) — оба документа с этим именем существуют законно, просто в разных
   * паках. При таком совпадении byName.get(name) отдавал тип ПОСЛЕДНЕГО
   * обработанного пака, а не именно "weapon", и ссылка ложно считалась
   * битой. Рантайм (_twinLookup в warhammer-dbc.mjs) ищет только в паке
   * warhammer-dbc.weapons — здесь проверка повторяет ровно эту область
   * поиска, а не общий неймспейс по всем паками.
   */
  function packIndex() {
    const weaponNames = new Set();
    const links = [];
    for (const pack of LIBRARY_PACKS) {
      const dir = abs(pack.src);
      if (!existsSync(dir)) continue;
      for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
        if (e.isDirectory() || !e.name.endsWith(".json") || e.name.startsWith("_")) continue;
        const doc = JSON.parse(readFileSync(join(e.parentPath ?? e.path, e.name), "utf8"));
        if (doc.type === "weapon") weaponNames.add(doc.name);
        if (doc.system?.linkedWeapon) links.push({ name: doc.name, link: doc.system.linkedWeapon });
      }
    }
    return { weaponNames, links };
  }

  // Таймаут увеличен: полный обход packs-src подрос (flags.autoanimations на
  // Оружии), под нагрузкой всего суйта иногда не укладывался в дефолтные 5с
  // при заведомо валидном ~1.1с сольно.
  it("каждая ссылка на боевой профиль ведёт к оружию из паков", () => {
    const { weaponNames, links } = packIndex();
    expect(links.length).toBeGreaterThan(0);
    const broken = links.filter(l => !weaponNames.has(l.link));
    expect(broken).toEqual([]);
  }, 15000);
});

describe("исходники книг", () => {
  it.each(JOURNAL_PACKS.map(b => [b.slug, b]))("%s: объявлен паком и имеет JSON", (_slug, book) => {
    expect(book.type).toBe("JournalEntry");
    expect(existsSync(abs(`${SRC_ROOT}/books/${book.slug}.json`))).toBe(true);
  }, PACK_SCAN_TIMEOUT);
});

// CI гоняет круговорот сборка → извлечение и падает при расхождении, поэтому
// исходники обязаны быть байт-в-байт тем, что пишут инструменты. Дважды
// расходились молча: файл, положенный руками или скриптом, оставался без
// концевого перевода строки (`extractPack` в CLI пишет `JSON.stringify(...) + "\n"`,
// его же теперь пишут книги в tools/unpack.mjs), а имя файла не совпадало с тем,
// как его назвал бы `transformName` — тогда извлечение удаляло старый файл и
// заводило рядом такой же под своим именем.
describe("формат исходников паков", () => {
  /** Все JSON паков-библиотек: путь + содержимое. */
  function sourceFiles() {
    const out = [];
    for (const pack of LIBRARY_PACKS) {
      const dir = abs(pack.src);
      if (!existsSync(dir)) continue;
      for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
        if (e.isDirectory() || !e.name.endsWith(".json")) continue;
        const file = join(e.parentPath ?? e.path, e.name);
        out.push({ pack: pack.name, file, name: e.name, text: readFileSync(file, "utf8") });
      }
    }
    return out;
  }

  const FILES = sourceFiles();
  // Правила имени — те же, что у tools/unpack.mjs: CLI оставляет в имени только
  // буквы и цифры, а длину режет ради лимита пути Windows.
  const safe = (name) => String(name).replace(/[^a-zA-Z0-9А-я]/g, "_");
  const NAME_LIMIT = 40;

  it("исходники вообще найдены", () => {
    expect(FILES.length).toBeGreaterThan(1000);
  });

  it("каждый файл заканчивается ровно одним переводом строки", () => {
    const broken = FILES
      .filter(f => !f.text.endsWith("\n") || f.text.endsWith("\n\n"))
      .map(f => f.file);
    expect(broken).toEqual([]);
  });

  it("имя файла — то, которым его назовёт извлечение", () => {
    const wrong = [];
    for (const f of FILES) {
      if (f.name === "_Folder.json") continue;
      const doc = JSON.parse(f.text);
      const expected = doc.name ? `${safe(doc.name).slice(0, NAME_LIMIT)}_${doc._id}.json` : `${doc._id}.json`;
      if (f.name !== expected) wrong.push(`${f.name} → ожидалось ${expected}`);
    }
    expect(wrong).toEqual([]);
  });
});
