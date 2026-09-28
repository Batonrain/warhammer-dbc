// test/rules/beastman.test.mjs
//
// Зверолюд и его субрасы (корбук, глава I) — сверка 28.09.2026. Черты расы
// (Отвращение к Порядку, Копытный, Пасынки Богов), боевые формы субрас «за
// Очко Бесчестия до конца боя или сцены», доступ к Талантам субрас, замок
// Покровителя. Данные — из настоящих JSON packs-src.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { packDocById, packDocByFileHint } from "../support/pack-doc.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { resolveAptitudeOverride } from "../../module/rules/aptitude-overrides.mjs";
import { skillAdvanceCat } from "../../module/rules/advance-category.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";
import { GROUP_SKILLS_DEF } from "../../module/constants/skills.mjs";
import { charAptitudeSet } from "../../module/constants/advancement.mjs";
import { matchRule } from "../../module/rules/collect.mjs";
import { nextMutationThreshold } from "../../module/rules/character.mjs";
import { BATTLE_FORMS, activeBattleForms, naturalWeaponsAttacks, deadlyNaturalPatch,
         grantedByForm } from "../../module/rules/battle-forms.mjs";
import { rejectedImplants, bionicsRejection, isFormationTalent, actorCarriesCapability,
         ORDER_NO_BRIEFING } from "../../module/rules/aversion-to-order.mjs";
import { lockedPatron, enforcedPatron } from "../../module/rules/patron-lock.mjs";
import { presetIntegralChoice, partialRemoval } from "../../module/rules/integral-rating.mjs";
import { checkRequirement } from "../../module/constants/talent-requirements.mjs";
import { commandRulesFor } from "../../module/rules/command-effects.mjs";
import { creationCharSum } from "../../module/apps/creation.mjs";

const TRAITS = "packs-src/traits";
const SUB = "packs-src/races/Субрасы";
const aversion = packDocById(TRAITS, "6v1NUWCYIc2Oosi8");
const cloven   = packDocById(TRAITS, "NOaPE0AYhvLGTVPI");
const stepchildren = packDocById(TRAITS, "PeUg4uJnrciYPkK8");
const entriesOf = doc => doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const effectsOf = (items, actor) => rulesFromItemMechanics(items, () => true, actor).flatMap(r => r.effects);

const saved = getRuleSources();
afterEach(() => { clearRuleSources(); for (const [k, fn] of saved) registerRuleSource(k, fn); });

/** Актор, чьи правила — только Механика перечисленных предметов. */
function actorWith(items, system = {}) {
  const actor = { system: { aptitudes: [], skills: {}, characteristics: {}, ...system }, items };
  clearRuleSources();
  registerRuleSource("items", a => rulesFromItemMechanics(a.items, () => true, a));
  return actor;
}

