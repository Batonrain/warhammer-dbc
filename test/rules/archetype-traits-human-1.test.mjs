// test/rules/archetype-traits-human-1.test.mjs
//
// Черты Архетипов Людей (корбук, глава I), сверка 28.09.2026:
//   Serpent's Tongue / Змеиный Язык (Отступник), Dark Seer / Ведун Тьмы
//   (Демонолог), Adroit / Искусный (Ренегат), Take Everything / Забирай Всё
//   (Пират). Чистая логика — без Foundry, на литералах.

import { describe, it, expect } from "vitest";
import { infamyFailSuccessOptions, infamyBoostNotes } from "../../module/rules/infamy-fail-success.mjs";
import { talentRequirements, minionInfamyWaiverFlag } from "../../module/rules/minion-build.mjs";
import { darkSeerPaths, darkSeerAdvantage, darkSeerSwapChar } from "../../module/rules/dark-seer.mjs";
import { adroitDegreeBonus, adroitChar, ADROIT_CHOICES } from "../../module/rules/adroit.mjs";
import { isAdroitTrait } from "../../module/apps/adroit.mjs";
import { rigManagerData } from "../../module/constants/rig.mjs";

const flags = (...names) => f => names.includes(f);

describe("Змеиный Язык: провал → Очко Бесчестия → Успех (1)", () => {
  const has = flags("trait.serpentSTongue");

  it("проваленный тест социального Навыка — кнопка есть", () => {
    for (const skill of ["charm", "command", "interrogate", "deceive", "intimidate", "inquiry", "commerce"])
      expect(infamyFailSuccessOptions(has, { skill, char: "fel", success: false })).toHaveLength(1);
  });

  it("голый тест F — тоже социальное взаимодействие", () => {
    expect(infamyFailSuccessOptions(has, { char: "fel", success: false })).toHaveLength(1);
  });

  it("успех, не-социальный Навык, чужая Характеристика — кнопки нет", () => {
    expect(infamyFailSuccessOptions(has, { skill: "charm", char: "fel", success: true })).toEqual([]);
    expect(infamyFailSuccessOptions(has, { skill: "awareness", char: "per", success: false })).toEqual([]);
    expect(infamyFailSuccessOptions(has, { skill: "scrutiny", char: "per", success: false })).toEqual([]);
    expect(infamyFailSuccessOptions(has, { char: "wp", success: false })).toEqual([]);
  });

  it("без Черты — кнопки нет", () => {
    expect(infamyFailSuccessOptions(flags(), { skill: "charm", char: "fel", success: false })).toEqual([]);
  });

  it("трата на Усиление напоминает про +1 Успех — только с Чертой", () => {
    expect(infamyBoostNotes(has)).toHaveLength(1);
    expect(infamyBoostNotes(flags())).toEqual([]);
  });
});

describe("Миньоны: требование по Inf снимается Чертой своей группы", () => {
  const master = { system: { characteristics: { fel: { total: 50 }, wp: { total: 55 }, inf: { total: 10 } } } };

  it("без снятия — Бесчестия не хватает", () => {
    expect(talentRequirements(master, "human", "standard").missing.join()).toMatch(/Бесчестие/);
  });

  it("со снятием — требование Бесчестия не проверяется, остальные остаются", () => {
    const req = talentRequirements(master, "human", "standard", { ignoreInfamy: true });
    expect(req.ok).toBe(true);
    const low = { system: { characteristics: { wp: { total: 20 }, inf: { total: 0 } } } };
    const r2 = talentRequirements(low, "daemon", "greater", { ignoreInfamy: true });
    expect(r2.missing).toHaveLength(1);
    expect(r2.missing[0]).toMatch(/WP 20/);
  });

  it("имя возможности — по группе", () => {
    expect(minionInfamyWaiverFlag("human")).toBe("minion.ignoreInfamy.human");
    expect(minionInfamyWaiverFlag("daemon")).toBe("minion.ignoreInfamy.daemon");
  });
});

