// tools/origins-to-mechanics.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Перегон выдачи Рас, Субрас и Архетипов из текстовых полей в Конструктор
//  Механики.
//
//  Строки книги (system.skills / .talents / .gear) разбирал Мастер создания —
//  и только он. Из-за этого выдача работала ровно один раз, при создании
//  персонажа: дал расу позже — не досталось ничего. Конструктор отыгрывает
//  выдачу при получении предмета, когда бы это ни случилось.
//
//  Что переводится и что нет — решает не удобство, а честность:
//
//    Навыки  — переводятся целиком. Их синтаксис уже машинный: тот же разбор
//        живёт в creation.mjs, поэтому грамматика взята оттуда, а не выдумана;
//    Таланты — переводятся те, что названы по имени, в том числе выбором
//        «A или B» (ИЛИ-группа). Записи вида «500хр на Психосилы», «Psy Rating
//        (×2)», «7 талантов 1 уровня» механического выражения не имеют — их
//        трогать нельзя, они остаются текстом;
//    Снаряжение — НЕ переводится. Из 124 строк 105 несут количество, качество,
//        потолок Редкости или выбор («L. Chain Weapon (до R1, Best.Q) или
//        L. Power Weapon (до R3)»). Конструктор выдаёт предмет, а не описание
//        условий его получения, и перевод потерял бы ровно то, ради чего эти
//        строки написаны.
//
//  Запуск:  node tools/origins-to-mechanics.mjs [--apply]
//  Без --apply только считает и печатает отчёт, ничего не трогая.
// ════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../module/constants/skills.mjs";
import { SKILL_SPECIALIZATIONS, matchSpec } from "../module/constants/skill-specializations.mjs";
import { abs, SRC_ROOT } from "./packs.mjs";

const APPLY = process.argv.includes("--apply");
const FLAG  = "warhammer-dbc";
const TYPES = ["race", "subrace", "archetype"];

// ── Словари разбора ─────────────────────────────────────────────────────────
// Английские имена Навыков из книги. Держим здесь, а не берём из SKILLS_DEF:
// там подписи русские, а в строках книги — английские.
const SK = {
  "acrobatics": "acrobatics", "athletics": "athletics", "awareness": "awareness",
  "charm": "charm", "command": "command", "commerce": "commerce", "deceive": "deceive",
  "dodge": "dodge", "inquiry": "inquiry", "interrogate": "interrogate",
  "intimidate": "intimidate", "logic": "logic", "medicae": "medicae", "parry": "parry",
  "psyniscience": "psyniscience", "scrutiny": "scrutiny", "security": "security",
  "sleight of hand": "sleightOfHand", "stealth": "stealth", "survival": "survival",
  "tech-use": "techUse", "tech use": "techUse"
};

// В корбуке группы пишутся сокращённо и вразнобой — здесь ВСЕ варианты,
// иначе запись молча теряется (тот же список, что в creation.mjs).
const GRP = {
  "common lore": "commonLore", "com. lore": "commonLore", "com lore": "commonLore",
  "forbidden lore": "forbiddenLore", "for. lore": "forbiddenLore", "for lore": "forbiddenLore",
  "scholastic lore": "scholasticLore", "schol. lore": "scholasticLore", "schol lore": "scholasticLore",
  "linguistics": "linguistics", "navigation": "navigation", "navigate": "navigation",
  "operate": "operate", "trade": "trade"
};

const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const rankOf = n => n >= 30 ? "expert" : n >= 20 ? "veteran" : n >= 10 ? "trained" : "knows";

let idSeq = 0;
/** Устойчивый id записи: перегон дважды не должен менять файл. */
const mkId = (docId, tag) => `${String(docId).slice(0, 8)}${tag}${(idSeq++).toString(36)}`.slice(0, 16);

