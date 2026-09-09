// Вид записи «Модификатор теста» (kind:"testMod") и область «Нестабильность».
// Первый потребитель — Локус Цепей: «+Inf герольда на все тесты Нестабильности».

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rollModsFromRules } from "../../module/rules/resolve-test.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";

const SYSTEM = "warhammer-dbc";
let errors;
beforeEach(() => { errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => errors.mockRestore());

const item = (name, entries) => ({
  id: name, name,
  flags: { [SYSTEM]: { mechanics: [{ id: "g", operator: "AND", entries }] } }
});
const testMod = (over = {}) => ({
  id: "e1", kind: "testMod", modScope: "instability",
  modValueMode: "flat", value: 5, modCharBonus: "inf", label: "", ...over
});

describe("область «Нестабильность»", () => {
  const rule = { id: "r", label: "Локус Цепей", when: {}, effects: [
    { kind: "rollBonus", target: "instability", value: 4 }
  ] };

  it("модификатор доходит до теста Нестабильности", () => {
    expect(rollModsFromRules([rule], { kind: "instability" }))
      .toEqual([{ ruleId: "r", label: "Локус Цепей", value: 4, halvePenalty: false }]);
  });

  it("и не примазывается к обычному тесту Воли: это разные правила книги", () => {
    expect(rollModsFromRules([rule], { kind: "skill", char: "wp" })).toEqual([]);
  });
});

describe("область «vsExorcism» (Локус Цепей, wdbc-smc)", () => {
  const rule = { id: "r", label: "Локус Цепей: против Экзорцизма/Демонологии", when: {}, effects: [
    { kind: "rollBonus", target: "vsExorcism", value: 4 }
  ] };

  it("модификатор доходит до встречного теста против Экзорцизма/Демонологии", () => {
    expect(rollModsFromRules([rule], { kind: "vsExorcism" }))
      .toEqual([{ ruleId: "r", label: "Локус Цепей: против Экзорцизма/Демонологии", value: 4, halvePenalty: false }]);
  });

  it("не примазывается ни к обычному Встречному тесту (kind:\"opposed\"), ни к Нестабильности", () => {
    expect(rollModsFromRules([rule], { kind: "opposed" })).toEqual([]);
    expect(rollModsFromRules([rule], { kind: "instability" })).toEqual([]);
  });
});

describe("значение от своей характеристики", () => {
  const rule = { id: "r", label: "Цепи", when: {}, effects: [
    { kind: "rollBonus", target: "instability", valueFrom: { selfCharBonus: "inf" } }
  ] };

  it("берётся бонус характеристики САМОГО актора, а не цели", () => {
    const actor = { system: { characteristics: { inf: { bonus: 6 } } } };
    expect(rollModsFromRules([rule], { kind: "instability", actor })[0].value).toBe(6);
  });

  it("нет актора или характеристики — ноль, без падения посреди броска", () => {
    expect(rollModsFromRules([rule], { kind: "instability" })[0].value).toBe(0);
  });
});

describe("значение от собственного Пси-Рейтинга (wdbc-jw81 — «+PR» психосил/техночудес)", () => {
  const rule = { id: "r", label: "Сила", when: {}, effects: [
    { kind: "rollBonus", target: "char:s", valueFrom: { selfCharBonus: "pr" } }
  ] };

  it("берётся текущий (уже уменьшенный поддержанием) Пси-Рейтинг актора", () => {
    const actor = { system: { psyker: { currentRating: 4 } } };
    expect(rollModsFromRules([rule], { kind: "skill", char: "s", actor })[0].value).toBe(4);
  });

  it("multiplier масштабирует («+2×PR»)", () => {
    const ruleX2 = { id: "r2", label: "Сила×2", when: {}, effects: [
      { kind: "rollBonus", target: "char:s", valueFrom: { selfCharBonus: "pr", multiplier: 2 } }
    ] };
    const actor = { system: { psyker: { currentRating: 3 } } };
    expect(rollModsFromRules([ruleX2], { kind: "skill", char: "s", actor })[0].value).toBe(6);
  });

  it("нет актора или psyker — ноль, без падения посреди броска", () => {
    expect(rollModsFromRules([rule], { kind: "skill", char: "s" })[0].value).toBe(0);
  });
});

describe("значение от бонуса Порчи (wdbc-1rno — «½Cor.b (окр.▲)» Enchanting Voice/Black Eyes и др.)", () => {
  const rule = (multiplier) => ({ id: "r", label: "Чарующий Голос", when: {}, effects: [
    { kind: "rollBonus", target: "all", valueFrom: { selfCharBonus: "cor", multiplier } }
  ] });

  it("½Cor.b округляется ВВЕРХ (книга всегда «окр.▲»)", () => {
    // corruptionBonus = floor(65/10) = 6; половина 6 = 3 (уже целое — но
    // проверяем нечётный случай отдельно ниже).
    const actor = { system: { corruptionBonus: 6 } };
    expect(rollModsFromRules([rule(0.5)], { kind: "skill", actor })[0].value).toBe(3);
  });

  it("нечётный Cor.b: 5×0.5=2.5 округляется до 3, не до 2", () => {
    const actor = { system: { corruptionBonus: 5 } };
    expect(rollModsFromRules([rule(0.5)], { kind: "skill", actor })[0].value).toBe(3);
  });

  it("множитель по умолчанию (1) не меняет значение", () => {
    const actor = { system: { corruptionBonus: 4 } };
    expect(rollModsFromRules([rule(undefined)], { kind: "skill", actor })[0].value).toBe(4);
  });

  it("нет актора или corruptionBonus — ноль, без падения посреди броска", () => {
    expect(rollModsFromRules([rule(0.5)], { kind: "skill" })[0].value).toBe(0);
  });
});

// wdbc-1rno, шаг F: Инфернальный Оруженосец — «Кровопускатель считает Завесу
// на Cor.b ПЕРСОНАЖА тоньше» — Черта висит на демоне, число берётся с листа
// его Хозяина (ctx.masterActor), не с самого демона. ctx.masterActor уже
// резолвлен вызывающим кодом (module/sheets/daemon-sheet.mjs) — тот же приём,
// что и у ctx.targetActor, здесь никакого fromUuid.
describe("значение от характеристики ХОЗЯИНА (masterCharBonus, wdbc-1rno шаг F)", () => {
  const rule = { id: "r", label: "Тоньше Завесы", when: {}, effects: [
    { kind: "rollBonus", target: "instability", valueFrom: { masterCharBonus: "cor" } }
  ] };

  it("берётся Cor.b ХОЗЯИНА (masterActor), а не самого демона (actor)", () => {
    const actor = { system: { corruptionBonus: 1 } };
    const masterActor = { system: { corruptionBonus: 7 } };
    expect(rollModsFromRules([rule], { kind: "instability", actor, masterActor })[0].value).toBe(7);
  });

  it("нет masterActor (демон без Хозяина, или контекст его не резолвил) — ноль, без падения", () => {
    const actor = { system: { corruptionBonus: 5 } };
    expect(rollModsFromRules([rule], { kind: "instability", actor })[0].value).toBe(0);
  });

  it("обычная характеристика Хозяина (не pr/cor) — тот же путь, что selfCharBonus", () => {
    const ruleInf = { id: "r2", label: "Инф Хозяина", when: {}, effects: [
      { kind: "rollBonus", target: "instability", valueFrom: { masterCharBonus: "inf" } }
    ] };
    const masterActor = { system: { characteristics: { inf: { bonus: 4 } } } };
    expect(rollModsFromRules([ruleInf], { kind: "instability", masterActor })[0].value).toBe(4);
  });

  it("masterCharBonus:\"pr\" — Пси-Рейтинг Хозяина, не демона", () => {
    const rulePr = { id: "r3", label: "PR Хозяина", when: {}, effects: [
      { kind: "rollBonus", target: "instability", valueFrom: { masterCharBonus: "pr" } }
    ] };
    const masterActor = { system: { psyker: { currentRating: 3 } } };
    expect(rollModsFromRules([rulePr], { kind: "instability", masterActor })[0].value).toBe(3);
  });
});

describe("запись Конструктора «Модификатор теста»", () => {
  it("плоское число превращается в rollBonus нужной области", () => {
    const rules = rulesFromItemMechanics([item("Локус Цепей", [testMod()])]);
    expect(rules[0].effects).toEqual([{ kind: "rollBonus", target: "instability", value: 5 }]);
  });

  it("режим «бонус характеристики» пишет valueFrom, а не число", () => {
    const rules = rulesFromItemMechanics([item("Локус Цепей", [
      testMod({ modValueMode: "charBonus", modCharBonus: "inf" })
    ])]);
    expect(rules[0].effects).toEqual([
      { kind: "rollBonus", target: "instability", valueFrom: { selfCharBonus: "inf" } }
    ]);
  });

  it("vsExorcism (Локус Цепей, wdbc-smc) — фиксированная область, не char/skill", () => {
    const rules = rulesFromItemMechanics([item("Локус Цепей", [
      testMod({ modScope: "vsExorcism", modValueMode: "charBonus", modCharBonus: "inf" })
    ])]);
    expect(rules[0].effects).toEqual([
      { kind: "rollBonus", target: "vsExorcism", valueFrom: { selfCharBonus: "inf" } }
    ]);
  });

  it("области берутся те же, что у Переброса", () => {
    const rules = rulesFromItemMechanics([item("И", [testMod({ modScope: "char", rerollChar: "wp" })])]);
    expect(rules[0].effects[0].target).toBe("char:wp");
  });

  it("modCharBonusMultiplier пишет multiplier в valueFrom («+2×PR», wdbc-jw81)", () => {
    const rules = rulesFromItemMechanics([item("Внутренние Часы", [
      testMod({ modValueMode: "charBonus", modCharBonus: "pr", modCharBonusMultiplier: 2 })
    ])]);
    expect(rules[0].effects).toEqual([
      { kind: "rollBonus", target: "instability", valueFrom: { selfCharBonus: "pr", multiplier: 2 } }
    ]);
  });

  it("modCharBonusMultiplier отсутствующий/1 не добавляет multiplier (как раньше)", () => {
    const rules = rulesFromItemMechanics([item("Локус Цепей", [
      testMod({ modValueMode: "charBonus", modCharBonus: "inf", modCharBonusMultiplier: 1 })
    ])]);
    expect(rules[0].effects[0].valueFrom).toEqual({ selfCharBonus: "inf" });
  });

  it("незаполненная область отбрасывается с жалобой", () => {
    expect(rulesFromItemMechanics([item("И", [testMod({ modScope: "char", rerollChar: "" })])])).toEqual([]);
    expect(errors).toHaveBeenCalled();
  });

  // wdbc-1rno, шаг F.
  it("режим «бонус характеристики ХОЗЯИНА» пишет masterCharBonus, а не selfCharBonus", () => {
    const rules = rulesFromItemMechanics([item("Тоньше Завесы", [
      testMod({ modValueMode: "masterCharBonus", modCharBonus: "cor" })
    ])]);
    expect(rules[0].effects).toEqual([
      { kind: "rollBonus", target: "instability", valueFrom: { masterCharBonus: "cor" } }
    ]);
  });

  it("masterCharBonus тоже поддерживает modCharBonusMultiplier", () => {
    const rules = rulesFromItemMechanics([item("Тоньше Завесы", [
      testMod({ modValueMode: "masterCharBonus", modCharBonus: "cor", modCharBonusMultiplier: 0.5 })
    ])]);
    expect(rules[0].effects).toEqual([
      { kind: "rollBonus", target: "instability", valueFrom: { masterCharBonus: "cor", multiplier: 0.5 } }
    ]);
  });
});
