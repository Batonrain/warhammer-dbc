// test/tools/char-mod-sign-consistency.test.mjs
//
// wdbc-2h6q: класс бага «инверсия знака / лишняя-недостающая альтернатива при
// переносе книги в пак» уже случался (divination давала +3 вместо −3 по int/
// fel; Телекинетическая Мантия без Ловкости) и не имел стража. У записей
// divinations/homeworlds/archetypes рядом с flags.mechanics лежит машиночитаемый
// текст модификаторов характеристик — charModLabel гомворлдов («+3 F, +3 S,
// −3 A»), effect дивинаций («F или S +3; W или T −3») и структурное поле
// archetype.charBonus. Оба должны согласоваться и по знаку, и по составу
// (какие характеристики вообще упомянуты) — расхождение ловится здесь, а не
// на игровом столе. Нераспознанный текст пропускается (не падает), покрытие
// считается отдельной проверкой.
//
// Кириллица: \w/\b не видят кириллические буквы (см. AGENTS.md), но паттерны
// здесь ищут только ЛАТИНСКИЕ литеры характеристик (WS/BS/S/T/A/I/P/W/F) —
// \b вокруг них работает штатно, поскольку кириллица для \w уже не «буква».

import { describe, it, expect } from "vitest";
import { packDocuments } from "../support/pack-docs.mjs";

/** Латиница характеристик, как в module/constants/homeworlds.mjs::CHAR_ABBR. */
const LETTER_TO_KEY = { WS: "ws", BS: "bs", S: "s", T: "t", A: "ag", I: "int", P: "per", W: "wp", F: "fel" };
const LETTER_RE = "(?:WS|BS|S|T|A|I|P|W|F)";
// Форма А (список): «±N ЛИТЕРА[, ±N ЛИТЕРА...]» — charModLabel гомворлдов.
const LIST_RE_SRC = "([+−-])(\\d+)\\s*(" + LETTER_RE + ")\\b";
// Форма Б (альтернатива): «ЛИТЕРА[, ЛИТЕРА][ или ЛИТЕРА] ±N» — effect дивинаций.
const ALT_RE_SRC = "\\b(" + LETTER_RE + "(?:\\s*(?:,|или)\\s*" + LETTER_RE + ")*)\\s*([+−-])(\\d+)";

function signOf(s) { return s === "+" ? 1 : -1; }

/** [{charKey, value}] распознанных из текста модификаторов char. Пропускает нераспознанное. */
export function parseCharModText(txt) {
  const out = [];
  if (!txt) return out;
  const altRe = new RegExp(ALT_RE_SRC, "g");
  const consumed = [];
  let m;
  while ((m = altRe.exec(txt))) {
    consumed.push([m.index, m.index + m[0].length]);
    const letters = m[1].split(/\s*(?:,|или)\s*/).filter(Boolean);
    const value = signOf(m[2]) * Number(m[3]);
    for (const l of letters) out.push({ charKey: LETTER_TO_KEY[l], value });
  }
  const listRe = new RegExp(LIST_RE_SRC, "g");
  while ((m = listRe.exec(txt))) {
    if (consumed.some(([a, b]) => m.index >= a && m.index < b)) continue;
    out.push({ charKey: LETTER_TO_KEY[m[3]], value: signOf(m[1]) * Number(m[2]) });
  }
  return out;
}

/** [{charKey, value}] эффективных значений всех entries kind:characteristic. */
function mechCharEntries(doc) {
  const groups = doc.flags?.["warhammer-dbc"]?.mechanics;
  if (!Array.isArray(groups)) return [];
  const out = [];
  for (const g of groups) {
    for (const e of (g.entries ?? [])) {
      if (e?.kind === "characteristic") {
        out.push({ charKey: e.charKey, value: (e.op === "subtract" ? -1 : 1) * Number(e.value) });
      }
    }
  }
  return out;
}

/** Declared-пары для доменов: divinations/homeworlds — текст, archetypes — структурное charBonus. */
function declaredPairs(domain, doc) {
  if (domain === "archetype") {
    return Object.entries(doc.system?.charBonus || {})
      .filter(([, v]) => typeof v === "number" && v !== 0)
      .map(([charKey, value]) => ({ charKey, value }));
  }
  const txt = domain === "homeworld" ? doc.system?.charModLabel : doc.system?.effect;
  return parseCharModText(txt || "");
}