/** Разбивка по запятым верхнего уровня — запятая внутри скобок это «и обе». */
function splitTopLevel(s) {
  const out = []; let cur = "", depth = 0;
  for (const ch of String(s)) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

/** Разбивка «A или B» / «A / B» на верхнем уровне скобок. */
function splitChoice(s) {
  const str = String(s);
  const out = []; let cur = "", depth = 0, i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (ch === "(") depth++; else if (ch === ")") depth--;
    if (depth === 0 && (ch === "/" || ch === ";")) { out.push(cur); cur = ""; i++; continue; }
    // «или» ищем регуляркой, а не срезом фиксированной длины: пробелов вокруг
    // него в книге бывает и два, и перенос строки.
    const m = depth === 0 ? str.slice(i).match(/^\s+или\s+/) : null;
    if (m) { out.push(cur); cur = ""; i += m[0].length; continue; }
    cur += ch; i++;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

// ── Навыки → записи Конструктора ────────────────────────────────────────────

/**
 * Одна строка Навыка → запись Механики, либо null (не разобрали).
 * Возвращает массив: «Trade (Armourer, Weaponsmith)» это две записи.
 */
function skillEntries(str, docId, out, unknown) {
  const m = str.match(/\+(\d+)/);
  const rank = rankOf(m ? parseInt(m[1]) : 0);
  let body = str.replace(/\+\d+/, "").trim();

  // «1 Scholastic Lore на выбор» — та же «любая специализация», записанная с
  // другого конца. Форма редкая, но терять её из-за порядка слов глупо.
  const loose = body.match(/^(\d+)\s+(.+?)\s+на\s+выбор$/i);
  if (loose && GRP[norm(loose[2])]) {
    const gkey = GRP[norm(loose[2])];
    out.push({
      id: mkId(docId, "s"), kind: "skill", skillScope: "group", skillKey: gkey,
      specKey: "__choice__", specialty: "",
      specChoiceKeys: (SKILL_SPECIALIZATIONS[gkey] || []).filter(s => !s.free).map(s => s.key),
      specChoiceCount: parseInt(loose[1]) || 1, specChoiceAny: true, rank
    });
    return;
  }

  const gm = body.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (gm) {
    const gkey = GRP[norm(gm[1])];
    if (gkey) {
      const specs = SKILL_SPECIALIZATIONS[gkey] || [];
      const parts = gm[2].split(",").map(x => x.trim()).filter(Boolean);
      for (const raw of parts) {
        // «любые N» / «любое 1» — выбор актора при получении. \w без флага u
        // кириллицу не ловит, поэтому хвост слова берём как «не пробел».
        const wild = raw.match(/люб\S*\s+(\d+)/i);
        if (wild || /^люб/i.test(raw)) {
          out.push({
            id: mkId(docId, "s"), kind: "skill", skillScope: "group", skillKey: gkey,
            specKey: "__choice__", specialty: "",
            specChoiceKeys: specs.filter(s => !s.free).map(s => s.key),
            specChoiceCount: wild ? parseInt(wild[1]) : 1, specChoiceAny: true, rank
          });
          continue;
        }
        // «Battle Cant или High Gothic» — выбор из перечисленных.
        const alts = splitChoice(raw);
        if (alts.length > 1) {
          const keys = alts.map(a => matchSpec(gkey, a)?.key).filter(Boolean);
          if (keys.length === alts.length) {
            out.push({
              id: mkId(docId, "s"), kind: "skill", skillScope: "group", skillKey: gkey,
              specKey: "__choice__", specialty: "", specChoiceKeys: keys,
              specChoiceCount: 1, rank
            });
            continue;
          }
          unknown.push(`${str} → специализации не опознаны: ${alts.join(" / ")}`);
          continue;
        }
        // «Astartes, Horus Heresy and Long War» — союз «and» это тоже перечень,
        // НО сперва пробуем строку целиком: в каталоге есть комбинированные
        // специализации («Ересь Хоруса и Долгая Война»), и разбив их по «and»,
        // мы выдали бы и объединённую, и её половину.
        const whole = matchSpec(gkey, raw);
        const pieces = whole ? [raw] : raw.split(/\s+and\s+/i).map(x => x.trim()).filter(Boolean);
        for (const one of pieces) {
          const def = matchSpec(gkey, one);
          if (def) {
            out.push({
              id: mkId(docId, "s"), kind: "skill", skillScope: "group", skillKey: gkey,
              specKey: def.key, specialty: def.ru || def.label, specChoiceKeys: [],
              specChoiceCount: 1, rank
            });
          } else {
            // Своя специализация: в каталоге её нет, но выдать её надо.
            out.push({
              id: mkId(docId, "s"), kind: "skill", skillScope: "group", skillKey: gkey,
              specKey: "", specialty: one, specChoiceKeys: [], specChoiceCount: 1, rank
            });
          }
        }
      }
      return;
    }
  }

  const skey = SK[norm(body)];
  if (skey) {
    out.push({
      id: mkId(docId, "s"), kind: "skill", skillScope: "plain", skillKey: skey,
      specKey: "", specialty: "", specChoiceKeys: [], specChoiceCount: 1, rank
    });
    return;
  }
  unknown.push(str);
}

// ── Разбор документа ────────────────────────────────────────────────────────

/** Пустая заготовка записи — поля те же, что кладёт Конструктор. */
const baseEntry = () => ({
  corruptionValue: "1", woundsValue: "1", cohesionRole: "any", cohesionValue: "1",
  charKey: "ws", field: "total", op: "add", value: 1,
  sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false, rating: "",
  specialization: "", skillScope: "plain", skillKey: "", specKey: "", specialty: "",
  specChoiceKeys: [], specChoiceCount: 1, rank: "untrained",
  weightScope: "all", weightMode: "kg", weightValue: 1,
  movementTarget: "spd", movementValue: 1, ignoreTerrainProps: [],
  equipMode: "choice", equipQty: 1, label: "", code: ""
});

const fill = e => ({ ...baseEntry(), ...e });

function walk(dir, fn) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, d.name);
    if (d.isDirectory()) walk(f, fn);
    else if (f.endsWith(".json")) fn(f);
  }
}

