// test/rules/leadership-talents.test.mjs
//
// Таланты Лидерства (глава 3, Sahara 3-ac78, повторная разведка 19.10.2026):
// подсистема Команд/Слаженности полностью реализована, каждый Талант здесь —
// расширение готовой инфраструктуры, не новая механика.
//
// Rancor / Злопамятность: +10 на Команду и +1 к максимуму Успехов от Риска
// против цели Ненависти. Прямое расширение rules/hatred.mjs на тест
// Командования.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import {
  hasRancor, rancorRiskCapBonus, leadershipTalentRules,
  hasBravado, bravadoRiskLevel,
  hasCamaraderie, camaraderieStartCohesion, CAMARADERIE_MIN_COHESION,
  hasDutyAboveAll, dutyAboveAllBlocks, CONFLICT_COHESION_LABEL,
  hasEloquence, linguisticsBestRank, eloquenceCommandBonus, eloquenceRiskCapBonus,
  hasIronDiscipline, commandersOf,
  hasFrontlineCommander, frontlineCommanderDistanceOk, frontlineCommanderMeleeFree,
  hasProtege, protegeFavoriteUuid, protegeFreeCommandActive, protegePenalty, protegeActivationPatch,
  hasRadiantPresence, anyRadiantPresenceHolderExists, radiantPresenceBonus,
  hasIntoTheJawsOfHell, anyIntoTheJawsOfHellHolderExists, intoTheJawsOfHellActive,
  hasAirOfAuthority, commandTargetLimit,
  hasLivingLegend, livingLegendCommandBonus,
  hasWarChant, warChantSinging, WAR_CHANT_FLAG,
  warChantSingAlongActive, WAR_CHANT_SING_ALONG_FLAG, warChantIntimidateBonus, warChantSingAlongBonus,
  hasRally, rallyAvailable,
  hasBringItDown, bringItDownAccuracyPenalty, bringItDownMaxStacks, bringItDownStacksFor,
  BRING_IT_DOWN_PENALTY_PER_STACK,
  hasFieldExecution, fieldExecutionEligible,
  hasBackToBack, backToBackGrantCap
} from "../../module/rules/leadership-talents.mjs";
import { raceTarget } from "../../module/rules/talent-targets.mjs";

const hatredTalent = (targets, name = "Hatred / Ненависть") => ({ type: "talent", name, system: { targets } });
const rancorTalent = (name = "Rancor / Злопамятность") => ({ type: "talent", name, system: {} });
const talentOf = (name) => ({ type: "talent", name, system: {} });
const actorWith = (...items) => ({ items });

const orkTarget = raceTarget("ork", "Орк");
const orkActor = { system: { race: "ork" } };
const eldarActor = { system: { race: "eldar" } };

describe("hasRancor", () => {
  it("по любой половине двуязычного имени", () => {
    expect(hasRancor(actorWith(rancorTalent()))).toBe(true);
    expect(hasRancor(actorWith(rancorTalent("Rancor")))).toBe(true);
    expect(hasRancor(actorWith(rancorTalent("Злопамятность")))).toBe(true);
  });
  it("без Таланта — false", () => {
    expect(hasRancor(actorWith())).toBe(false);
    expect(hasRancor(actorWith(hatredTalent([orkTarget])))).toBe(false);
  });
});

describe("leadershipTalentRules (источник \"leadershipTalents\")", () => {
  it("пусто без Rancor, даже если цель Ненависти совпала", () => {
    const actor = actorWith(hatredTalent([orkTarget]));
    expect(leadershipTalentRules(actor, { targetActor: orkActor })).toEqual([]);
  });

  it("пусто с Rancor, но без целей Ненависти (нет Hatred)", () => {
    const actor = actorWith(rancorTalent());
    expect(leadershipTalentRules(actor, { targetActor: orkActor })).toEqual([]);
  });

  it("пусто с Rancor и Hatred, но цель броска не совпала", () => {
    const actor = actorWith(hatredTalent([orkTarget]), rancorTalent());
    expect(leadershipTalentRules(actor, { targetActor: eldarActor })).toEqual([]);
  });

  it("пусто без выделенной цели (targetActor не задан)", () => {
    const actor = actorWith(hatredTalent([orkTarget]), rancorTalent());
    expect(leadershipTalentRules(actor, {})).toEqual([]);
  });

  it("+10 на skill:command, когда цель Команды совпала с целью Ненависти", () => {
    const actor = actorWith(hatredTalent([orkTarget]), rancorTalent());
    const rules = leadershipTalentRules(actor, { kind: "skill", skill: "command", targetActor: orkActor });
    expect(rules).toHaveLength(1);
    expect(rules[0].effects).toEqual([
      { kind: "rollBonus", target: "skill:command", value: 10, label: "Злопамятность" }
    ]);
  });
});

