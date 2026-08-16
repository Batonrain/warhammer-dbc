// test/apps/compendium-browser.test.mjs
//
// Находка I4 общего ревью (wdbc-n1k): пак races не был заведён в Обозревателе
// компендиумов рядом с traits/talents/archetypes/homeworlds/divinations —
// заявленный сценарий «перетащить расу на лист» из браузера был недоступен.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { CATEGORIES } from "../../module/apps/compendium-browser.mjs";

describe("категория «Расы» в Обозревателе компендиумов", () => {
  it("пак races заведён категорией, как у остальных источников содержимого", () => {
    const cat = CATEGORIES.find(c => c.sources.some(s => s.pack === "races"));

    expect(cat).toBeTruthy();
    expect(cat.label).toBeTruthy();
  });
});
