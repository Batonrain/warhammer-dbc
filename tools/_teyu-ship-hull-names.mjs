// tools/_teyu-ship-hull-names.mjs
// Разовый скрипт wdbc-teyu: 22 корпуса кораблей (packs-src/ship-components/
// Корпуса/*) и 5 связанных компонентов "Станки" переименованы по книге
// (packs-src/books/void.json, разделы «Гранд-крейсеры», «Крейсеры», «Легкие
// крейсеры», «Линейные крейсеры», «Линкоры», «Рейдеры», «Транспорты»,
// «Фрегаты») — сверено вручную по названию-паре "English / Русский", а не
// подстрочным скриптом (см. отчёт в bd).
//
//   node tools/_teyu-ship-hull-names.mjs --dry
//   node tools/_teyu-ship-hull-names.mjs

import fs from "node:fs";
import path from "node:path";
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

// { найти файл по подстроке имени файла: новое полное имя }
const FIXES = [
  ["Rejector___Отвергающий", "Repulsive / Отвергающий"],
  ["Retributor___Возда", "Retaliator / Воздаятель"],
  ["Unbending___Несгиба", "Inflexible / Несгибаемый"],
  ["Boldness___Смелость", "Enterprise / Смелость"],
  ["Excelsior___", "Excelsior / Эксельсиор"],
  ["Hawk_s_Flight___", "Hawking / Полет Ястреба"],
  ["Massacre___Резня", "Carnage / Резня"],
  ["Aspiration___Стремление", "Endeavour / Стремление"],
  ["Bringer_of_Hell___", "Hellbringer / Несущий ад"],
  ["Malefic___Тлетворный", "Pestilan / Тлетворный"],
  ["Stanki___Станки", "Lathe / Станки"],
  ["Odyssey___", "Odysseus / Одиссей"],
  ["Sovereign___Владыка", "Overlord / Владыка"],
  ["Destroyer___Разрушитель", "Desolator / Разрушитель"],
  ["Diktat___Диктат", "Dictatus / Диктат"],
  ["Legate___Легат", "Legatus / Легат"],
  ["Ravager___Разоритель", "Despoiler / Разоритель"],
  ["Asiroph___Асироф", "Hazeroth / Асироф"],
  ["Pagan___Язычник", "Infidel / Язычник"],
  ["Stronghold___Оплот", "Stalwart / Оплот"],
  ["Carrack___Каррака", "Carrack / Каракка"],
  ["Discovery___Открытие", "Unveiling / Открытие"],
  ["Lightning___Молния", "Thunderbolt / Молния"],
  ["Storm___Буря", "Tempest / Буря"],
  // компоненты "Станки" — тот же хулл-класс, книга зовёт паттерн "Lathe"
  ["Stanki_Hangar_Bay___", "Lathe Hangar Bay / Ангарный отсек Станки"],
  ["Stanki_Pattern_Broadside_Grav_Guns___", "Lathe Pattern Broadside Grav-Guns / Бортовые грав-пушки модели Станки"],
  ["Stanki_Pattern_Class_1___", "Lathe Pattern Class 1 / Модель Станки класса 1"],
  ["Stanki_Pattern_Class_2a___", "Lathe Pattern Class 2a / Модель Станков класса 2а"],
  ["Stanki_Pattern_Class_2v", "Lathe Pattern Class 2v «Escort» / Модель Станков класса 2в «Эскорт»"],
  // талант «Смелость» использует Idolater/Idolator? нет — это отдельный
  // хулл-рейдер "Идолопоклонник", в паке ship-components
  ["Рейдеры/Idolater___Идолопоклонник", "Idolator / Идолопоклонник"],
];

export function run({ dry = false } = {}) {
  const dir = path.join(ROOT, "packs-src/ship-components");
  const files = walk(dir);
  const applied = [];
  const oldToNew = new Map(); // старое полное doc.name -> новое, для REF_FIELDS

  for (const [needle, newName] of FIXES) {
    const rel = needle.includes("/") ? needle : null;
    const match = files.find(f => {
      const relF = path.relative(ROOT, f).replace(/\\/g, "/");
      return rel ? relF.includes(rel) : path.basename(f).startsWith(needle);
    });
    if (!match) { console.error("НЕ НАЙДЕН:", needle); continue; }
    const doc = JSON.parse(fs.readFileSync(match, "utf8"));
    const oldName = doc.name;
    if (oldName === newName) continue;
    oldToNew.set(oldName, newName);
    doc.name = newName;
    const newAbs = path.join(path.dirname(match), packFileName(newName, doc._id));
    if (!dry) {
      fs.writeFileSync(match, JSON.stringify(doc, null, 2) + "\n");
      if (newAbs !== match) fs.renameSync(match, newAbs);
    }
    applied.push({ old: oldName, now: newName,
                   file: path.relative(ROOT, newAbs).replace(/\\/g, "/") });
  }

  // Ссылки по имени (Конструктор: sourceName/equipSourceName) — маловероятны
  // для корпусов кораблей, но проверяем по тому же принципу, что и
  // tools/apply-original-names.mjs.
  //
  // ЛОВУШКА: "Idolater / Идолопоклонник" существует ДВАЖДы — рейдер в
  // ship-components (переименовывается здесь) и одноимённый талант в
  // packs-src/talents/Смелость (не трогаем). Слепая замена по строке имени
  // переписала бы sourceName у ссылки на ТАЛАНТ (sourceUuid указывает на
  // Item.9oj9nEzqCtpSap8E, компендиум talents, не ship-components) — это не
  // наша правка. Исключаем это имя из ссылочной замены, оставляя только
  // переименование самого корпуса.
  oldToNew.delete("Idolater / Идолопоклонник");
  const REF_FIELDS = new Set(["sourceName", "equipSourceName"]);
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
        if (REF_FIELDS.has(key) && typeof value === "string" && oldToNew.has(value)) {
          node[key] = oldToNew.get(value); changed++;
        } else visit(value);
      }
    };
    visit(doc);
    if (changed) {
      refFiles++; refs += changed;
      if (!dry) fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
    }
  }

  return { applied, refFiles, refs };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const dry = process.argv.includes("--dry");
  const { applied, refFiles, refs } = run({ dry });
  for (const a of applied) console.log(`${a.old}  →  ${a.now}`);
  console.log(`\n${dry ? "БУДЕТ применено" : "применено"}: ${applied.length}`
            + ` | ссылок обновлено: ${refs} в ${refFiles} файлах`);
}
