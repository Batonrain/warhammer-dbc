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
    globalThis.game = { ...globalThis.game, settings: { get: () => false } };
    expect(source("homeworld")(actorWith("__test"))).toEqual([]);
  });
});

describe("источник daemonInevitability (Локус Неизбежности, wdbc-smc)", () => {
  const actorWithFlag = value => ({ getFlag: (ns, key) => (key === "inevitabilityPenalty" ? value : undefined) });

  it("флаг не стоит — источник пуст", () => {
    expect(source("daemonInevitability")(actorWithFlag(undefined))).toEqual([]);
  });

  it("флаг стоит — штраф −10 target:all", () => {
    const rules = source("daemonInevitability")(actorWithFlag(true));
    expect(rules).toHaveLength(1);
    expect(rules[0].effects).toEqual([
      { kind: "rollBonus", target: "all", value: -10, label: "Локус Неизбежности: штраф после авто-попадания" }
    ]);
  });
});
