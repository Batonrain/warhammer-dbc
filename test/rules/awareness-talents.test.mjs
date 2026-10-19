// test/rules/awareness-talents.test.mjs
//
// Таланты Внимательности (глава 3): rules/awareness-talents.mjs и то, как они
// встраиваются в конвейер теста, Ослепление и Слепое Зрение.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  hasAwarenessTalent, heightenedSensesOf, awarenessTalentRules, awarenessTalentDegrees,
  halvePenalty, AWARENESS_RULE_IDS
} from "../../module/rules/awareness-talents.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { ruleRollModsHtml } from "../../module/rules/roll-mods.mjs";
import { suffersBlindness, hasAlternativeSenses } from "../../module/rules/blindness.mjs";
import { helmetWorn, blindsightActive } from "../../module/rules/predicates.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const talent = (name, system = {}) => ({ id: `t-${name}`, type: "talent", name, system, getFlag: () => undefined });
const armor = (head, equipped = true) => ({ id: `a-${head}`, type: "armor", name: "Шлем", system: { equipped, head }, getFlag: () => undefined });

function actorWith(items = [], { conditions = {}, per = 40, system = {} } = {}) {
  const sys = new ACTOR_DATA_MODELS.character({}).toObject();
  sys.characteristics.per.base = per;
  sys.characteristics.per.total = per;
  sys.characteristics.per.bonus = Math.floor(per / 10);
  Object.assign(sys.conditions, conditions);
  Object.assign(sys, system);
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return { type: "character", name: "Подставной", system: sys, items: list, getFlag: () => undefined };
}

const awarenessCtx = { kind: "skill", skill: "awareness", char: "per" };
const labelsOf = res => res.mods.map(m => m.label);

describe("hasAwarenessTalent", () => {
  it("по имени предмета", () => {
    expect(hasAwarenessTalent(actorWith([talent("Taster / Дегустатор")]), "taster")).toBe(true);
    expect(hasAwarenessTalent(actorWith(), "taster")).toBe(false);
    expect(hasAwarenessTalent(actorWith(), "нет")).toBe(false);
  });
});

describe("heightenedSensesOf: выбранные чувства", () => {
  const hs = spec => actorWith([talent("Heightened Senses / Усиленные Чувства", { specialization: spec })]);
  it("одно чувство по-английски и по-русски", () => {
    expect(heightenedSensesOf(hs("Hearing")).map(s => s.key)).toEqual(["hearing"]);
    expect(heightenedSensesOf(hs("Обоняние")).map(s => s.label)).toEqual(["Обоняние"]);
  });
  it("несколько через запятую; All — все пять", () => {
    expect(heightenedSensesOf(hs("Sight, Taste")).map(s => s.key)).toEqual(["sight", "taste"]);
    expect(heightenedSensesOf(hs("All")).map(s => s.key)).toEqual(["sight", "hearing", "smell", "taste", "touch"]);
  });
  it("не распознано — общая запись; нет Таланта — пусто", () => {
    expect(heightenedSensesOf(hs("")).map(s => s.key)).toEqual(["any"]);
    expect(heightenedSensesOf(actorWith())).toEqual([]);
  });
  it("два предмета на разные чувства не дублируются", () => {
    const a = actorWith([
      talent("Heightened Senses / Усиленные Чувства", { specialization: "Sight" }),
      talent("Heightened Senses / Усиленные Чувства", { specialization: "Sight" }),
      talent("Heightened Senses / Усиленные Чувства", { specialization: "Touch" })
    ]);
    expect(heightenedSensesOf(a).map(s => s.key)).toEqual(["sight", "touch"]);
  });
});