const TALENT_IDX = packIndex("talents");
const GEAR_IDX = new Map();
for (const pack of ["weapons", "armor", "gear", "ammunition", "tools", "shields", "implants"]) {
  for (const [k, v] of packIndex(pack)) if (!GEAR_IDX.has(k)) GEAR_IDX.set(k, { ...v, pack });
}

/** Одна альтернатива Таланта → запись, либо null. */
function talentEntry(str, docId) {
  const budget = budgetEntry(str, docId);
  if (budget) return budget;
  const bare = str.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
  const spec = str.match(/\(([^)]*)\)\s*$/);
  const hit = TALENT_IDX.get(str.toLowerCase()) || TALENT_IDX.get(bare);
  if (!hit) return null;
  return {
    id: mkId(docId, "t"), kind: "talent", sourceUuid: hit.uuid, sourceName: hit.name,
    sourceImg: hit.img || "", specialization: spec ? spec[1].trim() : ""
  };
}

/** Одна альтернатива снаряжения → запись, либо null. */
function gearEntry(str, docId) {
  const m = gearMods(str);
  const hit = GEAR_IDX.get(m.name.toLowerCase());
  if (!hit) return null;
  return {
    id: mkId(docId, "e"), kind: "equipment", equipMode: "direct",
    equipSourceUuid: hit.uuid, equipSourceName: hit.name, equipSourceImg: hit.img || "",
    equipQty: m.qty, equipQuality: m.quality, equipMaxAvailability: m.avail
  };
}

/**
 * Разбор списка «имя, имя или имя» одного поля. Прямые записи и ИЛИ-группы
 * складываются отдельно, неопознанное возвращается строкой — чтобы поле не
 * опустело там, где книга сказала то, чего Конструктор не умеет.
 */
