// Русские названия Навыков — как в книге (Основная книга, стр. 57-61, заголовки
// «ОПИСАНИЯ НАВЫКОВ»: «Acrobatics (A) / Акробатика»). Таблица ниже переписана с
// книги, а не выведена из кода. Старые названия (Бдительность, Обаяние…) живут
// только как алиасы сравнения: правила рас и Таланты в снимках на живых акторах
// ещё несут их, а пак их не догонит — см. constants/skills.mjs → currentSkillName.
import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { SKILLS_DEF, GROUP_SKILLS_DEF, currentSkillName } from "../../module/constants/skills.mjs";
import { SKILL_SPECIALIZATIONS } from "../../module/constants/skill-specializations.mjs";
import { charAptitudeSet, aptitudeCat } from "../../module/constants/advancement.mjs";
import { resolveAptitudeOverride } from "../../module/rules/aptitude-overrides.mjs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";
import { socialMentions } from "../../module/rules/social.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const BOOK_NAMES = {
  acrobatics: "Акробатика", athletics: "Атлетика", awareness: "Внимательность", charm: "Очарование",
  command: "Командование", commerce: "Торговля", deceive: "Обман", dodge: "Уклонение",
  inquiry: "Расспрос", interrogate: "Допрос", intimidate: "Запугивание", logic: "Логика",
  medicae: "Медицина", parry: "Парирование", psyniscience: "Психочутье", scrutiny: "Пристальность",
  security: "Безопасность", sleightOfHand: "Ловкость рук", stealth: "Скрытность",
  survival: "Выживание", techUse: "Технология"
};
const BOOK_GROUP_NAMES = {
  commonLore: "Общие знания", forbiddenLore: "Запретные знания", scholasticLore: "Ученые знания",
  linguistics: "Язык", navigation: "Навигация", operate: "Вождение", trade: "Ремесло"
};
const flat = s => String(s).toLowerCase().replaceAll("ё", "е");

describe("названия Навыков — как в книге", () => {
  for (const [key, name] of Object.entries(BOOK_NAMES)) {
    it(`${key}: «${name}»`, () => {
      expect(flat(SKILLS_DEF[key].label)).toBe(flat(name));
    });
  }
  for (const [key, name] of Object.entries(BOOK_GROUP_NAMES)) {
    it(`группа ${key}: «${name}»`, () => {
      expect(flat(GROUP_SKILLS_DEF[key].label)).toBe(flat(name));
    });
  }
  it("специализации Вождения: Наземное, Полёт, Корабль", () => {
    expect(SKILL_SPECIALIZATIONS.operate.map(s => flat(s.ru))).toEqual(["наземное", "полет", "корабль"]);
  });
});

describe("старые названия сводятся к нынешним", () => {
  it("именительный падеж, целым словом", () => {
    expect(currentSkillName("психонаука")).toBe("психочутьё");
    expect(currentSkillName("медика")).toBe("медицина");
    expect(currentSkillName("бдительность")).toBe("внимательность");
    expect(currentSkillName("обаяние")).toBe("очарование");
    expect(currentSkillName("лингвистика")).toBe("язык");
  });
  it("«Медика-палуба», «Медикаменты» и прочие слова не задеваются", () => {
    expect(currentSkillName("медика-палуба")).toBe("медика-палуба");
    expect(currentSkillName("медикаменты")).toBe("медикаменты");
    expect(currentSkillName("талант бдительность")).toBe("талант внимательность");
  });
});

describe("старые данные продолжают работать после переименования", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });
  const rule = match => registerRuleSource("test-legacy", () => [{
    id: "test.legacy", when: {},
    effects: [{ kind: "grantAptitudeOverride", scope: "skill", match, align: "ally" }]
  }]);
  const actor = { system: { aptitudes: [], characteristics: {}, geneSeed: {}, patronGod: "" }, items: [] };

  it("override расы со старым `match` («Психонаука») находит Навык с новой подписью", () => {
    rule("Психонаука");
    expect(resolveAptitudeOverride(actor, "skill", SKILLS_DEF.psyniscience.label)).toBe("ally");
  });
  it("override с новым `match` находит и старое имя", () => {
    rule(SKILLS_DEF.psyniscience.label);
    expect(resolveAptitudeOverride(actor, "skill", "Психонаука")).toBe("ally");
  });
  it("Мастерство (Психонаука) в снимке на акторе засчитывается как Мастерство (Психочутьё)", () => {
    const entry = { when: { talentSpec: { name: "Мастерство", specialization: SKILLS_DEF.psyniscience.label } } };
    const has = specialization => ({
      system: { geneSeed: {}, bio: { age: 0 } },
      items: [{ type: "talent", name: "Mastery / Мастерство", system: { specialization } }]
    });
    expect(entryWhenOk(has("Психонаука"), entry)).toBe(true);
    expect(entryWhenOk(has("Психочутьё"), entry)).toBe(true);
    expect(entryWhenOk(has("Телепатия"), entry)).toBe(false);
  });
  it("разбор текста предметов узнаёт и новые, и старые названия социальных Навыков", () => {
    expect(socialMentions("+10 к Очарованию")).toEqual(["Очарование"]);
    expect(socialMentions("+10 к Обаянию")).toEqual(["Очарование"]);
    expect(socialMentions("тесты Расспроса")).toEqual(["Расспрос"]);
    expect(socialMentions("тесты Дознания")).toEqual(["Расспрос"]);
    expect(socialMentions("бонус к Торговле")).toEqual(["Торговля"]);
    expect(socialMentions("бонус к Коммерции")).toEqual(["Торговля"]);
  });
});

describe("Склонность General выдаётся всем автоматически", () => {
  it("набор Склонностей персонажа всегда содержит general, даже пустой", () => {
    expect(charAptitudeSet([]).has("general")).toBe(true);
    expect(charAptitudeSet(undefined).has("general")).toBe(true);
  });
  it("Акробатика (Ag, General): без Ag — нейтральная, с Ag — дружественная", () => {
    const def = SKILLS_DEF.acrobatics;
    expect(aptitudeCat(charAptitudeSet([]), [def.char, def.apt2])).toBe("neutral");
    expect(aptitudeCat(charAptitudeSet(["ag"]), [def.char, def.apt2])).toBe("ally");
  });
});
