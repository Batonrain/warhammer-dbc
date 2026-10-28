// test/rules/situational-social-talents.test.mjs
//
// Лицо в Толпе, Жалкие Слабаки, Идолопоклонник (−30): галочки в окне теста,
// условие решает стол (Sahara 3-5e84 / 3-scope, 24.10.2026).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  situationalSocialRules, SITUATIONAL_SOCIAL_RULE_IDS as IDS
} from "../../module/rules/situational-social-talents.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const talent = name => ({ id: `t-${name}`, type: "talent", name, system: {}, getFlag: () => undefined });

function actorWith(items = [], system = {}) {
  const sys = new ACTOR_DATA_MODELS.character({}).toObject();
  Object.assign(sys, system);
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return { type: "character", name: "Подставной", system: sys, items: list, getFlag: () => undefined };
}

const stealth = { kind: "skill", skill: "stealth", char: "ag" };
const ids = rules => rules.map(r => r.id);

describe("Лицо в Толпе: F вместо A на Скрытности", () => {
  const holder = actorWith([talent("Face in a Crowd / Лицо в Толпе")]);

  it("галочка только на тесте Скрытности и переключает «Бросок с:» на F", () => {
    const rules = situationalSocialRules(holder, stealth);
    expect(ids(rules)).toEqual([IDS.faceInACrowd]);
    expect(rules[0].effects[0]).toMatchObject({ askOnly: true, setChar: "fel", target: "skill:stealth" });
  });

  it("в конвейере тест доходит до окна как предлагаемая галочка (mods с setChar)", () => {
    const res = resolveTest({ actor: holder, ...stealth });
    const mod = res.mods.find(m => m.ruleId === IDS.faceInACrowd);
    expect(mod?.setChar).toBe("fel");
    expect(mod?.askOnly).toBe(true);
  });

  it("другой навык и актор без Таланта — ничего", () => {
    expect(situationalSocialRules(holder, { kind: "skill", skill: "awareness", char: "per" })).toEqual([]);
    expect(situationalSocialRules(actorWith(), stealth)).toEqual([]);
  });
});

describe("Жалкие Слабаки: +10 / −10 против слабых целей", () => {
  const holder = actorWith([talent("Pity the Weak / Жалкие Слабаки")]);

  it("+10 на Command, Commerce, Deceive, Intimidate", () => {
    for (const skill of ["command", "commerce", "deceive", "intimidate"]) {
      const rules = situationalSocialRules(holder, { kind: "skill", skill });
      expect(ids(rules), skill).toEqual([IDS.pityBonus]);
      expect(rules[0].effects[0], skill).toMatchObject({ value: 10, target: `skill:${skill}`, askOnly: true });
    }
  });

  it("−10 на Charm и Logic", () => {
    for (const skill of ["charm", "logic"]) {
      const rules = situationalSocialRules(holder, { kind: "skill", skill });
      expect(ids(rules), skill).toEqual([IDS.pityPenalty]);
      expect(rules[0].effects[0].value, skill).toBe(-10);
    }
  });

  it("прочие навыки не затронуты; без Таланта пусто", () => {
    expect(situationalSocialRules(holder, { kind: "skill", skill: "scrutiny" })).toEqual([]);
    expect(situationalSocialRules(actorWith(), { kind: "skill", skill: "command" })).toEqual([]);
  });

  it("галочка предложена, но сама не применяется (askOnly)", () => {
    const res = resolveTest({ actor: holder, kind: "skill", skill: "command", char: "fel" });
    const mod = res.mods.find(m => m.ruleId === IDS.pityBonus);
    expect(mod?.askOnly).toBe(true);
    expect(res.autoMods.some(m => m.ruleId === IDS.pityBonus)).toBe(false);
  });
});

describe("Идолопоклонник: −30 на встречные против кумира", () => {
  const withTalent = idolNearby => actorWith([talent("Idolater / Идолопоклонник")], { idolNearby });

  it("пока кумир рядом — галочка −30 на социальные тесты и W", () => {
    const rules = situationalSocialRules(withTalent(true), { kind: "skill", skill: "charm", char: "fel" });
    expect(ids(rules)).toEqual([IDS.idolater]);
    expect(rules[0].effects[0]).toMatchObject({ value: -30, askOnly: true });
    const res = resolveTest({ actor: withTalent(true), kind: "skill", skill: "command", char: "fel" });
    expect(res.mods.find(m => m.ruleId === IDS.idolater)?.value).toBe(-30);
    const wp = resolveTest({ actor: withTalent(true), kind: "char", char: "wp" });
    expect(wp.mods.find(m => m.ruleId === IDS.idolater)?.value).toBe(-30);
  });

  it("кумира нет рядом или нет Таланта — ничего", () => {
    expect(situationalSocialRules(withTalent(false), { kind: "skill", skill: "charm" })).toEqual([]);
    expect(situationalSocialRules(actorWith([], { idolNearby: true }), { kind: "skill", skill: "charm" })).toEqual([]);
  });

  it("на не-социальном тесте не на W (стрельба, Ловкость) галочка не нужна", () => {
    const res = resolveTest({ actor: withTalent(true), kind: "char", char: "ag" });
    expect(res.mods.some(m => m.ruleId === IDS.idolater)).toBe(false);
  });
});
