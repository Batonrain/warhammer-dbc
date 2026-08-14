import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { JOURNAL_PACKS, LIBRARY_PACKS, SRC_ROOT, abs } from "../../tools/packs.mjs";

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
  /** Все документы паков: имя → тип. */
  function packIndex() {
    const byName = new Map();
    const links  = [];
    for (const pack of LIBRARY_PACKS) {
      const dir = abs(pack.src);
      if (!existsSync(dir)) continue;
      for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
        if (e.isDirectory() || !e.name.endsWith(".json") || e.name.startsWith("_")) continue;
        const doc = JSON.parse(readFileSync(join(e.parentPath ?? e.path, e.name), "utf8"));
        byName.set(doc.name, doc.type);
        if (doc.system?.linkedWeapon) links.push({ name: doc.name, link: doc.system.linkedWeapon });
      }
    }
    return { byName, links };
  }

  it("каждая ссылка на боевой профиль ведёт к оружию из паков", () => {
    const { byName, links } = packIndex();
    expect(links.length).toBeGreaterThan(0);
    const broken = links.filter(l => byName.get(l.link) !== "weapon");
    expect(broken).toEqual([]);
  });
});

describe("исходники книг", () => {
  it.each(JOURNAL_PACKS.map(b => [b.slug, b]))("%s: объявлен паком и имеет JSON", (_slug, book) => {
    expect(book.type).toBe("JournalEntry");
    expect(existsSync(abs(`${SRC_ROOT}/books/${book.slug}.json`))).toBe(true);
  });
});