function parseList(raw, docId, make) {
  const entries = [], leftover = [];
  for (const part of splitTopLevel(raw)) {
    const alts = splitChoice(part);
    if (alts.length > 1) {
      const sub = alts.map(a => make(a, docId));
      if (sub.every(Boolean)) { entries.push({ kind: "__or__", items: sub.map(fill) }); continue; }
      leftover.push(part);
      continue;
    }
    const one = make(part, docId);
    if (one) entries.push(one); else leftover.push(part);
  }
  return { entries, leftover };
}

const report = { docs: 0, skillEntries: 0, talentEntries: 0, gearEntries: 0,
                 unknown: [], leftTalents: [], leftGear: [], touched: [] };

walk(abs(SRC_ROOT), (file) => {
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { return; }
  if (!TYPES.includes(doc.type)) return;

  const raw = String(doc.system?.skills || "").trim();
  const rawTal  = String(doc.system?.talents || "").trim();
  const rawGear = String(doc.system?.gear || "").trim();
  if (!raw && !rawTal && !rawGear) return;

  const entries = [], unknown = [];
  for (const part of splitTopLevel(raw)) {
    // Выбор целой записи — «Intimidate или Security»: ИЛИ-группа.
    const alts = splitChoice(part);
    if (alts.length > 1) {
      const sub = [];
      for (const a of alts) skillEntries(a, doc._id, sub, unknown);
      if (sub.length) {
        entries.push({ kind: "__or__", items: sub.map(fill) });
      }
      continue;
    }
    skillEntries(part, doc._id, entries, unknown);
  }

  const tal  = parseList(rawTal,  doc._id, talentEntry);
  const gear = parseList(rawGear, doc._id, gearEntry);

  const all = [...entries, ...tal.entries, ...gear.entries];
  if (!all.length && !unknown.length) return;
  report.docs++;
  report.skillEntries  += entries.length;
  report.talentEntries += tal.entries.length;
  report.gearEntries   += gear.entries.length;
  if (unknown.length) report.unknown.push(`${doc.name}: ${unknown.join("; ")}`);
  if (tal.leftover.length)  report.leftTalents.push(`${doc.name}: ${tal.leftover.join("; ")}`);
  if (gear.leftover.length) report.leftGear.push(`${doc.name}: ${gear.leftover.join("; ")}`);
  report.touched.push({ file, doc, entries: all, leftTal: tal.leftover, leftGear: gear.leftover });
});

// ── Печать отчёта / запись ──────────────────────────────────────────────────

console.log(`Затронуто записей: ${report.docs}`);
console.log(`Навыков: ${report.skillEntries}, Талантов: ${report.talentEntries}, Снаряжения: ${report.gearEntries}`);
const show = (title, list) => {
  if (!list.length) { console.log(`
${title}: всё разобрано.`); return; }
  console.log(`
${title} (${list.length}) — остаётся строкой:`);
  for (const u of list) console.log("  " + u);
};
show("ТАЛАНТЫ", report.leftTalents);
show("СНАРЯЖЕНИЕ", report.leftGear);
if (report.unknown.length) {
  console.log(`\nНЕ РАЗОБРАНО (${report.unknown.length}) — остаётся строкой, выдаётся вручную:`);
  for (const u of report.unknown) console.log("  " + u);
} else {
  console.log("\nНеразобранных записей нет.");
}

if (!APPLY) {
  console.log("\nСухой прогон: файлы не тронуты. Повторите с --apply.");
  process.exit(0);
}

for (const rest of report.touched) {
  const { file, doc, entries } = rest;
  const flags = doc.flags?.[FLAG] ?? {};
  const groups = Array.isArray(flags.mechanics) ? [...flags.mechanics] : [];

  // Прямые записи ложатся одной И-группой, каждый выбор — своей ИЛИ-группой:
  // «И» применяет всё сразу, «ИЛИ» спрашивает актора.
  const direct = entries.filter(e => e.kind !== "__or__").map(fill);
  if (direct.length) {
    groups.push({ id: mkId(doc._id, "g"), operator: "AND", entries: direct });
  }
  for (const or of entries.filter(e => e.kind === "__or__")) {
    groups.push({ id: mkId(doc._id, "g"), operator: "OR", entries: or.items });
  }

  doc.flags = { ...(doc.flags || {}), [FLAG]: { ...flags, mechanics: groups } };
  // Разобранное убираем, неразобранное оставляем строкой: молча выбросить
  // требование книги хуже, чем оставить его ГМу на глаза.
  doc.system.skills  = "";
  doc.system.talents = (rest.leftTal  || []).join(", ");
  doc.system.gear    = (rest.leftGear || []).join(", ");
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
}
console.log(`\nЗаписано файлов: ${report.touched.length}`);

