// test/apps/strange-hands-submutation-mechanics.test.mjs
//
// wdbc-5inv/wdbc-e9e: субмутация 10 (Призрачные Руки) мутации Strange Hands/
// Странные Руки заведена Механикой самого предмета — тот же приём
// when.submutations, что у Глаз Хаоса и Множественных Глаз.
//
// Тест появился при приёме стопки #441-#462. Ровно он поймал бы блокер, из-за
// которого субмутация выдавала ВТОРУЮ Черту «Многорукий (2)» вместо одной
// «(4)»: Конструктор дедуплицирует только Таланты, а читатели рук берут
// наибольший рейтинг (rules/hands.mjs::baseHandsFromTraits).

import { describe, it, expect } from "vitest";
import { parseSubmutations } from "../../module/rules/submutations.mjs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";
import { baseHandsFromTraits } from "../../module/rules/hands.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const strangeHands = packDocById("packs-src/mutations/Общие_мутации", "ApXVLD3qzW9ngnuC");
const submutations = parseSubmutations(strangeHands.system.benefit);
const entries = strangeHands.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const armsEntries = entries.filter(e => e.kind === "trait" && e.sourceUuid?.includes("b2B8zxbhoK961wEf"));

const MULTIPLE_ARMS = "Multiple Arms / Многорукий (X)";

describe("Strange Hands/Странные Руки: Механика субмутации 10", () => {
  it("в таблице СУБМУТАЦИИ есть строка 10", () => {
    expect(submutations.entries.map(e => e.label)).toContain("10");
  });

  it("Черту «Многорукий» выдают ровно две записи: базовая и субмутация 10", () => {
    expect(armsEntries).toHaveLength(2);
    const gated = armsEntries.filter(e => (e.when?.submutations ?? []).length);
    expect(gated).toHaveLength(1);
    expect(gated[0].when.submutations).toEqual(["10"]);
  });

  // Рейтинг Черты — ИТОГОВОЕ число рук («общее число рук = X» в тексте самой
  // Черты), а не прибавка. Субмутация обещает «итог +4», значит её запись
  // обязана нести 4, а не второе «2».
  it("субмутация 10 несёт рейтинг 4, базовая запись — 2", () => {
    const gated = armsEntries.find(e => (e.when?.submutations ?? []).length);
    const base  = armsEntries.find(e => !(e.when?.submutations ?? []).length);
    expect(String(gated.rating)).toBe("4");
    expect(String(base.rating)).toBe("2");
  });

  // Конструктор трейты не дедуплицирует (дедуп написан только для Таланта,
  // apps/mechanics.mjs) — на акторе окажутся ДВЕ Черты. Читатель обязан взять
  // большую, иначе сильная субмутация проигрывает слабой базовой записи.
  it("две выданные Черты вместе дают бюджет 4 руки, а не 2", () => {
    const trait = rating => ({ type: "trait", name: MULTIPLE_ARMS, system: { rating } });
    const actor = { items: [trait(2), trait(4)] };
    expect(baseHandsFromTraits(actor)).toBe(4);
  });

  it("субмутация не выбрана — гейтованная запись не включается", () => {
    const gated = armsEntries.find(e => (e.when?.submutations ?? []).length);
    expect(entryWhenOk(null, gated, { system: { submutation: { label: "" } } })).toBe(false);
    expect(entryWhenOk(null, gated, { system: { submutation: { label: "10" } } })).toBe(true);
  });
});
