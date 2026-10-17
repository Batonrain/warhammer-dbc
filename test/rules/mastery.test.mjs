// test/rules/mastery.test.mjs
//
// Мастерство (Общие Таланты, стр. 62): автоуспех за Очко Бесчестия
// («окончательный модификатор +0 или легче», Успехов столько, каков Бонус
// Характеристики), 5+ Успехов = Критический Успех, Требование «Навык+30».
// Чистая логика без Foundry.

import { describe, it, expect } from "vitest";
import {
  MASTERY_CRIT_DEGREES, isMastery, masteryKeyOf, masteryKeys, masteryCoversTest,
  masteryCrit, masteryAutoSuccessAllowed, masteryAutoSuccessDegrees, masteryAutoSuccessOffer
} from "../../module/rules/mastery.mjs";
import { checkRequirement, checkMasteryTarget, parseRequirement } from "../../module/constants/talent-requirements.mjs";
import { masteryTarget } from "../../module/rules/mastery-targets.mjs";

const mastery = (aptSource, specialization = "") => ({
  type: "talent", name: "Mastery / Мастерство", system: { aptSource, specialization }
});
const actorWith = (items = [], system = {}) => ({ items, system });

describe("Мастерство: привязка", () => {
  it("опознаётся по любой половине имени", () => {
    expect(isMastery(mastery("dodge"))).toBe(true);
    expect(isMastery({ type: "talent", name: "Мастерство", system: {} })).toBe(true);
    expect(isMastery({ type: "talent", name: "Plasma Mastery / Мастерство Плазмы", system: {} })).toBe(false);
  });

  it("ключ — из aptSource, а без него — по подписи", () => {
    expect(masteryKeyOf(mastery("dodge"))).toBe("dodge");
    expect(masteryKeyOf(mastery("", "Уклонение"))).toBe("dodge");
    expect(masteryKeyOf(mastery("", ""))).toBe("");
  });

  it("собирает ключи без повторов", () => {
    expect(masteryKeys([mastery("dodge"), mastery("dodge"), mastery("parry")]).sort()).toEqual(["dodge", "parry"]);
  });
});

describe("Мастерство: какой тест покрыт", () => {
  it("обычный Навык — по ключу", () => {
    expect(masteryCoversTest(["dodge"], { skill: "dodge" })).toBe(true);
    expect(masteryCoversTest(["dodge"], { skill: "parry" })).toBe(false);
  });

  it("специализация группового Навыка — только своя", () => {
    const key = "forbiddenLore:daemons";
    expect(masteryTarget(key)).toBeTruthy();
    expect(masteryCoversTest([key], { group: "forbiddenLore", specialty: "Daemons" })).toBe(true);
    expect(masteryCoversTest([key], { group: "forbiddenLore", specialty: "Xenos" })).toBe(false);
  });

  it("группа целиком покрывает любую специализацию", () => {
    expect(masteryCoversTest(["forbiddenLore"], { group: "forbiddenLore", specialty: "Xenos" })).toBe(true);
    expect(masteryCoversTest(["forbiddenLore"], { group: "commonLore", specialty: "Xenos" })).toBe(false);
  });

  it("без привязки или без теста — не покрыт", () => {
    expect(masteryCoversTest([], { skill: "dodge" })).toBe(false);
    expect(masteryCoversTest(["dodge"], null)).toBe(false);
  });
});

describe("Мастерство: 5+ Успехов = Критический Успех", () => {
  const actor = actorWith([mastery("dodge")]);

  it("порог — пять Успехов", () => {
    expect(MASTERY_CRIT_DEGREES).toBe(5);
    expect(masteryCrit(actor, { skill: "dodge" }, { success: true, deg: 4 })).toBe(false);
    expect(masteryCrit(actor, { skill: "dodge" }, { success: true, deg: 5 })).toBe(true);
    expect(masteryCrit(actor, { skill: "dodge" }, { success: true, deg: 8 })).toBe(true);
  });

  it("провал с большой степенью — не критический успех", () => {
    expect(masteryCrit(actor, { skill: "dodge" }, { success: false, deg: 6 })).toBe(false);
  });

  it("другой Навык без Мастерства — не критический успех", () => {
    expect(masteryCrit(actor, { skill: "parry" }, { success: true, deg: 7 })).toBe(false);
  });
});

