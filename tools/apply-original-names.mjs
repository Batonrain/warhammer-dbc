// tools/apply-original-names.mjs
// ════════════════════════════════════════════════════════════════════════
//  ДОПИСАТЬ ОРИГИНАЛЬНЫЕ НАЗВАНИЯ В ПАКИ (wdbc-o30i).
//
//  Берёт однозначные находки tools/original-names-from-books.mjs и делает из
//  «Ведьмин Клинок» имя «Witch Blade / Ведьмин Клинок».
//
//  ТРИ ВЕЩИ, БЕЗ КОТОРЫХ ПЕРЕИМЕНОВАНИЕ ЛОМАЕТ СБОРКУ ИЛИ ДАННЫЕ:
//
//  1. ИМЯ ФАЙЛА. packs-src называет файл по имени документа
//     (tools/pack-file-name.mjs), а CI собирает пак, разбирает обратно и
//     требует, чтобы packs-src не изменился. Переименовать документ и не
//     переименовать файл — значит уронить круговорот.
//  2. ССЫЛКИ ПО ИМЕНИ. Другие документы называют этот предмет строкой в
//     полях Конструктора (sourceName, equipSourceName). Ссылка не по имени —
//     по uuid (resolveMechSource берёт его первым), но подпись в окне
//     Конструктора берётся из строки, и без правки она останется старой.
//  3. РУССКАЯ ПОЛОВИНА ОСТАЁТСЯ. Код опознаёт предметы по имени
//     (itemHasName), и он принимает ЛЮБУЮ половину двуязычного имени — но
//     только пока эта половина цела. Поэтому русское имя не заменяется, а
//     дополняется английским слева.
//
//  Рейтинг в скобках у английской половины («Gorget (X)») снимается, если у
//  русской его нет: «(X)» — пометка книги о параметре, а не часть имени, и
//  в паре она выглядела бы опечаткой.
//
//    node tools/apply-original-names.mjs --dry     — показать, ничего не делая
//    node tools/apply-original-names.mjs           — применить
// ════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { proposals } from "./original-names-from-books.mjs";
import { packFileName } from "./pack-file-name.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith(".json")) out.push(p);
  }
  return out;
}

/** Английская половина без книжной пометки рейтинга, если её нет у русской. */
export function cleanOriginal(original, russian) {
  if (/\(/.test(russian)) return original;
  return original.replace(/\s*\((?:X|\d+)\)\s*$/i, "").trim();
}

export function run({ dry = false } = {}) {
  const { found } = proposals();
  const renames = found.map(f => ({
    ...f,
    newName: `${cleanOriginal(f.original, f.name)} / ${f.name}`
  }));

  // Один и тот же документ мог попасть дважды (одинаковые имена в разных
  // паках — разные файлы, это нормально), но один файл переименовываем один раз.
  const byFile = new Map(renames.map(r => [r.file, r]));

  const renamed = [];
  for (const [rel, r] of byFile) {
    const abs = path.join(ROOT, rel);
    const doc = JSON.parse(fs.readFileSync(abs, "utf8"));
    if (doc.name !== r.name) continue;                 // кто-то уже правил
    doc.name = r.newName;
    const dir = path.dirname(abs);
    const newAbs = path.join(dir, packFileName(r.newName, doc._id));
    if (!dry) {
      fs.writeFileSync(abs, JSON.stringify(doc, null, 2) + "\n");
      if (newAbs !== abs) fs.renameSync(abs, newAbs);
    }
    renamed.push({ old: r.name, now: r.newName,
                   file: path.relative(ROOT, newAbs).replace(/\\/g, "/") });
  }

  // Ссылки по имени в остальных документах пака — ТОЛЬКО подписи источника в
  // записях Конструктора.
  //
  // Текстовая замена «"Меч"» на «"Sword / Меч"» по всему файлу здесь была бы
  // порчей данных: «Меч» — ещё и значение поля meleeCategory (категория
  // рукопашного оружия из module/constants/weapon-categories.mjs), и после
  // такой замены категория перестала бы совпадать с любым списком. Поэтому
  // правим по ИМЕНИ ПОЛЯ, разобрав JSON, а не поиском по тексту.
  const REF_FIELDS = new Set(["sourceName", "equipSourceName"]);
  const map = new Map(renames.map(r => [r.name, r.newName]));
  let refFiles = 0, refs = 0;
  for (const file of walk(path.join(ROOT, "packs-src"))) {
    if (file.includes(`${path.sep}books${path.sep}`)) continue;
    let doc;
    try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    let changed = 0;
    const visit = (node) => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== "object") return;
      for (const [key, value] of Object.entries(node)) {
        if (REF_FIELDS.has(key) && typeof value === "string" && map.has(value)) {
          node[key] = map.get(value); changed++;
        } else visit(value);
      }
    };
    visit(doc);
    if (changed) {
      refFiles++; refs += changed;
      if (!dry) fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
    }
  }
  return { renamed, refFiles, refs };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const dry = process.argv.includes("--dry");
  const { renamed, refFiles, refs } = run({ dry });
  for (const r of renamed.slice(0, 20)) console.log(`${r.old}  →  ${r.now}`);
  if (renamed.length > 20) console.log(`… и ещё ${renamed.length - 20}`);
  console.log(`\n${dry ? "БУДЕТ переименовано" : "переименовано"}: ${renamed.length}`
            + ` | подписей источника обновлено: ${refs} в ${refFiles} файлах`);
}