describe("rancorRiskCapBonus", () => {
  it("0 без Rancor", () => {
    const actor = actorWith(hatredTalent([orkTarget]));
    expect(rancorRiskCapBonus(actor, { targetActor: orkActor })).toBe(0);
  });
  it("0 с Rancor, но цель не совпала или не выделена", () => {
    const actor = actorWith(hatredTalent([orkTarget]), rancorTalent());
    expect(rancorRiskCapBonus(actor, { targetActor: eldarActor })).toBe(0);
    expect(rancorRiskCapBonus(actor, {})).toBe(0);
  });
  it("1 с Rancor и совпавшей целью Ненависти", () => {
    const actor = actorWith(hatredTalent([orkTarget]), rancorTalent());
    expect(rancorRiskCapBonus(actor, { targetActor: orkActor })).toBe(1);
  });
});

describe("Bravado/Бравада: воспринимаемый уровень Риска +1, если он не 1", () => {
  it("hasBravado — по любой половине имени", () => {
    expect(hasBravado(actorWith(talentOf("Bravado / Бравада")))).toBe(true);
    expect(hasBravado(actorWith(talentOf("Бравада")))).toBe(true);
    expect(hasBravado(actorWith())).toBe(false);
  });
  it("без Таланта — уровень не меняется", () => {
    expect(bravadoRiskLevel(3, actorWith())).toBe(3);
  });
  it("с Талантом — +1, зажато в 5", () => {
    const actor = actorWith(talentOf("Bravado"));
    expect(bravadoRiskLevel(3, actor)).toBe(4);
    expect(bravadoRiskLevel(5, actor)).toBe(5);
  });
  it("Риск 1 — исключение, не поднимается", () => {
    expect(bravadoRiskLevel(1, actorWith(talentOf("Bravado")))).toBe(1);
  });
});

describe("Camaraderie/Дружество: Слаженность в начале миссии не ниже +20", () => {
  it("без Таланта у Лидера — базовая как есть", () => {
    expect(camaraderieStartCohesion(-10, actorWith())).toBe(-10);
    expect(camaraderieStartCohesion(25, actorWith())).toBe(25);
  });
  it("с Талантом — поднимает ниже +20, не трогает выше", () => {
    const leader = actorWith(talentOf("Camaraderie / Дружество"));
    expect(camaraderieStartCohesion(-10, leader)).toBe(CAMARADERIE_MIN_COHESION);
    expect(camaraderieStartCohesion(0, leader)).toBe(CAMARADERIE_MIN_COHESION);
    expect(camaraderieStartCohesion(25, leader)).toBe(25);
  });
  it("без актора Лидера (пост не занят) — не ломается", () => {
    expect(camaraderieStartCohesion(-10, null)).toBe(-10);
  });
});

describe("Duty Above All/Долг Превыше Всего: блокирует только пресет «Конфликт»", () => {
  const leader = actorWith(talentOf("Duty Above All / Долг Превыше Всего"));
  it("блокирует −5 «Конфликт между членами отряда» у Лидера с Талантом", () => {
    expect(dutyAboveAllBlocks(-5, CONFLICT_COHESION_LABEL, leader)).toBe(true);
  });
  it("не блокирует без Таланта", () => {
    expect(dutyAboveAllBlocks(-5, CONFLICT_COHESION_LABEL, actorWith())).toBe(false);
  });
  it("не блокирует другие пресеты или произвольный шаг кнопками", () => {
    expect(dutyAboveAllBlocks(-5, "Боевые потери", leader)).toBe(false);
    expect(dutyAboveAllBlocks(-5, "", leader)).toBe(false);
  });
  it("не блокирует положительный шаг (не применимо к росту)", () => {
    expect(dutyAboveAllBlocks(5, CONFLICT_COHESION_LABEL, leader)).toBe(false);
  });
});

