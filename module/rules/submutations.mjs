// module/rules/submutations.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СУБМУТАЦИИ (корбук, стр. 440).
//
//  «Многие мутации имеют субмутации, требующие броска d10 на определение. Если
//  мутация не была вызвана Порчей от Провала, персонаж может модифицировать
//  результат броска на до ⅓Inf.b (окр.▼) вверх или вниз, по сути выбирая
//  мутацию из участка таблицы. Если мутация не была вызвана Порчей от Провала,
//  Неделимые персонажи бросают на субмутацию два раза и выбирают один
//  результат. Некоторые субмутации отмечены цветом одного из Богов. Персонажи с
//  Покровительством этого Бога могут выбрать эту субмутацию вместо той, что
//  выпала, или взять её автоматически и не бросать вовсе. Они не могут брать
//  субмутации, отмеченные цветами враждебного Бога и, если бросок не позволяет
//  им выбрать ни одну субмутацию, они должны перебросить его.»
//
//  Таблица субмутаций живёт В ТЕКСТЕ мутации (`system.benefit`), блоком
//  «СУБМУТАЦИИ (d10):» — и в паке (packs-src/mutations), и в библиотеке
//  constants/mutations.mjs, которая тот же текст и собирает. Поэтому здесь
//  разбор текста, а не второй список строк: одна таблица на обе стороны, и
//  своя мутация, дописанная ГМом в том же формате, бросается наравне с
//  книжными.
//
//  Модуль чистый — Foundry не нужен, проверяется test/rules/submutations.test.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { areGodsHostile } from "../constants/chaos-patron.mjs";

/** Ключ Бога по подписи строки таблицы (у «Стального Сердца» строки именные). */
const GOD_BY_LABEL = {
  "Кхорн": "khorne", "Нургл": "nurgle", "Тзинч": "tzeentch", "Слаанеш": "slaanesh"
};

/** Подпись Бога по ключу — для окон и карточек чата. */
export const SUB_GOD_LABELS = {
  khorne: "Кхорн", nurgle: "Нургл", tzeentch: "Тзинч", slaanesh: "Слаанеш"
};

const HEADER   = "СУБМУТАЦИИ";
const SEP      = " — ";                       // подпись строки ← → название
// Пометка цвета Бога в конце строки. «[цвет Бога: X]» — текущая форма;
// «[только для последователей: X]» — прежняя, вводила в заблуждение (по
// книге, стр. 440, цветную строку может получить любой, кроме последователя
// враждебного Бога), читается ради уже выданных предметов в мирах.
const GOD_MARK = /\s*\[(?:цвет Бога|только для последователей):\s*([^\]]+)\]\s*$/;

/** Минус U+2212 книги → обычный дефис: «−1» и «2-3» дальше разбираются одинаково. */
const plainDigits = (s) => String(s ?? "").replace(/−/g, "-").trim();

/**
 * Подпись строки таблицы → диапазон бросков.
 * «7» → 7…7, «2-3» → 2…3, «Кхорн» → без броска, строка Бога.
 * Всё остальное — не подпись (значит, строка продолжает предыдущую).
 */
function parseLabel(label) {
  const t = plainDigits(label);
  if (GOD_BY_LABEL[t]) return { lo: null, hi: null, god: GOD_BY_LABEL[t] };
  const m = t.match(/^(-?\d+)(?:\s*-\s*(-?\d+))?$/);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = m[2] === undefined ? lo : Number(m[2]);
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi), god: "" };
}

/**
 * Разбор блока «СУБМУТАЦИИ (d10):» из текста мутации.
 *
 * @returns {{die:number, rollable:boolean, entries:Array<{
 *   label:string, lo:number|null, hi:number|null, name:string, text:string, god:string
 * }>}} — `entries` пуст, если блока нет.
 */
export function parseSubmutations(benefit) {
  const lines = String(benefit ?? "").split("\n");
  const head  = lines.findIndex(l => l.trimStart().startsWith(HEADER));
  if (head < 0) return { die: 0, rollable: false, entries: [] };

  const die = Number(lines[head].match(/d\s*(\d+)/i)?.[1]) || 10;
  const entries = [];

  for (const raw of lines.slice(head + 1)) {
    const line = raw.trim();
    if (!line) continue;

    const cut   = line.indexOf(SEP);
    const range = cut > 0 ? parseLabel(line.slice(0, cut)) : null;

    // Строка без разбираемой подписи продолжает описание предыдущей.
    if (!range) {
      if (entries.length) entries[entries.length - 1].text += `\n${line}`;
      continue;
    }

    // «Название: описание». Двоеточий в описании хватает (Rng, RoF, названия
    // тестов), поэтому берётся ПЕРВОЕ и только если до него уместилось имя;
    // у пяти строк «Выжженных Чувств» описания нет вовсе, и строка кончается
    // на двоеточии — оно тоже не должно попасть в название.
    const rest  = line.slice(cut + SEP.length);
    const split = rest.match(/^([^:]{1,60}):([\s\S]*)$/);
    const name  = (split ? split[1] : rest).trim();
    let   text  = (split ? split[2] : "").trim();

    // Цвет Бога у книжных строк проставлен пометкой в конце описания.
    const mark = text.match(GOD_MARK);
    if (mark) text = text.replace(GOD_MARK, "").trim();
    const god = mark ? mark[1].trim() : range.god;

    entries.push({ label: plainDigits(line.slice(0, cut)), lo: range.lo, hi: range.hi,
                   name, text, god });
  }

  return { die, rollable: entries.some(e => e.lo !== null), entries };
}

