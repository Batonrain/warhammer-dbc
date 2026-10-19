// test/rules/infernal-will.test.mjs
//
// Инфернальная Воля (Мутация 44, wdbc-1rno.22): бросок по таблице Шока при
// 4+ Провалах теста Навыка и снижение результата на Cor. Решения владельца
// 02.10.2026: 1d100 + 10×(Провалы−1), Infamy не вычитается; «Неделимый» — и
// Покровитель «Неделимый», и персонаж без Покровителя; дружественные Навыки —
// Навыки его Бога плюс «всегда дружественные» (Common Lore, Trade); снижение
// автоматическое, результат ≤0 — Шока нет.

import { describe, it, expect } from "vitest";
import { infernalWillFriendlySkill, infernalWillReduction, infernalWillShockTotal }
  from "../../module/rules/infernal-will.mjs";

const actor = (patronGod, cor) => ({ system: { patronGod, corruption: { value: cor } } });

describe("infernalWillFriendlySkill — Навык дружественен Богу", () => {
  it("Навык своего Бога — да (Кхорн, Athletics)", () => {
    expect(infernalWillFriendlySkill("khorne", { skill: "athletics" })).toBe(true);
  });

  it("Навык чужого Бога — нет (Кхорн, Charm — Слаанеш)", () => {
    expect(infernalWillFriendlySkill("khorne", { skill: "charm" })).toBe(false);
  });

  it("Навык «Неделимого» — не дружественен конкретному Богу (Кхорн, Awareness)", () => {
    expect(infernalWillFriendlySkill("khorne", { skill: "awareness" })).toBe(false);
  });

  it("Common Lore и Trade — всегда дружественные, при любом Боге", () => {
    expect(infernalWillFriendlySkill("nurgle", { group: "commonLore", specialty: "Imperium" })).toBe(true);
    expect(infernalWillFriendlySkill("tzeentch", { group: "trade", specialty: "Armourer" })).toBe(true);
  });

  it("групповой Навык Бога (ctx.group) — по Богу группы (Тзинч, Forbidden Lore)", () => {
    expect(infernalWillFriendlySkill("tzeentch", { group: "forbiddenLore", specialty: "Daemonology" })).toBe(true);
  });

  it("специализация с собственным Богом: Forbidden Lore (Heresy) — Нургл, не Тзинч", () => {
    expect(infernalWillFriendlySkill("nurgle", { group: "forbiddenLore", specialty: "Heresy" })).toBe(true);
    expect(infernalWillFriendlySkill("tzeentch", { group: "forbiddenLore", specialty: "Heresy" })).toBe(false);
  });
});

describe("infernalWillReduction — на сколько снижается результат", () => {
  it("без Покровителя (Неделимый) — половина Cor, окр. вверх: Cor 45 → 23", () => {
    expect(infernalWillReduction(actor("", 45), { skill: "charm" }).value).toBe(23);
  });

  it("Покровитель «Неделимый» — так же половина Cor", () => {
    expect(infernalWillReduction(actor("undivided", 45), { skill: "charm" }).value).toBe(23);
  });

  it("Неделимому дружественность Навыка не важна — половина Cor на любом Навыке", () => {
    expect(infernalWillReduction(actor("undivided", 30), { group: "trade" }).value).toBe(15);
  });

  it("Бог-Покровитель и дружественный Навык — полный Cor", () => {
    expect(infernalWillReduction(actor("khorne", 45), { skill: "athletics" }).value).toBe(45);
  });

  it("Бог-Покровитель и Common Lore — полный Cor (всегда дружественный)", () => {
    expect(infernalWillReduction(actor("slaanesh", 12), { group: "commonLore" }).value).toBe(12);
  });

  it("Бог-Покровитель и НЕдружественный Навык — снижения нет", () => {
    expect(infernalWillReduction(actor("khorne", 45), { skill: "charm" }).value).toBe(0);
  });

  it("Cor 0 — снижения нет и у Неделимого", () => {
    expect(infernalWillReduction(actor("", 0), { skill: "charm" }).value).toBe(0);
  });

  it("подпись объясняет, откуда число", () => {
    expect(infernalWillReduction(actor("", 45), { skill: "charm" }).label).toMatch(/Неделим/);
    expect(infernalWillReduction(actor("khorne", 45), { skill: "athletics" }).label).toMatch(/Кхорн/);
  });
});

describe("infernalWillShockTotal — итог броска Шока", () => {
  it("1d100 + 10×(Провалы−1): бросок 50, 4 Провала → 80", () => {
    expect(infernalWillShockTotal(50, 4, 0)).toBe(80);
  });

  it("6 Провалов → +50", () => {
    expect(infernalWillShockTotal(10, 6, 0)).toBe(60);
  });

  it("минус снижение на Cor: 50 + 30 − 23 = 57", () => {
    expect(infernalWillShockTotal(50, 4, 23)).toBe(57);
  });

  it("снижение может увести в 0 и ниже — тогда Шока нет (решает вызывающий код)", () => {
    expect(infernalWillShockTotal(5, 4, 60)).toBe(-25);
  });
});
