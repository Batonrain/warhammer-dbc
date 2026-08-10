import { describe, it, expect, afterEach } from "vitest";
import { HOMEWORLD_BY_KEY } from "../../module/constants/homeworlds.mjs";
import { getRuleSources } from "../../module/rules/sources.mjs";

const RULE = { id: "test.homeworld" };

const source = key => getRuleSources().find(([k]) => k === key)[1];
const actorWith = key => ({ system: {}, items: [{ type: "homeworld", system: { key } }] });

afterEach(() => {
  delete globalThis.game;
  delete HOMEWORLD_BY_KEY.__test;
});

describe("источник homeworld", () => {
  it("ключ Происхождения берётся с предмета-носителя", () => {
    HOMEWORLD_BY_KEY.__test = { rules: [RULE] };
    expect(source("homeworld")(actorWith("__test"))).toEqual([RULE]);
  });

  it("Происхождения у актора нет — источник пуст", () => {
    expect(source("homeworld")({ system: {}, items: [] })).toEqual([]);
  });

  // Выключатель подсистемы должен убирать правила из сборки. Иначе повторится
  // течь, найденная на шаге 1.4 плана: галочки Особенностей из диалога исчезали,
  // а расчёт продолжал их учитывать.
  it("подсистема «Происхождения» выключена — источник пуст", () => {
    HOMEWORLD_BY_KEY.__test = { rules: [RULE] };
    globalThis.game = { settings: { get: () => false } };
    expect(source("homeworld")(actorWith("__test"))).toEqual([]);
  });
});