/** Есть ли у мутации таблица субмутаций. */
export function hasSubmutations(benefit) {
  return parseSubmutations(benefit).entries.length > 0;
}

/** Предел сдвига результата: ⅓Inf.b (окр.▼); от Порчи за Провал сдвига нет. */
export function subShiftLimit(infBonus, { fromFailure = false } = {}) {
  if (fromFailure) return 0;
  return Math.max(0, Math.floor((Number(infBonus) || 0) / 3));
}

/**
 * Строка таблицы по значению броска. За краями таблицы берётся крайняя строка —
 * как `mutationByRoll` у общей таблицы: сдвиг может увести результат за них.
 */
export function submutationByRoll(entries, value) {
  const rows = entries.filter(e => e.lo !== null);
  if (!rows.length) return null;
  const v = Number(value) || 0;
  const hit = rows.find(e => v >= e.lo && v <= e.hi);
  if (hit) return hit;
  return v < rows[0].lo ? rows[0] : rows[rows.length - 1];
}

// «Бросьте N раза на субмутации без обычных модификаторов от Inf.b» —
// найдено ДВАЖДЫ в книге (Fruit of Flesh/Плод Плоти «11 — Тройной Плод»,
// Wings/Крылья «12 — Многокрылый», wdbc-1rno) — не одноразовый частный
// случай одной находки, общий примитив.
const MULTI_ROLL_RE = /Бросьте\s+(\d+)\s+раза?/i;

/** Сколько раз бросить по этой же таблице для этой строки — 0, если строка обычная. */
export function multiRollCount(entry) {
  const m = String(entry?.text ?? "").match(MULTI_ROLL_RE);
  return m ? Number(m[1]) : 0;
}

/**
 * Результаты «бросить N раз без сдвига Inf.b» — dieRolls уже брошены
 * снаружи (apps/submutations.mjs, живой Roll). Дубликаты схлопываются
 * («или меньше, если были дубликаты бросков» — прямая цитата книги);
 * повторное попадание на САМУ multi-roll строку выпадает из списка тем же
 * способом (тоже «меньше, чем N») — отдельного переброса для этого случая
 * книга не описывает явно, чистая функция не додумывает его сама.
 */
export function multiRollResults(entries, dieRolls, selfLabel) {
  const seen = new Set();
  const out = [];
  for (const roll of dieRolls) {
    const e = submutationByRoll(entries, roll);
    if (!e || e.label === selfLabel || seen.has(e.label)) continue;
    seen.add(e.label);
    out.push(e);
  }
  return out;
}

/**
 * Закрыта ли строка для персонажа: цвет ВРАЖДЕБНОГО Бога.
 *
 * Враждебность — не «любой чужой», а пара извечных соперников (Кхорн ↔ Слаанеш,
 * Тзинч ↔ Нургл, см. constants/chaos-patron.mjs). Кхорниту закрыта строка
 * Слаанеш, но не строка Нургла: выбрать её вместо выпавшей он не может (это
 * право только своего Бога), а выпавшую — берёт. Неделимым и персонажам без
 * покровителя не закрыто ничего.
 */
export function isSubBlocked(entry, patron) {
  if (!entry?.god) return false;
  return areGodsHostile(patron, entry.god);
}

/** Строка своего Бога — её можно взять вместо выпавшей или вовсе не бросая. */
export function patronSubmutation(entries, patron) {
  if (!patron || patron === "undivided") return null;
  return entries.find(e => e.god === patron) || null;
}

/**
 * Куда можно увести результат: каждое значение в пределах сдвига со строкой,
 * в которую оно попадает, и признаком закрытости.
 */
export function subShiftOptions(entries, rolled, limit, patron = "") {
  const out = [];
  const lim = Math.max(0, Number(limit) || 0);
  for (let shift = -lim; shift <= lim; shift++) {
    const total = Number(rolled) + shift;
    const entry = submutationByRoll(entries, total);
    if (!entry) continue;
    out.push({ shift, total, entry, blocked: isSubBlocked(entry, patron) });
  }
  return out;
}

/**
 * Нужен ли переброс: ни одно доступное значение не даёт открытой строки
 * («если бросок не позволяет им выбрать ни одну субмутацию, они должны
 * перебросить его»).
 */
export function needsReroll(options) {
  return options.length > 0 && options.every(o => o.blocked);
}
