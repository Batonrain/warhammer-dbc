// tools/_pack-one.mjs — закоммичен и активно используется, не одноразовый.
// Точечно пересобирает ОДИН пак из packs-src в LevelDB, не трогая остальные
// (полный packs:build пересобрал бы всё разом — небезопасно, когда другие
// паки новее .pack-stamp по причине, не связанной с текущей правкой).
// Запуск: node tools/_pack-one.mjs <имя пака>
//
// После пересборки отметка синхронизации (tools/pack-stamp.mjs) переписывает
// СВОЙ ключ этого пака, не трогая чужие (wdbc-tn92). Без этого следующая общая
// сборка (tools/pack.mjs) сравнивала бы свежую базу со старым отпечатком,
// записанным до точечной пересборки, и ложно объявляла «в компендиумах есть
// правки, сперва npm run packs:unpack» — хотя в игре никто ничего не правил.
// Цена этой ложной тревоги реальна: unpack с clean:true в этой ситуации
// удалил бы из packs-src документы, которых нет в базе (инцидент 05.09.2026 —
// 45 удалённых файлов, см. tools/pack-drift.mjs). 08.09.2026 после точечной
// сборки пака mutations пришлось руками дописывать один ключ в отметку
// сторонним скриптом — эта правка убирает ручной шаг.

import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { LIBRARY_PACKS, abs, isPacksBusy, reportBusy } from "./packs.mjs";
import { readStamp, writeStamp } from "./pack-stamp.mjs";
import { FINGERPRINT_VERSION, packFingerprintInfo } from "./pack-fingerprint.mjs";

/**
 * Что сделать с отметкой синхронизации после точечной пересборки одного пака.
 *
 * Дописать один ключ можно только в отметку НОВОГО формата (объект с
 * `packs`), посчитанную ТЕКУЩЕЙ версией алгоритма отпечатка, — и только если
 * отпечаток свежепересобранной базы вообще удалось прочитать. Во всех прочих
 * случаях сравнивать не с чем или писать нечего, и переписывать отметку
 * наугад нельзя: молчаливая порча отметки хуже одной лишней ложной тревоги у
 * следующей общей сборки, а по счастью, у неё уже есть свои понятные тексты
 * ошибок на эти случаи (см. tools/pack.mjs).
 *
 * Чистая функция: решение не зависит от файловой системы, поэтому
 * проверяется без неё.
 *
 * @param {?(number|{when:number, fpVersion:number, packs:Object<string,string>})} stamp
 *   текущая отметка синхронизации, как её возвращает readStamp()
 * @param {string} name имя только что пересобранного пака
 * @param {{fingerprint:?string, busy:boolean, missing:boolean}} fp
 *   отпечаток базы пака после пересборки (packFingerprintInfo)
 * @returns {{action:"write", packs:Object<string,string>}|{action:"skip", reason:string}}
 */
export function stampAfterPackBuild(stamp, name, fp) {
  if (!stamp) {
    return { action: "skip", reason: "отметки синхронизации ещё нет — дописывать в неё точечно некуда" };
  }
  if (typeof stamp === "number") {
    return { action: "skip", reason: "отметка в старом формате (только время, без отпечатков) — точечно дописать нечего" };
  }
  if (stamp.fpVersion !== FINGERPRINT_VERSION) {
    return { action: "skip", reason: `отметка посчитана другой версией отпечатка `
      + `(в отметке ${stamp.fpVersion}, сейчас ${FINGERPRINT_VERSION}) — сравнивать не с чем` };
  }
  if (fp.busy) {
    return { action: "skip", reason: "база пака занята (мир открыт?) — отпечаток не читается" };
  }
  if (!fp.fingerprint) {
    return { action: "skip", reason: "не удалось посчитать отпечаток пака после пересборки" };
  }
  return { action: "write", packs: { ...(stamp.packs ?? {}), [name]: fp.fingerprint } };
}

// ── Точка входа: только при прямом запуске, не при импорте на тест ──
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const name = process.argv[2];
  const p = LIBRARY_PACKS.find(x => x.name === name);
  if (!p) {
    console.error(`Пак не найден: ${name}`);
    process.exit(1);
  }
  if (!existsSync(abs(p.src))) {
    console.error(`нет исходника ${p.src} — пак ${p.name} остался бы пустым`);
    process.exit(1);
  }

  try {
    rmSync(abs(p.dir), { recursive: true, force: true });
    mkdirSync(abs(p.dir), { recursive: true });
    let docs = 0;
    await compilePack(abs(p.src), abs(p.dir), { recursive: true, transformEntry: () => { docs++; } });
    if (!docs) {
      console.error(`пак ${p.name} собрался бы пустым: в ${p.src} нет документов`);
      process.exit(1);
    }
    console.log(`собран ${p.name}: документов — ${docs}`);

    const stamp = readStamp();
    const fp = await packFingerprintInfo(abs(p.dir));
    const decision = stampAfterPackBuild(stamp, p.name, fp);
    if (decision.action === "write") {
      writeStamp(Date.now(), decision.packs);
      console.log(`отметка синхронизации обновлена: ${p.name}`);
    } else {
      console.log(`отметка синхронизации НЕ обновлена: ${decision.reason}`);
      console.log("следующая общая сборка (npm run packs:build) может ложно решить, что в компендиумах есть правки.");
    }
  } catch (e) {
    if (isPacksBusy(e)) { reportBusy(e, "собрать"); process.exit(1); }
    throw e;
  }
}
