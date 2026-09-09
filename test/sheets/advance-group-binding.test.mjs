// test/sheets/advance-group-binding.test.mjs
//
// Привязка Склонностей у Групповых Навыков и их специализаций (wdbc-fzbu)
// обязана доезжать до ЦЕНЫ, а не оставаться пометкой на листе: ради цены она и
// меняется. Проверяются оба уровня и их приоритет — своя привязка
// специализации сильнее привязки Группы целиком.
//
// Числа: у персонажа со Склонностями [Воля, Знания] Знания (Интеллект +
// Знания) дают одно совпадение — Нейтральная, ранг «Знает» = 200 опыта. Если
// переопределить привязку на [Воля, Знания], совпадений два — Дружественная,
// 100. Если вернуть специализации [Интеллект, Нападение] — ноль совпадений,
// Враждебная, 300.
import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { skillCumCost } from "../../module/sheets/tabs/advance.mjs";
import { GROUP_SKILLS_DEF } from "../../module/constants/skills.mjs";

const actor = (aptitudeBinding, entries) => ({
  system: {
    aptitudes: ["wp", "knowledge"],
    aptitudeBinding,
    groupSkills: { scholasticLore: entries }
  },
  items: []
});

const def = GROUP_SKILLS_DEF.scholasticLore;
const cost = (a, entry) =>
  skillCumCost(a, def, entry.rank, entry.char, "untrained", "scholasticLore", entry.specialty, null, entry.aptitudes);

describe("привязка Склонностей Группового Навыка доезжает до цены", () => {
  it("книжная привязка: одно совпадение — Нейтральная", () => {
    const entry = { specialty: "Тактика", rank: "knows", char: "int" };
    expect(cost(actor(undefined, [entry]), entry)).toBe(200);
  });

  it("переопределение Группы целиком удешевляет специализацию без своей привязки", () => {
    const entry = { specialty: "Тактика", rank: "knows", char: "int" };
    const a = actor({ skill: { scholasticLore: ["wp", "knowledge"] } }, [entry]);
    expect(cost(a, entry)).toBe(100);          // два совпадения — Дружественная
  });

  it("своя привязка специализации сильнее привязки Группы", () => {
    const entry = { specialty: "Тактика", rank: "knows", char: "int", aptitudes: ["int", "offence"] };
    const a = actor({ skill: { scholasticLore: ["wp", "knowledge"] } }, [entry]);
    expect(cost(a, entry)).toBe(300);          // ноль совпадений — Враждебная
  });

  it("соседняя специализация без своей привязки продолжает считаться по Группе", () => {
    const own   = { specialty: "Тактика",    rank: "knows", char: "int", aptitudes: ["int", "offence"] };
    const plain = { specialty: "Геральдика", rank: "knows", char: "int" };
    const a = actor({ skill: { scholasticLore: ["wp", "knowledge"] } }, [own, plain]);

    expect(cost(a, own)).toBe(300);
    expect(cost(a, plain)).toBe(100);
  });
});
