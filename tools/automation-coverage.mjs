// tools/automation-coverage.mjs
// ════════════════════════════════════════════════════════════════════════
//  ЗАМЕР АВТОМАТИЗАЦИИ ЧЕРТ, ТАЛАНТОВ И НАВЫКОВ — шаг 1 плана «закрыть всю
//  автоматизацию Черт, Талантов и Навыков» (18.11.2026).
//
//  Вопрос владельца: сколько Черт и Талантов система считает сама, а сколько
//  игроку приходится помнить. Одним числом на это не ответить — у записи пять
//  способов «работать» и три способа «не работать», и все они выглядят
//  одинаково на листе. Поэтому каждая запись раскладывается по корзинам:
//
//  РАБОТАЕТ (auto)
//    • запись Конструктора (кроме памятки и пустой Возможности);
//    • ActiveEffect с изменениями;
//    • Возможность, у которой в module/constants/capabilities.mjs есть читатель;
//    • код опознаёт предмет по имени (itemHasName/hasAbility/hasTalent…);
//    • честная заметка `system.notes` говорит «Реализовано/Смоделировано/
//      Автоматизировано/Подключено/Читается…» без слова «частично».
//  ЧАСТИЧНО (partial) — заметка говорит «частично».
//  ПАМЯТКА (memo)  — единственная механика — кнопка «Памятка», которая пишет
//                    текст Черты в чат (код кнопки начинается «// Памятка»).
//  ЗАГЛУШКА (stub) — единственная механика — Возможность без читателя: на
//                    листе видна, в расчёт не входит.
//  ТЕКСТ (text)    — ничего из перечисленного; у таких в `notes` лежит
//                    причина («Не смоделировано: …»), её вид — `reason`.
//
//  Отдельный флажок `conflict`: заметка говорит «не смоделировано», а код
//  опознаёт предмет по имени. Значит, одно из двух устарело — такие записи
//  засчитываются как «работает», но идут в отчёт списком на проверку.
//
//  Навыки — не предметы, а таблица module/constants/skills.mjs. Для них
//  замеряется, в каких файлах механики (вне module/constants) встречается
//  ключ Навыка: это места, где Навык участвует в чём-то сверх обычного броска
//  с листа.
//
//  Запуск:
//    node tools/automation-coverage.mjs                 — сводка в консоль
//    node tools/automation-coverage.mjs --md out.md     — полный отчёт
//    node tools/automation-coverage.mjs --json          — данные целиком
//    --usage usage.json  — {"Имя предмета": число персонажей} из мира
//                          (tools/world-item-usage.mjs), добавляет столбец
//                          «у персонажей мира».
// ════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { readModule, nameDetectionStrings } from "./capability-reachability.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
export const PACKS = ["talents", "traits", "aeldari-talents", "aeldari-traits"];
export const BUCKETS = ["auto", "partial", "memo", "stub", "text"];
export const BUCKET_LABEL = {
  auto: "работает", partial: "частично", memo: "памятка в чат",
  stub: "заглушка", text: "только текст"
};

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".json") && e.name !== "_Folder.json") out.push(p);
  }
  return out;
}

const normName = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/gi, "");

/** Половинки двуязычного имени без специализации в скобках. */
export function nameHalves(name) {
  return String(name || "").split("/")
    .map(s => s.replace(/\(.*?\)/g, "").trim())
    .filter(s => s.length > 2);
}

/**
 * Имена, по которым код опознаёт предмет. Берётся разбор
 * capability-reachability (литералы в вызовах опознания и регулярки `match:`)
 * и добавляются две формы, которых он не видит:
 *  • константа-строка аргументом: `itemHasName(i, BONE_SONG)`;
 *  • массив строк-имён в файле, который опознаёт по имени:
 *    `const X_TALENTS = ["A", "B"]` … `.some(n => itemHasName(i, n))`.
 */