describe("галочки в окне теста Awareness", () => {
  it("без Талантов — ничего лишнего", () => {
    expect(awarenessTalentRules(actorWith(), awarenessCtx)).toEqual([]);
  });

  it("Усиленные Чувства: +10 на Awareness и Scrutiny, не на прочие Навыки", () => {
    const a = actorWith([talent("Heightened Senses / Усиленные Чувства", { specialization: "Hearing" })]);
    const aw = resolveTest({ actor: a, ...awarenessCtx });
    expect(aw.mods.find(m => m.label === "Усиленные Чувства (Слух)")).toMatchObject({ value: 10, askOnly: true });
    const sc = resolveTest({ actor: a, kind: "skill", skill: "scrutiny", char: "per" });
    expect(labelsOf(sc)).toContain("Усиленные Чувства (Слух)");
    const other = resolveTest({ actor: a, kind: "skill", skill: "stealth", char: "ag" });
    expect(labelsOf(other)).not.toContain("Усиленные Чувства (Слух)");
  });

  it("Усиленные Чувства не появляются на атаке", () => {
    const a = actorWith([talent("Heightened Senses / Усиленные Чувства", { specialization: "Sight" })]);
    const atk = resolveTest({ actor: a, kind: "attack", isMelee: false, char: "bs" });
    expect(atk.mods.some(m => m.label.startsWith("Усиленные Чувства"))).toBe(false);
  });

  it("Дегустатор: +20 нюх и +40 вкус, только Awareness", () => {
    const a = actorWith([talent("Taster / Дегустатор")]);
    const r = resolveTest({ actor: a, ...awarenessCtx });
    expect(r.mods.find(m => m.label.includes("на нюх")).value).toBe(20);
    expect(r.mods.find(m => m.label.includes("на вкус")).value).toBe(40);
    expect(labelsOf(resolveTest({ actor: a, kind: "skill", skill: "scrutiny", char: "per" }))).toEqual([]);
  });

  it("Воролов, Служба Безопасности, Аналитический Взгляд: нулевые галочки с id", () => {
    const a = actorWith([talent("Thiefcatcher / Воролов"), talent("Security Detail / Служба Безопасности"),
      talent("Analytical Eye / Аналитический Взгляд")]);
    const r = resolveTest({ actor: a, ...awarenessCtx });
    for (const id of Object.values(AWARENESS_RULE_IDS)) {
      expect(r.mods.find(m => m.ruleId === id)).toMatchObject({ value: 0, askOnly: true });
    }
    expect(r.mods.find(m => m.ruleId === AWARENESS_RULE_IDS.analyticalEye).setChar).toBe("int");
  });

  it("галочка Аналитического Взгляда несёт data-set-char в разметке окна", () => {
    const a = actorWith([talent("Analytical Eye / Аналитический Взгляд")]);
    const { html } = ruleRollModsHtml(a, awarenessCtx);
    expect(html).toContain('data-set-char="int"');
    expect(html).toContain(`data-rule-id="${AWARENESS_RULE_IDS.analyticalEye}"`);
  });
});

describe("awarenessTalentDegrees: Успехи после броска", () => {
  const eye = AWARENESS_RULE_IDS.analyticalEye;
  const thief = AWARENESS_RULE_IDS.thiefcatcher;
  const sec = AWARENESS_RULE_IDS.securityDetail;
  const all = actorWith([talent("Thiefcatcher / Воролов"), talent("Security Detail / Служба Безопасности"),
    talent("Analytical Eye / Аналитический Взгляд")], { per: 47 });

  it("ничего не отмечено — Успехи те же", () => {
    expect(awarenessTalentDegrees(all, { success: true, deg: 2, charKey: "per" })).toEqual({ deg: 2, lines: [] });
  });
  it("Аналитический Взгляд удваивает", () => {
    expect(awarenessTalentDegrees(all, { checkedRuleIds: [eye], success: true, deg: 3, charKey: "int" }).deg).toBe(6);
  });
  it("Воролов: +½P.b вверх (P.b 4 → +2; P.b 5 → +3)", () => {
    expect(awarenessTalentDegrees(all, { checkedRuleIds: [thief], success: true, deg: 1, charKey: "per" }).deg).toBe(3);
    const p5 = actorWith([talent("Thiefcatcher / Воролов")], { per: 55 });
    expect(awarenessTalentDegrees(p5, { checkedRuleIds: [thief], success: true, deg: 1, charKey: "per" }).deg).toBe(4);
  });
  it("Служба Безопасности: +1 при броске P, ничего при броске I", () => {
    expect(awarenessTalentDegrees(all, { checkedRuleIds: [sec], success: true, deg: 1, charKey: "per" }).deg).toBe(2);
    const onInt = awarenessTalentDegrees(all, { checkedRuleIds: [sec], success: true, deg: 1, charKey: "int" });
    expect(onInt.deg).toBe(1);
    expect(onInt.lines[0]).toContain("только на тест P");
  });
  it("порядок: ×2, затем прибавки", () => {
    // deg 2 → ×2 = 4, Воролов +2 (P.b 4) = 6, Служба +1 = 7
    expect(awarenessTalentDegrees(all, { checkedRuleIds: [eye, thief, sec], success: true, deg: 2, charKey: "per" }).deg).toBe(7);
  });
  it("на провале ничего не добавляет", () => {
    expect(awarenessTalentDegrees(all, { checkedRuleIds: [eye, thief, sec], success: false, deg: 2, charKey: "per" }))
      .toEqual({ deg: 2, lines: [] });
  });
  it("отмечено, но Таланта нет (чужая галочка) — игнорируется", () => {
    expect(awarenessTalentDegrees(actorWith(), { checkedRuleIds: [eye, thief, sec], success: true, deg: 2, charKey: "per" }).deg).toBe(2);
  });
});

