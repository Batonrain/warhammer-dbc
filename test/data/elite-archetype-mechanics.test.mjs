// test/data/elite-archetype-mechanics.test.mjs
//
// Сверка Главы 3 «Элитные архетипы» (03.11.2026): общие сторожа по данным
// packs-src/elite-archetypes — то, что аудит нашёл сразу у нескольких
// архетипов и что молча возвращается при следующей правке записи.
//
//  1. Рейтинг Трейта в Конструкторе — формула Механики (rules/mech-formula.mjs),
//     а не книжная запись. «½Cor.b, окр.▲», «A.b×2» и голое «P» формула не
//     разбирает и молча даёт 0: Укус Вампира, Регенерация Мейстера и Короля
//     Червей, Полёт Когтя Варпа выдавались с рейтингом 0.
//  2. «+5 WS или +5 BS» — выбор одного, а не обе строки сразу: записи пары
//     лежат в ИЛИ-группах (Чемпион-терминатор и Ветеран Долгой Войны получали
//     по +5 к обеим Характеристикам).
//  3. Облитератор: две цены книги, +5 Cor и Hatred (Imperium) Ветерана.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mechFormulaTotal } from "../../module/rules/mech-formula.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ELITE_DIR = join(ROOT, "packs-src/elite-archetypes");

function jsonFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...jsonFiles(p));
    else if (e.name.endsWith(".json") && e.name !== "_Folder.json") out.push(p);
  }
  return out;
}

const archetypes = jsonFiles(ELITE_DIR).map(p => ({ path: p, doc: JSON.parse(readFileSync(p, "utf8")) }));
const byName = part => archetypes.find(a => a.doc.name.includes(part))?.doc;
const groupsOf = doc => doc?.flags?.["warhammer-dbc"]?.mechanics ?? [];

/** Все записи Конструктора архетипа, включая вложенные подгруппы. */
function* entriesOf(doc) {
  function* walk(entries, operator) {
    for (const e of entries ?? []) {
      if (e.kind === "group" && e.group) yield* walk(e.group.entries, e.group.operator);
      else yield { entry: e, operator };
    }
  }
  for (const g of groupsOf(doc)) yield* walk(g.entries, g.operator);
}

// Бонусы и значения «взрослого» персонажа: везде 4 / 40. Нетривиальная формула
// на таких данных не может дать 0 — 0 значит, что формулу не разобрали.
const SAMPLE = Object.fromEntries([
  ["cor", 4], ["pr", 4], ["corv", 40], ["subtier", 1], ["wound", 0],
  ...["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel", "inf"].flatMap(k => [[k, 4], [`${k}v`, 40]])
]);

describe("рейтинги Трейтов Элитных архетипов разбираются формулой Механики", () => {
  const rated = [];
  for (const { doc } of archetypes) {
    for (const { entry } of entriesOf(doc)) {
      const raw = String(entry.rating ?? "").trim();
      if (raw !== "") rated.push({ arch: doc.name, trait: entry.sourceName || entry.kind, raw });
    }
  }

  it("в данных есть записи с рейтингом (иначе тест ничего не проверяет)", () => {
    expect(rated.length).toBeGreaterThan(20);
  });

  it("каждый рейтинг — число или формула, которую разбирает mechFormulaTotal", () => {
    const broken = [];
    for (const r of rated) {
      try { mechFormulaTotal(r.raw, SAMPLE); } catch { broken.push(`${r.arch} :: ${r.trait} :: «${r.raw}»`); }
    }
    expect(broken).toEqual([]);
  });

  it("формула не вырождается в 0 на нормальном персонаже", () => {
    const zero = [];
    for (const r of rated) {
      let total = 0;
      try { total = mechFormulaTotal(r.raw, SAMPLE); } catch { total = 0; }
      if (total === 0 && !/^\s*[+-]?0\s*$/.test(r.raw)) zero.push(`${r.arch} :: ${r.trait} :: «${r.raw}»`);
    }
    expect(zero).toEqual([]);
  });
});

