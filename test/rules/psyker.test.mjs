import { describe, it, expect } from "vitest";
import { psyRatingFromTalents } from "../../module/rules/psyker.mjs";

const talent = (name, rating) => ({ type: "talent", name, system: { rating } });

describe("psyRatingFromTalents", () => {
  it("null без Таланта — NPC/бестиарий держат ручное значение", () => {
    expect(psyRatingFromTalents([])).toBeNull();
    expect(psyRatingFromTalents([{ type: "trait", name: "Psy Rating / Пси-Рейтинг", system: { rating: 5 } }]))
      .toBeNull();
  });

  it("новая модель — один предмет с Рейтингом", () => {
    expect(psyRatingFromTalents([talent("Psy Rating / Пси-Рейтинг", 3)])).toBe(3);
  });

  it("старая модель — несколько предметов без Рейтинга, каждый +1", () => {
    expect(psyRatingFromTalents([
      talent("Psy Rating / Пси-Рейтинг", 0),
      talent("Psy Rating / Пси-Рейтинг", 0),
      talent("Psy Rating / Пси-Рейтинг", 0)
    ])).toBe(3);
  });

  it("смешанная модель — старые копии и новый рейтинг складываются", () => {
    expect(psyRatingFromTalents([
      talent("Psy Rating / Пси-Рейтинг", 0),
      talent("Psy Rating / Пси-Рейтинг", 2)
    ])).toBe(3);
  });

  it("не путает с другими Талантами", () => {
    expect(psyRatingFromTalents([talent("Sure Strike / Точный удар", 1)])).toBeNull();
  });
});