export function detectionNames(moduleFiles = readModule()) {
  const names = nameDetectionStrings(moduleFiles);
  const CALL = /\b(?:itemHasName|hasAbility|hasTalent|hasItemNamed|hasNamed|itemsNamed|hasTrait|hasTalentNamed)\s*\(([^)]*)\)/g;
  for (const src of moduleFiles.values()) {
    const consts = new Map();
    for (const m of src.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*"([^"\n]+)"/g)) consts.set(m[1], m[2]);
    let detects = false;
    for (const m of src.matchAll(CALL)) {
      detects = true;
      for (const id of m[1].matchAll(/\b([A-Z][A-Z0-9_]*)\b/g)) if (consts.has(id[1])) names.add(consts.get(id[1]));
    }
    if (!detects) continue;
    for (const m of src.matchAll(/const\s+([A-Z][A-Z0-9_]*(?:NAMES?|TALENTS?|TRAITS?)[A-Z0-9_]*)\s*=\s*(?:new Set\()?\[([^\]]*)\]/g)) {
      for (const lit of m[2].matchAll(/"([^"\n]+)"/g)) names.add(lit[1]);
    }
  }
  return new Set([...names].map(normName).filter(Boolean));
}

const NOTE_DONE = /^(?:\s*)(?:Реализован|РЕАЛИЗОВАН|Смоделирован|Автоматизирован|Подключен|Читается|Работает|Механика\s+—\s+не\s+здесь|Движение подключено|Дальность Движения считает)/;
const NOTE_PARTIAL = /частичн/i;
const NOTE_NOT = /^\s*Не смоделировано/;

/** Вид причины у записи «только текст» — первые слова шаблонной заметки. */
export function reasonOf(notes) {
  const n = String(notes || "").trim();
  if (!n) return "без заметки";
  if (/срабатывает по условию\/триггеру/.test(n)) return "условие или триггер";
  if (/тратит\/даёт игровой ресурс/.test(n)) return "трата ресурса (Судьба, Бесчестие, Реакция…)";
  if (/свойства\/AP конкретного пред/.test(n)) return "меняет конкретный предмет";
  if (/адресован ДРУГИМ/.test(n)) return "действует на других";
  if (/дарует новую способность/.test(n)) return "новая способность или действие";
  return "своя причина (см. заметку)";
}

function classify(doc, ctx) {
  const groups = doc.flags?.["warhammer-dbc"]?.mechanics || [];
  const entries = groups.flatMap(g => g?.entries || []);
  const changes = (doc.effects || []).reduce((n, e) => n + (e?.system?.changes?.length || 0), 0);
  const notes = String(doc.system?.notes || "");
  const ways = [];
  let memo = false, stub = false;

  for (const e of entries) {
    if (e?.kind === "script" && /^\s*\/\/\s*Памятка/.test(String(e.code || ""))) { memo = true; continue; }
    if (e?.kind === "capability") {
      const cap = ctx.capabilities[e.capabilityKey];
      if (cap && String(cap.reader || "").trim()) ways.push("capability");
      else stub = true;
      continue;
    }
    ways.push(`constructor:${e?.kind}`);
  }
  if (changes) ways.push("effect");
  const byName = nameHalves(doc.name).some(h => ctx.detect.has(normName(h)));
  if (byName) ways.push("byName");
  const noteDone = NOTE_DONE.test(notes) && !NOTE_PARTIAL.test(notes.slice(0, 40));
  const notePartial = NOTE_PARTIAL.test(notes.slice(0, 60)) && !NOTE_NOT.test(notes);
  if (noteDone) ways.push("notes");

  let bucket;
  if (ways.length) bucket = "auto";
  else if (notePartial) bucket = "partial";
  else if (memo) bucket = "memo";
  else if (stub) bucket = "stub";
  else bucket = "text";

  // Частичная заметка при работающей части — честнее «частично», чем «работает».
  if (bucket === "auto" && notePartial && !entries.length && !changes) bucket = "partial";

  return {
    bucket,
    ways: [...new Set(ways)],
    conflict: byName && NOTE_NOT.test(notes),
    reason: bucket === "text" ? reasonOf(notes) : ""
  };
}

