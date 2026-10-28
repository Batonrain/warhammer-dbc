// test/data/drug-addiction-vs-book.test.mjs
//
// wdbc-gyqf2. Сторож: поля Зависимости наркотиков в паке «Химия» совпадают с
// книжной строкой «Зависимость: N | тест | частота | эффект» (core.json), а
// структурные поля штрафа (penaltyMods, breakMod, periodCharDamage) разобраны
// без мусора и ссылаются только на существующие области правил и Характеристики.
//
// Повод: при заведении комбинированного теста обнаружилось, что пакс несёт
// чужие числа к целой дюжине препаратов (Роза W–40 вместо W–10, Мортис «1 день»
// вместо «7 дней», Лхо «1 час» вместо «8ч» и т.п.). Часы Календаря теперь
// считают по этим полям, и неверное число стало бы неверным штрафом за столом.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PACK_SCAN_TIMEOUT, PACKS_SRC, packDocuments } from "../support/pack-docs.mjs";
import { addictionTestParts, parseFrequency, parsePenaltyMods } from "../../module/rules/drug-withdrawal.mjs";
import { CHARACTERISTICS } from "../../module/constants/characteristics.mjs";
import { SKILLS_DEF } from "../../module/constants/skills.mjs";

/** Книжные строки Зависимости: английское имя → { min, test, freq, effect }. */
function bookAddictionLines() {
  const txt = fs.readFileSync(path.join(PACKS_SRC, "books/core.json"), "utf8");
  const re = /<h4>([^<]*)<\/h4>|<strong>Зависимость<\/strong>:\s*([^<]*)/g;
  const out = new Map();
  let m, name = "";
  while ((m = re.exec(txt))) {
    if (m[1]) { name = m[1]; continue; }
    // «наркотики вызывают зависимость … 4 поля, разделенных |» — общее вступление, не строка.
    if (!m[2].includes("|") || m[2].includes("4 поля")) continue;
    const en = name.replace(/^R:\s*-?\d+\s*\|\s*/, "").split("/")[0].trim();
    const [min, test, freq, ...effect] = m[2].split("|").map(s => s.trim());
    out.set(en, { min: Number(min), test, freq, effect: effect.join("|") });
  }
  return out;
}

/** «Комб.Т+40/W+50» → [{charKey:"t",mod:40},{charKey:"wp",mod:50}]; «W–20 [W+0]» → [{wp,-20}]. */
function bookTestParts(test) {
  const clean = test.replace(/[–−]/g, "-").replace(/Т/g, "T").replace(/\s*\[.*\]/, "").replace(/^Комб\./, "");
  return clean.split("/").map(p => {
    const m = p.trim().match(/^([TW])([+-]\d+)$/);
    if (!m) throw new Error(`не разобрана книжная проверка «${test}»`);
    return { charKey: m[1] === "T" ? "t" : "wp", mod: Number(m[2]) };
  });
}

/** Пак называет иначе, чем книга (одно слово) — явный список. */
const BOOK_NAME = { Polymorphine: "Polymorphyne" };
/**
 * В основной книге строки нет: препарат из другого источника, сверять не с чем.
 * Не «разрешено навсегда» — уходит отсюда, когда у него появится своя книжная строка.
 */
const NOT_IN_CORE = new Set(["Medusae Fruit"]);

const drugs = () => packDocuments("chemistry", "drug")
  .filter(({ doc }) => doc.system?.addiction?.hasAddiction)
  // Английская половина имени (у «Плод Медузы / Medusae Fruit» русская стоит первой).
  .map(({ doc }) => {
    const halves = doc.name.split("/").map(s => s.trim());
    return { doc, en: halves.find(h => /^[A-Za-z]/.test(h)) ?? halves[0] };
  });

