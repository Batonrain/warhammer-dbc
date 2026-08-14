// test/support/pack-docs.mjs
//
// Общий разбор данных компендиумов для тестов схем: документы паков и сравнение
// значений по путям. Один набор помощников на предметы и акторов — иначе две
// копии одной проверки разъедутся при первой же правке.

import fs   from "node:fs";
import path from "node:path";

export const PACKS_SRC = path.resolve(import.meta.dirname, "../../packs-src");

/** Документы пака (или нескольких) нужного типа: по файлу на документ. */
export function packDocuments(pack, type) {
  if (Array.isArray(pack)) return pack.flatMap(p => packDocuments(p, type));
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".json") || entry.name.startsWith("_")) continue;
      const doc = JSON.parse(fs.readFileSync(full, "utf8"));
      if (doc.type === type) out.push({ file: path.relative(PACKS_SRC, full), doc });
    }
  };
  walk(path.join(PACKS_SRC, pack));
  return out;
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
