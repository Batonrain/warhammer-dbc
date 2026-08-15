// tools/ritual-reqs.mjs
// ════════════════════════════════════════════════════════════════════════
//  Требования ритуалов из текста книги в предметы packs-src/rituals
//  (wdbc-c63). Механика требований живёт во флаге `warhammer-dbc.req` и
//  проверяется checkRequirements (module/apps/mechanics.mjs); книга описывает
//  их строкой «Требования: …» в начале каждого ритуала.
//
//  Выгрузка главы «Мистика» в packs-src/books/core.json — сырая, двумя
//  колонками вперемешку: текст соседней колонки влезает в середину
//  требований, а заголовки соседних ритуалов склеиваются в один. Поэтому
//  разбор строгий и с двойной сверкой:
//
//    1. любое неузнанное слово отменяет ВЕСЬ блок — переносится либо всё
//       требование целиком, либо ничего;
//    2. «Запись (N)» из книги сверяется с system.record предмета. Число уже
//       лежит в паках и получено отдельно от этого текста, поэтому его
//       совпадение и есть подтверждение, что требования достались своему
//       ритуалу, а не соседнему по развороту.
//
//  Что не прошло сверку — остаётся пустым и попадает в отчёт: пустые
//  требования видно, а чужие молча запретили бы ритуал тому, кому он положен.
//
//  Запуск:  node tools/ritual-reqs.mjs [--write]
// ════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { SKILL_SPECIALIZATIONS } from "../module/constants/skill-specializations.mjs";

const NS = "warhammer-dbc";

// Английские названия из книги → ключи навыков системы. Группы и обычные
// навыки различаются: у группы требование адресует ещё и специализацию.
const GROUP_SKILLS = {
  "Common Lore": "commonLore",
  "Forbidden Lore": "forbiddenLore",
  "Scholastic Lore": "scholasticLore",
  "Linguistics": "linguistics",
  "Navigation": "navigation",
  "Operate": "operate",
  "Trade": "trade"
};
const PLAIN_SKILLS = {
  "Medicae": "medicae",
  "Psyniscience": "psyniscience",
  "Tech-Use": "techUse"
};

// Ступени книги: «+0» — Знает, дальше по SKILL_RANKS (constants/characteristics).
const RANK_BY_BONUS = { 0: "knows", 10: "trained", 20: "veteran", 30: "expert" };

/** Ключ специализации по английскому названию из книги. */
function specKeyOf(groupKey, label) {
  const hit = (SKILL_SPECIALIZATIONS[groupKey] || []).find(s => s.label === label);
  return hit?.key ?? null;
}

/**
 * Текст требований блока: от «Требования:» до следующего раздела ритуала.
 * Второй блок требований в том же куске — признак склейки колонок, отказ.
 * @returns {string|null}
 */
export function blockRequirementText(body) {
  const heads = [...String(body).matchAll(/Требовани[яе]:/g)];
  if (heads.length !== 1) return null;
  // Следом за Требованиями идут Ассистенты, но выгрузка иногда уносит их в
  // соседнюю колонку — тогда границей служит следующий раздел, «Ритуал:».
  const m = body.match(/Требовани[яе]:\s*([\s\S]*?)\s*(?:Ассистенты:|Ритуал:)/);
  return m ? m[1].trim() : null;
}

/** Разбор одной записи вида «Forbidden Lore (Warp) +10» → запись требования. */
function parseSkillRef(text) {
  const m = text.match(/^([A-Za-z][A-Za-z\- ]*?)(?:\s*\(([^)]+)\))?\s*\+(\d+)$/);
  if (!m) return null;
  const [, rawName, rawSpec, bonus] = m;
  const name = rawName.trim();
  const rank = RANK_BY_BONUS[Number(bonus)];
  if (!rank) return null;

  const groupKey = GROUP_SKILLS[name];
  if (groupKey) {
    // У группы специализация обязательна: без неё требование закрывалось бы
    // любой специализацией группы, а книга называет конкретную.
    if (!rawSpec) return null;
    const specKey = specKeyOf(groupKey, rawSpec.trim());
    if (!specKey) return null;
    return { skillScope: "group", skillKey: groupKey, specKey, specialty: rawSpec.trim(), rank };
  }

  const plainKey = PLAIN_SKILLS[name];
  if (!plainKey || rawSpec) return null;
  return { skillScope: "plain", skillKey: plainKey, specKey: "", specialty: "", rank };
}

/** Разбить по запятым верхнего уровня (скобки специализаций не трогаем). */
function splitTop(text) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}

/**
 * Строка «Требования:» из книги → { record, groups }.
 * record — число из «Запись (N)» (или null): оно уже лежит в system.record и
 * записью требования не становится, но служит сверкой привязки.
 * @returns {{record: number|null, groups: object[]}|null} null — не разобралось
 */
