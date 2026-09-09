// tools/_unpack-one.mjs — закоммичен и активно используется, не одноразовый.
// Точечно снимает правки одного пака из LevelDB в packs-src, не трогая остальные.
// Запуск: node tools/_unpack-one.mjs <имя пака>
//
// После извлечения packs-src этого пака точно совпадает с его базой — но саму
// базу extractPack не трогает, поэтому её отпечаток не менялся. Отметка
// синхронизации (tools/pack-stamp.mjs) при этом переписывает СВОЙ ключ этого
// пака на текущий отпечаток базы, не трогая чужие (wdbc-tn92, симметрично
// tools/_pack-one.mjs): без этого следующая общая сборка сравнила бы базу со
// старым отпечатком, записанным ДО правок в игре, которые здесь как раз сняли
// в исходники, — и ложно потребовала бы unpack ещё раз, хотя он уже сделан.
//
// Это НЕ то же самое, что --pack= у tools/unpack.mjs: там отметка нарочно не
// сдвигается при частичном запуске (комментарий там же) — но тот инструмент
// пишет отметку ЦЕЛИКОМ (allFingerprints по отфильтрованным пакам), и сдвиг
// стёр бы из неё записи всех паков вне фильтра. Здесь отметка ДОПОЛНЯЕТСЯ по
// одному ключу, как и в _pack-one.mjs, — чужие записи не теряются, поэтому та
// причина не держащая.

import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { NAME_LIMIT, safe } from "./pack-file-name.mjs";
import { LIBRARY_PACKS, abs, isPacksBusy, reportBusy } from "./packs.mjs";
import { readStamp, writeStamp } from "./pack-stamp.mjs";
import { FINGERPRINT_VERSION, packFingerprintInfo } from "./pack-fingerprint.mjs";
import { join } from "node:path";

/**
 * Что сделать с отметкой синхронизации после точечного извлечения одного пака.
 *
 * Извлечение не меняет базу — меняется только packs-src, — поэтому отпечаток,
 * который сюда приходит, это отпечаток БАЗЫ, как она была и остаётся. Дописать
 * им один ключ отметки можно только в отметку НОВОГО формата (объект с
 * `packs`), посчитанную ТЕКУЩЕЙ версией алгоритма отпечатка, и только если
 * отпечаток вообще удалось прочитать. См. tools/_pack-one.mjs::stampAfterPackBuild
 * — решение то же самое, продублировано здесь, чтобы файл оставался
 * самостоятельным одиночным скриптом.
 *
 * Чистая функция: решение не зависит от файловой системы, поэтому
 * проверяется без неё.
 *
 * @param {?(number|{when:number, fpVersion:number, packs:Object<string,string>})} stamp
 *   текущая отметка синхронизации, как её возвращает readStamp()
 * @param {string} name имя только что извлечённого пака
 * @param {{fingerprint:?string, busy:boolean, missing:boolean}} fp
 *   отпечаток базы пака (packFingerprintInfo) — извлечение её не меняет
 * @returns {{action:"write", packs:Object<string,string>}|{action:"skip", reason:string}}
 */
export function stampAfterPackUnpack(stamp, name, fp) {
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
    return { action: "skip", reason: "не удалось посчитать отпечаток пака после извлечения" };
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

  const transformFolderName = (doc) => (doc.name ? safe(doc.name) : doc._id);
  const transformName = (doc, { documentType, folder }) => {
    if (documentType === "Folder") return null;
    const stem = doc.name ? `${safe(doc.name).slice(0, NAME_LIMIT)}_${doc._id}` : doc._id;
    return folder ? join(folder, `${stem}.json`) : `${stem}.json`;
  };

  if (!existsSync(abs(p.dir, "CURRENT"))) {
    console.error(`В ${p.dir} нет базы LevelDB`);
    process.exit(1);
  }

  try {
    await extractPack(abs(p.dir), abs(p.src), {
      folders: true, clean: true, omitVolatile: true, transformFolderName, transformName
    });
    console.log(`извлечён ${p.name} → ${p.src}`);

    const stamp = readStamp();
    const fp = await packFingerprintInfo(abs(p.dir));
    const decision = stampAfterPackUnpack(stamp, p.name, fp);
    if (decision.action === "write") {
      writeStamp(Date.now(), decision.packs);
      console.log(`отметка синхронизации обновлена: ${p.name}`);
    } else {
      console.log(`отметка синхронизации НЕ обновлена: ${decision.reason}`);
      console.log("следующая общая сборка (npm run packs:build) может ложно решить, что в компендиумах есть правки.");
    }
  } catch (e) {
    if (isPacksBusy(e)) { reportBusy(e, "снять"); process.exit(1); }
    throw e;
  }
}
