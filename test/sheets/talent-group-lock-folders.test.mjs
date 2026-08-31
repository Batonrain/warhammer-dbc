// test/sheets/talent-group-lock-folders.test.mjs
//
// talentGroupLock (module/sheets/item-picker.mjs, wdbc-sauo) гейтит папки
// компендиума Талантов по СТРОКАМ их имён — переименование папки в паке молча
// снимает замок (гейт просто перестаёт совпадать и падает в «открыто» через
// финальный `return null`), а опечатка в этом файле молча не гейтит вовсе.
// Здесь оба пака-источника Талантов (module/constants/library-packs.mjs,
// TALENT_LIB_PACKS) сверяются с полным списком (parent, folderName), который
// знает talentGroupLock — если реальная папка исчезнет или переименуется,
// тест покраснеет раньше, чем это заметят в игре.

import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { abs, SRC_ROOT } from "../../tools/packs.mjs";
import { TALENT_LIB_PACKS } from "../../module/constants/library-packs.mjs";

/** Пак-имя ("warhammer-dbc.talents") → папка исходников ("packs-src/talents"). */
const srcOf = pack => `${SRC_ROOT}/${pack.split(".")[1]}`;

/**
 * Все папки одного пака: id → { name, parentId }. Собирается прямым обходом
 * `_Folder.json` — тем же файлом, которым Foundry описывает саму папку
 * компендиума (module/sheets/item-picker.mjs получает то же дерево из
 * живого пака, здесь оно читается из исходника, минуя сборку).
 */
function foldersOf(pack) {
  const dir = abs(srcOf(pack));
  const byId = new Map();
  if (!existsSync(dir)) return byId;
  for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isDirectory() || e.name !== "_Folder.json") continue;
    const doc = JSON.parse(readFileSync(join(e.parentPath ?? e.path, e.name), "utf8"));
    byId.set(doc._id, { name: doc.name, parentId: doc.folder || null });
  }
  return byId;
}

/** Имя родителя папки, "" для папки верхнего уровня — как parent у talentGroupLock. */
const parentNameOf = (byId, folder) => {
  if (!folder.parentId) return "";
  return byId.get(folder.parentId)?.name ?? "";
};

/** {parent, name} по всем папкам всех паков Талантов разом. */
function allFolders() {
  const out = [];
  for (const pack of TALENT_LIB_PACKS) {
    const byId = foldersOf(pack);
    for (const folder of byId.values()) out.push({ parent: parentNameOf(byId, folder), name: folder.name });
  }
  return out;
}

const FOLDERS = allFolders();
const has = (parent, name) => FOLDERS.some(f => f.parent === parent && f.name === name);
const hasPrefix = (parent, prefix) => FOLDERS.some(f => f.parent === parent && f.name.startsWith(prefix));

// Точные (parent, folderName), которые talentGroupLock сравнивает `===`.
// «Элитные архетипы» и «Таланты одержимых» сюда не входят: там folderName —
// переменная часть (имя архетипа/группы Даров), а не константа этого файла.
const EXACT = [
  ["Книга Пустоты", "Ген навигатора"],
  ["Таланты Астартес", "Повелители Ночи"],
  ["Книга Пустоты", "Псайкер"],
  ["", "Друкхари"],
  ["", "Азуриани"],
  ["", "Иннари"],
  ["", "Псайкана"],
  ["", "Скитарии"],
  ["", "Таланты Боли"],
  ["", "Механикум"],
  ["", "Техномистик"],
  ["", "Геносемя"],
  ["", "Дредноуты"]
];

// Родительские папки, у которых сама talentGroupLock проверяет только
// `parent === X`, а не конкретное имя подпапки.
const PARENTS = ["Книга Пустоты", "Таланты Астартес", "Элитные архетипы", "Таланты одержимых"];

// Гейты по префиксу (folderName.startsWith(...)) — под каждым может быть
// несколько подпапок сразу (по одной на аспект/архетип).
const PREFIXES = [["", "Экзодиты — "], ["", "Арлекины — "]];

// Известный пробел контента, а не баг кода: раса заведена
// (module/constants/races.mjs), но своя папка Талантов Иннари в паке ещё не
// создана — talentGroupLock для неё сейчас недостижимо-открыт (см. финальный
// `return null`), потому что реальной папки с таким именем нет вовсе. Список
// снят при ревизии wdbc-sauo (31.08.2026); как только папка появится в паке,
// эту строку убрать — тест сам подтвердит совпадение.
const KNOWN_MISSING_EXACT = new Set(["|Иннари"]);
const KNOWN_MISSING_PREFIX = new Set(["|Экзодиты — "]);

describe("папки Талантов из talentGroupLock существуют в паке (wdbc-sauo)", () => {
  it("паки Талантов вообще прочитаны", () => {
    expect(FOLDERS.length).toBeGreaterThan(20);
  });

  it.each(EXACT)("«%s» → «%s»", (parent, name) => {
    if (KNOWN_MISSING_EXACT.has(`${parent}|${name}`)) {
      expect(has(parent, name)).toBe(false); // документированный пробел, не тест кода
      return;
    }
    expect(has(parent, name)).toBe(true);
  });

  it.each(PARENTS)("родительская папка «%s» существует", parent => {
    expect(FOLDERS.some(f => f.name === parent)).toBe(true);
  });

  it.each(PREFIXES)("хотя бы одна папка «%s» + «%s…»", (parent, prefix) => {
    if (KNOWN_MISSING_PREFIX.has(`${parent}|${prefix}`)) {
      expect(hasPrefix(parent, prefix)).toBe(false); // документированный пробел, не тест кода
      return;
    }
    expect(hasPrefix(parent, prefix)).toBe(true);
  });
});
