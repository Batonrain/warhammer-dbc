// test/rules/craft-memory.test.mjs
//
// Память Крафта и Талант Prototyping / Прототипирование (корбук, гл. 3, 3-3a64).
// Книга: «При Крафте предметов, которые он уже создавал, он может перебрасывать
// тесты Крафта, если уже создавал этот предмет в таком же Качестве, и уменьшает
// мультипликатор Банка Успехов от Качества вдвое (обычно до ×2 для Good.Q и ×7
// для Best.Q), для предметов, которые он уже создавал в Качестве хотя бы на 1
// ниже. Он также не получает обычный штраф −20 на тесты Улучшения предметов,
// которые он создал сам или ассистировал в их создании.»

import { describe, it, expect } from "vitest";
import {
  CRAFTED_ITEMS_FLAG, normalizeItemName, recordCreation, recordAssist, craftedItemsOf, prototypingFor
} from "../../module/rules/craft-memory.mjs";
import { prototypingEffects, hasPrototyping, effectiveDiceMode } from "../../module/rules/craft-advantage.mjs";
import { bankFor } from "../../module/constants/craft.mjs";

const NS = "warhammer-dbc";
const crafterWith = (log, { talent = true } = {}) => ({
  items: talent ? [{ type: "talent", name: "Prototyping / Прототипирование" }] : [],
  flags: { [NS]: log === undefined ? {} : { [CRAFTED_ITEMS_FLAG]: log } },
  getFlag(s, k) { return this.flags[s]?.[k]; }
});
const proj = (over = {}) => ({ mode: "craft", title: "Лазган «Лукас»", quality: "good", improve: false, repair: false, ...over });

describe("normalizeItemName", () => {
  it("регистр, пробелы по краям и внутри, ё/е не мешают узнать тот же предмет", () => {
    expect(normalizeItemName("  Лазган   Лукас ")).toBe(normalizeItemName("лазган лукас"));
    expect(normalizeItemName("Ёж")).toBe(normalizeItemName("еж"));
    expect(normalizeItemName("")).toBe("");
    expect(normalizeItemName(null)).toBe("");
  });
});

describe("ключ журнала без точки и «=» (ловушка раскрытия ключей флага Foundry)", () => {
  it("«Лазган Мк.II» — плоский ключ без точки; тот же предмет находится", () => {
    const log = recordCreation({}, "Лазган Мк.II", "good");
    expect(Object.keys(log).every(k => !k.includes(".") && !k.includes("="))).toBe(true);
    expect(prototypingFor(log, "лазган мк.ii", "good").reroll).toBe(true);
  });
  it("«-=имя» не превращается в оператор удаления", () => {
    expect(Object.keys(recordCreation({}, "-=Болтер", "good")).every(k => !k.includes("="))).toBe(true);
  });
});

describe("журнал созданного", () => {
  it("recordCreation запоминает предмет и Качество; повтор того же — без дублей", () => {
    let log = recordCreation({}, "Лазган", "common");
    log = recordCreation(log, "лазган ", "good");
    log = recordCreation(log, "Лазган", "good");
    expect(Object.keys(log)).toHaveLength(1);
    expect(Object.values(log)[0]).toMatchObject({ name: "Лазган", made: ["common", "good"] });
  });

  it("пустое имя или неизвестное Качество в журнал не пишутся", () => {
    expect(recordCreation({}, "  ", "good")).toEqual({});
    expect(recordCreation({}, "Лазган", "legendary")).toEqual({});
  });

  it("recordAssist отмечает, что помогал, и не подменяет «создавал»", () => {
    const log = recordAssist(recordCreation({}, "Лазган", "good"), "Лазган");
    expect(Object.values(log)[0]).toMatchObject({ made: ["good"], assisted: true });
    const onlyAssist = recordAssist({}, "Болтер");
    expect(Object.values(onlyAssist)[0]).toMatchObject({ made: [], assisted: true });
  });

  it("craftedItemsOf читает флаг актора и терпит его отсутствие", () => {
    expect(craftedItemsOf(crafterWith({ a: { name: "A", made: ["good"] } }))).toHaveProperty("a");
    expect(craftedItemsOf({})).toEqual({});
    expect(craftedItemsOf(null)).toEqual({});
  });
});