describe("Отвращение к Порядку", () => {
  it("все группы Lore и Trade — Враждебные, сильнее «всегда Дружественных»", () => {
    const a = actorWith([aversion]);
    const apts = charAptitudeSet([]);
    for (const g of ["commonLore", "forbiddenLore", "scholasticLore", "trade"])
      expect(skillAdvanceCat(a, GROUP_SKILLS_DEF[g], { group: g, specialty: "x" }, apts), g).toBe("enemy");
    // Лингвистика — не Lore.
    expect(resolveAptitudeOverride(a, "skill", "Лингвистика", "linguistics")).toBeNull();
  });

  it("Символ Власти Шамана снимает враждебность Lore/Trade и штраф за импланты", () => {
    const symbol = { type: "trait", name: "Symbol of Power / Символ Власти", flags: {} };
    const a = actorWith([aversion, symbol]);
    expect(resolveAptitudeOverride(a, "skill", "Ремесло", "trade")).toBeNull();
    const flags = effectsOf([aversion, symbol], a).filter(e => e.kind === "grantFlag").map(e => e.target);
    expect(flags).not.toContain("order.rejectsBionics");
    expect(flags).toContain("order.noBriefing");
  });

  it("каждый установленный имплант, кроме плоти, — −5 T и −2 Раны", () => {
    const imp = (category, installed = true) => ({ type: "implant", system: { category },
      flags: { "warhammer-dbc": { installed } } });
    const items = [imp("bionic"), imp("cybernetic"), imp("astartes"), imp("bioimplant"), imp("mechanicus", false)];
    expect(rejectedImplants(items)).toHaveLength(2);
    expect(bionicsRejection(2)).toEqual({ count: 2, t: -10, wounds: -4 });
  });

  it("Combat Formation и Iron Discipline — узнаются по английской половине", () => {
    expect(isFormationTalent("Combat Formation / Боевое Построение")).toBe(true);
    expect(isFormationTalent("Iron Discipline / Железная Дисциплина")).toBe(true);
    expect(isFormationTalent("Combat Sense / Чувство Боя")).toBe(false);
  });

  it("Брифинг не доходит до Зверолюда, обычная Команда — доходит", () => {
    expect(actorCarriesCapability({ items: [aversion] }, ORDER_NO_BRIEFING)).toBe(true);
    const node = giver => ({ label: "Отряд", presence: {}, short: { active: true, key: "inspire", successes: 3, giverUuid: giver }, detail: {} });
    const beast = { type: "character", system: { characteristics: { per: { bonus: 4 } } }, items: [aversion] };
    const human = { type: "character", system: { characteristics: { per: { bonus: 4 } } }, items: [] };
    const ctx = { kind: "skill", skill: "dodge" };
    expect(commandRulesFor(beast, [node("briefing")], ctx)).toEqual([]);
    expect(commandRulesFor(human, [node("briefing")], ctx).length).toBe(1);
    expect(commandRulesFor(beast, [node("Actor.x")], ctx).length).toBe(1);
  });
});

describe("Копытный", () => {
  it("+20 только на тест Трудного Ландшафта", () => {
    const rules = rulesFromItemMechanics([cloven]);
    const terrain = rules.find(r => r.effects.some(e => e.kind === "rollBonus" && e.value === 20));
    expect(terrain.effects[0].target).toBe("terrain");
  });

  it("шесть Талантов книги — Дружественные", () => {
    const a = actorWith([cloven]);
    for (const n of ["Leap Up / Вскочить", "Jumper / Прыгун", "Preternatural Speed / Запредельная Скорость",
                     "Sprint / Спринт", "Tireless / Неутомимый", "Steady Footwork / Надёжная Стойка"])
      expect(resolveAptitudeOverride(a, "talent", n), n).toBe("ally");
    expect(resolveAptitudeOverride(a, "talent", "Dodge Master")).toBeNull();
  });
});

describe("Пасынки Богов", () => {
  it("максимум Бесчестия −1, мутации как у Астартес, один кубик", () => {
    const es = entriesOf(stepchildren);
    const pool = es.find(e => e.kind === "poolMax");
    expect([pool.poolTarget, pool.value]).toEqual(["infamy", "-1"]);
    const keys = es.filter(e => e.kind === "capability").map(e => e.capabilityKey);
    expect(keys).toEqual(expect.arrayContaining(["mutation.asAstartes", "mutation.singleDie"]));
  });

  it("порог мутаций по таблице Астартес, если Черта даёт возможность", () => {
    const sys = { race: "beastman", corruption: { value: 20 } };
    expect(nextMutationThreshold(sys)).toBe(40);
    expect(nextMutationThreshold(sys, { asAstartes: true })).toBe(30);
  });
});

describe("естественное оружие: выбор книги и частичное снятие", () => {
  const nw = packDocById(TRAITS, "SvLCLe1hbxSaWy3s");
  const groups = nw.flags["warhammer-dbc"].mechanics;
  it("Natural Weapons (Рога, Укус, Когти, Копыта) — четыре атаки без окна", () => {
    const race = packDocByFileHint("packs-src/races/Люди/Beastman___Зверолюд_aCWwJQUQSDbx1uEo.json");
    const entry = entriesOf(race).find(e => e.sourceName?.startsWith("Natural Weapons"));
    const ids = presetIntegralChoice(groups, entry.integralPreset);
    expect(ids).toHaveLength(4);
  });
  it("«Natural Weapons (Рога, Когти)» разбирается на имя и части", () => {
    expect(partialRemoval("Natural Weapons (Рога, Когти)")).toEqual({ name: "Natural Weapons", parts: ["Рога", "Когти"] });
    expect(partialRemoval("Aversion to Order")).toEqual({ name: "Aversion to Order", parts: [] });
  });
});

