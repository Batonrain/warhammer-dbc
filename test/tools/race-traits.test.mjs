// test/tools/race-traits.test.mjs
//
// Расовые Черты выдаются ССЫЛКОЙ на библиотеку: раса несёт запись Конструктора
// с именем Черты, а текст и эффекты живут в паке traits. Значит каждая Черта из
// констант обязана иметь пару в паке — иначе ссылка повиснет.
//
// Сверка по нормализованному имени: в паке шаблоны названы «(X)», а раса
// называет конкретный рейтинг — «Unnatural Strength (4)».

import { describe, it, expect } from "vitest";
import { normTraitName, libraryTrait, missingRaceTraits } from "../../tools/race-traits.mjs";

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
});