describe("Eloquence/Красноречие: +5 за шаг Linguistics, +1 к риск-потолку на +30", () => {
  const groupSkills = rank => ({ system: { groupSkills: { linguistics: [{ specKey: "low-gothic", rank }] } } });
  const eloquent = rank => ({
    items: [talentOf("Eloquence / Красноречие")],
    system: { groupSkills: { linguistics: [{ specKey: "low-gothic", rank }] } }
  });

  it("hasEloquence — по любой половине имени", () => {
    expect(hasEloquence({ items: [talentOf("Eloquence")] })).toBe(true);
    expect(hasEloquence({ items: [talentOf("Красноречие")] })).toBe(true);
    expect(hasEloquence({ items: [] })).toBe(false);
  });
  it("linguisticsBestRank — максимум среди специализаций, 0 без них", () => {
    expect(linguisticsBestRank(groupSkills("trained"))).toBe(10);
    expect(linguisticsBestRank({ system: {} })).toBe(0);
  });
  it("без Таланта — бонусов нет даже с высоким рангом", () => {
    expect(eloquenceCommandBonus(groupSkills("expert"))).toBe(0);
    expect(eloquenceRiskCapBonus(groupSkills("expert"))).toBe(0);
  });
  it("ниже +10 (knows/untrained) — бонуса на Команду нет", () => {
    expect(eloquenceCommandBonus(eloquent("knows"))).toBe(0);
    expect(eloquenceCommandBonus(eloquent("untrained"))).toBe(0);
  });
  it("+10/+20/+30 — по +5 за шаг", () => {
    expect(eloquenceCommandBonus(eloquent("trained"))).toBe(5);
    expect(eloquenceCommandBonus(eloquent("veteran"))).toBe(10);
    expect(eloquenceCommandBonus(eloquent("expert"))).toBe(15);
  });
  it("риск-потолок +1 только на +30 (expert)", () => {
    expect(eloquenceRiskCapBonus(eloquent("veteran"))).toBe(0);
    expect(eloquenceRiskCapBonus(eloquent("expert"))).toBe(1);
  });
  it("leadershipTalentRules отдаёт rollBonus на skill:command", () => {
    const rules = leadershipTalentRules(eloquent("veteran"), {});
    expect(rules).toEqual([
      { id: "eloquence.command", label: "Красноречие: +10 на Команду", when: {},
        effects: [{ kind: "rollBonus", target: "skill:command", value: 10, label: "Красноречие" }] }
    ]);
  });
});

describe("Iron Discipline/Железная Дисциплина: переброс Морали подчинённым", () => {
  const squad = (uuid, posts, members = []) => ({ type: "squad", uuid, system: { posts, members } });
  const actor = (uuid, items = []) => ({ uuid, items });

  it("hasIronDiscipline — по любой половине имени", () => {
    expect(hasIronDiscipline(actor("a1", [talentOf("Iron Discipline")]))).toBe(true);
    expect(hasIronDiscipline(actor("a1", [talentOf("Железная Дисциплина")]))).toBe(true);
  });

  it("commandersOf — эффективный командующий (Командир??Лидер) и Координатор, кроме самого actor", () => {
    const sub  = actor("sub");
    const cmdr = actor("cmdr");
    const coord = actor("coord");
    const sq = squad("sq1", { commander: { uuid: "cmdr" }, coordinator: { uuid: "coord" } }, [{ uuid: "sub" }]);
    const all = [sub, cmdr, coord, sq];
    expect(commandersOf(sub, all).map(a => a.uuid).sort()).toEqual(["cmdr", "coord"]);
  });

  it("commandersOf — без Командира падает на Лидера", () => {
    const sub = actor("sub");
    const leader = actor("leader");
    const sq = squad("sq1", { leader: { uuid: "leader" } }, [{ uuid: "sub" }]);
    expect(commandersOf(sub, [sub, leader, sq]).map(a => a.uuid)).toEqual(["leader"]);
  });

  it("пусто, если ни один командующий не состоит в Отряде actor", () => {
    expect(commandersOf(actor("lone"), [actor("lone")])).toEqual([]);
  });

  it("leadershipTalentRules даёт переброс Морали, если командующий имеет Талант", () => {
    const sub = actor("sub");
    const cmdr = actor("cmdr", [talentOf("Iron Discipline")]);
    const sq = squad("sq1", { commander: { uuid: "cmdr" } }, [{ uuid: "sub" }]);
    const rules = leadershipTalentRules(sub, {}, [sub, cmdr, sq]);
    expect(rules).toEqual([
      { id: "ironDiscipline.moraleReroll", label: "Железная Дисциплина", when: {},
        effects: [{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2, label: "Железная Дисциплина" }] }
    ]);
  });

  it("молчит, если единственный командующий с Талантом — источник этого теста (ctx.targetActor)", () => {
    const sub = actor("sub");
    const cmdr = actor("cmdr", [talentOf("Iron Discipline")]);
    const sq = squad("sq1", { commander: { uuid: "cmdr" } }, [{ uuid: "sub" }]);
    const rules = leadershipTalentRules(sub, { targetActor: cmdr }, [sub, cmdr, sq]);
    expect(rules).toEqual([]);
  });

  it("молчит без командующего с Талантом", () => {
    const sub = actor("sub");
    const cmdr = actor("cmdr");
    const sq = squad("sq1", { commander: { uuid: "cmdr" } }, [{ uuid: "sub" }]);
    expect(leadershipTalentRules(sub, {}, [sub, cmdr, sq])).toEqual([]);
  });

  it("работает и без allActors (вне игры) — просто пусто, не падает", () => {
    expect(leadershipTalentRules(actor("sub"), {})).toEqual([]);
  });
});