const GRANT_DIR = { traits: "packs-src/traits", weapons: "packs-src/weapons/Интегральные_атаки" };

describe("боевые формы субрас", () => {
  it("три формы, Клешня возвращается вручную, остальные — концом боя/сцены", () => {
    expect(Object.keys(BATTLE_FORMS).sort()).toEqual(["khorngor.bloodFury", "pestigor.plagueFlesh", "slaangor.pincerClaw"]);
    expect(BATTLE_FORMS["slaangor.pincerClaw"].manualEnd).toBe(true);
    expect(BATTLE_FORMS["khorngor.bloodFury"].activateAp).toBe(0);   // свободное действие
    expect(BATTLE_FORMS["pestigor.plagueFlesh"].activateAp).toBe(2);  // полное действие
  });

  it("всё, что выдаёт форма, есть в паке", () => {
    for (const def of Object.values(BATTLE_FORMS))
      for (const g of def.grant) expect(packDocById(GRANT_DIR[g.pack], g.id), g.id).toBeTruthy();
  });

  it("Клешня — профиль книги", () => {
    const claw = packDocById("packs-src/weapons/Интегральные_атаки", "uwzgmx72z7uZCbOu");
    expect([claw.system.damage, claw.system.penetration, claw.system.range]).toEqual(["1d10+2", 3, 4]);
    expect(claw.system.weaponProps.map(p => p.key).sort()).toEqual(["extreme", "razorSharp", "reinforced", "tearing"]);
  });

  it("Deadly: без Primitive, Reinforced, Pen = рейтинг; откат хранит прежнее", () => {
    const plan = deadlyNaturalPatch({ weaponProps: [{ key: "primitive" }], penetration: 0 }, 1);
    expect(plan.patch["system.weaponProps"]).toEqual([{ key: "reinforced" }]);
    expect(plan.patch["system.penetration"]).toBe(1);
    expect(plan.revert).toEqual({ weaponProps: [{ key: "primitive" }], penetration: 0 });
    expect(deadlyNaturalPatch({ weaponProps: [{ key: "reinforced" }], penetration: 2 }, 1)).toBeNull();
  });

  it("находит оружие именно Natural Weapons, а не Deadly", () => {
    const nw = { id: "t1", type: "trait", name: "Natural Weapons / Естественное Оружие", system: { rating: 1 } };
    const dnw = { id: "t2", type: "trait", name: "Deadly Natural Weapons / Смертельное Естественное Оружие" };
    const w = (id, src) => ({ id, type: "weapon", flags: { "warhammer-dbc": { grantedByItem: src } } });
    const found = naturalWeaponsAttacks([nw, dnw, w("a", "t1"), w("b", "t2")]).map(x => x.weapon.id);
    expect(found).toEqual(["a"]);
  });

  it("действующие формы и выданное ими читаются по меткам предметов", () => {
    const items = [{ flags: { "warhammer-dbc": { battleForm: { form: "pestigor.plagueFlesh" } } } },
                   { flags: { "warhammer-dbc": { battleFormRevert: { form: "khorngor.bloodFury" } } } }, { flags: {} }];
    expect([...activeBattleForms(items)].sort()).toEqual(["khorngor.bloodFury", "pestigor.plagueFlesh"]);
    expect(grantedByForm(items, "pestigor.plagueFlesh")).toHaveLength(1);
  });
});

