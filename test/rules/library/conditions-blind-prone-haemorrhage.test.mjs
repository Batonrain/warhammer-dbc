// test/rules/library/conditions-blind-prone-haemorrhage.test.mjs
//
// «Раны и Урон», «Статусы» (core.json): три правила Состояний, дописанные в
// rules/library/conditions.mjs сверкой с книгой.
//  - wdbc-x1nz.2.89 Ослеплён: автопровал ЛЮБЫХ тестов BS, −30 любым тестам WS
//    и Бдительности/Проницательности/Выживанию (решение владельца 4);
//    Sonar Sense / Unnatural Senses снимают все штрафы (Чертой по имени и
//    Возможностью Конструктора).
//  - wdbc-x1nz.2.97 п.5 Повален: «−20 на броски WS» — не только рукопашная
//    атака, но и Парирование, и прочие тесты WS; на атаке не задваивается.
//  - wdbc-x1nz.2.92 Обескровливание: −5 × уровень ко всем тестам T.

import "../../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveTest } from "../../../module/rules/resolve-test.mjs";
import { collectTestMods } from "../../../module/rules/roll-mods.mjs";
import { resolveKindOutcome } from "../../../module/rules/kind-outcome.mjs";
import { rulesFromItemMechanics } from "../../../module/rules/item-rules.mjs";
import { selectRules } from "../../../module/rules/collect.mjs";
import { CONDITION_RULES } from "../../../module/rules/library/conditions.mjs";
import { suffersBlindness, hasAlternativeSenses } from "../../../module/rules/blindness.mjs";

const actor = (conditions = {}, items = []) => ({
  system: { race: "human", characteristics: {}, conditions }, items,
  getFlag: () => undefined, setFlag: async () => {}
});
const trait = name => ({ type: "trait", name, system: {} });

const blindMods = (a, ctx) => resolveTest({ actor: a, ...ctx }).autoMods
  .filter(m => m.ruleId === "conditions.blinded");

describe("Ослеплён — тесты Навыков/Характеристик (wdbc-x1nz.2.89)", () => {
  it("тест характеристики BS — автопровал", () => {
    const { autoFail } = resolveTest({ actor: actor({ blinded: true }), kind: "skill", char: "bs" });
    expect(autoFail).toEqual([expect.objectContaining({ ruleId: "conditions.blinded" })]);
  });

  it("не Ослеплён — автопровала BS нет", () => {
    expect(resolveTest({ actor: actor(), kind: "skill", char: "bs" }).autoFail).toEqual([]);
  });

  it("оба глаза потеряны = Ослеплён (автопровал BS)", () => {
    const a = actor({ lostEyes: true, lostEyesCount: 2 });
    expect(resolveTest({ actor: a, kind: "skill", char: "bs" }).autoFail).toHaveLength(1);
  });

  it("один глаз — не Ослеплён", () => {
    const a = actor({ lostEyes: true, lostEyesCount: 1 });
    expect(resolveTest({ actor: a, kind: "skill", char: "bs" }).autoFail).toEqual([]);
    expect(blindMods(a, { kind: "skill", char: "ws" })).toEqual([]);
  });

  it("атака BS в конвейере автопровала не получает — её считает окно атаки (без задвоения)", () => {
    const { autoFail, autoMods, mods } = resolveTest({
      actor: actor({ blinded: true }), kind: "attack", isMelee: false, char: "bs", weaponClass: "basic"
    });
    expect(autoFail).toEqual([]);
    expect([...autoMods, ...mods].filter(m => m.ruleId === "conditions.blinded")).toEqual([]);
  });

  it("тест характеристики WS — −30 автоматически (не галочкой)", () => {
    const a = actor({ blinded: true });
    expect(blindMods(a, { kind: "skill", char: "ws" })).toEqual([expect.objectContaining({ value: -30 })]);
    expect(resolveTest({ actor: a, kind: "skill", char: "ws" }).mods
      .filter(m => m.ruleId === "conditions.blinded")).toEqual([]);
  });

  it("Парирование (навык от WS) — −30", () => {
    expect(blindMods(actor({ blinded: true }), { kind: "skill", skill: "parry", char: "ws" }))
      .toEqual([expect.objectContaining({ value: -30 })]);
  });

  it.each(["awareness", "scrutiny", "survival"])("навык %s — −30", skill => {
    expect(blindMods(actor({ blinded: true }), { kind: "skill", skill, char: "per" }))
      .toEqual([expect.objectContaining({ value: -30 })]);
  });

  it("Психонаука (от Per, не зрение) — без штрафа", () => {
    expect(blindMods(actor({ blinded: true }), { kind: "skill", skill: "psyniscience", char: "per" })).toEqual([]);
  });

  it("Бдительность на WS (Распознать Стойку) — −30 ОДИН раз, не −60", () => {
    const list = blindMods(actor({ blinded: true }), { kind: "skill", skill: "awareness", char: "ws" });
    expect(list).toHaveLength(1);
    expect(list[0].value).toBe(-30);
  });

  it("Реакция без диалога (collectTestMods) получает −30 в сумму", () => {
    expect(collectTestMods(actor({ blinded: true }), { kind: "skill", skill: "parry", char: "ws" }).total).toBe(-30);
  });

  it.each(["Sonar Sense / Сонарное Чувство", "Unnatural Senses (30)", "Sonar Senses / Сонарное Чувство"])(
    "Черта «%s» снимает все штрафы (и −30, и автопровал)", name => {
      const a = actor({ blinded: true }, [trait(name)]);
      expect(resolveTest({ actor: a, kind: "skill", char: "bs" }).autoFail).toEqual([]);
      expect(blindMods(a, { kind: "skill", char: "ws" })).toEqual([]);
      expect(suffersBlindness(a)).toBe(false);
    });

  it("Возможность Конструктора trait.sonarSense снимает штрафы так же, как Черта", () => {
    const item = {
      id: "i1", type: "gear", name: "Эхолокатор", system: {},
      flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND",
        entries: [{ id: "e1", kind: "capability", capabilityKey: "trait.sonarSense" }] }] } }
    };
    const a = actor({ blinded: true });
    const itemR = rulesFromItemMechanics([item], () => true, a);
    expect(itemR.some(r => (r.overrides ?? []).includes("conditions.blinded"))).toBe(true);
    // Сквозь штатный отбор: книжное правило Ослепления снято, штрафа нет.
    const bag = [...CONDITION_RULES, ...itemR];
    expect(selectRules(bag, a, { kind: "skill", char: "ws" }).map(r => r.id)).not.toContain("conditions.blinded");
  });

  it("suffersBlindness: Ослеплён без сонара — да; не Ослеплён — нет; щит на голове — да", () => {
    expect(suffersBlindness(actor({ blinded: true }))).toBe(true);
    expect(suffersBlindness(actor())).toBe(false);
    expect(suffersBlindness(actor(), { extraBlind: true })).toBe(true);
    expect(hasAlternativeSenses(actor({}, [trait("Unnatural Senses (8)")]))).toBe(true);
  });
});