describe("Химия: поля Зависимости = книжная строка (core.json)", () => {
  const book = bookAddictionLines();

  it("книжные строки нашлись (сторож не вакуумный)", () => {
    expect(book.size).toBeGreaterThan(20);
  });

  it("каждый зависимый препарат сверен: минимум, тест (в т.ч. комбинированный), частота", () => {
    const bad = [];
    let checked = 0;
    for (const { doc, en } of drugs()) {
      if (NOT_IN_CORE.has(en)) continue;
      const b = book.get(BOOK_NAME[en] ?? en);
      if (!b) { bad.push(`${doc.name}: в книге нет строки`); continue; }
      checked++;
      const a = doc.system.addiction;
      if (a.minDose !== b.min) bad.push(`${doc.name}: minDose ${a.minDose}, книга ${b.min}`);
      const want = bookTestParts(b.test);
      const have = addictionTestParts(a);
      if (JSON.stringify(have) !== JSON.stringify(want)) bad.push(`${doc.name}: тест ${JSON.stringify(have)}, книга ${JSON.stringify(want)}`);
      if (parseFrequency(a.frequency) !== parseFrequency(b.freq)) bad.push(`${doc.name}: частота «${a.frequency}», книга «${b.freq}»`);
    }
    expect(checked).toBeGreaterThan(20);
    expect(bad).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("комбинированных тестов в книге ровно три — Рекаф, Алкоголь, Лхо — и все заведены двумя слагаемыми", () => {
    const combined = [...book.entries()].filter(([, b]) => /^Комб\./.test(b.test)).map(([k]) => k).sort();
    expect(combined).toEqual(["Alcohol", "Lho", "Recaf"]);
    for (const { doc, en } of drugs()) {
      expect(addictionTestParts(doc.system.addiction).length, doc.name).toBe(combined.includes(en) ? 2 : 1);
    }
  });
});

describe("Химия: структурный штраф без дозы", () => {
  const book = bookAddictionLines();
  const normMinus = s => s.replace(/[–−]/g, "-");

  it("штраф разобран без мусора и целится в существующие области", () => {
    const social = Object.keys(SKILLS_DEF).filter(k => SKILLS_DEF[k].apt2 === "social");
    const bad = [];
    for (const { doc, en } of drugs()) {
      const { mods, errors } = parsePenaltyMods(doc.system.addiction.penaltyMods);
      if (errors.length) bad.push(`${doc.name}: мусор в penaltyMods: ${errors.join(" | ")}`);
      for (const m of mods) {
        for (const t of [].concat(m.target)) {
          const [scope, key] = t.split(":");
          const okScope = ["all", "social"].includes(t)
            || (scope === "basedon" && CHARACTERISTICS[key])
            || (scope === "skill" && SKILLS_DEF[key]);
          if (!okScope) bad.push(`${doc.name}: область «${t}» не существует`);
        }
        if (!(m.value < 0)) bad.push(`${doc.name}: штраф должен быть отрицательным (${m.value})`);
      }
      const cd = doc.system.addiction.periodCharDamage;
      if (cd?.stat && !CHARACTERISTICS[cd.stat]) bad.push(`${doc.name}: periodCharDamage.stat «${cd.stat}»`);
      if (cd?.stat && !/^\d+d\d+([+-]\d+)?$/.test(cd.formula)) bad.push(`${doc.name}: periodCharDamage.formula «${cd.formula}»`);
      if (!cd?.stat !== !cd?.formula) bad.push(`${doc.name}: periodCharDamage наполовину пуст`);
      // «Кроме запугивания» — явный список: все социальные Навыки минус Запугивание.
      if (/кроме запугивания/.test(book.get(en)?.effect ?? "")) {
        const targets = mods.flatMap(m => [].concat(m.target)).sort();
        const expected = social.filter(k => k !== "intimidate").map(k => `skill:${k}`).sort();
        if (JSON.stringify(targets) !== JSON.stringify(expected)) bad.push(`${doc.name}: «кроме запугивания» ≠ социальные Навыки минус intimidate`);
      }
    }
    expect(bad).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("каждое число структурного штрафа и урона за период есть в книжном тексте эффекта", () => {
    const bad = [];
    for (const { doc, en } of drugs()) {
      const b = book.get(BOOK_NAME[en] ?? en);
      if (!b) continue;
      const text = normMinus(b.effect);
      const a = doc.system.addiction;
      for (const m of parsePenaltyMods(a.penaltyMods).mods) {
        if (!text.includes(`-${Math.abs(m.value)}`)) bad.push(`${doc.name}: ${m.value} нет в книге («${b.effect}»)`);
      }
      if (a.breakMod && !text.includes(`-${Math.abs(a.breakMod)} на тесты избавления`)) bad.push(`${doc.name}: breakMod ${a.breakMod} нет в книге`);
      if (a.periodCharDamage?.formula && !text.includes(a.periodCharDamage.formula.replace("-", "-"))) bad.push(`${doc.name}: урон за период «${a.periodCharDamage.formula}» нет в книге`);
    }
    expect(bad).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("текст «Штраф», который читает игрок, называет те же числа, что считает система (ревью: Мортис «−5» при −30)", () => {
    const bad = [];
    for (const { doc } of drugs()) {
      const a = doc.system.addiction;
      const text = normMinus(a.penalty ?? "");
      for (const m of parsePenaltyMods(a.penaltyMods).mods) {
        if (!text.includes(`-${Math.abs(m.value)}`)) bad.push(`${doc.name}: в тексте штрафа «${a.penalty}» нет числа ${m.value}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("ровно эти препараты несут структурный штраф (список растёт осознанно)", () => {
    const withMods = drugs().filter(({ doc }) => doc.system.addiction.penaltyMods).map(({ en }) => en).sort();
    expect(withMods).toEqual(["Alcohol", "Blue Fire", "Commorrite Combat Drugs", "Frenzon", "Lho", "Mortis", "Recaf", "Rose", "Spook", "Stimm", "Sweep"].sort());
    const withDamage = drugs().filter(({ doc }) => doc.system.addiction.periodCharDamage?.stat).map(({ en }) => en).sort();
    expect(withDamage).toEqual(["Satrophine", "Slaught"]);
    const sweep = drugs().find(({ en }) => en === "Sweep").doc.system.addiction;
    expect(sweep.breakMod).toBe(-20);
  });
});