describe("Frontline Commander/Фронтовой Командир: дистанция до ближайшего врага", () => {
  it("frontlineCommanderDistanceOk — не дальше, чем ЛЮБОЙ подчинённый", () => {
    expect(frontlineCommanderDistanceOk(5, [5, 10])).toBe(true);
    expect(frontlineCommanderDistanceOk(5, [4, 10])).toBe(false);
    expect(frontlineCommanderDistanceOk(null, [5])).toBe(false);
    expect(frontlineCommanderDistanceOk(5, [])).toBe(false);
    expect(frontlineCommanderDistanceOk(5, [null])).toBe(false);
  });

  it("hasFrontlineCommander — по любой половине имени", () => {
    expect(hasFrontlineCommander({ items: [talentOf("Frontline Commander")] })).toBe(true);
    expect(hasFrontlineCommander({ items: [talentOf("Фронтовой Командир")] })).toBe(true);
    expect(hasFrontlineCommander({ items: [] })).toBe(false);
  });

  describe("frontlineCommanderMeleeFree — геометрия сцены", () => {
    const token = (x, y, disposition = 1) => {
      const t = { document: { x, y, width: 1, height: 1, rotation: 0, disposition } };
      t.actor = { uuid: `actor-${x}-${y}-${disposition}` };
      return t;
    };
    const withToken = (t, items = []) => ({ items, getActiveTokens: () => (t ? [t] : []) });

    beforeEach(() => { globalThis.canvas = { grid: { size: 100 }, scene: { grid: { distance: 1 } } }; });

    it("без Таланта — false", () => {
      const me = token(0, 0, 1);
      globalThis.canvas.tokens = { placeables: [me] };
      expect(frontlineCommanderMeleeFree(withToken(me, []))).toBe(false);
    });

    it("с Талантом и врагом в базовом контакте — true", () => {
      const me = token(0, 0, 1);
      const enemy = token(0, 0, -1);
      globalThis.canvas.tokens = { placeables: [me, enemy] };
      expect(frontlineCommanderMeleeFree(withToken(me, [talentOf("Frontline Commander")]))).toBe(true);
    });

    it("с Талантом, но враг далеко — false", () => {
      const me = token(0, 0, 1);
      const enemy = token(0, 1000, -1);
      globalThis.canvas.tokens = { placeables: [me, enemy] };
      expect(frontlineCommanderMeleeFree(withToken(me, [talentOf("Frontline Commander")]))).toBe(false);
    });

    it("без токена на сцене — false", () => {
      expect(frontlineCommanderMeleeFree(withToken(null, [talentOf("Frontline Commander")]))).toBe(false);
    });
  });
});

describe("Protege/Протеже: свободное действие любимчику, −30 остальным", () => {
  const protege = (flags = {}) => ({ items: [talentOf("Protege / Протеже")], flags: { "warhammer-dbc": flags },
    getFlag: (_s, k) => flags[k] });

  it("hasProtege — по любой половине имени", () => {
    expect(hasProtege({ items: [talentOf("Protege")] })).toBe(true);
    expect(hasProtege({ items: [talentOf("Протеже")] })).toBe(true);
    expect(hasProtege({ items: [] })).toBe(false);
  });

  it("protegeFavoriteUuid — null, пока не выбран", () => {
    expect(protegeFavoriteUuid(protege())).toBeNull();
    expect(protegeFavoriteUuid(protege({ protegeUuid: "fav1" }))).toBe("fav1");
  });

  it("protegeFreeCommandActive — без Таланта, без получателя или уже использовано в этом Ходу — false", () => {
    expect(protegeFreeCommandActive({ items: [] }, "fav1")).toBe(false);
    expect(protegeFreeCommandActive(protege(), null)).toBe(false);
    expect(protegeFreeCommandActive(protege({ protegeFreeCommandUsed: true }), "fav1")).toBe(false);
  });

  it("protegeFreeCommandActive — любимчик не выбран (любой получатель даёт свободное) или совпал", () => {
    expect(protegeFreeCommandActive(protege(), "anyone")).toBe(true);
    expect(protegeFreeCommandActive(protege({ protegeUuid: "fav1" }), "fav1")).toBe(true);
    expect(protegeFreeCommandActive(protege({ protegeUuid: "fav1" }), "other")).toBe(false);
  });

  it("protegePenalty — 0 без Таланта или пока пенальти не включено", () => {
    expect(protegePenalty({ items: [] }, "other")).toBe(0);
    expect(protegePenalty(protege(), "other")).toBe(0);
  });

  it("protegePenalty — −30 не любимчику, 0 любимчику, когда пенальти включено", () => {
    const p = protege({ protegePenaltyActive: true, protegeUuid: "fav1" });
    expect(protegePenalty(p, "other")).toBe(-30);
    expect(protegePenalty(p, "fav1")).toBe(0);
  });

  it("protegeActivationPatch — закрепляет любимчика, если ещё не выбран", () => {
    expect(protegeActivationPatch(protege(), "fav1")).toEqual({
      "flags.warhammer-dbc.protegeFreeCommandUsed": true,
      "flags.warhammer-dbc.protegePenaltyActive": true,
      "flags.warhammer-dbc.protegeUuid": "fav1"
    });
  });

  it("protegeActivationPatch — не трогает уже выбранного любимчика", () => {
    expect(protegeActivationPatch(protege({ protegeUuid: "fav1" }), "fav1")).toEqual({
      "flags.warhammer-dbc.protegeFreeCommandUsed": true,
      "flags.warhammer-dbc.protegePenaltyActive": true
    });
  });
});

