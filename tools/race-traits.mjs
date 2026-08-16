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
import { RACES, SUBRACE_DATA } from "../module/constants/races.mjs";
import { packFileName } from "./pack-file-name.mjs";

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
  const full = String(name).toLowerCase().replace(/\([^)]*\)/g, " ");
  const english = full.split("/")[0].replace(/[^a-z]+/g, " ").trim();
  if (english) return english;
  // Английской части нет («Дары Цегораха / Базовые Черты Арлекина» — оба
  // куска кириллические): без запасного пути ключ ушёл бы в пустую строку, и
  // любая вторая такая Черта молча склеилась бы с этой. Сверяем полное имя,
  // латиницу и кириллицу — как в первой версии правила, до английского ключа.
  return full.replace(/[^a-zа-яё]+/g, " ").trim();
}

// Виды числового бонуса, ради которых у Черты не может быть пары-заглушки:
// список полей system.effects, которые считает актор (те же, что заводит run()
// ниже и origin-shared.mjs). Раньше гейт needsNumbers смотрел только на
// charBonusStat/charBonuses — Черта с одним sizeMod (Размер) под гейт не
// попадала, и связка с пустой заглушкой проходила сверку молча: так уже
// терялся Размер у пяти рас, пока usable() не проверял sizeMod вовсе.
const NUMERIC_EFFECT_KEYS = [
  "charBonusStat", "charBonuses", "charValueBonuses",
  "armourAll", "fearRating", "sizeMod", "initMod", "speedMod"
];

/** Есть ли у effects хоть один числовой бонус, ради которого нужна рабочая пара. */
export function hasNumericTraitEffects(effects) {
  return NUMERIC_EFFECT_KEYS.some(k => {
    const v = effects?.[k];
    return Array.isArray(v) ? v.length > 0 : !!v;
  });
}

/** Есть ли у документа чем считать: рейтинг и хоть один эффект. */
const usable = doc => !!doc?.system?.hasRating && (Number(doc.system.rating) || 0) > 0
  && ((doc.effects || []).length > 0 || hasNumericTraitEffects(doc.system?.effects));

/**
 * Омонимы: имя из констант и документ библиотеки совпадают по ключу сверки
 * (normTraitName — английская часть имени без скобок), но это РАЗНЫЕ Черты —
 * общее только слово, не смысл. Автоматического правила, отличающего такой
 * омоним от честного синонима («Природная Броня» / «Естественная Броня» —
 * одна Черта под двумя названиями), не существует, поэтому список — ручной,
 * с пояснением на каждую запись. libraryTrait() эту пару НЕ считает парой,
 * из-за чего missingRaceTraits() признаёт Черту отсутствующей, и run() ниже
 * заводит для нею собственный документ — как для остальных недостающих.
 */
const HOMONYM_EXCLUSIONS = [
  {
    name: "Hulking / Громила (Легион)",
    excludeDoc: "Hulking / Громила (Размер)",
    why: "«Легион» у Репликанта — доступ к снаряжению Легиона Астартес, без " +
      "чисел; библиотечная «Размер» — Размер +1 (sizeMod). Общее только " +
      "английское слово «Hulking»."
  }
];

/**
 * Документ Черты по имени. Кандидатов может быть несколько: рядом с рабочей
 * записью в паке лежат пустые заглушки вроде «Unnatural Agility (+2)» без
 * рейтинга и эффектов. Ссылка на заглушку выдала бы +0, поэтому рабочая
 * запись предпочитается всегда. Документ из HOMONYM_EXCLUSIONS в кандидаты не
 * попадает вовсе — это не заглушка, а Черта с другим смыслом.
 */
export function libraryTrait(name) {
  const key = normTraitName(name);
  const excludeDoc = HOMONYM_EXCLUSIONS.find(h => h.name === name)?.excludeDoc;
  const hits = packTraits().map(t => t.doc)
    .filter(d => normTraitName(d.name) === key && d.name !== excludeDoc);
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

/**
 * Уникальные расовые Черты констант: имя → запись расы/субрасы.
 *
 * Субрасы обязаны участвовать наравне с расами: у них свои Черты
 * (Pariah/Дискордант — целиком, Daemonic/Machine у друкхарийских — как
 * добавка), и без них missingRaceTraits() не увидел бы дыру в паке.
 */
export function raceTraits() {
  const out = new Map();
  for (const def of [...Object.values(RACES), ...Object.values(SUBRACE_DATA)])
    for (const t of def.traits || []) if (t?.name && !out.has(t.name)) out.set(t.name, t);
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
      const needsNumbers = hasNumericTraitEffects(t.effects);
      return needsNumbers && !usable(doc);
    })
    .map(([name]) => name);
}

/** Устойчивый идентификатор: пересборка не должна менять _id. */
const stableId = seed => createHash("sha1").update(seed).digest("base64")
  .replace(/[^A-Za-z0-9]/g, "").slice(0, 16);



/** Документы библиотеки со своими путями — без записи на диск. */
export function libraryDocs() {
  const missing = missingRaceTraits();
  const traits  = raceTraits();

  // Несколько сырых имён константы сходятся к одному ключу сверки — «Unnatural
  // Agility» назван тремя разными рейтингами/русскими сокращениями у разных
  // рас. Библиотеке нужен один документ на ключ: рейтинг роли не играет,
  // выдача подвинет эффект под нужный сама (rescaleTraitByRating, задача 1).
  // Выбор внутри группы — первое имя по алфавиту: детерминированно, значит
  // при пересборке даёт тот же _id.
  const groups = new Map();
  for (const name of missing) {
    const key = normTraitName(name);
    const group = groups.get(key) || [];
    group.push(name);
    groups.set(key, group);
  }

  const files = [];
  for (const [key, names] of groups) {
    const name = [...names].sort()[0];
    const t  = traits.get(name);
    const id = stableId(`race-trait:${key}`);
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
    files.push({ path: join(FOLDER, packFileName(libName, id)), doc });
  }

  return files;
}

export function run({ write = false } = {}) {
  const docs = libraryDocs();
  if (write) for (const { path, doc } of docs)
    writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
  const existing = raceTraits().size - missingRaceTraits().length;
  return { existing, created: docs.length, files: docs.map(d => d.path) };
}

if (process.argv[1]?.endsWith("race-traits.mjs")) {
  const res = run({ write: process.argv.includes("--write") });
  console.log(`Расовых Черт в константах: ${raceTraits().size}`);
  console.log(`Уже в библиотеке: ${res.existing}; заведено документов: ${res.created}`);
}
