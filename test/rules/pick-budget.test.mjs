// test/rules/pick-budget.test.mjs
//
// Бюджет выбора из компендиума — общий счётчик для «7 талантов 1 уровня»,
// «500хр на Психосилы» и «4 магазина болтов». Разница между ними только в том,
// чем меряется одна взятая запись, и проверяется здесь именно это.

import { describe, it, expect } from "vitest";
import {
  normalizeBudget, entryWeight, budgetState, budgetFits, budgetLabel, budgetReady,
  BUDGET_COUNT, BUDGET_XP, BUDGET_AVAILABILITY
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

// Сплайс, Gene-Splice: «максимум +3 дополнительные адаптации» — ноль тоже
// законный выбор. Нижняя граница `min` (штуками): «до N», а не «ровно N».
describe("штуки «до N» (min)", () => {
  const UP_TO_3 = { mode: "count", value: 3, min: 0 };
  it("подтверждается и пустой выбор, и неполный", () => {
    expect(budgetReady([], UP_TO_3)).toBe(true);
    expect(budgetReady([talent(0)], UP_TO_3)).toBe(true);
    expect(budgetReady([talent(0), talent(0), talent(0)], UP_TO_3)).toBe(true);
  });
  it("перебор по-прежнему не влезает", () => {
    expect(budgetFits([talent(0), talent(0), talent(0)], talent(0), UP_TO_3)).toBe(false);
  });
  it("без min — по-прежнему ровно N", () => {
    expect(budgetReady([talent(0)], { mode: "count", value: 3 })).toBe(false);
  });
  it("подпись говорит «до»", () => {
    expect(budgetLabel([talent(0)], UP_TO_3)).toBe("Выбрано 1 из (до) 3");
  });
});

// wdbc-zaesd (23.10.2026): «Записи Ритуалов на суммарную Редкость 11, но не выше
// R3 каждый» (Демонолог; Певец Камня, Фарсиер) — бюджет считается СУММОЙ Редкости
// взятых записей, а не штуками и не опытом. Редкость Записи ритуала — это
// system.record Ритуала (core.json, «Анатомия ритуала»: «X в Записи отображает
// Редкость ритуала аналогична Редкости снаряжения»); в узле Обозревателя она
// лежит в поле availability.
describe("сумма Редкости (availability)", () => {
  const rec = (availability) => ({ name: `Запись R${availability}`, availability });
  const SUM11 = { mode: BUDGET_AVAILABILITY, value: 11 };

  it("режим не схлопывается в штуки", () => {
    expect(normalizeBudget(SUM11)).toEqual({ mode: BUDGET_AVAILABILITY, value: 11 });
  });

  it("вес записи — её Редкость; нет Редкости — ноль", () => {
    expect(entryWeight(rec(3), SUM11)).toBe(3);
    expect(entryWeight({ name: "без поля" }, SUM11)).toBe(0);
    expect(entryWeight({ availability: null }, SUM11)).toBe(0);
    // Отрицательная Редкость снаряжения («Повсеместно») не увеличивает остаток.
    expect(entryWeight(rec(-2), SUM11)).toBe(0);
  });

  it("цена в опыте на этот режим не влияет", () => {
    expect(entryWeight({ availability: 2, cost: 999 }, SUM11, () => 777)).toBe(2);
  });

  it("сумма считается по Редкости, остаток не уходит ниже нуля незаметно", () => {
    const taken = [rec(3), rec(3), rec(3)];
    expect(budgetState(taken, SUM11)).toMatchObject({ spent: 9, left: 2, over: false, done: false });
    expect(budgetFits(taken, rec(2), SUM11)).toBe(true);
    expect(budgetFits(taken, rec(3), SUM11)).toBe(false);
  });

  // Как с опытом: набрать ровно 11 удаётся не всегда (записи R1..R3), поэтому
  // недобор подтверждается, а перерасход — нет; пустой выбор не подтверждается.
  it("недобор подтверждается, перерасход и пустой выбор нет", () => {
    expect(budgetReady([rec(3), rec(3), rec(3)], SUM11)).toBe(true);
    expect(budgetReady([], SUM11)).toBe(false);
    expect(budgetReady([rec(3), rec(3), rec(3), rec(3)], SUM11)).toBe(false);
    expect(budgetReady([rec(3), rec(3), rec(3), rec(2)], SUM11)).toBe(true);
  });

  it("подпись говорит про Редкость", () => {
    expect(budgetLabel([rec(3), rec(2)], SUM11)).toBe("Сумма Редкости 5 из 11");
  });

  it("ноль в бюджете Редкости — не «одна штука»", () => {
    expect(normalizeBudget({ mode: BUDGET_AVAILABILITY, value: 0 }).value).toBe(0);
  });
});
