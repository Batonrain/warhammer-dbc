// test/sheets/item-picker-dynamic-requirements.test.mjs
//
// Пикер Талантов с привязкой «как у Характеристики/Навыка» (стр. 62): За Гранью
// Человека — только девять книжных Характеристик и требование «Характеристика
// 70»; Мастерство — требование «Навык+30» по выбранному Навыку. Требование —
// вопрос, а не запрет (как нехватка опыта, стр. 23): варианты помечены и
// уходят вниз списка.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { GROUP_SKILLS_DEF } from "../../module/constants/skills.mjs";
import { dynamicTalentOptions, dynamicRequirementGap } from "../../module/sheets/item-picker.mjs";

const bhDoc = { name: "Beyond Human / За Гранью Человека", type: "talent", system: { tier: 3, aptitudes: ["general"] } };
const masteryDoc = { name: "Mastery / Мастерство", type: "talent", system: { tier: 3, aptitudes: ["general"] } };

const chars = totals => Object.fromEntries(Object.entries(totals).map(([k, total]) => [k, { total, base: total }]));
// Как у настоящего листа: у каждой группы Навыков есть список (пусть пустой) и у каждой Характеристики — значение.
const emptyGroups = () => Object.fromEntries(Object.keys(GROUP_SKILLS_DEF).map(g => [g, []]));
const ALL_CHARS = { ws: 30, bs: 30, s: 30, t: 30, ag: 30, int: 30, per: 30, wp: 30, fel: 30, inf: 30 };
const actor = (system = {}) => ({ system: { skills: {}, ...system, groupSkills: { ...emptyGroups(), ...(system.groupSkills ?? {}) },
  characteristics: chars({ ...ALL_CHARS, ...Object.fromEntries(Object.entries(system.characteristics ?? {}).map(([k, v]) => [k, v.total])) }) }, items: [] });

describe("За Гранью Человека в пикере", () => {
  const a = actor({ characteristics: chars({ s: 72, ws: 45, inf: 90 }) });
  const opts = dynamicTalentOptions(a, bhDoc, "char", new Set(["general"]));

  it("девять Характеристик книги, Влияния нет", () => {
    expect(opts.map(o => o.key).sort()).toEqual(["ag", "bs", "fel", "int", "per", "s", "t", "wp", "ws"]);
  });

  it("не хватает 70 — вариант помечен, хватает — чист", () => {
    expect(opts.find(o => o.key === "s").unmet).toBe("");
    expect(opts.find(o => o.key === "ws").unmet).toBe("WS 45 < 70");
  });

  it("подходящие варианты идут первыми", () => {
    const firstUnmet = opts.findIndex(o => o.unmet);
    const lastOk = opts.map(o => !o.unmet).lastIndexOf(true);
    expect(lastOk).toBeLessThan(firstUnmet);
    expect(opts[0].key).toBe("s");
  });

  it("ровно 70 проходит, 69 — нет", () => {
    expect(dynamicRequirementGap(actor({ characteristics: chars({ t: 70 }) }), bhDoc, "char", "t")).toBe("");
    expect(dynamicRequirementGap(actor({ characteristics: chars({ t: 69 }) }), bhDoc, "char", "t")).toBe("T 69 < 70");
  });
});

describe("Мастерство в пикере", () => {
  it("Навык +30 проходит, +20 и неизученный — нет", () => {
    const a = actor({ skills: { dodge: { rank: "expert" }, parry: { rank: "veteran" } } });
    expect(dynamicRequirementGap(a, masteryDoc, "skill", "dodge")).toBe("");
    expect(dynamicRequirementGap(a, masteryDoc, "skill", "parry")).toBe("Навык ниже +30");
    expect(dynamicRequirementGap(a, masteryDoc, "skill", "stealth")).toBe("Навык ниже +30");
  });

  it("специализация группового Навыка: только та, что продвинута", () => {
    const a = actor({ groupSkills: { forbiddenLore: [{ specialty: "Daemons", rank: "expert" }] } });
    expect(dynamicRequirementGap(a, masteryDoc, "skill", "forbiddenLore:daemons")).toBe("");
    expect(dynamicRequirementGap(a, masteryDoc, "skill", "forbiddenLore:heresy")).toBe("Навык ниже +30");
  });

  it("варианты с неготовым Навыком уходят вниз списка, цена не теряется", () => {
    const a = actor({ skills: { dodge: { rank: "expert" } } });
    const opts = dynamicTalentOptions(a, masteryDoc, "skill", new Set(["general"]));
    expect(opts[0].key).toBe("dodge");
    expect(opts.every(o => typeof o.cost === "number")).toBe(true);
  });

  it("Миньон Хаоса и прочие Таланты требований не получают", () => {
    const minion = { name: "Minion of Chaos / Миньон Хаоса", type: "talent", system: { tier: 1, aptitudes: ["social"] } };
    expect(dynamicRequirementGap(actor(), minion, "char", "ws")).toBe("");
  });
});