describe("Air of Authority/Аура Власти — лимит целей Command/Intimidate", () => {
  it("hasAirOfAuthority — по любой половине имени", () => {
    expect(hasAirOfAuthority({ items: [talentOf("Air of Authority")] })).toBe(true);
    expect(hasAirOfAuthority({ items: [talentOf("Аура Власти")] })).toBe(true);
    expect(hasAirOfAuthority({ items: [] })).toBe(false);
  });

  it("commandTargetLimit — F.b без Таланта, F.b×20 с ним", () => {
    const actor = (bonus, talents = []) => ({ items: talents, system: { characteristics: { fel: { bonus } } } });
    expect(commandTargetLimit(actor(3))).toBe(3);
    expect(commandTargetLimit(actor(3, [talentOf("Air of Authority")]))).toBe(60);
    expect(commandTargetLimit(actor(0, [talentOf("Air of Authority")]))).toBe(0);
  });

  it("commandTargetLimit — отрицательный F.b не уходит в минус", () => {
    expect(commandTargetLimit({ items: [], system: { characteristics: { fel: { bonus: -1 } } } })).toBe(0);
  });
});

describe("Radiant Presence/Блистательное Присутствие — галочка диалога, не скан сцены", () => {
  it("hasRadiantPresence — по любой половине имени", () => {
    expect(hasRadiantPresence({ items: [talentOf("Radiant Presence")] })).toBe(true);
    expect(hasRadiantPresence({ items: [talentOf("Блистательное Присутствие")] })).toBe(true);
    expect(hasRadiantPresence({ items: [] })).toBe(false);
  });

  it("anyRadiantPresenceHolderExists — хоть один носитель в списке", () => {
    expect(anyRadiantPresenceHolderExists([{ items: [talentOf("Radiant Presence")] }, { items: [] }])).toBe(true);
    expect(anyRadiantPresenceHolderExists([{ items: [] }])).toBe(false);
    expect(anyRadiantPresenceHolderExists([])).toBe(false);
    expect(anyRadiantPresenceHolderExists(undefined)).toBe(false);
  });

  it("radiantPresenceBonus — +10, если галочка отмечена, иначе 0", () => {
    expect(radiantPresenceBonus(true)).toBe(10);
    expect(radiantPresenceBonus(false)).toBe(0);
    expect(radiantPresenceBonus(undefined)).toBe(0);
  });

  it("leadershipTalentRules отдаёт rollBonus на morale по ctx.radiantPresence", () => {
    const actor = { items: [] };
    expect(leadershipTalentRules(actor, { radiantPresence: true })).toEqual([
      { id: "radiantPresence.morale", label: "Блистательное Присутствие", when: {},
        effects: [{ kind: "rollBonus", target: "morale", value: 10, label: "Блистательное Присутствие", auto: true }] }
    ]);
    expect(leadershipTalentRules(actor, { radiantPresence: false })).toEqual([]);
    expect(leadershipTalentRules(actor, {})).toEqual([]);
  });
});

describe("Into the Jaws of Hell/В Самое Пекло: галочка диалога, не скан сцены", () => {
  it("hasIntoTheJawsOfHell — по любой половине имени", () => {
    expect(hasIntoTheJawsOfHell({ items: [talentOf("Into the Jaws of Hell")] })).toBe(true);
    expect(hasIntoTheJawsOfHell({ items: [talentOf("В Самое Пекло")] })).toBe(true);
    expect(hasIntoTheJawsOfHell({ items: [] })).toBe(false);
  });

  it("anyIntoTheJawsOfHellHolderExists — хоть один носитель в списке", () => {
    expect(anyIntoTheJawsOfHellHolderExists([{ items: [talentOf("В Самое Пекло")] }])).toBe(true);
    expect(anyIntoTheJawsOfHellHolderExists([{ items: [] }])).toBe(false);
    expect(anyIntoTheJawsOfHellHolderExists(undefined)).toBe(false);
  });

  it("intoTheJawsOfHellActive — ровно значение галочки, приведённое к boolean", () => {
    expect(intoTheJawsOfHellActive(true)).toBe(true);
    expect(intoTheJawsOfHellActive(false)).toBe(false);
    expect(intoTheJawsOfHellActive(undefined)).toBe(false);
  });
});