/** Офендеры доменного набора документов: расхождение знака или состава charKey. */
function findOffenders(domain, docs) {
  const offenders = [];
  let withText = 0, checked = 0;
  for (const { file, doc } of docs) {
    const declared = declaredPairs(domain, doc);
    if (!declared.length) continue;
    withText++;
    const mech = mechCharEntries(doc);
    if (!mech.length) continue;
    checked++;
    for (const d of declared) {
      const matches = mech.filter(e => e.charKey === d.charKey);
      if (!matches.length) {
        offenders.push(`${file} (${doc.name}): заявлено ${d.charKey}=${d.value}, среди mechanics kind:characteristic такого charKey нет`);
        continue;
      }
      if (!matches.some(e => Math.sign(e.value) === Math.sign(d.value))) {
        offenders.push(`${file} (${doc.name}): заявлено ${d.charKey}=${d.value}, в mechanics ${matches.map(e => e.value).join("/")} — ЗНАК НЕ СОВПАДАЕТ`);
      }
    }
  }
  return { offenders, withText, checked, total: docs.length };
}

const DOMAINS = [
  ["homeworld", "homeworlds"],
  ["divination", "divinations"],
  ["archetype", "archetypes"]
];

describe("знак и состав Механики совпадают с текстом записи (wdbc-2h6q)", () => {
  const results = DOMAINS.map(([domain, pack]) => [domain, findOffenders(domain, packDocuments(pack, domain))]);

  it("парсер вообще что-то распознаёт (проверка не выродилась в пустышку)", () => {
    const totalChecked = results.reduce((n, [, r]) => n + r.checked, 0);
    expect(totalChecked).toBeGreaterThan(10);
  });

  it("покрытие (доля записей с распознанным текстом модификаторов) ≥60% по доменам вместе", () => {
    const totalDocs = results.reduce((n, [, r]) => n + r.total, 0);
    const totalWithText = results.reduce((n, [, r]) => n + r.withText, 0);
    expect(totalWithText / totalDocs).toBeGreaterThanOrEqual(0.6);
  });

  for (const [domain, result] of results) {
    it(`${domain}: заявленный текст/структура совпадает по знаку и составу с mechanics`, () => {
      expect(result.offenders).toEqual([]);
    });
  }
});

describe("parseCharModText: синтетические случаи", () => {
  it("распознаёт форму-список гомворлдов", () => {
    expect(parseCharModText("+3 F, +3 S, −3 A")).toEqual([
      { charKey: "fel", value: 3 },
      { charKey: "s", value: 3 },
      { charKey: "ag", value: -3 }
    ]);
  });

  it("распознаёт форму-альтернативу дивинаций (общий знак на несколько литер)", () => {
    expect(parseCharModText("F или S +3; W или T −3.")).toEqual([
      { charKey: "fel", value: 3 },
      { charKey: "s", value: 3 },
      { charKey: "wp", value: -3 },
      { charKey: "t", value: -3 }
    ]);
  });

  it("нераспознанный текст — пустой список, не падение", () => {
    expect(parseCharModText("Талант Fearless.")).toEqual([]);
    expect(parseCharModText("")).toEqual([]);
  });
});

describe("findOffenders: ловит синтетическую инверсию знака (регрессия на будущее)", () => {
  it("падает, если текст обещает −3, а mechanics даёт +3", () => {
    const bad = {
      file: "synthetic.json",
      doc: {
        name: "Синтетическая запись",
        system: { charModLabel: "−3 F" },
        flags: { "warhammer-dbc": { mechanics: [{ operator: "AND", entries: [
          { kind: "characteristic", charKey: "fel", op: "add", value: 3 }
        ] }] } }
      }
    };
    const { offenders } = findOffenders("homeworld", [bad]);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toMatch(/ЗНАК НЕ СОВПАДАЕТ/);
  });

  it("падает, если текст упоминает характеристику, отсутствующую в mechanics (класс «Мантия без Ловкости»)", () => {
    const bad = {
      file: "synthetic2.json",
      doc: {
        name: "Синтетическая запись 2",
        system: { charModLabel: "+3 F, +3 A" },
        flags: { "warhammer-dbc": { mechanics: [{ operator: "AND", entries: [
          { kind: "characteristic", charKey: "fel", op: "add", value: 3 }
        ] }] } }
      }
    };
    const { offenders } = findOffenders("homeworld", [bad]);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toMatch(/такого charKey нет/);
  });

  it("не падает на согласованной записи", () => {
    const good = {
      file: "synthetic3.json",
      doc: {
        name: "Синтетическая запись 3",
        system: { charModLabel: "+3 F, −3 A" },
        flags: { "warhammer-dbc": { mechanics: [{ operator: "AND", entries: [
          { kind: "characteristic", charKey: "fel", op: "add", value: 3 },
          { kind: "characteristic", charKey: "ag", op: "subtract", value: 3 }
        ] }] } }
      }
    };
    const { offenders } = findOffenders("homeworld", [good]);
    expect(offenders).toEqual([]);
  });
});