describe("Ослеплён — исход теста (resolveKindOutcome)", () => {
  it("тест BS с броском ниже Порога всё равно провален, строка автопровала в карточке", async () => {
    const a = actor({ blinded: true });
    const o = await resolveKindOutcome(a, { baseEff: 60, rv: 20, ctx: { actor: a, kind: "skill", char: "bs" } });
    expect(o.success).toBe(false);
    expect(o.deg).toBe(1);
    expect(o.critLine).toContain("Автопровал");
  });

  it("тот же бросок без Ослепления — успех", async () => {
    const a = actor();
    const o = await resolveKindOutcome(a, { baseEff: 60, rv: 20, ctx: { actor: a, kind: "skill", char: "bs" } });
    expect(o.success).toBe(true);
    expect(o.critLine).not.toContain("Автопровал");
  });

  it("autoSuccess не перебивает автопровал", async () => {
    const a = actor({ blinded: true });
    const o = await resolveKindOutcome(a, { baseEff: 60, rv: 20, autoSuccess: true, ctx: { actor: a, kind: "skill", char: "bs" } });
    expect(o.success).toBe(false);
  });
});

describe("Повален — −20 на все тесты WS (wdbc-x1nz.2.97 п.5)", () => {
  const proneMods = (ctx) => {
    const r = resolveTest({ actor: actor({ prone: true }), ...ctx });
    return [...r.autoMods, ...r.mods].filter(m => m.ruleId === "conditions.prone");
  };

  it("Парирование — −20 (раньше без штрафа)", () => {
    expect(proneMods({ kind: "skill", skill: "parry", char: "ws" })).toEqual([expect.objectContaining({ value: -20 })]);
  });

  it("тест характеристики WS — −20", () => {
    expect(proneMods({ kind: "skill", char: "ws" })).toEqual([expect.objectContaining({ value: -20 })]);
  });

  it("рукопашная атака — ровно один −20 (weapon:melee), basedon:ws не задваивает", () => {
    expect(proneMods({ kind: "attack", isMelee: true, char: "ws", weaponClass: "melee" }))
      .toEqual([expect.objectContaining({ value: -20 })]);
  });

  it("тест BS не штрафуется", () => {
    expect(proneMods({ kind: "skill", char: "bs" })).toEqual([]);
  });
});

describe("Обескровливание — −5 × уровень ко всем тестам T (wdbc-x1nz.2.92)", () => {
  const hMods = (conds, ctx) => resolveTest({ actor: actor(conds), ...ctx }).autoMods
    .filter(m => m.ruleId === "conditions.haemorrhaging");

  it("уровень 3 — тест T −15", () => {
    expect(hMods({ haemorrhaging: true, haemorrhagingLevel: 3 }, { kind: "skill", char: "t" }))
      .toEqual([expect.objectContaining({ value: -15 })]);
  });

  it("уровень 1 — −5", () => {
    expect(hMods({ haemorrhaging: true, haemorrhagingLevel: 1 }, { kind: "skill", char: "t" }))
      .toEqual([expect.objectContaining({ value: -5 })]);
  });

  it("тест не T — без штрафа", () => {
    expect(hMods({ haemorrhaging: true, haemorrhagingLevel: 3 }, { kind: "skill", char: "wp" })).toEqual([]);
  });

  it("нет Обескровливания — без штрафа", () => {
    expect(hMods({}, { kind: "skill", char: "t" })).toEqual([]);
  });
});

describe("valueFrom.selfConditionLevel — Состояние без счётчика", () => {
  let errors;
  beforeEach(() => { errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => errors.mockRestore());

  it("жалуется в консоль и мод не выдаёт", async () => {
    const { rollModsFromRules } = await import("../../../module/rules/resolve-test.mjs");
    const rule = { id: "x", effects: [{ kind: "rollBonus", target: "all", auto: true, valueFrom: { selfConditionLevel: "prone" } }] };
    expect(rollModsFromRules([rule], { actor: actor({ prone: true }) }, { auto: true })).toEqual([]);
    expect(errors).toHaveBeenCalled();
  });
});
