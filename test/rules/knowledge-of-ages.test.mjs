// test/rules/knowledge-of-ages.test.mjs
//
// Knowledge of Ages / Знания Веков (Общие мутации, wdbc-1rno.23), вторая
// половина: «Когда персонаж использует способности Бесчестия «Усиление»,
// «Успех» или «Переброс» для этого Навыка, он может бросить 1d10 — на 9-10
// он не тратит Очко Бесчестия, но на 1 он входит в Ступор на 1 Раунд»
// (core.json, «–3..0 | Знания Веков»). Чистая логика — module/rules/
// knowledge-of-ages.mjs, без Foundry.

import { describe, it, expect } from "vitest";
import {
  KNOWLEDGE_OF_AGES_CAPABILITY, KNOWLEDGE_OF_AGES_ABILITIES,
  knowledgeOfAgesOutcome, knowledgeOfAgesSkillKeys, knowledgeOfAgesCoversTest, spendsInfamyPoints
} from "../../module/rules/knowledge-of-ages.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const NS = "warhammer-dbc";
const KOA = () => packDocById("packs-src/mutations/Общие_мутации", "0Mc6b4RhLPO4ruoU");

describe("Знания Веков: исход 1d10", () => {
  it("9 и 10 — Очко не тратится, Ступора нет", () => {
    expect(knowledgeOfAgesOutcome(9)).toEqual({ refund: true, stupor: false });
    expect(knowledgeOfAgesOutcome(10)).toEqual({ refund: true, stupor: false });
  });
  it("1 — Ступор на 1 Раунд, Очко потрачено", () => {
    expect(knowledgeOfAgesOutcome(1)).toEqual({ refund: false, stupor: true });
  });
  it("2–8 — ничего", () => {
    for (let d = 2; d <= 8; d++) expect(knowledgeOfAgesOutcome(d)).toEqual({ refund: false, stupor: false });
  });
});

describe("Знания Веков: какие траты Очка", () => {
  it("книга называет ровно «Усиление», «Успех», «Переброс»", () => {
    expect([...KNOWLEDGE_OF_AGES_ABILITIES].sort()).toEqual(["boost", "reroll", "success"]);
  });

  it("только Очки Бесчестия: Хаосит и Демон-Принц — да; Судьба и Боль — нет", () => {
    expect(spendsInfamyPoints({ type: "character", system: { alignment: "heretic" } })).toBe(true);
    expect(spendsInfamyPoints({ type: "demonPrince", system: {} })).toBe(true);
    expect(spendsInfamyPoints({ type: "character", system: { alignment: "renegade" } })).toBe(false);
    expect(spendsInfamyPoints({ type: "character", system: { alignment: "heretic", race: "drukhari" } })).toBe(false);
    expect(spendsInfamyPoints(null)).toBe(false);
  });
});

describe("Знания Веков: «этот Навык» — по Таланту Mastery, выданному мутацией", () => {
  const mutation = () => ({ id: "mut1", type: "mutation", flags: KOA().flags });
  const mastery = (aptSource, extra = {}) => ({
    id: `t-${aptSource}`, type: "talent", name: "Mastery / Мастерство",
    system: { specialization: "?", aptSource },
    flags: { [NS]: { grantedByItem: "mut1", abilityEntryId: "6WRTlSrWDkgM8iI5:mastery", ...extra } }
  });

  it("пак действительно несёт capability с этим ключом", () => {
    const keys = KOA().flags[NS].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain(KNOWLEDGE_OF_AGES_CAPABILITY);
  });

  it("находит ключ Навыка у Mastery, выданного мутацией", () => {
    expect(knowledgeOfAgesSkillKeys([mutation(), mastery("dodge")])).toEqual(["dodge"]);
  });

  it("Mastery, купленный за опыт (не от мутации), не считается", () => {
    const bought = { id: "t9", type: "talent", system: { aptSource: "awareness" }, flags: { [NS]: {} } };
    expect(knowledgeOfAgesSkillKeys([mutation(), bought])).toEqual([]);
  });

  it("Mastery от ДРУГОГО предмета не считается", () => {
    const other = mastery("command", { grantedByItem: "other" });
    expect(knowledgeOfAgesSkillKeys([mutation(), other])).toEqual([]);
  });

  it("без aptSource ключ восстанавливается по подписи специализации", () => {
    const t = mastery("");
    t.system = { specialization: "Запретные знания (Демоны)" };
    expect(knowledgeOfAgesSkillKeys([mutation(), t])).toEqual(["forbiddenLore:daemons"]);
  });

  it("две мутации — два Навыка", () => {
    const m2 = { id: "mut2", type: "mutation", flags: KOA().flags };
    const t2 = mastery("command", { grantedByItem: "mut2" });
    expect(knowledgeOfAgesSkillKeys([mutation(), m2, mastery("dodge"), t2]).sort()).toEqual(["command", "dodge"]);
  });

  it("принимает и Коллекцию Foundry (итерируемую), не только массив", () => {
    const items = new Map([["a", mutation()], ["b", mastery("dodge")]]).values();
    expect(knowledgeOfAgesSkillKeys(items)).toEqual(["dodge"]);
  });
});

describe("Знания Веков: тот ли это Навык (флаг skillTest карточки теста)", () => {
  it("обычный Навык — по ключу", () => {
    expect(knowledgeOfAgesCoversTest(["dodge"], { skill: "dodge" })).toBe(true);
    expect(knowledgeOfAgesCoversTest(["dodge"], { skill: "awareness" })).toBe(false);
  });

  it("тест Характеристики (без Навыка) — нет", () => {
    expect(knowledgeOfAgesCoversTest(["dodge"], { skill: "", group: "" })).toBe(false);
  });

  it("специализация группы — по подписи строки листа в любом виде", () => {
    const keys = ["forbiddenLore:daemons"];
    // Так её кладёт выдача Конструктора (specOptions().display):
    expect(knowledgeOfAgesCoversTest(keys, { group: "forbiddenLore", specialty: "Daemons — Демоны" })).toBe(true);
    // Купленная руками строка — русская или английская подпись:
    expect(knowledgeOfAgesCoversTest(keys, { group: "forbiddenLore", specialty: "Демоны" })).toBe(true);
    expect(knowledgeOfAgesCoversTest(keys, { group: "forbiddenLore", specialty: "daemons" })).toBe(true);
  });

  it("другая специализация той же группы — нет", () => {
    expect(knowledgeOfAgesCoversTest(["forbiddenLore:daemons"],
      { group: "forbiddenLore", specialty: "Archeotech — Археотех" })).toBe(false);
  });

  it("та же специализация, но другая группа — нет", () => {
    expect(knowledgeOfAgesCoversTest(["forbiddenLore:daemons"], { group: "commonLore", specialty: "Демоны" })).toBe(false);
  });

  it("нет ключей или нет контекста — нет", () => {
    expect(knowledgeOfAgesCoversTest([], { skill: "dodge" })).toBe(false);
    expect(knowledgeOfAgesCoversTest(["dodge"], null)).toBe(false);
  });
});