describe("Ведун Тьмы: I↔W в ритуалах, Преимущество на «правильной»", () => {
  const paths = [
    { key: "default", label: "Forbidden Lore (Daemons) · I −10", testChar: "int", skillValue: "x", gmMod: -10 },
    { key: "alt:0", label: "Awareness · P +0", testChar: "per", skillValue: "y", gmMod: 0 }
  ];

  it("без Черты пути не меняются", () => {
    expect(darkSeerPaths(paths, false)).toBe(paths);
  });

  it("путь на I получает двойника на W, путь на P — нет", () => {
    const out = darkSeerPaths(paths, true);
    expect(out).toHaveLength(3);
    expect(out[1]).toMatchObject({ key: "default:darkSeer", testChar: "wp", darkSeerSwap: true, gmMod: -10 });
    expect(out[2].key).toBe("alt:0");
    expect(darkSeerSwapChar("wp")).toBe("int");
    expect(darkSeerSwapChar("per")).toBeNull();
  });

  it("Преимущество — на исходной I/W, не на подменённой и не без Черты", () => {
    expect(darkSeerAdvantage(true, { testChar: "int" })).toBe(true);
    expect(darkSeerAdvantage(true, { testChar: "wp" })).toBe(true);
    expect(darkSeerAdvantage(true, { testChar: "wp", darkSeerSwap: true })).toBe(false);
    expect(darkSeerAdvantage(true, { testChar: "per" })).toBe(false);
    expect(darkSeerAdvantage(false, { testChar: "int" })).toBe(false);
  });
});

describe("Искусный: +1 Успех к успешным тестам выбранной Характеристики", () => {
  const adroitMech = [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: "trait.adroit" }] }];
  const trait = (pick) => ({ type: "trait", name: "Adroit / Искусный",
    flags: { "warhammer-dbc": { mechanics: adroitMech, ...(pick ? { adroitChar: pick } : {}) } } });
  const actor = items => ({ items });

  it("выбор — все Характеристики, кроме Inf", () => {
    expect(ADROIT_CHOICES).not.toContain("inf");
    expect(ADROIT_CHOICES).toEqual(expect.arrayContaining(["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"]));
  });

  it("успех на выбранной — +1, провал или другая Характеристика — 0", () => {
    const a = actor([trait("bs")]);
    expect(adroitChar(a)).toBe("bs");
    expect(adroitDegreeBonus(a, "bs", true)).toBe(1);
    expect(adroitDegreeBonus(a, "bs", false)).toBe(0);
    expect(adroitDegreeBonus(a, "ws", true)).toBe(0);
  });

  it("Черта без сделанного выбора и актор без Черты — бонуса нет", () => {
    expect(adroitDegreeBonus(actor([trait("")]), "bs", true)).toBe(0);
    expect(adroitDegreeBonus(actor([]), "bs", true)).toBe(0);
  });

  it("Черту для диалога выбора узнаём по записи Конструктора, не по имени", () => {
    expect(isAdroitTrait(trait(""))).toBe(true);
    expect(isAdroitTrait({ type: "trait", name: "Adroit / Искусный", flags: {} })).toBe(false);
    expect(isAdroitTrait({ type: "talent", flags: { "warhammer-dbc": { mechanics: adroitMech } } })).toBe(false);
  });
});

describe("Забирай Всё: окно Разгрузки считает всё на удобной разгрузке", () => {
  const rig = {
    id: "rig1", name: "Bandolier", type: "gear",
    system: { isRig: true, weight: 1, rig: { comfort: "awkward", backSlot: false, slots: [{ size: "1x1", count: 1 }], magLocks: [] } },
    flags: {}
  };
  const mk = () => {
    const list = [rig];
    list.get = id => list.find(i => i.id === id) ?? null;
    return { name: "Пират", items: list, getFlag: () => ({}) };
  };

  it("без Черты неудобная разгрузка не даёт Quick Draw", () => {
    const d = rigManagerData(mk());
    expect(d.rigs[0].canQuickDraw).toBe(false);
    expect(d.takeEverything).toBe(false);
  });

  it("с Чертой неудобство снято и пояснение включено", () => {
    const d = rigManagerData(mk(), { takeEverything: true });
    expect(d.rigs[0].canQuickDraw).toBe(true);
    expect(d.rigs[0].comfortHint).toBe("");
    expect(d.takeEverything).toBe(true);
  });
});
