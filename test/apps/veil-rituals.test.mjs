// test/apps/veil-rituals.test.mjs
//
// Консоль Ритуалов (вкладка Завесы) работала только от пресетов книги: поля
// теста предмета-ритуала не читал никто, и ГМ переносил числа глазами
// (wdbc-lla). applyRitualItem — та же подстановка, что applyRitualPreset, но
// источником служит предмет на акторе.
//
// Подстановка — чистая функция: список навыков подаётся снаружи, как и
// пресетам. Гейт требований проверяется на самом методе консоли, вызванном без
// приложения, — там заглушка нужна ради `Application`, от которого наследуется
// окно Завесы.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { applyRitualItem, buildRitualSkills } from "../../module/constants/rituals.mjs";
import { VeilMystic } from "../../module/apps/veil.mjs";

/** Актор с групповыми навыками: у каждой специализации своя строка. */
function actorFor({ groupSkills = {}, skills = {} } = {}) {
  return {
    system: {
      characteristics: { int: { total: 40 }, wp: { total: 35 }, per: { total: 30 } },
      skills, groupSkills
    }
  };
}

const ritual = system => ({ id: "rit-1", name: "Зов Малефика", type: "ritual", system });

const skillsOf = actor => buildRitualSkills(actor);

describe("подстановка ритуала-предмета в консоль", () => {
  const scholar = actorFor({
    groupSkills: {
      forbiddenLore: [
        { specialty: "Демоны", total: 38, rank: "knows",   char: "int" },
        { specialty: "Варп",   total: 45, rank: "adept",   char: "int" }
      ]
    },
    skills: { awareness: { total: 41, rank: "knows" } }
  });

  it("групповой навык берёт СВОЮ специализацию, а не первую попавшуюся", () => {
    const applied = applyRitualItem(scholar, ritual({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Warp",
      testChar: "int", testMod: -20
    }), skillsOf);

    // «Warp» в книге, «Варп» у актора — сопоставитель специализаций общий с пресетами.
    const chosen = skillsOf(scholar).find(s => s.value === applied.skillValue);
    expect(chosen.label).toContain("Варп");
  });

  it("нужной специализации у актора нет — берётся любая из той же группы", () => {
    const applied = applyRitualItem(scholar, ritual({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Ересь"
    }), skillsOf);

    expect(applied.skillValue).toMatch(/^group:forbiddenLore:/);
  });

  it("группы у актора нет вовсе — навык не подставляется молча", () => {
    const applied = applyRitualItem(actorFor(), ritual({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Warp"
    }), skillsOf);

    expect(applied.skillValue).toBe("");
  });

  it("обычный навык подставляется по ключу", () => {
    const applied = applyRitualItem(scholar, ritual({
      testSkillScope: "plain", testSkillKey: "awareness"
    }), skillsOf);

    expect(applied.skillValue).toBe("skill:awareness");
  });

  it("имя, характеристика и сложность переезжают в форму", () => {
    const applied = applyRitualItem(scholar, ritual({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Warp",
      testChar: "wp", testMod: -30
    }), skillsOf);

    expect(applied.name).toBe("Зов Малефика");
    expect(applied.testChar).toBe("wp");
    expect(applied.gmMod).toBe(-30);
    expect(applied.itemId).toBe("rit-1");
  });

  it("пустой предмет даёт безопасные умолчания", () => {
    const applied = applyRitualItem(scholar, ritual({}), skillsOf);

    expect(applied.testChar).toBe("int");
    expect(applied.gmMod).toBe(0);
  });

  // Контентный тип предмета («Некромантия», «Ведьмограждение») не определяет
  // движковый: у пресетов одной категории встречаются и blessing, и summon, и
  // binding, а от движкового зависит Цена Ошибки при провале. Угадывать её за
  // ГМа нельзя, поэтому подстановка выбранный тип не трогает.
  it("движковый тип ритуала не подставляется", () => {
    const applied = applyRitualItem(scholar, ritual({ ritualType: "necromancy" }), skillsOf);

    expect(applied.type).toBeUndefined();
  });
});

