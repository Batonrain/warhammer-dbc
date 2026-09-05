// test/support/pack-docs.mjs
//
// Общий разбор данных компендиумов для тестов схем: документы паков и сравнение
// значений по путям. Один набор помощников на предметы и акторов — иначе две
// копии одной проверки разъедутся при первой же правке.

import fs   from "node:fs";
import path from "node:path";

/**
 * Таймаут для проверок, идущих по ВСЕМУ packs-src (wdbc-lxyl).
 *
 * Кэш ниже снимает повторные чтения внутри одного файла, но у каждого
 * тестового файла свой процесс — первый проход всё равно читает 6774 файла с
 * диска, а это ~2.5 секунды на свободной машине и заметно больше, когда
 * параллельно работают остальные воркеры. Дефолтные 5 секунд такие проверки
 * то проходят, то нет, и красным оказывается каждый раз другой файл.
 *
 * Поднимается ТОЧЕЧНО, третьим аргументом `it`, а не глобально: глобальный
 * потолок заодно спрятал бы настоящее зависание в обычном тесте.
 */
export const PACK_SCAN_TIMEOUT = 60_000;

export const PACKS_SRC = path.resolve(import.meta.dirname, "../../packs-src");

// Кэш ТЕКСТА файлов, а не разобранных документов (wdbc-lxyl). Замер на 6774
// файлах packs-src: обход каталога 47 мс, чтение с диска 2540 мс, разбор JSON
// 93 мс. Дорог ровно ввод-вывод, и он повторялся в каждом тесте и на каждый
// вызов — отсюда «Test timed out» на файлах, которые читают паки по нескольку
// раз, причём падал каждый прогон свой (кто не успел, тот и красный).
//
// Кэшируется текст, а не готовые документы, намеренно: разбор дешёвый, зато
// каждый вызов получает СВОИ объекты. Кэшируй документы — и тест, поправивший
// у себя одно поле, тихо поменял бы данные соседнему.
const dirCache  = new Map();   // пак -> список файлов
const fileCache = new Map();   // путь -> текст

function packFiles(pack) {
  if (dirCache.has(pack)) return dirCache.get(pack);
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".json") || entry.name.startsWith("_")) continue;
      out.push(full);
    }
  };
  walk(path.join(PACKS_SRC, pack));
  dirCache.set(pack, out);
  return out;
}

/** Текст файла из кэша: тот же файл читается с диска один раз за прогон. */
export function packFileText(full) {
  if (!fileCache.has(full)) fileCache.set(full, fs.readFileSync(full, "utf8"));
  return fileCache.get(full);
}

/**
 * Пути всех .json во ВСЁМ packs-src — для проверок, которые идут по всем
 * пакам сразу (миграции, храповики согласованности). Кэш тот же.
 *
 * `includeFolders` — считать ли служебные `_Folder.json`. По умолчанию нет:
 * у папок нет ни типа, ни механики, и в проверках по документам они шум.
 */
export function allPacksFiles({ includeFolders = false } = {}) {
  const key = includeFolders ? "*all*" : "*docs*";
  if (dirCache.has(key)) return dirCache.get(key);
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".json")) continue;
      if (!includeFolders && entry.name === "_Folder.json") continue;
      out.push(full);
    }
  };
  walk(PACKS_SRC);
  dirCache.set(key, out);
  return out;
}

/** Все документы пака (или нескольких), без фильтра по типу. */
export function allPackDocuments(pack) {
  if (Array.isArray(pack)) return pack.flatMap(p => allPackDocuments(p));
  return packFiles(pack).map(full => ({
    file: path.relative(PACKS_SRC, full),
    doc: JSON.parse(packFileText(full))
  }));
}

/** Документы пака (или нескольких) нужного типа: по файлу на документ. */
export function packDocuments(pack, type) {
  return allPackDocuments(pack).filter(({ doc }) => doc.type === type);
}

/** Значения по путям: «effects.sizeMod» → 1. Массивы сравниваются целиком. */
export function leaves(value, prefix = "") {
  if (Array.isArray(value)) return [[prefix, JSON.stringify(value)]];
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, v]) => leaves(v, prefix ? `${prefix}.${key}` : key));
  return [[prefix, value]];
}

/** Пусто — значит терять нечего: пустая строка, пустой список, пустой объект. */
export function isEmpty(value) {
  return value === "" || value === "[]" || value === "{}" || value === undefined;
}