describe("Мастерство: автоуспех", () => {
  const actor = actorWith([mastery("dodge")], { characteristics: { ag: { bonus: 4 } } });
  const card = (extra = {}) => ({ skill: "dodge", char: "ag", success: false, deg: 1, mod: 0, ...extra });

  it("поправка +0 и легче допустима, хуже — нет", () => {
    expect(masteryAutoSuccessAllowed(card({ mod: 0 }))).toBe(true);
    expect(masteryAutoSuccessAllowed(card({ mod: 20 }))).toBe(true);
    expect(masteryAutoSuccessAllowed(card({ mod: -10 }))).toBe(false);
  });

  it("карточка без поля mod (старая) не режется", () => {
    const old = card();
    delete old.mod;
    expect(masteryAutoSuccessAllowed(old)).toBe(true);
  });

  it("не тест Навыка — нельзя", () => {
    expect(masteryAutoSuccessAllowed({ skill: "", group: "", char: "ag" })).toBe(false);
    expect(masteryAutoSuccessAllowed(null)).toBe(false);
  });

  it("Успехов столько, каков Бонус Характеристики, но не меньше одного", () => {
    expect(masteryAutoSuccessDegrees(actor, "ag")).toBe(4);
    expect(masteryAutoSuccessDegrees(actorWith([], { characteristics: { ag: { bonus: 0 } } }), "ag")).toBe(1);
  });

  it("предлагается на проваленный тест Навыка с Мастерством", () => {
    expect(masteryAutoSuccessOffer(actor, card())).toEqual({ deg: 4 });
  });

  it("не предлагается, если бросок и так дал столько же Успехов или больше", () => {
    expect(masteryAutoSuccessOffer(actor, card({ success: true, deg: 4 }))).toBeNull();
    expect(masteryAutoSuccessOffer(actor, card({ success: true, deg: 2 }))).toEqual({ deg: 4 });
  });

  it("не предлагается без Мастерства на этот Навык", () => {
    expect(masteryAutoSuccessOffer(actor, card({ skill: "parry" }))).toBeNull();
    expect(masteryAutoSuccessOffer(actorWith([]), card())).toBeNull();
  });

  it("не предлагается при поправке хуже +0", () => {
    expect(masteryAutoSuccessOffer(actor, card({ mod: -10 }))).toBeNull();
  });
});

describe("Мастерство: Требование «Навык+30»", () => {
  it("строка разбирается как «любой Навык не ниже +30»", () => {
    const [part] = parseRequirement("Навык+30");
    expect(part.alts[0]).toMatchObject({ kind: "anySkill", bonus: 30 });
  });

  it("выполнено, если хоть один Навык продвинут на +30", () => {
    const ok = { system: { skills: { dodge: { rank: "expert" } }, groupSkills: {} } };
    const no = { system: { skills: { dodge: { rank: "veteran" } }, groupSkills: {} } };
    expect(checkRequirement(ok, "Навык+30").state).toBe("ok");
    expect(checkRequirement(no, "Навык+30").state).toBe("fail");
  });

  it("групповой Навык тоже засчитывается", () => {
    const actor = { system: { skills: {}, groupSkills: { forbiddenLore: [{ specialty: "Daemons", rank: "expert" }] } } };
    expect(checkRequirement(actor, "Навык+30").state).toBe("ok");
  });

  it("по выбранной привязке: +30 проходит, +20 и неизученный Навык — нет", () => {
    const t = masteryTarget("dodge");
    expect(checkMasteryTarget({ system: { skills: { dodge: { rank: "expert" } } } }, t)).toBe(true);
    expect(checkMasteryTarget({ system: { skills: { dodge: { rank: "veteran" } } } }, t)).toBe(false);
    expect(checkMasteryTarget({ system: { skills: {} } }, t)).toBe(false);
  });

  it("по выбранной специализации группы — только её", () => {
    const actor = { system: { skills: {}, groupSkills: { forbiddenLore: [{ specialty: "Daemons", rank: "expert" }] } } };
    expect(checkMasteryTarget(actor, masteryTarget("forbiddenLore:daemons"))).toBe(true);
    expect(checkMasteryTarget(actor, masteryTarget("forbiddenLore:heresy"))).toBe(false);
  });
});