// Требования ритуала ничего не гейтили: движок проведения о предмете не знал
// вовсе (wdbc-j13). Теперь консоль считает их тем же checkRequirements, что и
// строка раздела на листе, и проведение спрашивает подтверждение.
//
// Метод листа вызывается без самого приложения: ему нужны только this.ritual
// и список ритуалистов — как в test/sheets/horde-attack.test.mjs.
describe("гейт требований в консоли Ритуалов", () => {
  /** Ритуал-предмет с механическими группами требований во флагах. */
  const ritualItem = (id, name, flags = {}) => ({
    id, name, type: "ritual", system: { testChar: "int", testMod: -20 },
    getFlag: (_scope, key) => flags[key]
  });

  const raceGroup = (...raceKeys) => ({
    id: "g", operator: "AND",
    entries: raceKeys.map((raceKey, n) => ({ id: `e${n}`, kind: "reqRace", raceKey }))
  });

  /** Ритуалист на сцене: раса человек, один-два ритуала на листе. */
  function ritualist(items) {
    const list = [...items];
    list.get = id => list.find(i => i.id === id) ?? null;
    return {
      id: "act-1", name: "Каэль Ворн", type: "character",
      system: { race: "human", characteristics: { int: { total: 40 } },
                skills: {}, groupSkills: {} },
      items: list
    };
  }

  /** Консоль без приложения: только то, что читает _ritualData. */
  function consoleFor(actor, ritual = {}) {
    globalThis.game.actors = { get: id => (actor.id === id ? actor : null) };
    return {
      ritual: { ritualistId: actor.id, itemId: "", name: "", type: "summon",
                skillValue: "", testChar: "", gmMod: -20, assistants: 0, assistBonus: 10,
                summon: {}, curseFam: "close", curseSymp: {}, numerology: {}, numMod: 0,
                psyker: false, psykerBonus: 0, aversionPerFail: 5, ...ritual },
      _ritualActors: () => [{ id: actor.id, name: actor.name }]
    };
  }

  const dataOf = ctx => VeilMystic.prototype._ritualData.call(ctx);

  it("ритуал не выбран — гейта нет, ведём вручную как раньше", () => {
    const actor = ritualist([ritualItem("r1", "Зов", { req: [raceGroup("drukhari")] })]);
    const d = dataOf(consoleFor(actor));

    expect(d.reqOk).toBe(true);
    expect(d.ritualItems.map(r => r.name)).toEqual(["Зов"]);
  });

  it("выбран ритуал, требования не выполнены — гейт называет причину", () => {
    const actor = ritualist([ritualItem("r1", "Зов", { req: [raceGroup("drukhari")] })]);
    const d = dataOf(consoleFor(actor, { itemId: "r1" }));

    expect(d.reqOk).toBe(false);
    expect(d.reqFailed).toEqual(["Раса: Друкхари"]);
  });

  it("требования выполнены — гейт молчит", () => {
    const actor = ritualist([ritualItem("r1", "Зов", { req: [raceGroup("human")] })]);
    const d = dataOf(consoleFor(actor, { itemId: "r1" }));

    expect(d.reqOk).toBe(true);
  });

  // Требования к ассистентам проверяются по каждому помощнику отдельно, а не по
  // ритуалисту: гейт проведения на них не смотрит.
  it("требования к ассистентам проведение не гейтят", () => {
    const actor = ritualist([ritualItem("r1", "Зов", { assistReq: [raceGroup("drukhari")] })]);
    const d = dataOf(consoleFor(actor, { itemId: "r1" }));

    expect(d.reqOk).toBe(true);
  });

  it("ритуал чужого актора выбранным не остаётся", () => {
    const actor = ritualist([ritualItem("r1", "Зов")]);
    const ctx = consoleFor(actor, { itemId: "чужой-ритуал" });
    const d = dataOf(ctx);

    expect(ctx.ritual.itemId).toBe("");
    expect(d.ritualItems.every(r => !r.selected)).toBe(true);
  });
});
