// test/rules/hatred.test.mjs
//
// Ненависть (wdbc-1rno, 12.09.2026): первый реальный потребитель целей
// Таланта. Проверяем и сам источник правил (hatred.mjs), и предикат
// hasHatredTarget (predicates.mjs), которым будущие находки (Crimson
// Angel/Багровый Ангел и подобные) смогут спрашивать «цель этого броска —
// Ненавистная?» без повторной сборки целей.

import { describe, it, expect } from "vitest";
import { hatredRules } from "../../module/rules/hatred.mjs";
import { PREDICATES, hatredTargetsOf } from "../../module/rules/predicates.mjs";
import { raceTarget, patronTarget, allTarget } from "../../module/rules/talent-targets.mjs";

const hatredTalent = (targets, name = "Hatred / Ненависть") => ({
  type: "talent", name, system: { targets }
});

const actorWith = (...items) => ({ items });

describe("hatredTargetsOf", () => {
  it("собирает targets только с Талантов Ненависти", () => {
    const targets = [raceTarget("ork", "Орк")];
    const actor = actorWith(
      hatredTalent(targets),
      { type: "talent", name: "Rancor / Злопамятность", system: { targets: [raceTarget("eldar", "Эльдар")] } }
    );
    expect(hatredTargetsOf(actor)).toEqual(targets);
  });

  it("сравнивает по любой половине двуязычного имени, не по подстроке", () => {
    // «Цифровая Ненависть» содержит слово «Ненависть», но это другой Талант.
    const actor = actorWith(
      { type: "talent", name: "Digital Hatred / Цифровая Ненависть", system: { targets: [raceTarget("ork")] } }
    );
    expect(hatredTargetsOf(actor)).toEqual([]);
  });

  it("суммирует цели НЕСКОЛЬКИХ экземпляров Ненависти (разная специализация)", () => {
    const t1 = raceTarget("ork", "Орк");
    const t2 = patronTarget("khorne", "Кхорн");
    const actor = actorWith(hatredTalent([t1]), hatredTalent([t2]));
    expect(hatredTargetsOf(actor)).toEqual([t1, t2]);
  });

  it("без Талантов Ненависти — пустой список", () => {
    expect(hatredTargetsOf(actorWith())).toEqual([]);
    expect(hatredTargetsOf(null)).toEqual([]);
  });
});

describe("PREDICATES.hasHatredTarget", () => {
  it("истинно, когда цель броска подходит под цель Ненависти", () => {
    const actor = actorWith(hatredTalent([raceTarget("ork", "Орк")]));
    const ctx = { targetActor: { system: { race: "ork" } } };
    expect(PREDICATES.hasHatredTarget(actor, ctx)).toBe(true);
  });

  it("ложно без совпадения или без цели броска", () => {
    const actor = actorWith(hatredTalent([raceTarget("ork", "Орк")]));
    expect(PREDICATES.hasHatredTarget(actor, { targetActor: { system: { race: "human" } } })).toBe(false);
    expect(PREDICATES.hasHatredTarget(actor, {})).toBe(false);
  });

  it("«Все!» подходит под любую цель", () => {
    const actor = actorWith(hatredTalent([allTarget()]));
    expect(PREDICATES.hasHatredTarget(actor, { targetActor: { system: {} } })).toBe(true);
  });
});

describe("hatredRules", () => {
  const orkTarget = raceTarget("ork", "Орк");
  const orkActor = actorWith(hatredTalent([orkTarget]));

  it("без Ненавистной цели брoска — правил нет", () => {
    expect(hatredRules(orkActor, { kind: "attack", isMelee: true, targetActor: { system: { race: "human" } } })).toEqual([]);
    expect(hatredRules(orkActor, {})).toEqual([]);
  });

  it("даёт +10 на рукопашную атаку по Ненавистной цели", () => {
    const rules = hatredRules(orkActor, { kind: "attack", isMelee: true, targetActor: { system: { race: "ork" } } });
    const melee = rules.find(r => r.id === "hatred.meleeBonus");
    expect(melee.effects).toEqual([{ kind: "rollBonus", target: "weapon:melee", value: 10 }]);
  });

  it("не даёт рукопашный бонус на встречный социальный тест (область не совпадает — отсекает effectAppliesTo)", () => {
    // Само правило безусловное (when:{}), но effects несут СВОЮ область —
    // rollModsFromRules её проверит отдельно. Здесь фиксируем только форму
    // записи, а не то, что она обязательно применится к нерелевантному тесту.
    const rules = hatredRules(orkActor, { kind: "attack", isMelee: false, targetActor: { system: { race: "ork" } } });
    expect(rules.find(r => r.id === "hatred.meleeBonus").effects[0].target).toBe("weapon:melee");
  });

  it("даёт переброс встречного социального теста против Ненавистной цели", () => {
    const rules = hatredRules(orkActor, { kind: "skill", skill: "charm", targetActor: { system: { race: "ork" } } });
    const social = rules.find(r => r.id === "hatred.socialReroll");
    expect(social.effects).toEqual([{ kind: "rollMode", target: "social", mode: "keepBest", rolls: 2, who: "self" }]);
  });

  // Подавление/Тест Страха теперь несут ctx.targetActor (rollMoraleTest
  // sourceActor / disorders.mjs targetActor, wdbc-1rno) — тот же путь, что и
  // прочие cross-actor правила.
  it("даёт переброс теста Морали (Подавление/Страх) против Ненавистной цели", () => {
    const rules = hatredRules(orkActor, { kind: "skill", char: "wp", morale: true, targetActor: { system: { race: "ork" } } });
    const morale = rules.find(r => r.id === "hatred.moraleReroll");
    expect(morale.effects).toEqual([{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2, who: "self" }]);
  });

  it("у актора без Ненависти — правил нет вовсе", () => {
    expect(hatredRules(actorWith(), { kind: "attack", isMelee: true, targetActor: { system: { race: "ork" } } })).toEqual([]);
  });
});