/** Группа записи: пак + папка; у Элитных архетипов — ещё и сам архетип. */
function groupOf(pack, rel) {
  const parts = rel.split(path.sep).slice(0, -1);
  if (!parts.length) return `${pack} / (корень)`;
  if (parts[0] === "Элитные_архетипы" && parts[1]) return `${pack} / Элитные архетипы / ${parts[1].replace(/_+/g, " ")}`;
  return `${pack} / ${parts[0].replace(/_+/g, " ")}`;
}

/**
 * Разобрать все Черты и Таланты.
 * @returns {{items:object[], skills:object[]}}
 */
export async function analyzeCoverage({ usage = null } = {}) {
  const { CAPABILITIES } = await import("../module/constants/capabilities.mjs");
  const { SKILLS_DEF, GROUP_SKILLS_DEF } = await import("../module/constants/skills.mjs");
  const moduleFiles = readModule();
  const ctx = { capabilities: CAPABILITIES, detect: detectionNames(moduleFiles) };

  const items = [];
  for (const pack of PACKS) {
    const dir = path.join(ROOT, "packs-src", pack);
    for (const file of walk(dir)) {
      let doc;
      try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
      if (doc?.type !== "talent" && doc?.type !== "trait") continue;
      const rel = path.relative(dir, file);
      items.push({
        name: String(doc.name),
        type: doc.type,
        pack,
        group: groupOf(pack, rel),
        elite: rel.startsWith("Элитные_архетипы"),
        file: path.relative(ROOT, file).replace(/\\/g, "/"),
        used: usage ? (usage[doc.name] || 0) : null,
        ...classify(doc, ctx)
      });
    }
  }

  // Навыки: где ключ встречается в механике сверх таблиц-описаний.
  const skills = [];
  const defs = [...Object.entries(SKILLS_DEF), ...Object.entries(GROUP_SKILLS_DEF).map(([k, v]) => [k, { ...v, group: true }])];
  for (const [key, def] of defs) {
    const re = new RegExp(`["'\`.]${key}["'\`]?\\b`);
    const files = [];
    for (const [f, src] of moduleFiles) {
      if (!f.startsWith("module/") || f.startsWith("module/constants/") || f === "module/apps/creation.mjs") continue;
      if (re.test(src)) files.push(f);
    }
    skills.push({ key, label: def.label, en: def.en, group: !!def.group, files });
  }
  return { items, skills };
}

/** Сводка по корзинам: {всего, auto, partial, …}. */
export function tally(items) {
  const t = { total: items.length };
  for (const b of BUCKETS) t[b] = 0;
  for (const it of items) t[it.bucket]++;
  return t;
}

