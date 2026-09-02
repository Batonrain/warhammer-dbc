// test/rules/conditions.test.mjs
//
// Condition — момент срабатывания блока (doombc-req-condition-effect-plan).
// Чистая логика: conditionMatches сравнивает запись блока с уже случившимся
// событием, ничего сам не опрашивает и ни на что не подписывается.

import { describe, it, expect } from "vitest";
import {
  CONDITION_KINDS, conditionSupport, blankCondition, describeCondition, conditionMatches
} from "../../module/rules/conditions.mjs";

describe("реестр видов", () => {
  it("у каждого вида есть support: ready или missing", () => {
    for (const k of CONDITION_KINDS) expect(["ready", "missing"]).toContain(k.support);
  });

  it("onAttach — единственный вид без готовой опоры в коде", () => {
    expect(conditionSupport("onAttach")).toBe("missing");
    expect(conditionSupport("onGrant")).toBe("ready");
    expect(conditionSupport("onWoundsLoss")).toBe("ready");
  });

  it("неизвестный вид считается missing", () => {
    expect(conditionSupport("нетТакого")).toBe("missing");
  });
});

describe("blankCondition", () => {
  it("незнакомый kind откатывается на onGrant", () => {
    expect(blankCondition("чепуха").kind).toBe("onGrant");
  });

  it("несёт дефолты под все уточняемые виды сразу", () => {
    const c = blankCondition("onTestResult");
    expect(c.outcome).toBe("success");
    expect(c.activateTo).toBe("active");
    expect(c.squadRole).toBe("any");
  });
});

describe("conditionMatches — без уточнений", () => {
  it("onGrant/onRemove совпадают только по kind", () => {
    expect(conditionMatches({ kind: "onGrant" }, { kind: "onGrant" })).toBe(true);
    expect(conditionMatches({ kind: "onGrant" }, { kind: "onRemove" })).toBe(false);
  });

  it("нет condition или нет event — не совпадает", () => {
    expect(conditionMatches(null, { kind: "onGrant" })).toBe(false);
    expect(conditionMatches({ kind: "onGrant" }, null)).toBe(false);
  });
});

describe("conditionMatches — onTestResult", () => {
  it("сверяет outcome, не только kind", () => {
    const win = { kind: "onTestResult", outcome: "success" };
    expect(conditionMatches(win, { kind: "onTestResult", outcome: "success" })).toBe(true);
    expect(conditionMatches(win, { kind: "onTestResult", outcome: "fail" })).toBe(false);
  });
});

describe("conditionMatches — onActivate", () => {
  it("сверяет направление вкл/выкл", () => {
    const on = { kind: "onActivate", activateTo: "active" };
    expect(conditionMatches(on, { kind: "onActivate", active: true })).toBe(true);
    expect(conditionMatches(on, { kind: "onActivate", active: false })).toBe(false);
  });
});

describe("conditionMatches — onSquadRole", () => {
  it("\"any\" подходит любой роли, конкретная роль — только себе", () => {
    const any = { kind: "onSquadRole", squadRole: "any" };
    expect(conditionMatches(any, { kind: "onSquadRole", squadRole: "leader" })).toBe(true);
    expect(conditionMatches(any, { kind: "onSquadRole", squadRole: "subordinate" })).toBe(true);

    const leader = { kind: "onSquadRole", squadRole: "leader" };
    expect(conditionMatches(leader, { kind: "onSquadRole", squadRole: "leader" })).toBe(true);
    expect(conditionMatches(leader, { kind: "onSquadRole", squadRole: "subordinate" })).toBe(false);
  });
});

describe("conditionMatches — onAttach", () => {
  it("сверяет установлен/снят", () => {
    const attached = { kind: "onAttach", attachTo: "attached" };
    expect(conditionMatches(attached, { kind: "onAttach", attached: true })).toBe(true);
    expect(conditionMatches(attached, { kind: "onAttach", attached: false })).toBe(false);
  });
});

describe("describeCondition", () => {
  it("даёт читаемую подпись для каждого уточняемого вида", () => {
    expect(describeCondition({ kind: "onGrant" })).toBe("При получении предмета");
    expect(describeCondition({ kind: "onTestResult", outcome: "fail" })).toMatch(/провал/);
    expect(describeCondition({ kind: "onActivate", activateTo: "inactive" })).toMatch(/выключена/);
    expect(describeCondition({ kind: "onSquadRole", squadRole: "leader" })).toMatch(/Лидер/);
    expect(describeCondition({ kind: "onAttach", attachTo: "detached" })).toMatch(/снят/);
  });

  it("неизвестный kind — прочерк, не падает", () => {
    expect(describeCondition({ kind: "чепуха" })).toBe("?");
  });
});
