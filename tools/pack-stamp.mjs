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
import { SRC_ROOT, abs } from "./packs.mjs";
import { FINGERPRINT_VERSION, allSourceFingerprints } from "./pack-fingerprint.mjs";

/** Файл отметки. Имя с точки — рядом с базами паков он не мешает. */
export const STAMP_FILE = "packs/.pack-stamp";

/**
 * Записать отметку «исходники и базы сведены сейчас».
 *
 * `fingerprints` — отпечатки содержимого баз на этот момент (имя пака → строка,
 * tools/pack-fingerprint.mjs). Именно по ним следующая сборка отличит правку в
 * игре от того, что мир просто открывали и LevelDB переписал файлы (wdbc-1c10).
 * Без них отметка остаётся прежней — одно время.
 *
 * `sources` — отпечатки ИСХОДНИКОВ на тот же момент (wdbc-6dps, sourcesChangedSince
 * ниже). Не передано — переносятся из текущей отметки как есть: точечные
 * сборка и извлечение (tools/_pack-one.mjs, _unpack-one.mjs) переписывают
 * отметку ради одного пака и не должны молча стирать сверку остальных.
 */
export function writeStamp(when = Date.now(), fingerprints = null, sources = undefined) {
  const path = abs(STAMP_FILE);
  mkdirSync(dirname(path), { recursive: true });
  if (sources === undefined) {
    const prev = readStamp();
    sources = prev && typeof prev === "object" ? prev.sources : null;
  }
  const body = fingerprints
    ? JSON.stringify({ when: new Date(when).toISOString(),
                       fpVersion: FINGERPRINT_VERSION, packs: fingerprints,
                       ...(sources ? { sources } : {}) }, null, 2)
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
      return { when, fpVersion: Number(doc.fpVersion) || 1,
               packs: doc.packs && typeof doc.packs === "object" ? doc.packs : {},
               sources: doc.sources && typeof doc.sources === "object" ? doc.sources : null };
    } catch {
      return null; // испорченная отметка читается как отсутствующая
    }
  }
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

/** Где лежит исходник пака: у книги — один файл, у библиотеки — папка. */
export function sourcePathOf(p) {
  return p.slug ? abs(`${SRC_ROOT}/books/${p.slug}.json`) : abs(p.src);
}

/** Текущие отпечатки исходников перечисленных паков. */
export function currentSourceFingerprints(packs) {
  return allSourceFingerprints(packs.map(p => ({ name: p.name, source: sourcePathOf(p) })));
}

/**
 * Дописать в отметку отпечатки исходников нескольких паков, ничего больше в
 * ней не трогая: ни время, ни отпечатки баз, ни версию их алгоритма.
 *
 * Для точечных операций (--pack, _pack-one, _unpack-one): после них исходник
 * и база ИМЕННО ЭТИХ паков сведены, а о прочих сказать нечего. Отметки нет
 * или она старого формата — писать некуда, возвращается false.
 */
export function recordSources(fresh) {
  const stamp = readStamp();
  if (!stamp || typeof stamp !== "object") return false;
  const path = abs(STAMP_FILE);
  const doc = JSON.parse(readFileSync(path, "utf8"));
  doc.sources = { ...(doc.sources ?? {}), ...fresh };
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
  return true;
}

/**
 * Исходники каких паков изменились после последней сверки (wdbc-6dps).
 *
 * Это обратная сторона packsChangedSince: там «в игре правили, а исходники не
 * сняты» и под угрозой сборка, здесь «исходники правили, а база не
 * пересобрана» и под угрозой извлечение. Сторож дрейфа (tools/pack-drift.mjs)
 * этот случай видит, только если из исходников пропал бы ДОКУМЕНТ; устаревшие
 * поля у тех же документов он пропускал молча.
 *
 * Чистая функция.
 *
 * @param {?(number|{sources: ?Object<string,string>})} stamp отметка (readStamp)
 * @param {Object<string,string>} current имя пака → отпечаток исходника сейчас
 * @returns {?string[]} изменившиеся паки по возрастанию; null — сверять не с
 *   чем (отметки нет, старый формат или она записана до wdbc-6dps). Судить
 *   тогда нечем, и вызывающий должен ошибиться в безопасную сторону.
 */
export function sourcesChangedSince(stamp, current) {
  const known = stamp && typeof stamp === "object" ? stamp.sources : null;
  if (!known) return null;
  return Object.keys(current).filter(name => known[name] !== current[name]).sort();
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
      // wdbc-2gn (находка 7): на практике этот `if` сейчас достижим только
      // когда вызывающий (tools/pack.mjs) уже прошёл свою собственную проверку
      // версии отпечатка с флагом --force — старый числовой `stamp` даёт
      // stampVersion=1, и без --force несовпадение с текущим FINGERPRINT_VERSION
      // (сейчас 3) останавливает сборку раньше, до этой функции. Внутри
      // --force результат ниже по стеку не читается (тот же --force гасит и
      // проверку edited.length в pack.mjs) — так что «верим дате» здесь не
      // мёртвый код в смысле unreachable, а код без наблюдаемого следствия.
      // Не удаляю: останется живым и полезным, если контракт --force
      // когда-нибудь изменится (например, --force перестанет глушить итог
      // packsChangedSince) — тогда эта ветка должна остаться прежней.
      if (!known) return true;                 // старый формат — верим дате
      const was = known[p.name];
      if (!was || !p.fingerprint) return true; // сравнивать не с чем
      return p.fingerprint !== was;            // содержимое и правда разошлось
    })
    .map(p => p.name);
}