describe("«+5 WS или +5 BS, +5 W или +5 F» — выбор одного из пары", () => {
  // Пары «или» из строки charBonus; И-группа с обеими половинами пары = баг «оба сразу».
  const PAIRS = [
    { re: /WS\s*или\s*\+?\d*\s*BS/i, a: "ws", b: "bs" },
    { re: /\bW\s*или\s*\+?\d*\s*F\b/i, a: "wp", b: "fel" }
  ];

  it("ни у одного архетипа обе половины пары не лежат в одной И-группе", () => {
    const bad = [];
    for (const { doc } of archetypes) {
      const cb = String(doc.system?.charBonus ?? "");
      for (const pair of PAIRS) {
        if (!pair.re.test(cb)) continue;
        for (const g of groupsOf(doc)) {
          if (g.operator === "OR") continue;
          const keys = (g.entries ?? []).filter(e => e.kind === "characteristic").map(e => e.charKey);
          if (keys.includes(pair.a) && keys.includes(pair.b)) bad.push(`${doc.name} :: ${pair.a}/${pair.b}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  for (const part of ["Terminator Champion", "Veteran of the Long War"]) {
    it(`${part}: пары лежат в двух ИЛИ-группах`, () => {
      const doc = byName(part);
      expect(doc, `нет записи ${part}`).toBeTruthy();
      const orPairs = groupsOf(doc).filter(g => g.operator === "OR")
        .map(g => (g.entries ?? []).filter(e => e.kind === "characteristic")
          .map(e => `${e.charKey}${e.value > 0 ? "+" : ""}${e.value}`).sort().join("|"));
      expect(orPairs.sort()).toEqual(["bs+5|ws+5", "fel+5|wp+5"]);
    });
  }
});

describe("Облитератор и Ветеран Долгой Войны: цена, Порча, стартовый Hatred", () => {
  it("Облитератор: 4500 для Космодесантника, 5500 для не-Космодесантника", () => {
    const doc = byName("Obliterator");
    expect(doc.system.cost).toBe(4500);
    expect(doc.system.costNonAstartes).toBe(5500);
  });

  it("Облитератор: «+5 Cor» заведено записью Порчи", () => {
    const doc = byName("Obliterator");
    const cor = [...entriesOf(doc)].filter(({ entry }) => entry.kind === "corruption");
    expect(cor.map(({ entry }) => entry.corruptionValue)).toEqual(["5"]);
  });

  it("Ветеран Долгой Войны: Hatred (Imperium) выдаётся с целью-фракцией «imperium»", () => {
    const doc = byName("Veteran of the Long War");
    const hatred = [...entriesOf(doc)].filter(({ entry }) => entry.kind === "talent" && /Hatred/.test(entry.sourceName || ""));
    expect(hatred).toHaveLength(1);
    expect(hatred[0].entry.targets).toEqual([expect.objectContaining({ kind: "faction", ref: "imperium" })]);
  });
});

// Сверка 03.11.2026, хвост: у Высшего Духовидца (Азуриане, «+20 Cor») и Шамана
// Зверолюдей («+5 Cor») Порча стояла только в тексте бонусов Характеристик, а
// записи Порчи в Конструкторе не было — при покупке она не начислялась (так же,
// как у всех архетипов Основной книги до этой сверки). Сторож общий: любое
// «+N Cor» / «+NdM Cor» в charBonus обязано иметь запись Порчи с тем же значением.
describe("«+N Cor» в бонусах архетипа — это запись Порчи в Конструкторе", () => {
  const withCor = archetypes
    .map(({ doc }) => ({ doc, m: String(doc.system?.charBonus ?? "").match(/\+\s*(\d+(?:d\d+)?)\s*Cor\b/i) }))
    .filter(x => x.m);

  it("«+N Cor» в charBonus встречается — иначе тест ничего не проверяет", () => {
    expect(withCor.length).toBeGreaterThan(25);
  });

  it("у каждого такого архетипа есть запись Порчи с тем же значением", () => {
    const bad = [];
    for (const { doc, m } of withCor) {
      const values = [...entriesOf(doc)].filter(({ entry }) => entry.kind === "corruption").map(({ entry }) => String(entry.corruptionValue).toLowerCase());
      if (!values.includes(m[1].toLowerCase())) bad.push(`${doc.name}: charBonus «+${m[1]} Cor», записи Порчи: [${values.join(", ")}]`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("Высший Духовидец +20 и Шаман Зверолюдей +5", () => {
    for (const [part, value] of [["High Spiritseer", "20"], ["Beastman Shaman", "5"]]) {
      const cor = [...entriesOf(byName(part))].filter(({ entry }) => entry.kind === "corruption");
      expect(cor.map(({ entry }) => entry.corruptionValue), part).toEqual([value]);
    }
  });
});
