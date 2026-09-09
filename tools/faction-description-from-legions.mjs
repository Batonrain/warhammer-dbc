// tools/faction-description-from-legions.mjs
// ════════════════════════════════════════════════════════════════════════
//  ОПИСАНИЯ КАРТОЧЕК ЛЕГИОНОВ И ОРДЕНОВ (wdbc-i4y2).
//
//  Из 998 «карточек без слов» самой заметной кучей остались Фракции: 83 из
//  123 пусты, и все 83 — это Ордена Космодесанта и легионы/банды Хаоса.
//  Прежний разбор книг (tools/card-description-from-book.mjs) их не взял, и
//  правильно: в книге у ордена НЕТ абзаца прозы. Страница «ЧЕРТЫ ЛЕГИОНОВ»
//  даёт по каждому ровно три вещи — Геносемя, Культуру и Проклятье, то есть
//  чистые правила, а не описание.
//
//  Эти три вещи уже разобраны и выверены в module/constants/legions.mjs —
//  оттуда их берут Мастер создания, Механика и предикаты. Инструмент кладёт
//  тот же текст в карточку Фракции, чтобы открывший её в компендиуме читал
//  правила своего Ордена, а не пустоту.
//
//  ЧЕГО ИНСТРУМЕНТ НЕ ДЕЛАЕТ:
//   • не трогает карточки, у которых уже есть хоть какой-то текст правила;
//   • не выдумывает: нет записи в legions.mjs — карточка остаётся пустой;
//   • ничего не пишет за пределами packs-src/factions.
//
//    node tools/faction-description-from-legions.mjs --dry
//    node tools/faction-description-from-legions.mjs
// ════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { LEGIONS } from "../module/constants/legions.mjs";
import { hasRuleText } from "./rule-text-fields.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const FACTIONS = path.join(ROOT, "packs-src/factions");

/** Русское название карточки отличается от названия в legions.mjs. */
const ALIASES = { "осквернители": "насильники" };

/** Признак того, что описание уже написано этим инструментом, — можно переписать. */
const OURS = /^<p><strong>Геносемя\.<\/strong>/;

const norm = (s) => String(s || "")
  .replace(/­/g, "").replace(/ё/gi, "е").toLowerCase()
  .replace(/[«»"']/g, "").replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim();

/** «XVII – Word Bearers / XVII – Несущие Слово» → «Несущие Слово». */
export function russianName(name) {
  const tail = String(name).includes("/") ? String(name).split("/").pop() : String(name);
  return tail.replace(/^\s*[IVX]+\s*[–—-]\s*/, "").trim();
}

/** Указатель: нормализованное имя → запись легиона или ордена. */
export function legionIndex() {
  const idx = new Map();
  for (const l of LEGIONS) {
    idx.set(norm(l.name), l);
    for (const c of l.chapters || []) idx.set(norm(c.name), c);
  }
  return idx;
}

const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Геносемя / Культура / Проклятье — тремя абзацами, как в книге. */
export function describe(rec) {
  const out = [];
  if (rec.geneseed) out.push(`<p><strong>Геносемя.</strong> ${esc(rec.geneseed)}</p>`);
  if (rec.culture)  out.push(`<p><strong>Культура.</strong> ${esc(rec.culture)}</p>`);
  if (rec.curseChoices?.length) {
    // Краткая строка curse здесь только пересказывает сами варианты — берём
    // варианты целиком, чтобы карточка не повторяла одно и то же дважды.
    out.push("<p><strong>Проклятье.</strong> Выбрать одно:</p>");
    out.push("<ul>" + rec.curseChoices
      .map(c => `<li><em>${esc(c.name)}</em> — ${esc(c.text)}</li>`).join("") + "</ul>");
  } else if (rec.curse) {
    out.push(`<p><strong>Проклятье.</strong> ${esc(rec.curse)}</p>`);
  }
  return out.join("\n");
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith(".json") && !p.endsWith("_Folder.json")) out.push(p);
  }
  return out;
}

export function run({ dry = false } = {}) {
  const idx = legionIndex();
  const filled = [], skipped = [], matched = new Set();

  for (const file of walk(FACTIONS)) {
    let doc;
    try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    if (doc?.type !== "faction" || !doc.system) continue;

    const ours = OURS.test(String(doc.system.description || "").trim());
    const hasText = !ours && hasRuleText(doc);

    const key = norm(russianName(doc.name));
    const rec = idx.get(ALIASES[key] || key);
    if (rec) matched.add(ALIASES[key] || key);
    if (hasText) continue;
    if (!rec) { skipped.push(doc.name); continue; }

    doc.system.description = describe(rec);
    if (!dry) fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
    filled.push(doc.name);
  }

  const orphans = [...idx.keys()].filter(k => !matched.has(k));
  return { filled, skipped, orphans };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const dry = process.argv.includes("--dry");
  const { filled, skipped, orphans } = run({ dry });
  for (const n of filled) console.log(`+ ${n}`);
  console.log(`\n${dry ? "будет заполнено" : "заполнено"}: ${filled.length} | без записи в legions.mjs: ${skipped.length}`);
  if (skipped.length) console.log("  " + skipped.join("\n  "));
  if (orphans.length) {
    console.log(`\nЕсть в legions.mjs, но карточки Фракции нет (${orphans.length}):`);
    console.log("  " + orphans.join("\n  "));
  }
}