describe("Living Legend/Живая Легенда: Inf вместо F", () => {
  const actorWithInf = (inf, fel, items = []) => ({
    items, system: { characteristics: { inf: { total: inf }, fel: { total: fel } } }
  });

  it("hasLivingLegend — по любой половине имени", () => {
    expect(hasLivingLegend({ items: [talentOf("Living Legend")] })).toBe(true);
    expect(hasLivingLegend({ items: [talentOf("Живая Легенда")] })).toBe(true);
    expect(hasLivingLegend({ items: [] })).toBe(false);
  });

  it("0 без Таланта", () => {
    const actor = actorWithInf(60, 30);
    expect(livingLegendCommandBonus(actor, {})).toBe(0);
  });

  it("без цели — разница Inf−F целиком", () => {
    const actor = actorWithInf(60, 30, [talentOf("Living Legend / Живая Легенда")]);
    expect(livingLegendCommandBonus(actor, {})).toBe(30);
  });

  it("цель с соразмерным Inf (не меньше, чем Inf актора −10) — блокирует замену", () => {
    const actor = actorWithInf(60, 30, [talentOf("Living Legend")]);
    const comparableTarget = { system: { characteristics: { inf: { total: 50 } } } }; // 60-10=50
    expect(livingLegendCommandBonus(actor, { targetActor: comparableTarget })).toBe(0);
  });

  it("цель с Inf ниже порога −10 — замена проходит", () => {
    const actor = actorWithInf(60, 30, [talentOf("Living Legend")]);
    const weakTarget = { system: { characteristics: { inf: { total: 49 } } } };
    expect(livingLegendCommandBonus(actor, { targetActor: weakTarget })).toBe(30);
  });
});