describe("субрасы в паке", () => {
  const docs = {
    slaangor: packDocById(SUB, "57Q9H6rZACbBl8rV"), pestigor: packDocById(SUB, "26yhbXP9Vi4ZgNWA"),
    khorngor: packDocById(SUB, "DBpnsL5iimkOSDB1"), tzaangor: packDocById(SUB, "U8W1CR6cJt5Muara")
  };
  const traitNames = doc => entriesOf(doc).filter(e => e.kind === "trait").map(e => e.sourceName);
  const caps = doc => entriesOf(doc).filter(e => e.kind === "capability").map(e => e.capabilityKey);
  const scripts = doc => entriesOf(doc).filter(e => e.kind === "script");

  it("постоянно — только книжные Черты; Deadly/Sturdy/Кошмары — формы", () => {
    expect(traitNames(docs.slaangor)).toEqual(["Digitigrade / Двусоставный (X)"]);
    expect(traitNames(docs.pestigor)).toEqual(["Toxic / Токсичный (X)"]);
    expect(traitNames(docs.khorngor)).toEqual(["Brutal Charge / Брутальный Натиск (X)"]);
    expect(traitNames(docs.tzaangor)).toEqual([]);
  });

  it("формы — кнопки с ценой 1 Очко Бесчестия", () => {
    for (const k of ["slaangor", "pestigor", "khorngor"]) {
      const paid = scripts(docs[k]).filter(e => e.capabilityCostPool === "infamy");
      expect(paid, k).toHaveLength(1);
      expect(paid[0].code).toMatch(/activateBattleForm\(actor, "/);
    }
  });

  it("покровительство закреплено и папка Талантов открыта", () => {
    const god = { slaangor: "slaanesh", pestigor: "nurgle", khorngor: "khorne", tzaangor: "tzeentch" };
    for (const [k, doc] of Object.entries(docs)) {
      expect(caps(doc)).toEqual(expect.arrayContaining([`patron.locked.${god[k]}`, "talents.beastmanSubrace"]));
    }
  });

  it("Тзаангор снимает только Рога и Когти; Слаангор заменяет Digitigrade", () => {
    expect(docs.tzaangor.system.removesTraits).toEqual(["Natural Weapons (Рога, Когти)", "Aversion to Order", "Stepchildren of the Gods"]);
    expect(docs.slaangor.system.removesTraits).toEqual(["Digitigrade"]);
  });

  it("сдвиги характеристик субрасы не входят в базу Мастера (их даёт Механика)", () => {
    const race = { chars: { ag: 25 } };
    expect(creationCharSum({ race, sub: { charMods: { ag: 5 } } }).ag).toBe(25);
  });
});

describe("Таланты субрас — доступ, а не выдача", () => {
  const T = "packs-src/talents/Субрасы_Зверолюдов";
  const tal = {
    slaangor: packDocById(T, "ukQwozQtX8h2I29T"), pestigor: packDocById(T, "ZNsLdMnjBC5DSMcT"),
    khorngor: packDocById(T, "mBwAymB0yjsFgRtu"), tzaangor: packDocById(T, "kuzlAt8ukoGBl90g")
  };
  it("Уровень 3, Бог и Требование «Субраса …»", () => {
    const god = { slaangor: "Слаанеш", pestigor: "Нургл", khorngor: "Кхорн", tzaangor: "Тзинч" };
    for (const [k, d] of Object.entries(tal)) {
      expect(d.type).toBe("talent");
      expect(d.system.tier).toBe(3);
      expect(d.system.god).toBe(god[k]);
      expect(d.system.requirement).toMatch(/^Субраса /);
    }
  });

  it("Требование «Субраса Слаангор» проверяется по субрасе персонажа", () => {
    const actor = sub => ({ system: { subrace: sub, characteristics: { inf: { total: 40 } }, corruption: { value: 40 } },
      items: [{ type: "subrace", name: sub === "slaangor" ? "Slaangor / Слаангор" : "Pestigor / Пестигор" }] });
    expect(checkRequirement(actor("slaangor"), "Субраса Слаангор, Cor 30, Inf 30").state).toBe("ok");
    expect(checkRequirement(actor("pestigor"), "Субраса Слаангор, Cor 30, Inf 30").state).toBe("fail");
  });
});

describe("замок Покровителя", () => {
  it("смена на другого Бога возвращается к закреплённому", () => {
    const locked = lockedPatron(new Set(["patron.locked.nurgle"]));
    expect(locked).toBe("nurgle");
    expect(enforcedPatron("khorne", locked)).toBe("nurgle");
    expect(enforcedPatron("nurgle", locked)).toBe("nurgle");
    expect(enforcedPatron("khorne", "")).toBe("khorne");
  });

  it("lacksTrait — условие, по которому Символ Власти снимает часть Отвращения", () => {
    const rule = { id: "x", when: { lacksTrait: "Symbol of Power" }, effects: [] };
    expect(matchRule(rule, { system: {}, items: [] }, {})).toBe(true);
    expect(matchRule(rule, { system: {}, items: [{ type: "trait", name: "Symbol of Power / Символ Власти" }] }, {})).toBe(false);
  });
});
