// tools/bestq-implant-options.mjs
// ════════════════════════════════════════════════════════════════════════
//  ВАРИАНТЫ БОНУСНОГО ЭФФЕКТА BEST.Q-БИОИМПЛАНТОВ (wdbc-ukpu).
//
//  Книга Аэльдари: Ответвления, глава «АРСЕНАЛ ДРУКХАРИ», одинаково во всех
//  десяти разделах: «Best.Q: … Дополнительно даёт один из следующих эффектов.
//  Редкость Best.Q-импланта повышается на 1 за каждый дополнительный эффект».
//  У руки-хищника формулировка полнее: выбор делается при выращивании, и один
//  и тот же тип можно взять дважды.
//
//  Тикет прямо говорит, с чего начинать: пока список вариантов лежит СПЛОШНЫМ
//  ТЕКСТОМ в system.effect, выбирать нечего. Здесь этот текст разбирается в
//  структуру — по одной записи на вариант.
//
//  ФОРМА ТЕКСТА, на которую опирается разбор (проверена на всех 79):
//
//    Best.Q: <что даёт само качество> + 1 эффект (R +1 за каждый доп.):
//      1) Название (пояснение); 2) Название (пояснение); …
//
//  Разбор не «умный»: он требует ровно этой формы и молчит, если её нет —
//  лучше не разобрать и сказать об этом, чем разобрать наполовину и записать
//  мусор в данные.
//
//    node tools/bestq-implant-options.mjs --dry
//    node tools/bestq-implant-options.mjs
// ════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

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

/** Признак правила: строка про цену дополнительного эффекта. */
export const BESTQ_MARKER = /эффект\s*\(R\s*\+1\s*за\s*каждый\s*доп/i;

/**
 * Варианты из текста Best.Q.
 *
 * @param {string} effectText содержимое system.effect
 * @returns {{label:string, note:string}[]} пусто, если правила нет или форма чужая
 */
export function parseBestQOptions(effectText) {
  const text = String(effectText || "");
  if (!BESTQ_MARKER.test(text)) return [];
  const tail = text.slice(text.search(BESTQ_MARKER));
  const colon = tail.indexOf(":");
  if (colon < 0) return [];

  const out = [];
  const numbers = [];
  // «1) Название (пояснение); 2) …» — номер, затем всё до СЛЕДУЮЩЕГО НОМЕРА.
  //
  // Границей служит именно номер, а не точка с запятой: пояснение само бывает
  // с «;» внутри («при E(El) +1d10 ран; 1/час полное исцеление»), и разбор по
  // «;» молча терял такой вариант целиком — у Электродуги из четырёх
  // разбиралось три, и заметить это можно было только глазами.
  for (const m of tail.slice(colon + 1).matchAll(/(\d+)\)\s*([\s\S]*?)(?=\s*;\s*\d+\)|\s*$)/g)) {
    const raw = m[2].trim().replace(/[.;]+$/, "");
    // Пояснение книга кладёт в скобки после названия. Скобок может не быть —
    // тогда весь текст и есть название.
    const open = raw.indexOf("(");
    const label = (open > 0 ? raw.slice(0, open) : raw).trim();
    const note = open > 0 ? raw.slice(open + 1).replace(/\)\s*$/, "").trim() : "";
    if (label) { out.push({ label, note }); numbers.push(Number(m[1])); }
  }

  // Номера разобранных вариантов обязаны идти подряд с единицы. Если ряд
  // рваный, разбор потерял вариант (или прихватил лишнее) — отдаём пусто,
  // чтобы вызывающий это заметил, а не записал половину списка как полный.
  //
  // Считается ИМЕННО по номерам самих разобранных вариантов, а не поиском
  // «последнего номера в тексте»: в пояснениях встречается «Pen 4)», и такая
  // проверка объявляла бы испорченным нормально разобранный список.
  const ok = numbers.length === out.length && numbers.every((n, i) => n === i + 1);
  return ok ? out : [];
}

export function run({ dry = false } = {}) {
  const parsed = [], unparsed = [];
  for (const file of walk(path.join(ROOT, "packs-src/implants"))) {
    if (file.endsWith("_Folder.json")) continue;
    let doc;
    try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    if (!BESTQ_MARKER.test(String(doc?.system?.effect || ""))) continue;

    const options = parseBestQOptions(doc.system.effect);
    const row = { name: doc.name, count: options.length,
                  file: path.relative(ROOT, file).split(path.sep).join("/") };
    if (options.length < 2) { unparsed.push(row); continue; }
    doc.system.bestQualityEffects = options;
    if (!dry) fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
    parsed.push(row);
  }
  return { parsed, unparsed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const { parsed, unparsed } = run({ dry: process.argv.includes("--dry") });
  for (const r of parsed.slice(0, 10)) console.log(`+ ${r.name}: ${r.count} вариантов`);
  for (const r of unparsed) console.log(`— НЕ РАЗОБРАН: ${r.name}  (${r.file})`);
  console.log(`\nразобрано: ${parsed.length} | не разобрано: ${unparsed.length}`
            + ` | всего вариантов: ${parsed.reduce((n, r) => n + r.count, 0)}`);
}