describe("Бой Вслепую: штраф Ослепления вдвое", () => {
  it("halvePenalty: −10/−20/−30 → −5/−10/−15; плюс и ноль не трогает", () => {
    expect([-10, -20, -30].map(halvePenalty)).toEqual([-5, -10, -15]);
    expect(halvePenalty(0)).toBe(0);
    expect(halvePenalty(10)).toBe(10);
  });

  const blindWs = a => resolveTest({ actor: a, kind: "skill", skill: "parry", char: "ws" })
    .autoMods.reduce((s, m) => s + m.value, 0);

  it("Ослеплённый без Таланта: −30 на WS; с Талантом: −15", () => {
    expect(blindWs(actorWith([], { conditions: { blinded: true } }))).toBe(-30);
    expect(blindWs(actorWith([talent("Blind Fighting / Бой Вслепую")], { conditions: { blinded: true } }))).toBe(-15);
  });
  it("зрячий носитель Таланта — без поправки", () => {
    expect(blindWs(actorWith([talent("Blind Fighting / Бой Вслепую")]))).toBe(0);
  });
  it("Awareness Ослеплённого Бой Вслепую не смягчает", () => {
    const a = actorWith([talent("Blind Fighting / Бой Вслепую")], { conditions: { blinded: true } });
    const total = resolveTest({ actor: a, ...awarenessCtx }).autoMods.reduce((s, m) => s + m.value, 0);
    expect(total).toBe(-30);
  });
  it("с альтернативными чувствами штрафа нет вовсе, поправка не добавляется", () => {
    const a = actorWith([talent("Blind Fighting / Бой Вслепую"), { id: "us", type: "trait", name: "Unnatural Senses (30)", system: {}, getFlag: () => undefined }],
      { conditions: { blinded: true } });
    expect(blindWs(a)).toBe(0);
  });
});

describe("Слепое Зрение: Unnatural Senses без шлема", () => {
  const BS = "Blindsight / Слепое Зрение";
  it("helmetWorn: броня с AP головы или нет", () => {
    expect(helmetWorn(actorWith())).toBe(false);
    expect(helmetWorn(actorWith([armor(4)]))).toBe(true);
    expect(helmetWorn(actorWith([armor(4, false)]))).toBe(false);
    expect(helmetWorn(actorWith([armor(0)]))).toBe(false);
  });
  it("снятый шлем силовой брони (helmetlessActive) — шлема нет", () => {
    expect(helmetWorn(actorWith([armor(4)], { system: { helmetlessActive: true } }))).toBe(false);
  });
  it("blindsightActive: Талант и нет шлема", () => {
    expect(blindsightActive(actorWith([talent(BS)]))).toBe(true);
    expect(blindsightActive(actorWith([talent(BS), armor(3)]))).toBe(false);
    expect(blindsightActive(actorWith())).toBe(false);
  });
  it("без шлема Ослеплённый не страдает от слепоты и не получает штрафов", () => {
    const a = actorWith([talent(BS)], { conditions: { blinded: true } });
    expect(hasAlternativeSenses(a)).toBe(true);
    expect(suffersBlindness(a)).toBe(false);
    const penalty = resolveTest({ actor: a, ...awarenessCtx }).autoMods.reduce((s, m) => s + m.value, 0);
    expect(penalty).toBe(0);
  });
  it("в шлеме Ослеплённый страдает как обычный", () => {
    const a = actorWith([talent(BS), armor(3)], { conditions: { blinded: true } });
    expect(suffersBlindness(a)).toBe(true);
    const penalty = resolveTest({ actor: a, ...awarenessCtx }).autoMods.reduce((s, m) => s + m.value, 0);
    expect(penalty).toBe(-30);
  });
});
