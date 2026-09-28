// test/rules/survivor-infamy.test.mjs
//
// «Вместо провала — успех на 1 Успех за Очко Бесчестия» — Survivor /
// Выживальщик (Дикарь). Один реестр со Змеиным Языком Отступника
// (rules/infamy-fail-success.mjs): при слиянии веток сверки Архетипов
// 28.09.2026 оказалось два реестра под одно правило, оставлен один.

import { describe, it, expect } from "vitest";
import { infamyFailSuccessOptions, INFAMY_FAIL_SUCCESS_SOURCES } from "../../module/rules/infamy-fail-success.mjs";

const survivor = flag => flag === "trait.survivor";

describe("Выживальщик: не-атакующий тест S, T, A или P", () => {
  it.each(["s", "t", "ag", "per"])("провал теста на %s — предлагается", char => {
    expect(infamyFailSuccessOptions(survivor, { char, success: false }).map(o => o.capability))
      .toEqual(["trait.survivor"]);
  });

  it("Навык через эти Характеристики тоже (Athletics(S), Awareness(P)) — [допущение]", () => {
    expect(infamyFailSuccessOptions(survivor, { skill: "athletics", char: "s" })).toHaveLength(1);
    expect(infamyFailSuccessOptions(survivor, { skill: "awareness", char: "per" })).toHaveLength(1);
  });

  it.each(["ws", "bs", "int", "wp", "fel", "inf"])("тест на %s — нет", char => {
    expect(infamyFailSuccessOptions(survivor, { char })).toEqual([]);
  });

  it("успех и отсутствие Черты — нет", () => {
    expect(infamyFailSuccessOptions(survivor, { char: "t", success: true })).toEqual([]);
    expect(infamyFailSuccessOptions(() => false, { char: "t" })).toEqual([]);
  });

  it("Выживальщик и Змеиный Язык живут в одном реестре", () => {
    const caps = INFAMY_FAIL_SUCCESS_SOURCES.map(s => s.capability);
    expect(caps).toEqual(expect.arrayContaining(["trait.survivor", "trait.serpentSTongue"]));
  });
});