function byGroup(items) {
  const m = new Map();
  for (const it of items) {
    if (!m.has(it.group)) m.set(it.group, []);
    m.get(it.group).push(it);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru"));
}

const pct = (a, b) => b ? `${Math.round(100 * a / b)}%` : "—";

export function toMarkdown({ items, skills }, { date = new Date().toISOString().slice(0, 10), usage = null } = {}) {
  const L = [];
  const hasUsage = items.some(i => i.used !== null);
  L.push(`# Замер автоматизации Черт, Талантов и Навыков (${date})`, "");
  L.push("Собрано `node tools/automation-coverage.mjs --md`. Корзины описаны в шапке инструмента.", "");
  L.push("## Итог", "");
  L.push("| | Всего | Работает | Частично | Памятка | Заглушка | Только текст |");
  L.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  const row = (label, list) => {
    const t = tally(list);
    return `| ${label} | ${t.total} | ${t.auto} (${pct(t.auto, t.total)}) | ${t.partial} | ${t.memo} | ${t.stub} | ${t.text} |`;
  };
  L.push(row("**Все**", items));
  for (const pack of PACKS) {
    const list = items.filter(i => i.pack === pack);
    L.push(row(`${pack}: общие`, list.filter(i => !i.elite)));
    L.push(row(`${pack}: элитные архетипы`, list.filter(i => i.elite)));
  }
  if (hasUsage) {
    const used = items.filter(i => i.used > 0);
    L.push(row("**Есть у персонажей мира**", used));
  }
  L.push("");

  const textOnly = items.filter(i => i.bucket === "text");
  const reasons = new Map();
  for (const it of textOnly) reasons.set(it.reason, (reasons.get(it.reason) || 0) + 1);
  L.push("## Почему «только текст»", "", "| Причина в заметке | Записей |", "| --- | ---: |");
  for (const [r, n] of [...reasons].sort((a, b) => b[1] - a[1])) L.push(`| ${r} | ${n} |`);
  L.push("");

  if (hasUsage) {
    const gaps = items.filter(i => i.used > 0 && i.bucket !== "auto").sort((a, b) => b.used - a.used);
    L.push("## Не работают, но есть у персонажей мира", "");
    L.push("Сортировка по числу персонажей. Это очередь шага 2 плана.", "");
    L.push("| Запись | Тип | Корзина | Персонажей | Группа |", "| --- | --- | --- | ---: | --- |");
    for (const it of gaps) L.push(`| ${it.name} | ${it.type === "talent" ? "Талант" : "Черта"} | ${BUCKET_LABEL[it.bucket]} | ${it.used} | ${it.group} |`);
    L.push("");
  }

  if (hasUsage && usage) {
    const known = new Set(items.map(i => i.name));
    const outside = Object.entries(usage).filter(([n]) => !known.has(n)).sort((a, b) => b[1] - a[1]);
    L.push("## У персонажей, но не из компендиумов Черт и Талантов", "");
    L.push(`${outside.length} названий: Черты рас, легионов и Происхождений, переименованные копии и самодельные записи. В корзины выше не входят.`, "");
    for (const [n, c] of outside) L.push(`- ${n} — ${c}`);
    L.push("");
  }

  const conflicts = items.filter(i => i.conflict);
  L.push("## Заметка спорит с кодом", "");
  L.push("Заметка говорит «Не смоделировано», а код опознаёт запись по имени. Засчитаны как «работает»; одно из двух устарело.", "");
  if (conflicts.length) for (const it of conflicts) L.push(`- ${it.name} — \`${it.file}\``);
  else L.push("Нет.");
  L.push("");

  L.push("## По группам", "");
  L.push("| Группа | Всего | Работает | Частично | Памятка | Заглушка | Текст |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const [g, list] of byGroup(items)) {
    const t = tally(list);
    L.push(`| ${g} | ${t.total} | ${t.auto} | ${t.partial} | ${t.memo} | ${t.stub} | ${t.text} |`);
  }
  L.push("");

  L.push("## Навыки", "");
  L.push("Файлы механики (вне `module/constants` и Мастера создания персонажа), где встречается ключ Навыка. Ноль — Навык только бросается с листа.", "");
  L.push("| Навык | Мест в механике | Где |", "| --- | ---: | --- |");
  for (const s of skills) {
    const where = s.files.slice(0, 6).map(f => `\`${f.replace(/^module\//, "")}\``).join(", ") + (s.files.length > 6 ? ` и ещё ${s.files.length - 6}` : "");
    L.push(`| ${s.label} / ${s.en}${s.group ? " (группа)" : ""} | ${s.files.length} | ${where} |`);
  }
  L.push("");
  return L.join("\n");
}

// Ручной прогон
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const usagePath = arg("--usage");
  const usage = usagePath ? JSON.parse(fs.readFileSync(usagePath, "utf8")) : null;
  const res = await analyzeCoverage({ usage });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(res, null, 1));
  } else if (arg("--md")) {
    fs.writeFileSync(arg("--md"), toMarkdown(res, { usage }));
    console.log(`записано: ${arg("--md")}`);
  } else {
    const t = tally(res.items);
    console.log(`всего ${t.total}: ` + BUCKETS.map(b => `${BUCKET_LABEL[b]} ${t[b]}`).join(", "));
    for (const pack of PACKS) {
      const p = tally(res.items.filter(i => i.pack === pack));
      console.log(`  ${pack.padEnd(16)} ${String(p.total).padStart(4)}: ` + BUCKETS.map(b => `${b} ${p[b]}`).join(", "));
    }
    console.log(`спорных заметок: ${res.items.filter(i => i.conflict).length}`);
  }
}
