// test/constants/quality-drug.test.mjs
//
// wdbc-x1nz.4 («Арсенал» → «Химия»): яд/эликсир/наркотик/медикамент не
// должен попадать в общую ветку «misc» (Прочее снаряжение) и давать
// владельцу бонус «на тесты с этим снаряжением» (Poor −10/Good +5/Best +10)
// — у ядов книга описывает другую таблицу, модифицирующую тест ЦЕЛИ (см.
// module/rules/poison-resist.mjs), а у прочей Химии auto-эффекта Качества
// книга вовсе не определяет.

import { describe, it, expect } from "vitest";
import { qualityCategory, qualityEffects } from "../../module/constants/quality.mjs";

describe("Качество препаратов (type: drug) — отдельная категория, не misc", () => {
  it("qualityCategory возвращает 'drug', не 'misc'", () => {
    expect(qualityCategory({ type: "drug", system: { quality: "poor" } })).toBe("drug");
  });

  it("qualityEffects не даёt owner testMod и не пишет напоминание 'тесты с этим снаряжением'", () => {
    for (const q of ["poor", "good", "best"]) {
      const { auto, reminders } = qualityEffects({ type: "drug", system: { quality: q } });
      expect(auto.testMod).toBeUndefined();
      expect(reminders.join(" ")).not.toMatch(/тесты с этим снаряжением/);
    }
  });

  it("регресс: gear того же Качества по-прежнему получает misc testMod", () => {
    const { cat, auto } = qualityEffects({ type: "gear", system: { quality: "best" } });
    expect(cat).toBe("misc");
    expect(auto.testMod).toBe(10);
  });
});