describe("prototypingFor: что даёт память", () => {
  const log = recordCreation({}, "Лазган «Лукас»", "good");

  it("то же Качество: переброс; Банк не уменьшается (ниже ничего не делал)", () => {
    expect(prototypingFor(log, "Лазган «Лукас»", "good")).toEqual({ known: true, reroll: true, halveBank: false, noImprovePenalty: true });
  });

  it("Качество выше сделанного: Банк вдвое, но не переброс", () => {
    expect(prototypingFor(log, "Лазган «Лукас»", "best")).toEqual({ known: true, reroll: false, halveBank: true, noImprovePenalty: true });
  });

  it("Качество ниже сделанного: ни переброса, ни скидки Банка (скидка — за делавшийся НИЖЕ)", () => {
    expect(prototypingFor(log, "Лазган «Лукас»", "common")).toMatchObject({ reroll: false, halveBank: false });
  });

  it("другой предмет — ничего", () => {
    expect(prototypingFor(log, "Болтган", "good")).toEqual({ known: false, reroll: false, halveBank: false, noImprovePenalty: false });
  });

  it("только ассистировал: −20 Улучшения снят, а переброса и скидки Банка нет (там «создавал»)", () => {
    const l = recordAssist({}, "Болтер");
    expect(prototypingFor(l, "Болтер", "good")).toEqual({ known: true, reroll: false, halveBank: false, noImprovePenalty: true });
  });
});

describe("prototypingEffects: гейты Таланта и проекта", () => {
  const log = recordCreation({}, "Лазган «Лукас»", "common");

  it("без Таланта ничего, даже при полном журнале", () => {
    expect(prototypingEffects(crafterWith(log, { talent: false }), proj()).halveBank).toBe(false);
    expect(hasPrototyping(crafterWith(log, { talent: false }))).toBe(false);
  });

  it("Талант + журнал: Банк вдвое для Good.Q по сделанному Comm.Q", () => {
    const fx = prototypingEffects(crafterWith(log), proj());
    expect(fx).toMatchObject({ halveBank: true, reroll: false, noImprovePenalty: true });
  });

  it("Исследование, ремонт и безымянный проект не считаются «Крафтом уже созданного»", () => {
    const c = crafterWith(log);
    expect(prototypingEffects(c, proj({ mode: "research" })).halveBank).toBe(false);
    expect(prototypingEffects(c, proj({ repair: true })).halveBank).toBe(false);
    expect(prototypingEffects(c, proj({ title: "" })).halveBank).toBe(false);
  });

  it("предмет без записи — Таланту не за что зацепиться", () => {
    expect(prototypingEffects(crafterWith({}), proj()).known).toBe(false);
  });
});

describe("Банк: halveMult убирает половину мультипликатора Качества", () => {
  it("Good.Q ×4 → ×2, Best.Q ×14 → ×7 (числа книги)", () => {
    expect(bankFor(10, "good", false)).toBe(40);
    expect(bankFor(10, "good", false, { halveMult: true })).toBe(20);
    expect(bankFor(10, "best", false, { halveMult: true })).toBe(70);
  });

  it("складывается с Улучшением (÷2), не заменяет его", () => {
    expect(bankFor(10, "good", true, { halveMult: true })).toBe(10);
  });

  it("без опции — как было", () => {
    expect(bankFor(10, "common", false)).toBe(10);
    expect(bankFor(10, "poor", true)).toBe(2);
  });
});

describe("Кубик смены: переброс Прототипирования", () => {
  it("даёт «лучший из двух», как любой переброс системы; ручной Обычный не мешает", () => {
    expect(effectiveDiceMode("normal", { items: [] }, "explosive", false, null, true)).toBe("advantage");
    expect(effectiveDiceMode("normal", { items: [] }, "explosive", false, null, false)).toBe("normal");
  });
});
