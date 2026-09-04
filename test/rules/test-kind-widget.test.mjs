// test/rules/test-kind-widget.test.mjs
//
// Чтение формы «Вид теста» — общий для всех диалогов броска. `val` здесь
// имитирует и DialogV2 (`form.querySelector`), и jQuery-адаптер старого
// Dialog: обоим передаётся один и тот же объект-словарь.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs"; // esc() у opposedComparisonHtml зовёт foundry.utils.escapeHTML
import {
  readTestKind, readDiceChoice, mergeReroll, critLineHtml, testKindHtml, opposedComparisonHtml
} from "../../module/rules/test-kind-widget.mjs";

/** val(selector) из словаря — то же самое, чем DialogV2 и jQuery-адаптер
 *  оборачивают форму на вызывающей стороне. */
const valOf = fields => sel => (sel in fields ? fields[sel] : null);

describe("readTestKind", () => {
  it("без выбора — Базовый, Сложность 0, подблоков нет", () => {
    expect(readTestKind(valOf({ "#test-kind": "base", "#test-difficulty": "0" })))
      .toEqual({ kind: "base", difficulty: 0, combined: null, extended: null, opposed: null });
  });

  it("Сложность читается числом, включая отрицательную", () => {
    expect(readTestKind(valOf({ "#test-kind": "base", "#test-difficulty": "-20" })).difficulty).toBe(-20);
  });

  it("Комбинированный: charKey и Предел второго", () => {
    const r = readTestKind(valOf({
      "#test-kind": "combined", "#combined-char-select": "ag", "#combined-target": "35"
    }));
    expect(r.combined).toEqual({ charKey: "ag", target: 35 });
    expect(r.extended).toBeNull();
  });

  it("Расширенный: название по умолчанию берётся из подписи теста", () => {
    const r = readTestKind(valOf({ "#test-kind": "extended", "#extended-goal": "10" }), { label: "Медицина" });
    expect(r.extended).toEqual({ label: "Медицина", goal: 10 });
  });

  it("Расширенный: пустое название с пробелами тоже откатывается на подпись", () => {
    const r = readTestKind(valOf({ "#test-kind": "extended", "#extended-label": "   ", "#extended-goal": "5" }),
      { label: "Медицина" });
    expect(r.extended.label).toBe("Медицина");
  });

  it("Встречный: соперник указан целиком — оба числа", () => {
    const r = readTestKind(valOf({
      "#test-kind": "opposed", "#opposed-threshold": "50", "#opposed-roll": "60"
    }));
    expect(r.opposed).toEqual({ threshold: 50, roll: 60 });
  });

  it("Встречный: соперник не указан (оба поля пустые/отсутствуют) — null", () => {
    expect(readTestKind(valOf({ "#test-kind": "opposed" })).opposed).toBeNull();
  });

  it("Встречный: указано только одно поле — тоже null, не 0", () => {
    expect(readTestKind(valOf({ "#test-kind": "opposedSafe", "#opposed-threshold": "50" })).opposed).toBeNull();
  });
});

describe("readDiceChoice", () => {
  it("без выбора — normal", () => {
    expect(readDiceChoice(valOf({}))).toBe("normal");
  });

  it("читает отмеченную радиокнопку", () => {
    expect(readDiceChoice(valOf({ ".dice-mode-opt:checked": "advantage" }))).toBe("advantage");
  });
});

describe("mergeReroll", () => {
  it("именной переброс важнее выбора Кубика", () => {
    const named = { mode: "keepWorst", rolls: 3, label: "Локус Буйства" };
    expect(mergeReroll(named, "advantage")).toBe(named);
  });

  it("без именного — Преимущество даёт keepBest", () => {
    expect(mergeReroll(null, "advantage")).toEqual({ rolls: 2, mode: "keepBest", label: "Преимущество" });
  });

  it("без именного — Помеха даёт keepWorst", () => {
    expect(mergeReroll(null, "disadvantage")).toEqual({ rolls: 2, mode: "keepWorst", label: "Помеха" });
  });

  it("ни того ни другого — null, одиночный бросок", () => {
    expect(mergeReroll(null, "normal")).toBeNull();
  });
});

describe("testKindHtml: ряд авто-соперника (wdbc-j814)", () => {
  it("скрыт по умолчанию — остальные диалоги (Расстройства/Отряд/Демон/Верховая езда) его не видят", () => {
    const html = testKindHtml();
    expect(html).toContain('id="opposed-auto-row"');
    expect(html).toContain('id="opposed-auto"');
    expect(html).toMatch(/id="opposed-auto-row"[^>]*hidden/);
  });
});

describe("opposedComparisonHtml (wdbc-j814)", () => {
  const base = {
    label: "Запугивание",
    mineName: "Иван", mine: { threshold: 50, roll: 30 },
    theirsName: "Драго", theirs: { threshold: 40, roll: 60 }
  };

  it("побеждает инициатор (mine) — имя и margin в тексте", () => {
    const html = opposedComparisonHtml({ ...base, result: { winner: "mine", margin: 5 } });
    expect(html).toContain("Иван");
    expect(html).toContain("5");
  });

  it("побеждает соперник (theirs) — его имя в тексте", () => {
    const html = opposedComparisonHtml({ ...base, result: { winner: "theirs", margin: 3 } });
    expect(html).toContain("Драго");
  });

  it("ничья (winner: null) — не называет победителя, но не падает", () => {
    const html = opposedComparisonHtml({ ...base, result: { winner: null, margin: 0 } });
    expect(html).not.toContain("undefined");
    expect(html.toLowerCase()).toContain("ничья");
  });

  it("экранирует имена акторов", () => {
    const html = opposedComparisonHtml({
      ...base, mineName: '<img src=x onerror=alert(1)>', result: { winner: "mine", margin: 1 }
    });
    expect(html).not.toContain("<img");
  });
});

describe("critLineHtml", () => {
  it("успех — зелёная строка", () => {
    expect(critLineHtml({ success: true, failure: false })).toContain("Критический Успех");
  });

  it("провал — красная строка", () => {
    expect(critLineHtml({ success: false, failure: true })).toContain("Критический Провал");
  });

  it("ни то ни другое — пустая строка", () => {
    expect(critLineHtml({ success: false, failure: false })).toBe("");
  });
});
