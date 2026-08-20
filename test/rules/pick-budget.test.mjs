// test/rules/pick-budget.test.mjs
//
// Бюджет выбора из компендиума — общий счётчик для «7 талантов 1 уровня»,
// «500хр на Психосилы» и «4 магазина болтов». Разница между ними только в том,
// чем меряется одна взятая запись, и проверяется здесь именно это.

import { describe, it, expect } from "vitest";
import {
  normalizeBudget, entryWeight, budgetState, budgetFits, budgetLabel, budgetReady,
  BUDGET_COUNT, BUDGET_XP
} from "../../module/rules/pick-budget.mjs";

const talent = (cost) => ({ name: `Талант ${cost}`, cost });
const COUNT = { mode: BUDGET_COUNT, value: 7 };
const XP    = { mode: BUDGET_XP, value: 500 };

describe("нормализация бюджета", () => {
  // Пустой бюджет — «одна штука», а не «сколько угодно»: безлимитный выбор из
  // компендиума не выдача, а кража.
  it("пустое и битое — одна штука", () => {
    expect(normalizeBudget(undefined)).toEqual({ mode: BUDGET_COUNT, value: 1 });
    expect(normalizeBudget({ mode: "чепуха", value: -3 })).toEqual({ mode: BUDGET_COUNT, value: 1 });
  });

  it("опыт может быть нулевым, штуки — нет", () => {
    expect(normalizeBudget({ mode: BUDGET_XP, value: 0 }).value).toBe(0);
    expect(normalizeBudget({ mode: BUDGET_COUNT, value: 0 }).value).toBe(1);
  });
});

describe("вес одной записи", () => {
  it("в штуках любая запись весит единицу", () => {
    expect(entryWeight(talent(300), COUNT)).toBe(1);
  });

  it("в опыте вес — цена записи", () => {
    expect(entryWeight(talent(300), XP)).toBe(300);
  });

  // Цена зависит от Склонностей получателя, поэтому приходит функцией; своя
  // цена записи компендиума — только запасной вариант.
  it("цена берётся у переданного расчёта, а не у записи", () => {
    expect(entryWeight(talent(300), XP, () => 100)).toBe(100);
  });
});

describe("счётчик", () => {
  it("штуки: готово ровно на нужном числе", () => {
    const six = Array.from({ length: 6 }, () => talent(0));
    expect(budgetReady(six, COUNT)).toBe(false);
    expect(budgetReady([...six, talent(0)], COUNT)).toBe(true);
    expect(budgetState([...six, talent(0)], COUNT).left).toBe(0);
  });

  it("штуки: восьмая не влезает", () => {
    const seven = Array.from({ length: 7 }, () => talent(0));
    expect(budgetFits(seven, talent(0), COUNT)).toBe(false);
  });

  it("опыт: сумма цен, и дороже остатка не взять", () => {
    const taken = [talent(300), talent(150)];
    expect(budgetState(taken, XP).spent).toBe(450);
    expect(budgetFits(taken, talent(50), XP)).toBe(true);
    expect(budgetFits(taken, talent(100), XP)).toBe(false);
  });

  // Потратить 500 в ноль удаётся не всегда — цены разные, и запрещать выбор
  // из-за остатка нельзя. А вот перерасход — это уже чужой опыт.
  it("опыт: недобор подтверждается, перерасход нет", () => {
    expect(budgetReady([talent(450)], XP)).toBe(true);
    expect(budgetReady([], XP)).toBe(false);
    expect(budgetState([talent(600)], XP).over).toBe(true);
    expect(budgetReady([talent(600)], XP)).toBe(false);
  });
});

describe("подпись счётчика", () => {
  it("штуки и опыт читаются по-разному", () => {
    expect(budgetLabel([talent(0), talent(0)], COUNT)).toBe("Выбрано 2 из 7");
    expect(budgetLabel([talent(300)], XP)).toBe("Потрачено 300 из 500 опыта");
  });
});
