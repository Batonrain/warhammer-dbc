// test/rules/temp-infamy.test.mjs
//
// module/rules/temp-infamy.mjs (wdbc-sk8s) — ограниченная валюта отдельно
// от system.fate, для Voice of God/Глас Божий и подобных находок.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { tempInfamyAmount, tempInfamyInfo, grantTempInfamy, spendTempInfamy, clearTempInfamy }
  from "../../module/rules/temp-infamy.mjs";

function actor() {
  const flags = {};
  return {
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; }
  };
}

describe("tempInfamyAmount / grantTempInfamy", () => {
  it("нет флага — 0", () => {
    expect(tempInfamyAmount(actor())).toBe(0);
  });

  it("начисление складывается с уже имеющимся", async () => {
    const a = actor();
    await grantTempInfamy(a, 1, { source: "Voice of God", restriction: "reroll-this-command" });
    await grantTempInfamy(a, 2, { source: "Voice of God" });
    expect(tempInfamyAmount(a)).toBe(3);
  });

  it("0/отрицательное начисление — ничего не пишет", async () => {
    const a = actor();
    await grantTempInfamy(a, 0);
    await grantTempInfamy(a, -1);
    expect(tempInfamyAmount(a)).toBe(0);
  });
});

describe("tempInfamyInfo", () => {
  it("возвращает метку источника/ограничения — не проверяет её", async () => {
    const a = actor();
    await grantTempInfamy(a, 2, { source: "Voice of God", restriction: "reroll-this-command" });
    expect(tempInfamyInfo(a)).toEqual({ amount: 2, source: "Voice of God", restriction: "reroll-this-command" });
  });
  it("нет флага — null", () => {
    expect(tempInfamyInfo(actor())).toBeNull();
  });
});

describe("spendTempInfamy", () => {
  it("тратит при достатке, снимает флаг при обнулении", async () => {
    const a = actor();
    await grantTempInfamy(a, 2);
    expect(await spendTempInfamy(a, 1)).toBe(true);
    expect(tempInfamyAmount(a)).toBe(1);
    expect(await spendTempInfamy(a, 1)).toBe(true);
    expect(tempInfamyAmount(a)).toBe(0);
    expect(tempInfamyInfo(a)).toBeNull();
  });

  it("не хватает — false, ничего не меняет", async () => {
    const a = actor();
    await grantTempInfamy(a, 1);
    expect(await spendTempInfamy(a, 5)).toBe(false);
    expect(tempInfamyAmount(a)).toBe(1);
  });
});

describe("clearTempInfamy", () => {
  it("обнуляет запас по внешнему триггеру (конец Команды/Хода)", async () => {
    const a = actor();
    await grantTempInfamy(a, 3);
    await clearTempInfamy(a);
    expect(tempInfamyAmount(a)).toBe(0);
  });
});
