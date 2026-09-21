// test/migrations/nimble-rating.test.mjs
//
// Стопка #482-#504 привела правило «Проворный» к книге: штраф атакующим
// равен Рейтингу самой Черты (rules/library/core.mjs → targetTraitRating),
// а не Бонусу Ловкости цели. В записях пака Рейтинг заодно проставлен.
//
// Живой актор носит СНИМОК Черты момента выдачи — у всех уже созданных
// Астартес, Азуриан, Друкхари, Кроорков и у существ бестиария он пришёл с
// hasRating:false и rating:0. traitRatingSum такую Черту в сумму не берёт,
// правило продолжает отбираться и даёт −0 — молча. Отсюда починочный проход.

import { describe, it, expect } from "vitest";
import { isNimbleItem, ratingFromName, nimbleRatingFix, fixNimbleItem }
  from "../../module/migrations/nimble-rating.mjs";

/** Копия Черты в том виде, в каком она лежит на живом акторе до правки. */
function staleItem({ name = "Nimble / Проворный", hasRating = false, rating = 0 } = {}) {
  const item = {
    id: "it-1", type: "trait", name,
    system: { hasRating, rating },
    update: async (patch) => {
      for (const [k, v] of Object.entries(patch)) item.system[k.replace("system.", "")] = v;
      return item;
    }
  };
  return item;
}

describe("Опознание копии", () => {
  it("Черта узнаётся по любой половине двуязычного имени", () => {
    expect(isNimbleItem(staleItem())).toBe(true);
    expect(isNimbleItem(staleItem({ name: "Проворный" }))).toBe(true);
    expect(isNimbleItem(staleItem({ name: "Nimble (20)" }))).toBe(true);
  });

  it("другой предмет и другой тип — не трогаем", () => {
    expect(isNimbleItem(staleItem({ name: "Unnatural Agility / Сверхъестественная Ловкость" }))).toBe(false);
    expect(isNimbleItem({ type: "talent", name: "Nimble / Проворный" })).toBe(false);
    expect(isNimbleItem(null)).toBe(false);
  });
});

describe("Рейтинг из названия", () => {
  it("число в скобках — оно и есть Рейтинг", () => {
    expect(ratingFromName("Nimble (20) / Проворный")).toBe(20);
    expect(ratingFromName("Nimble (10)")).toBe(10);
  });

  it("числа нет — 0, дальше подставляется книжный", () => {
    expect(ratingFromName("Nimble / Проворный")).toBe(0);
    expect(ratingFromName(undefined)).toBe(0);
  });
});

describe("Что проставляется копии", () => {
  it("имя без числа — книжные 10 из записи пака", () => {
    expect(nimbleRatingFix(staleItem())).toBe(10);
  });

  it("имя с числом — число из имени, не книжное (бестиарий: Nimble (20))", () => {
    expect(nimbleRatingFix(staleItem({ name: "Nimble (20)" }))).toBe(20);
  });

  it("Рейтинг уже проставлен — число на предмете главнее, не трогаем", () => {
    expect(nimbleRatingFix(staleItem({ hasRating: true, rating: 30 }))).toBe(null);
  });

  it("не та Черта — null", () => {
    expect(nimbleRatingFix(staleItem({ name: "Fear (2) / Страх (2)" }))).toBe(null);
  });
});

describe("Правка копии", () => {
  it("ставит галочку и Рейтинг, сообщает о правке", async () => {
    const item = staleItem();
    expect(await fixNimbleItem(item)).toBe(true);
    expect(item.system.hasRating).toBe(true);
    expect(item.system.rating).toBe(10);
  });

  it("идемпотентна: второй прогон копию не трогает", async () => {
    const item = staleItem({ name: "Nimble (20)" });
    await fixNimbleItem(item);
    expect(item.system.rating).toBe(20);
    expect(await fixNimbleItem(item)).toBe(false);
    expect(item.system.rating).toBe(20);
  });
});