describe("War Chant/Боевая Песнь: переброс Морали (Лидер/подпевающий) и +3 Intimidate", () => {
  const leader = (uuid, flags = {}, items = [talentOf("War Chant / Боевая Песнь")]) => ({
    uuid, items, flags: { "warhammer-dbc": flags }, getFlag: (_s, k) => flags[k]
  });
  const sub = (uuid, flags = {}) => ({
    uuid, items: [], flags: { "warhammer-dbc": flags }, getFlag: (_s, k) => flags[k]
  });
  const squad = (uuid, posts, members = []) => ({ type: "squad", uuid, system: { posts, members } });

  it("hasWarChant — по любой половине имени", () => {
    expect(hasWarChant({ items: [talentOf("War Chant")] })).toBe(true);
    expect(hasWarChant({ items: [talentOf("Боевая Песнь")] })).toBe(true);
  });

  it("warChantSinging — требует и Таланта, и флага", () => {
    expect(warChantSinging(leader("l1"))).toBe(false);
    expect(warChantSinging(leader("l1", { [WAR_CHANT_FLAG]: true }))).toBe(true);
    expect(warChantSinging(leader("l1", { [WAR_CHANT_FLAG]: true }, []))).toBe(false);
  });

  it("warChantSingAlongActive — своя галочка + хоть один поющий командующий", () => {
    const l = leader("l1", { [WAR_CHANT_FLAG]: true });
    const s = sub("sub", { [WAR_CHANT_SING_ALONG_FLAG]: true });
    const sq = squad("sq1", { leader: { uuid: "l1" } }, [{ uuid: "sub" }]);
    expect(warChantSingAlongActive(s, [s, l, sq])).toBe(true);
    // Командующий перестал петь — подпевание тут же неактивно.
    const lSilent = leader("l1");
    expect(warChantSingAlongActive(s, [s, lSilent, sq])).toBe(false);
    // Своей галочки нет — неактивно, даже если командующий поёт.
    const sNoFlag = sub("sub2");
    expect(warChantSingAlongActive(sNoFlag, [sNoFlag, l, squad("sq2", { leader: { uuid: "l1" } }, [{ uuid: "sub2" }])])).toBe(false);
  });

  it("leadershipTalentRules — переброс Морали самому поющему Лидеру", () => {
    const l = leader("l1", { [WAR_CHANT_FLAG]: true });
    const rules = leadershipTalentRules(l, {}, [l]);
    expect(rules).toEqual([
      { id: "warChant.moraleReroll", label: "Боевая Песнь", when: {},
        effects: [{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2, label: "Боевая Песнь" }] }
    ]);
  });

  it("leadershipTalentRules — переброс Морали подпевающему подчинённому, не просто ЛЮБОМУ подчинённому", () => {
    const l = leader("l1", { [WAR_CHANT_FLAG]: true });
    const singer = sub("singer", { [WAR_CHANT_SING_ALONG_FLAG]: true });
    const silent = sub("silent");
    const sq = squad("sq1", { leader: { uuid: "l1" } }, [{ uuid: "singer" }, { uuid: "silent" }]);
    const allActors = [l, singer, silent, sq];

    expect(leadershipTalentRules(singer, {}, allActors)).toEqual([
      { id: "warChant.moraleReroll", label: "Боевая Песнь", when: {},
        effects: [{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2, label: "Боевая Песнь" }] }
    ]);
    // Подчинённый без своей галочки «подпевать» — ничего не получает, даже в том же Отряде.
    expect(leadershipTalentRules(silent, {}, allActors)).toEqual([]);
  });

  it("пусто, если Лидер не поёт — даже с галочкой «подпевать» у подчинённого", () => {
    const l = leader("l1");
    const singer = sub("singer", { [WAR_CHANT_SING_ALONG_FLAG]: true });
    const sq = squad("sq1", { leader: { uuid: "l1" } }, [{ uuid: "singer" }]);
    expect(leadershipTalentRules(singer, {}, [l, singer, sq])).toEqual([]);
    expect(leadershipTalentRules(l, {}, [l, singer, sq])).toEqual([]);
  });

  it("warChantIntimidateBonus — +3 за каждого подпевающего подчинённого, пока Лидер поёт", () => {
    const l = leader("l1", { [WAR_CHANT_FLAG]: true });
    const s1 = sub("s1", { [WAR_CHANT_SING_ALONG_FLAG]: true });
    const s2 = sub("s2", { [WAR_CHANT_SING_ALONG_FLAG]: true });
    const silent = sub("s3");
    const sq = squad("sq1", { leader: { uuid: "l1" } }, [{ uuid: "s1" }, { uuid: "s2" }, { uuid: "s3" }]);
    const allActors = [l, s1, s2, silent, sq];
    expect(warChantIntimidateBonus(l, allActors)).toBe(6);
    expect(warChantIntimidateBonus(leader("l1"), allActors)).toBe(0); // не поёт — бонуса нет
  });

  it("leadershipTalentRules — rollBonus skill:intimidate Лидеру за подпевающих", () => {
    const l = leader("l1", { [WAR_CHANT_FLAG]: true });
    const s1 = sub("s1", { [WAR_CHANT_SING_ALONG_FLAG]: true });
    const sq = squad("sq1", { leader: { uuid: "l1" } }, [{ uuid: "s1" }]);
    const rules = leadershipTalentRules(l, {}, [l, s1, sq]);
    expect(rules).toContainEqual(
      { id: "warChant.intimidate", label: "Боевая Песнь: +3 Intimidate", when: {},
        effects: [{ kind: "rollBonus", target: "skill:intimidate", value: 3, label: "Боевая Песнь" }] }
    );
  });

  it("warChantSingAlongBonus — +1, если цель Команды сейчас подпевает, иначе 0", () => {
    const l = leader("l1", { [WAR_CHANT_FLAG]: true });
    const singer = sub("singer", { [WAR_CHANT_SING_ALONG_FLAG]: true });
    const silent = sub("silent");
    const sq = squad("sq1", { leader: { uuid: "l1" } }, [{ uuid: "singer" }, { uuid: "silent" }]);
    const allActors = [l, singer, silent, sq];
    expect(warChantSingAlongBonus(singer, allActors)).toBe(1);
    expect(warChantSingAlongBonus(silent, allActors)).toBe(0);
    expect(warChantSingAlongBonus(null, allActors)).toBe(0);
  });
});

describe("Rally/Сплотить: доступность", () => {
  it("hasRally — по любой половине имени", () => {
    expect(hasRally({ items: [talentOf("Rally")] })).toBe(true);
    expect(hasRally({ items: [talentOf("Сплотить")] })).toBe(true);
    expect(hasRally({ items: [] })).toBe(false);
  });

  it("rallyAvailable — Талант и Риск 3+", () => {
    const leaderDoc = { items: [talentOf("Rally / Сплотить")] };
    expect(rallyAvailable(leaderDoc, 3)).toBe(true);
    expect(rallyAvailable(leaderDoc, 5)).toBe(true);
    expect(rallyAvailable(leaderDoc, 2)).toBe(false);
  });

  it("rallyAvailable — false без Таланта или без актора", () => {
    expect(rallyAvailable({ items: [] }, 4)).toBe(false);
    expect(rallyAvailable(null, 4)).toBe(false);
  });
});

