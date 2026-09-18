// test/rules/test-kind-widget.test.mjs
//
// Чтение формы «Вид теста» — общий для всех диалогов броска. `val` здесь
// имитирует и DialogV2 (`form.querySelector`), и jQuery-адаптер старого
// Dialog: обоим передаётся один и тот же объект-словарь.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs"; // esc()/DialogV2 зовут заглушку
import {
  readTestKind, readDiceChoice, mergeReroll, critLineHtml, testKindHtml, opposedComparisonHtml,
  rollD100WithReroll, confirmRollPick
} from "../../module/rules/test-kind-widget.mjs";

/** val(selector) из словаря — то же самое, чем DialogV2 и jQuery-адаптер
 *  оборачивают форму на вызывающей стороне. */
const valOf = fields => sel => (sel in fields ? fields[sel] : null);
/** checked(selector) из того же словаря — чекбоксы хранятся как `true`. */
const checkedOf = fields => sel => !!fields[sel];

describe("readTestKind", () => {
  it("без выбора — Сложность 0, подблоков нет", () => {
    const fields = { "#test-difficulty": "0" };
    expect(readTestKind(valOf(fields), checkedOf(fields)))
      .toEqual({ difficulty: 0, combined: null, extended: null, opposed: null });
  });

  it("Сложность читается числом, включая отрицательную", () => {
    const fields = { "#test-difficulty": "-20" };
    expect(readTestKind(valOf(fields), checkedOf(fields)).difficulty).toBe(-20);
  });

  it("Комбинированный: charKey и Предел второго", () => {
    const fields = { "#kind-combined": true, "#combined-char-select": "ag", "#combined-target": "35" };
    const r = readTestKind(valOf(fields), checkedOf(fields));
    expect(r.combined).toEqual({ charKey: "ag", target: 35 });
    expect(r.extended).toBeNull();
  });

  it("Расширенный: название по умолчанию берётся из подписи теста", () => {
    const fields = { "#kind-extended": true, "#extended-goal": "10" };
    const r = readTestKind(valOf(fields), checkedOf(fields), { label: "Медицина" });
    expect(r.extended).toEqual({ label: "Медицина", goal: 10 });
  });

  it("Расширенный: пустое название с пробелами тоже откатывается на подпись", () => {
    const fields = { "#kind-extended": true, "#extended-label": "   ", "#extended-goal": "5" };
    const r = readTestKind(valOf(fields), checkedOf(fields), { label: "Медицина" });
    expect(r.extended.label).toBe("Медицина");
  });

  it("Встречный: соперник указан целиком — оба числа", () => {
    const fields = { "#kind-opposed": true, "#opposed-threshold": "50", "#opposed-roll": "60" };
    const r = readTestKind(valOf(fields), checkedOf(fields));
    expect(r.opposed).toEqual({ threshold: 50, roll: 60, safe: false });
  });

  it("Встречный: соперник не указан (оба поля пустые/отсутствуют) — null", () => {
    const fields = { "#kind-opposed": true };
    expect(readTestKind(valOf(fields), checkedOf(fields)).opposed).toBeNull();
  });

  it("Встречный: указано только одно поле — тоже null, не 0", () => {
    const fields = { "#kind-opposed": true, "#kind-opposed-safe": true, "#opposed-threshold": "50" };
    expect(readTestKind(valOf(fields), checkedOf(fields)).opposed).toBeNull();
  });

  it("Безопасный встречный (vss): флаг safe читается из чекбокса рядом", () => {
    const fields = {
      "#kind-opposed": true, "#kind-opposed-safe": true, "#opposed-threshold": "50", "#opposed-roll": "60"
    };
    const r = readTestKind(valOf(fields), checkedOf(fields));
    expect(r.opposed).toEqual({ threshold: 50, roll: 60, safe: true });
  });

  it("Все виды разом — Комбинированный, Расширенный и Встречный не исключают друг друга", () => {
    const fields = {
      "#kind-combined": true, "#combined-char-select": "ag", "#combined-target": "35",
      "#kind-extended": true, "#extended-goal": "10",
      "#kind-opposed": true, "#opposed-threshold": "50", "#opposed-roll": "60"
    };
    const r = readTestKind(valOf(fields), checkedOf(fields), { label: "Медицина" });
    expect(r.combined).toEqual({ charKey: "ag", target: 35 });
    expect(r.extended).toEqual({ label: "Медицина", goal: 10 });
    expect(r.opposed).toEqual({ threshold: 50, roll: 60, safe: false });
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
  it("именной без Кубика — используется как есть", () => {
    const named = { mode: "keepWorst", rolls: 3, label: "Локус Буйства" };
    expect(mergeReroll(named, "normal")).toBe(named);
  });

  // стр. 26: «Если тест имел Преимущество или Помеху, переброс сохраняет
  // этот эффект» — согласованный режим складывает число бросков, а не
  // теряет Кубик игрока (wdbc-y9i8/довели по букве правил, 18.09.2026).
  it("именной переброс + СОГЛАСОВАННЫЙ Кубик (оба keepBest) — складывает число бросков", () => {
    const named = { mode: "keepBest", rolls: 2, label: "Локус Грации" };
    expect(mergeReroll(named, "advantage")).toEqual({ mode: "keepBest", rolls: 2, label: "Локус Грации + Преимущество" });
  });

  it("именной переброс (3 броска) + согласованный Кубик — берёт больший счётчик", () => {
    const named = { mode: "keepWorst", rolls: 3, label: "Локус Буйства" };
    expect(mergeReroll(named, "disadvantage")).toEqual({ mode: "keepWorst", rolls: 3, label: "Локус Буйства + Помеха" });
  });

  // стр. 26, следующий абзац: «Преимущества и Помехи на один тест нивелируют
  // друг друга» — тот же принцип для конфликта именного переброса и Кубика:
  // переброс происходит (галочка стоит), но без выбора лучшего/худшего.
  it("именной переброс + ПРОТИВОПОЛОЖНЫЙ Кубик — нивелируются до одиночного броска", () => {
    const named = { mode: "keepWorst", rolls: 3, label: "Локус Буйства" };
    expect(mergeReroll(named, "advantage")).toEqual({ mode: "keepWorst", rolls: 1, label: "Локус Буйства (Преимущество нивелирована)" });
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

describe("confirmRollPick", () => {
  beforeEach(resetCaptured);

  it("кнопка автовыбора возвращает auto как есть", async () => {
    const auto = { value: 20, index: 1, dropped: [80] };
    const promise = confirmRollPick([80, 20], auto);
    await captured.press("auto");
    expect(await promise).toBe(auto);
  });

  it("выбор другого значения возвращает его — с пересчитанным dropped", async () => {
    const auto = { value: 20, index: 1, dropped: [80] };
    const promise = confirmRollPick([80, 20], auto);
    await captured.press("alt-0");
    expect(await promise).toEqual({ value: 80, index: 0, dropped: [20] });
  });
});

/** Макротик — два броска Roll.evaluate() внутри rollD100WithReroll — два
 *  уровня промисов до того, как confirmRollPick вообще откроет диалог. */
const flush = () => new Promise(r => setTimeout(r, 0));

describe("rollD100WithReroll: confirmPick (стр. 26, wdbc-y9i8)", () => {
  beforeEach(resetCaptured);

  it("confirmPick не задан (по умолчанию false) — без Кубика-на-Кубике, авто-выбор сразу", async () => {
    captured.dice = [80, 20];
    const { rv } = await rollD100WithReroll({ mode: "keepBest", rolls: 2, label: "Преимущество" });
    expect(captured.dialog).toBeNull(); // никакого доп. диалога не открывалось
    expect(rv).toBe(20); // keepBest на d100 — меньшее
  });

  it("confirmPick: true и значения различаются — открывает выбор", async () => {
    captured.dice = [80, 20];
    const promise = rollD100WithReroll({ mode: "keepBest", rolls: 2, label: "Преимущество" }, { confirmPick: true });
    await flush();
    await captured.press("alt-0"); // сознательно взять худший (80), а не авто-лучший (20)
    const { rv } = await promise;
    expect(rv).toBe(80);
  });

  it("confirmPick: true, но оба броска одинаковы — доп. диалог не открывается", async () => {
    captured.nextRoll = 45; // одно и то же значение на оба броска
    const { rv } = await rollD100WithReroll({ mode: "keepBest", rolls: 2, label: "Преимущество" }, { confirmPick: true });
    expect(captured.dialog).toBeNull();
    expect(rv).toBe(45);
  });

  it("одиночный бросок (без переброса) — доп. диалог не открывается, даже с confirmPick: true", async () => {
    captured.nextRoll = 45;
    const { rv } = await rollD100WithReroll(null, { confirmPick: true });
    expect(captured.dialog).toBeNull();
    expect(rv).toBe(45);
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
