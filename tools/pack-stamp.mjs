// tools/pack-stamp.mjs
// ════════════════════════════════════════════════════════════════════════
//  Отметка последней синхронизации компендиумов и сторож несохранённых
//  правок.
//
//  Компендиумы правятся с двух сторон. В игре — руками, прямо в Foundry: там
//  живёт LevelDB из packs/. В репозитории — в packs-src/, оттуда их собирает
//  npm run packs:build. Сборка сносит папку пака целиком (иначе удалённые из
//  исходника документы остались бы в базе), поэтому ручные правки, не снятые
//  через npm run packs:unpack, она теряет молча — со стороны это выглядит как
//  «компендиум откатился сам».
//
//  Чтобы этого не случалось, обе команды оставляют отметку времени, а сборка
//  сверяется с ней: база новее отметки — значит в игре правили после последней
//  синхронизации, и сборку нужно остановить, пока правки не сняты в исходники.
//
//  Отметка лежит в packs/ и в репозиторий не попадает (packs/ в .gitignore):
//  это состояние рабочей машины, а не содержимое системы.
// ════════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { abs } from "./packs.mjs";

/** Файл отметки. Имя с точки — рядом с базами паков он не мешает. */
export const STAMP_FILE = "packs/.pack-stamp";

/** Записать отметку «исходники и базы сведены сейчас». */
export function writeStamp(when = Date.now()) {
  const path = abs(STAMP_FILE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${new Date(when).toISOString()}\n`);
  return when;
}

/** Время последней синхронизации в миллисекундах; null — отметки ещё нет. */
export function readStamp() {
  const path = abs(STAMP_FILE);
  if (!existsSync(path)) return null;
  const ms = Date.parse(readFileSync(path, "utf8").trim());
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Когда базу пака трогали в последний раз — самый свежий mtime её файлов.
 * Пака нет вовсе → 0: собирать нечего, терять нечего.
 */
export function latestDbChange(dir) {
  const path = abs(dir);
  if (!existsSync(path)) return 0;
  let latest = 0;
  for (const name of readdirSync(path)) {
    try { latest = Math.max(latest, statSync(join(path, name)).mtimeMs); }
    catch { /* файл исчез между чтением каталога и stat — не наша забота */ }
  }
  return latest;
}

/**
 * Паки, изменённые после отметки. Чистая функция: принимает уже снятые времена,
 * поэтому проверяется без файловой системы.
 *
 * Допуск в секунду — на разницу часов и на то, что сборка сама пишет файлы:
 * без него собственная запись сборки читалась бы как чужая правка.
 *
 * @param {number|null} stampMs           время последней синхронизации
 * @param {Array<{name: string, mtimeMs: number}>} packs
 */
export function packsChangedSince(stampMs, packs = [], toleranceMs = 1000) {
  // Отметки нет — сказать нечего: это первая сборка на этой машине.
  if (!stampMs) return [];
  return packs.filter(p => (p.mtimeMs || 0) > stampMs + toleranceMs).map(p => p.name);
}