describe("Bring It Down!/Валите Это!: срез бонуса попадания на кубы урона", () => {
  it("hasBringItDown — по любой половине имени", () => {
    expect(hasBringItDown({ items: [talentOf("Bring It Down!")] })).toBe(true);
    expect(hasBringItDown({ items: [talentOf("Валите Это!")] })).toBe(true);
    expect(hasBringItDown({ items: [] })).toBe(false);
  });

  it("bringItDownAccuracyPenalty — 0 вне Общей Команды на Атаки или без стеков", () => {
    expect(bringItDownAccuracyPenalty({ active: true, key: "inspire", testKind: "attack", bringItDownStacks: 2 })).toBe(0);
    expect(bringItDownAccuracyPenalty({ active: true, key: "general", testKind: "evasion", bringItDownStacks: 2 })).toBe(0);
    expect(bringItDownAccuracyPenalty({ active: true, key: "general", testKind: "attack", bringItDownStacks: 0 })).toBe(0);
    expect(bringItDownAccuracyPenalty(null)).toBe(0);
  });

  it("bringItDownAccuracyPenalty — 20 за стек", () => {
    expect(bringItDownAccuracyPenalty({ active: true, key: "general", testKind: "attack", bringItDownStacks: 1 }))
      .toBe(-BRING_IT_DOWN_PENALTY_PER_STACK);
    expect(bringItDownAccuracyPenalty({ active: true, key: "general", testKind: "attack", bringItDownStacks: 2 }))
      .toBe(-2 * BRING_IT_DOWN_PENALTY_PER_STACK);
  });

  it("bringItDownMaxStacks — не больше, чем позволяет бонус (Успехи×3)", () => {
    expect(bringItDownMaxStacks(0)).toBe(0);
    expect(bringItDownMaxStacks(6)).toBe(0); // 6*3=18 < 20
    expect(bringItDownMaxStacks(7)).toBe(1); // 7*3=21 >= 20
    expect(bringItDownMaxStacks(14)).toBe(2); // 14*3=42 -> 2 стека (40)
  });

  it("bringItDownStacksFor — 0 без цели/вне назначенной Общей Команды", () => {
    const squad = (uuid, posts, sc) => ({ type: "squad", uuid, system: { posts, members: [], shortCommand: sc } });
    const attacker = { uuid: "att" };
    const target = { uuid: "trg" };
    expect(bringItDownStacksFor(attacker, null, [])).toBe(0);
    expect(bringItDownStacksFor(attacker, target, [])).toBe(0);
    const sq = squad("sq1", { leader: { uuid: "boss" } },
      { active: true, key: "general", testKind: "attack", bringItDownStacks: 2, bringItDownTargetUuid: "other" });
    sq.system.members = [{ uuid: "att" }];
    expect(bringItDownStacksFor(attacker, target, [attacker, sq])).toBe(0);
  });

  it("bringItDownStacksFor — бонусные кубы, когда цель совпала с назначенной", () => {
    const squad = (uuid, posts, sc) => ({ type: "squad", uuid, system: { posts, members: [{ uuid: "att" }], shortCommand: sc } });
    const attacker = { uuid: "att" };
    const target = { uuid: "trg" };
    const sq = squad("sq1", { leader: { uuid: "boss" } },
      { active: true, key: "general", testKind: "attack", bringItDownStacks: 2, bringItDownTargetUuid: "trg" });
    expect(bringItDownStacksFor(attacker, target, [attacker, sq])).toBe(2);
  });
});

describe("Field Execution/Полевая Казнь: опознание и eligibility", () => {
  it("hasFieldExecution — по любой половине имени", () => {
    expect(hasFieldExecution({ items: [talentOf("Field Execution")] })).toBe(true);
    expect(hasFieldExecution({ items: [talentOf("Полевая Казнь")] })).toBe(true);
    expect(hasFieldExecution({ items: [] })).toBe(false);
  });

  it("fieldExecutionEligible — Шок или Подавление, не любое другое состояние", () => {
    expect(fieldExecutionEligible({ system: { conditions: { shocked: true } } })).toBe(true);
    expect(fieldExecutionEligible({ system: { conditions: { pinned: true } } })).toBe(true);
    expect(fieldExecutionEligible({ system: { conditions: { prone: true } } })).toBe(false);
    expect(fieldExecutionEligible({ system: { conditions: {} } })).toBe(false);
    expect(fieldExecutionEligible(null)).toBe(false);
  });
});

describe("Back to Back/Спиной к Спине: опознание и лимит получателей", () => {
  it("hasBackToBack — по любой половине имени", () => {
    expect(hasBackToBack({ items: [talentOf("Back to Back")] })).toBe(true);
    expect(hasBackToBack({ items: [talentOf("Спиной к Спине")] })).toBe(true);
    expect(hasBackToBack({ items: [] })).toBe(false);
  });

  it("backToBackGrantCap — ½F.b, округление вверх", () => {
    expect(backToBackGrantCap({ system: { characteristics: { fel: { bonus: 4 } } } })).toBe(2);
    expect(backToBackGrantCap({ system: { characteristics: { fel: { bonus: 5 } } } })).toBe(3);
    expect(backToBackGrantCap({ system: { characteristics: { fel: { bonus: 0 } } } })).toBe(0);
    expect(backToBackGrantCap(null)).toBe(0);
  });
});