// ── Таланты и снаряжение → записи Конструктора ───────────────────────────────
//
//  Имя из книги ищется в паке по английской части («Frenzy» в «Frenzy /
//  Бешенство»). Что не нашлось — остаётся строкой: молча выбросить требование
//  книги хуже, чем оставить его ГМу на глаза.
//
//  Отдельно разбираются записи, у которых имени нет вовсе, а есть счётчик:
//  «7 талантов 1 уровня» и «500хр на Психосилы». Это тот же выбор из
//  компендиума с фильтром, только бюджет считается ступенью и опытом.

/** Индекс пака: английская часть имени → { uuid, name }. */
function packIndex(pack) {
  const idx = new Map();
  walk(abs(SRC_ROOT, "/" + pack), (file) => {
    let j; try { j = JSON.parse(fs.readFileSync(file, "utf8")); } catch { return; }
    if (!j?.name || !j?._id) return;
    const uuid = `Compendium.warhammer-dbc.${pack}.Item.${j._id}`;
    const en = String(j.name).split("/")[0].trim().toLowerCase();
    if (!idx.has(en)) idx.set(en, { uuid, name: j.name, img: j.img });
    const full = String(j.name).toLowerCase();
    if (!idx.has(full)) idx.set(full, { uuid, name: j.name, img: j.img });
  });
  return idx;
}

/** «7 талантов 1 уровня», «500хр на Психосилы» — выбор с бюджетом. */
function budgetEntry(str, docId) {
  // \w без флага u кириллицу не ловит — хвост слова берём как «не пробел».
  const tier = str.match(/^(\d+)\s+талант\S*\s+(\d+)\s+уровня/i);
  if (tier) {
    return {
      id: mkId(docId, "b"), kind: "equipment", equipMode: "choice",
      equipCategoryPack: "talents", equipTalentTier: Number(tier[2]),
      equipMaxAvailability: 5,
      equipBudgetMode: "count", equipBudgetValue: Number(tier[1])
    };
  }
  const xp = str.match(/^(\d+)\s*хр\s+на\s+(психосил\S*|техночудес\S*)/i);
  if (xp) {
    return {
      id: mkId(docId, "b"), kind: "equipment", equipMode: "choice",
      equipCategoryPack: /психосил/i.test(xp[2]) ? "psychic-powers" : "tech-powers",
      equipMaxAvailability: 5,
      equipBudgetMode: "xp", equipBudgetValue: Number(xp[1])
    };
  }
  return null;
}

/** «20 доз Химии до R1» / «Narthecium (Good.Q)» → количество, Редкость, качество. */
function gearMods(str) {
  const qty = str.match(/^(\d+)\s*(?:×|x|шт\.?)?\s+/i);
  const avail = str.match(/до\s*R\s*(\d)/i);
  const quality = /best\.?\s*q/i.test(str) ? "best" : /good\.?\s*q/i.test(str) ? "good" : "common";
  const name = str
    .replace(/^\d+\s*(?:×|x|шт\.?)?\s+/i, "")
    .replace(/\((?:[^()]*)\)\s*$/, "")
    .replace(/\bдо\s*R\s*\d\b/ig, "")
    .replace(/[;,]\s*$/, "")
    .trim();
  return { qty: qty ? Number(qty[1]) : 1, avail: avail ? Number(avail[1]) : 5, quality, name };
}
