// tools/race-traits.mjs
// ════════════════════════════════════════════════════════════════════════
//  Недостающие расовые Черты в библиотеку packs-src/traits.
//
//  Расы выдают Черты ссылкой на библиотеку (Конструктор, kind:"trait"), а не
//  копией текста. 67 из 102 расовых Черт там уже есть; остальные заводятся
//  здесь — из тех же констант, откуда их раньше создавал лист персонажа.
//
//  Сверка по нормализованному имени: пак хранит шаблон «Сверхъест. Сила (X)»,
//  а раса называет «Сверхъест. Сила (4)». Скобки при сверке отбрасываются,
//  рейтинг едет отдельным полем.
//
//  Запуск:  node tools/race-traits.mjs [--write]
// ════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { RACES } from "../module/constants/races.mjs";

const DIR    = "packs-src/traits";
const FOLDER = "packs-src/traits/Трейты_рас";
const FOLDER_ID = "NQHsbl75bk7fCc77";          // _Folder.json папки «Трейты рас»

/**
 * Ключ сверки — АНГЛИЙСКАЯ часть имени (до «/»), без скобок и знаков.
 *
 * Русские названия одной Черты расходятся между константами и паком
 * («Природная Броня» против «Естественной»), английские — нет. Сверка по
 * полному имени завела бы 11 дублей. Тот же приём — в buildTalents
 * (module/apps/origin-shared.mjs).
 */
export function normTraitName(name) {
  return String(name)
    .split("/")[0]
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

/** Есть ли у документа чем считать: рейтинг и хоть один эффект. */
const usable = doc => !!doc?.system?.hasRating && (Number(doc.system.rating) || 0) > 0
  && ((doc.effects || []).length > 0 || !!doc.system.effects?.charBonusStat);

/**
 * Документ Черты по имени. Кандидатов может быть несколько: рядом с рабочей
 * записью в паке лежат пустые заглушки вроде «Unnatural Agility (+2)» без
 * рейтинга и эффектов. Ссылка на заглушку выдала бы +0, поэтому рабочая
 * запись предпочитается всегда.
 */
export function libraryTrait(name) {
  const key = normTraitName(name);
  const hits = packTraits().map(t => t.doc).filter(d => normTraitName(d.name) === key);
  return hits.find(usable) || hits[0] || null;
}

/** Все документы Черт пака: [{ path, doc }]. */
function packTraits(dir = DIR) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...packTraits(path));
    else if (entry.endsWith(".json") && entry !== "_Folder.json")
      out.push({ path, doc: JSON.parse(readFileSync(path, "utf8")) });
  }
  return out;
}

/** Уникальные расовые Черты констант: имя → запись расы. */
export function raceTraits() {
  const out = new Map();
  for (const race of Object.values(RACES))
    for (const t of race.traits || []) if (t?.name && !out.has(t.name)) out.set(t.name, t);
  return out;
}

/**
 * Расовые Черты без пригодной пары в библиотеке. Черта с числовым эффектом в
 * константах, которой в паке отвечает пустая заглушка, считается отсутствующей:
 * ссылка на заглушку молча обнулила бы бонус.
 */
export function missingRaceTraits() {
  return [...raceTraits().entries()]
    .filter(([name, t]) => {
      const doc = libraryTrait(name);
      if (!doc) return true;
      const needsNumbers = !!(t.effects?.charBonusStat || (t.effects?.charBonuses || []).length);
      return needsNumbers && !usable(doc);
    })
    .map(([name]) => name);
}

/** Устойчивый идентификатор: пересборка не должна менять _id. */
const stableId = seed => createHash("sha1").update(seed).digest("base64")
  .replace(/[^A-Za-z0-9]/g, "").slice(0, 16);

/** Имя файла в стиле выгрузки: пробелы и знаки — подчёркиванием. */
const fileName = (name, id) =>
  `${name.replace(/[^A-Za-zА-Яа-яЁё0-9]+/g, "_").slice(0, 40)}_${id}.json`;

export function run({ write = false } = {}) {
  const missing = missingRaceTraits();
  const traits  = raceTraits();
  const files   = [];

  for (const name of missing) {
    const t  = traits.get(name);
    const id = stableId(`race-trait:${name}`);
    // Черта с рейтингом заводится ШАБЛОНОМ «(X)», как уже сделаны Сила и
    // Стойкость: число из констант остаётся в rating и в эффекте, а выдача с
    // другим рейтингом подвинет его сама (rescaleTraitByRating, задача 1).
    // Поэтому одной записи хватает всем расам, какой бы рейтинг им ни был нужен.
    const libName = t.hasRating ? name.replace(/\((\d+)\)/g, "(X)") : name;
    const doc = {
      name: libName, type: "trait", img: "systems/warhammer-dbc/assets/item-icons/trait.svg",
      folder: FOLDER_ID,
      system: {
        description: "", notes: "", benefit: t.benefit || "", source: "раса",
        hasRating: !!t.hasRating, rating: t.rating || 0,
        hasRating2: false, rating2: 0,
        effects: {
          charBonusStat: "", charBonusValue: 0, charBonuses: [], charValueBonuses: [],
          armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0,
          ...(t.effects || {})
        },
        bookSource: "DoomBC — Основная книга"
      },
      _id: id, effects: [], sort: 0, flags: {}, _key: `!items!${id}`
    };
    const path = join(FOLDER, fileName(libName, id));
    if (write) writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
    files.push(path);
  }

  return { existing: traits.size - missing.length, created: missing.length, files };
}

if (process.argv[1]?.endsWith("race-traits.mjs")) {
  const res = run({ write: process.argv.includes("--write") });
  console.log(`Расовых Черт в константах: ${res.existing + res.created}`);
  console.log(`Уже в библиотеке: ${res.existing}; заведено: ${res.created}`);
}
