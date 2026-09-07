// test/support/pack-doc.mjs
//
// ДОКУМЕНТ ПАКА ПО ИДЕНТИФИКАТОРУ, А НЕ ПО ИМЕНИ ФАЙЛА.
//
// Имя файла в packs-src выводится из имени документа (tools/pack-file-name.mjs)
// и меняется вместе с ним. Тест, прописавший путь строкой, ломается от любого
// переименования — и ломается ENOENT'ом, то есть выглядит как «пак развалился»,
// хотя развалился только тест.
//
// Так и вышло дважды за один заход wdbc-o30i/wdbc-yubg: дописали к предмету
// английскую половину имени — упал тест Метеоритного Молота; привели русское
// название к книжному — упал тест Даров Тзинча. Идентификатор при
// переименовании не меняется никогда, поэтому искать надо по нему.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

/**
 * Документ пака по его идентификатору.
 *
 * @param {string} dir каталог внутри packs-src (относительный или абсолютный)
 * @param {string} id  16-символьный идентификатор документа
 */
export function packDocById(dir, id) {
  const abs = path.isAbsolute(dir) ? dir : path.join(ROOT, dir);
  const file = fs.readdirSync(abs).find(f => f.endsWith(`_${id}.json`));
  if (!file) throw new Error(`в ${dir} нет документа с id ${id}`);
  return JSON.parse(fs.readFileSync(path.join(abs, file), "utf8"));
}
