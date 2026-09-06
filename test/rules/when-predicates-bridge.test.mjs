// test/rules/when-predicates-bridge.test.mjs
//
// Записи Конструктора умеют спрашивать те же условия, что и правила книги
// (wdbc-n48f).
//
// Было два языка условий об одном и том же: восемь самодельных гейтов
// entry.when (module/rules/mech-when.mjs) и реестр PREDICATES из 25 ключей
// (module/rules/predicates.mjs). Условие, заведённое в реестре, записи
// Конструктора было недоступно, и наоборот — каждое новое условие приходилось
// заводить дважды либо выбирать сторону наугад.
//
// Теперь запись может сослаться на реестр: entry.when.predicates. Восемь
// прежних гейтов никуда не делись — они остаются короткой записью частых
// случаев и продолжают работать как раньше.
//
// ГРАНИЦА ЧЕСТНАЯ И ПРОВЕРЯЕМАЯ: часть предикатов спрашивает не актора, а
// КОНТЕКСТ БРОСКА (цель, оружие, характеристику теста). Запись предмета
// вычисляется и вне броска — при выдаче, в предпросмотре, при пересчёте листа,
// — и контекста там нет. Такие предикаты не разрешены: тихо отвечать «нет» на
// вопрос о несуществующей цели значит выключать механику молча.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";
import { PREDICATES, CTX_DEPENDENT_PREDICATES } from "../../module/rules/predicates.mjs";

const actor = (system = {}) => ({ system: { characteristics: {}, ...system } });

let errors;
beforeEach(() => { errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => errors.mockRestore());

describe("entry.when.predicates — мост к реестру условий", () => {
  it("предикат из реестра работает у записи Конструктора", () => {
    const entry = { when: { predicates: { race: ["astartes"] } } };
    expect(entryWhenOk(actor({ race: "astartes" }), entry)).toBe(true);
    expect(entryWhenOk(actor({ race: "human" }), entry)).toBe(false);
  });

  it("несколько предикатов складываются через И", () => {
    const entry = { when: { predicates: { race: ["astartes"], subrace: ["ultramarines"] } } };
    expect(entryWhenOk(actor({ race: "astartes", subrace: "ultramarines" }), entry)).toBe(true);
    expect(entryWhenOk(actor({ race: "astartes", subrace: "ironhands" }), entry)).toBe(false);
  });

  it("работает вместе со старыми гейтами: они И между собой", () => {
    const entry = { when: { patronGod: ["khorne"], predicates: { race: ["astartes"] } } };
    expect(entryWhenOk(actor({ race: "astartes", patronGod: "khorne" }), entry)).toBe(true);
    expect(entryWhenOk(actor({ race: "human", patronGod: "khorne" }), entry)).toBe(false);
    expect(entryWhenOk(actor({ race: "astartes", patronGod: "nurgle" }), entry)).toBe(false);
  });

  it("и внутри ИЛИ считается одним гейтом наравне с прочими", () => {
    const entry = { when: { patronGod: ["khorne"], predicates: { race: ["astartes"] }, anyOf: true } };
    expect(entryWhenOk(actor({ race: "astartes", patronGod: "nurgle" }), entry)).toBe(true);
    expect(entryWhenOk(actor({ race: "human", patronGod: "khorne" }), entry)).toBe(true);
    expect(entryWhenOk(actor({ race: "human", patronGod: "nurgle" }), entry)).toBe(false);
  });

  it("пустой набор предикатов условием не считается", () => {
    expect(entryWhenOk(actor({ race: "human" }), { when: { predicates: {} } })).toBe(true);
  });

  it("без актора условие считается пройденным — как у прочих гейтов", () => {
    // Предпросмотр записи вне владельца: остальные гейты ведут себя так же.
    expect(entryWhenOk(null, { when: { predicates: { race: ["astartes"] } } })).toBe(true);
  });

  it("неизвестный ключ — ошибка в консоль и отказ, а не тихое «да»", () => {
    expect(entryWhenOk(actor({ race: "astartes" }), { when: { predicates: { раса: ["astartes"] } } })).toBe(false);
    expect(errors).toHaveBeenCalled();
  });

  it("предикат, которому нужен контекст броска, ЗАПРЕЩЁН и говорит об этом", () => {
    // Запись предмета вычисляется и вне броска, цели там нет. Тихо ответить
    // «нет» значит выключить механику молча — ровно то, против чего этап.
    const entry = { when: { predicates: { targetHasTrait: ["Nimble"] } } };
    expect(entryWhenOk(actor({ race: "astartes" }), entry)).toBe(false);
    expect(errors).toHaveBeenCalled();
    expect(String(errors.mock.calls.at(-1)?.[0] ?? "")).toContain("targetHasTrait");
  });
});

describe("список предикатов, зависящих от контекста, не разъезжается с кодом", () => {
  it("каждый предикат, читающий ctx, объявлен зависимым", () => {
    // Иначе появится новый предикат с целью, его разрешат в записи предмета, и
    // он молча начнёт отвечать «нет» — сторож против ровно этого.
    const readsCtx = Object.entries(PREDICATES)
      .filter(([, fn]) => {
        const src = fn.toString();
        return /\bctx\b/.test(src.slice(src.indexOf("=>") + 2));
      })
      .map(([key]) => key);
    const missing = readsCtx.filter(k => !CTX_DEPENDENT_PREDICATES.has(k));
    expect(missing, "эти предикаты читают контекст, но не объявлены зависимыми").toEqual([]);
  });

  it("в списке нет лишних имён", () => {
    const unknown = [...CTX_DEPENDENT_PREDICATES].filter(k => !Object.hasOwn(PREDICATES, k));
    expect(unknown, "этих предикатов нет в реестре — опечатка").toEqual([]);
  });
});
