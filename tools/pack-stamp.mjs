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

/**
 * Записать отметку «исходники и базы сведены сейчас».
 *
 * `fingerprints` — отпечатки содержимого баз на этот момент (имя пака → строка,
 * tools/pack-fingerprint.mjs). Именно по ним следующая сборка отличит правку в
 * игре от того, что мир просто открывали и LevelDB переписал файлы (wdbc-1c10).
 * Без них отметка остаётся прежней — одно время.
 */
export function writeStamp(when = Date.now(), fingerprints = null) {
  const path = abs(STAMP_FILE);
  mkdirSync(dirname(path), { recursive: true });
  const body = fingerprints
    ? JSON.stringify({ when: new Date(when).toISOString(), packs: fingerprints }, null, 2)
    : new Date(when).toISOString();
  writeFileSync(path, `${body}\n`);
  return when;
}

/**
 * Отметка последней синхронизации.
 *
 * Два формата, и старый обязан читаться: на машинах разработчиков отметки уже
 * лежат простой строкой времени, и обновление инструмента не должно требовать
 * пересборки компендиумов.
 *
 * @returns {?(number|{when: number, packs: Object<string,string>})}
 *   число — старый формат (только время); объект — новый (время плюс отпечатки);
 *   null — отметки ещё нет либо она испорчена.
 */
export function readStamp() {
  const path = abs(STAMP_FILE);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8").trim();
  if (raw.startsWith("{")) {
    try {
      const doc = JSON.parse(raw);
      const when = Date.parse(doc.when);
      if (Number.isNaN(when)) return null;
      return { when, packs: doc.packs && typeof doc.packs === "object" ? doc.packs : {} };
    } catch {
      return null; // испорченная отметка читается как отсутствующая
    }
  }
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Когда базу пака в самом деле записывали последний раз — самый свежий mtime
 * её файлов данных: `.ldb` и непустых журналов `NNNNNN.log` (WAL, где живёт
 * запись до сброса в SST). Служебные файлы LevelDB (LOG, LOG.old,
 * MANIFEST-*, CURRENT, пустой текущий `NNNNNN.log`) не считаются: просто
 * открытие мира в Foundry трогает их у КАЖДОГО загруженного пака, даже если
 * внутри ничего не редактировали, и без фильтра это выглядело бы как правка.
 * Пака нет вовсе → 0: собирать нечего, терять нечего.
 */
export function latestDbChange(dir) {
  const path = abs(dir);
  if (!existsSync(path)) return 0;
  let latest = 0;
  for (const name of readdirSync(path)) {
    // Данные — это .ldb (SST) и НЕПУСТОЙ текущий журнал NNNNNN.log:
    // classic-level пишет документ сперва в memtable + WAL, а в .ldb
    // сбрасывает лишь при переполнении write-buffer или при следующем
    // открытии базы. Правка, сделанная перед выключением Foundry, живёт
    // только в логе; пустой текущий лог — служебный, его не считаем.
    if (!name.endsWith(".ldb") && !/^\d+\.log$/.test(name)) continue;
    try {
      const st = statSync(join(path, name));
      if (name.endsWith(".log") && st.size === 0) continue;
      latest = Math.max(latest, st.mtimeMs);
    }
    catch { /* файл исчез между чтением каталога и stat — не наша забота */ }
  }
  return latest;
}

/**
 * Паки, изменённые после отметки. Чистая функция: принимает уже снятые времена
 * и отпечатки, поэтому проверяется без файловой системы и без LevelDB.
 *
 * ДВА ШАГА, и решающий — второй (wdbc-1c10):
 *
 * 1. Дата файлов — быстрый предфильтр. Пак не новее отметки трогали заведомо не
 *    после синхронизации, читать его базу незачем.
 * 2. Отпечаток содержимого — решение. classic-level переписывает .ldb при
 *    ОТКРЫТИИ базы (уплотнение), не меняя ни одного документа, а мир открывает
 *    все паки при каждом запуске. По одной дате «поиграли» неотличимо от
 *    «правили», и гейт краснел после каждого сеанса игры — то есть ровно тогда,
 *    когда нужен больше всего.
 *
 * Отпечатка нет (старая отметка, новый пак, база занята миром и не открылась) —
 * судить о содержимом нечем, и пак считается изменённым. Ошибиться в эту сторону
 * значит зря остановить сборку; в другую — молча потерять правки.
 *
 * Допуск в секунду — на разницу часов и на то, что сборка сама пишет файлы:
 * без него собственная запись сборки читалась бы как чужая правка.
 *
 * @param {number|{when: number, packs: Object<string,string>}|null} stamp
 *   отметка: число (старый формат) или объект с отпечатками (новый)
 * @param {Array<{name: string, mtimeMs: number, fingerprint?: ?string}>} packs
 */
export function packsChangedSince(stamp, packs = [], toleranceMs = 1000) {
  // Отметки нет — сказать нечего: это первая сборка на этой машине.
  if (!stamp) return [];
  const when = typeof stamp === "number" ? stamp : stamp.when;
  const known = typeof stamp === "number" ? null : (stamp.packs ?? {});
  if (!when) return [];

  return packs
    .filter(p => (p.mtimeMs || 0) > when + toleranceMs)
    .filter(p => {
      if (!known) return true;                 // старый формат — верим дате
      const was = known[p.name];
      if (!was || !p.fingerprint) return true; // сравнивать не с чем
      return p.fingerprint !== was;            // содержимое и правда разошлось
    })
    .map(p => p.name);
}