export function parseRequirements(text) {
  let record = null;
  const groups = [];

  for (const part of splitTop(String(text).replace(/\.\s*$/, ""))) {
    const rec = part.match(/^Запись\s*\(([^)]*)\)$/);
    if (rec) {
      // «Запись (Х)» — переменная: у ритуала нет одного числа, сверять нечем.
      if (!/^\d+$/.test(rec[1].trim())) return null;
      record = Number(rec[1]);
      continue;
    }
    const alts = part.split(/\s+или\s+/).map(s => s.trim());
    const entries = alts.map(parseSkillRef);
    if (entries.some(e => !e)) return null;
    groups.push({ operator: entries.length > 1 ? "OR" : "AND", entries });
  }

  return groups.length ? { record, groups } : null;
}

// ── Ниже — сборка: чтение книги и паков, сверка, запись ──────────────────

/** Текст без разметки и без переносов: выгрузка ломает слова дефисом. */
const strip = html => String(html)
  .replace(/<[^>]+>/g, " ")
  .replace(/(\S)-\s+(\S)/g, "$1$2")
  .replace(/\s+/g, " ")
  .trim();

/** Блоки «заголовок + проза» главы Мистики. */
export function ritualBlocks(book) {
  const chapter = book.entries.find(e => /МИСТИКА/i.test(e.name));
  const out = [];
  for (const page of chapter?.pages ?? []) {
    for (const m of page.html.matchAll(/<h2>([^<]*)<\/h2>\s*<p>([\s\S]*?)<\/p>/g)) {
      out.push({ name: strip(m[1]), body: strip(m[2]) });
    }
  }
  return out;
}

/** Все файлы ритуалов packs-src (кроме описаний папок). */
function ritualFiles(dir = "packs-src/rituals") {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...ritualFiles(path));
    else if (entry.endsWith(".json") && entry !== "_Folder.json") out.push(path);
  }
  return out;
}

/** Устойчивый идентификатор записи: пересборка не должна менять флаги. */
const stableId = seed => createHash("sha1").update(seed).digest("base64")
  .replace(/[^A-Za-z0-9]/g, "").slice(0, 16);

/** Разложить разобранные группы по формату флага (с идентификаторами). */
function withIds(groups, seed) {
  return groups.map((g, gi) => ({
    id: stableId(`${seed}:g${gi}`),
    operator: g.operator,
    entries: g.entries.map((e, ei) => ({
      id: stableId(`${seed}:g${gi}:e${ei}`),
      kind: "reqSkill",
      skillScope: e.skillScope, skillKey: e.skillKey, specKey: e.specKey,
      specialty: e.specialty, rank: e.rank,
      sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false, rating: "",
      raceKey: "", archetypeName: "", patronKey: ""
    }))
  }));
}

export function run({ write = false } = {}) {
  const book   = JSON.parse(readFileSync("packs-src/books/core.json", "utf8"));
  const blocks = ritualBlocks(book);
  const files  = ritualFiles();

  // Заголовок берётся целиком: склеенный из двух ритуалов не совпадёт ни с
  // одним именем предмета, и блок отпадёт сам.
  const byName = new Map();
  for (const path of files) {
    const item = JSON.parse(readFileSync(path, "utf8"));
    byName.set(item.name, { path, item });
  }

  const report = { filled: [], noBlock: [], unparsed: [], recordMismatch: [] };

  for (const { name, body } of blocks) {
    const target = byName.get(name);
    if (!target) continue;                       // склейка заголовков или не ритуал
    const text = blockRequirementText(body);
    if (!text) { report.noBlock.push(name); continue; }
    const parsed = parseRequirements(text);
    if (!parsed) { report.unparsed.push(`${name} ⇒ ${text}`); continue; }

    // Сверка привязки: Запись из книги против числа в паке.
    const record = Number(target.item.system?.record) || 0;
    if ((parsed.record ?? 0) !== record) {
      report.recordMismatch.push(`${name}: книга ${parsed.record ?? "—"}, пак ${record}`);
      continue;
    }

    const groups = withIds(parsed.groups, target.item._id);
    if (write) {
      target.item.flags = { ...target.item.flags, [NS]: { ...(target.item.flags?.[NS]), req: groups } };
      writeFileSync(target.path, JSON.stringify(target.item, null, 2) + "\n");
    }
    report.filled.push(`${name}: ${groups.length} гр.`);
  }

  const withReq = files.filter(p => {
    const it = JSON.parse(readFileSync(p, "utf8"));
    return (it.flags?.[NS]?.req || []).length > 0;
  }).length;

  return { ...report, total: files.length, withReq, blocks: blocks.length };
}

if (process.argv[1]?.endsWith("ritual-reqs.mjs")) {
  const res = run({ write: process.argv.includes("--write") });
  console.log(`Ритуалов в packs-src: ${res.total}; блоков в книге: ${res.blocks}`);
  console.log(`Проставлено требований: ${res.filled.length} (всего с требованиями: ${res.withReq})`);
  console.log(`\nНе разобралось (${res.unparsed.length}):\n  ` + res.unparsed.join("\n  "));
  console.log(`\nЗапись не сошлась (${res.recordMismatch.length}):\n  ` + res.recordMismatch.join("\n  "));
  console.log(`\nБлок требований не найден (${res.noBlock.length}):\n  ` + res.noBlock.join("\n  "));
}
