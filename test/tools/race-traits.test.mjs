// test/tools/race-traits.test.mjs
//
// Расовые Черты выдаются ССЫЛКОЙ на библиотеку: раса несёт запись Конструктора
// с именем Черты, а текст и эффекты живут в паке traits. Значит каждая Черта из
// констант обязана иметь пару в паке — иначе ссылка повиснет.
//
// Сверка по нормализованному имени: в паке шаблоны названы «(X)», а раса
// называет конкретный рейтинг — «Unnatural Strength (4)».

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { normTraitName, libraryTrait, missingRaceTraits, raceTraits, hasNumericTraitEffects } from "../../tools/race-traits.mjs";

/** Нечисловые уточнения в скобках: «(4)», «(X)», «(+2)» из сравнения выбрасываются. */
function bracketQualifiers(name) {
  const brackets = [...String(name).matchAll(/\(([^)]*)\)/g)].map(m => m[1].trim());
  return new Set(brackets.filter(b => !/^[+-]?(\d+|x)$/i.test(b)));
}

const setsEqual = (a, b) => a.size === b.size && [...a].every(v => b.has(v));

describe("сверка расовых Черт с библиотекой", () => {

  it("рейтинг в скобках не мешает узнать Черту", () => {
    expect(normTraitName("Unnatural Strength (4) / Сверхъест. Сила (4)"))
      .toBe(normTraitName("Unnatural Strength / Сверхъестественная Сила (X)"));
  });

  // Русские названия одной Черты в константах и в паке расходятся, английские —
  // нет. Сверка по полному имени завела бы 11 дублей.
  it("расхождение русских названий не делает Черту новой", () => {
    expect(normTraitName("Natural Armour (3) / Природная Броня (3)"))
      .toBe(normTraitName("Natural Armour / Естественная Броня (X)"));
    expect(normTraitName("Dark Sight / Тёмное Зрение"))
      .toBe(normTraitName("Dark Sight / Ночное Зрение"));
  });

  // «Unnatural Agility (+2)» в паке — пустышка без рейтинга и эффектов. Выбрать
  // её значит выдать Азурианам +0 вместо +4.
  it("из кандидатов выбирается рабочая запись, а не пустая заглушка", () => {
    const doc = libraryTrait("Unnatural Agility (4) / Сверхъестественная Ловкость (4)");

    expect(doc).toBeTruthy();
    expect(doc.system.hasRating).toBe(true);
    expect(doc.system.rating).toBeGreaterThan(0);
  });

  it("после прогона генератора ни одна расовая Черта не осталась без пары", () => {
    expect(missingRaceTraits()).toEqual([]);
  });

  // Сторож омонимов (раунд правок 2): «Hulking / Громила (Легион)» когда-то
  // молча привязался к «Hulking / Громила (Размер)» — разные Черты, общее
  // только английское слово. Автоматического правила, отличающего такой
  // омоним от честного синонима («Природная Броня» / «Естественная Броня» —
  // одна Черта под двумя названиями), нет, поэтому проверка грубая: нечисловое
  // уточнение в скобках («Легион» против «Размер») у имени из констант и у
  // имени привязанного документа обязано совпасть, если оно вообще есть у
  // обоих. Числовые уточнения — «(4)», «(X)», «(+2)» — не считаются: иначе
  // сторож заругался бы на каждый параметрический шаблон.
  it("нечисловое уточнение в скобках не расходится с привязанным документом (сторож омонимов)", () => {
    const suspects = [];
    for (const [name] of raceTraits()) {
      const doc = libraryTrait(name);
      if (!doc) continue;
      const a = bracketQualifiers(name);
      const b = bracketQualifiers(doc.name);
      if (a.size && b.size && !setsEqual(a, b)) suspects.push(`«${name}» → «${doc.name}»`);
    }
    expect(suspects).toEqual([]);
  });

  // Черта без английской части («Дары Цегораха / Базовые Черты Арлекина») не
  // должна схлопывать ключ сверки в пустую строку — иначе любая вторая такая
  // Черта молча склеится с ней.
  it("Черта без английской части не схлопывается с другой такой же Чертой", () => {
    const a = normTraitName("Дары Цегораха / Базовые Черты Арлекина");
    const b = normTraitName("Иные Дары / Другая Черта");

    expect(a).not.toBe("");
    expect(b).not.toBe("");
    expect(a).not.toBe(b);
  });

  // «Unnatural Agility» встречается в константах с тремя разными рейтингами и
  // разным русским сокращением — три сырых имени, один ключ сверки. run()
  // обязан завести под этот ключ ОДИН документ, а не по документу на имя.
  it("созданные документы не повторяют друг друга по ключу сверки", () => {
    const dir   = "packs-src/traits/Трейты_рас";
    const files = readdirSync(dir).filter(f => f.endsWith(".json") && f !== "_Folder.json");
    const keys  = files.map(f => normTraitName(JSON.parse(readFileSync(join(dir, f), "utf8")).name));

    expect(new Set(keys).size).toBe(keys.length);
  });
});

// Задел на будущее из общего ревью (wdbc-n1k): гейт needsNumbers в
// missingRaceTraits смотрел только на charBonusStat/charBonuses — Черта с
// одним sizeMod (Размер) под гейт не попадала, и связка с пустой заглушкой
// в паке проходила сверку молча. Ровно так уже терялся Размер у пяти рас.
describe("hasNumericTraitEffects покрывает все числовые виды эффекта Черты", () => {
  it("charBonusStat/charBonuses/charValueBonuses — как и раньше", () => {
    expect(hasNumericTraitEffects({ charBonusStat: "s" })).toBe(true);
    expect(hasNumericTraitEffects({ charBonuses: [{ stat: "s", value: 1 }] })).toBe(true);
    expect(hasNumericTraitEffects({ charValueBonuses: [{ stat: "s", value: 1 }] })).toBe(true);
  });

  it("sizeMod, armourAll, fearRating, initMod, speedMod тоже считаются числовыми", () => {
    for (const key of ["sizeMod", "armourAll", "fearRating", "initMod", "speedMod"]) {
      expect(hasNumericTraitEffects({ [key]: 1 })).toBe(true);
    }
  });

  it("пустые или нулевые эффекты — не числовые", () => {
    expect(hasNumericTraitEffects({})).toBe(false);
    expect(hasNumericTraitEffects({ sizeMod: 0, armourAll: 0, charBonuses: [] })).toBe(false);
    expect(hasNumericTraitEffects(undefined)).toBe(false);
  });
});
