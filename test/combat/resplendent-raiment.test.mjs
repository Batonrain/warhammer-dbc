// test/combat/resplendent-raiment.test.mjs
//
// module/combat/resplendent-raiment.mjs (wdbc-sk8s) — Resplendent Raiment/
// Блистательные Одеяния: раз за бой/сцену + Бесчестие, W−30 всем на сцене
// кроме исключённых, провал ставит информационный флаг.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { hasResplendentRaiment, resplendentUnit, resplendentRaimentAvailable, applyResplendentRaiment }
  from "../../module/combat/resplendent-raiment.mjs";

function champion({ hasGift = true, fate = 2 } = {}) {
  const flags = {};
  const data = {
    name: "Чемпион", uuid: "Actor.champion",
    items: hasGift ? [{ type: "mutation", name: "Resplendent Raiment / Блистательные Одеяния" }] : [],
    system: { fate: { value: fate, max: 5 } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
  data.update = async patch => {
    if (patch["system.fate.value"] !== undefined) data.system.fate.value = patch["system.fate.value"];
  };
  return data;
}

function bystander(id, wpTotal = 40) {
  const flags = {};
  const data = {
    name: `Свидетель-${id}`,
    system: { characteristics: { wp: { total: wpTotal } } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
  return data;
}

function token(id, actor) { return { id, actor }; }

afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("hasResplendentRaiment", () => {
  it("определяет владение Даром (kind:mutation)", () => {
    expect(hasResplendentRaiment(champion({ hasGift: true }))).toBe(true);
    expect(hasResplendentRaiment(champion({ hasGift: false }))).toBe(false);
  });
});

describe("resplendentUnit", () => {
  it("в бою — battle, вне боя — scene", () => {
    globalThis.game.combat = { started: true };
    expect(resplendentUnit()).toBe("battle");
    globalThis.game.combat = { started: false };
    expect(resplendentUnit()).toBe("scene");
    globalThis.game.combat = undefined;
    expect(resplendentUnit()).toBe("scene");
  });
});

describe("resplendentRaimentAvailable / applyResplendentRaiment", () => {
  it("раз за сцену вне боя", async () => {
    const c = champion();
    const b1 = bystander("b1");
    const cToken = token("c1", c);
    cToken.parent = { tokens: { contents: [cToken, token("t1", b1)] } };

    expect(resplendentRaimentAvailable(c)).toBe(true);
    captured.nextRoll = 90;
    await applyResplendentRaiment(c, cToken);
    expect(resplendentRaimentAvailable(c)).toBe(false);
  });

  it("тратит 1 Очко Бесчестия", async () => {
    const c = champion({ fate: 2 });
    const cToken = token("c1", c);
    cToken.parent = { tokens: { contents: [cToken] } };
    await applyResplendentRaiment(c, cToken);
    expect(c.system.fate.value).toBe(1);
  });

  it("провал теста ставит флаг seesOnlyCaster, успех — нет", async () => {
    const c = champion();
    const failer = bystander("f", 40); // порог 10
    const succeeder = bystander("s", 90); // порог 60
    const cToken = token("c1", c);
    cToken.parent = { tokens: { contents: [cToken, token("t1", failer), token("t2", succeeder)] } };

    captured.dice = [50, 10]; // failer: 50>10 провал; succeeder: 10<=60 успех
    await applyResplendentRaiment(c, cToken);

    expect(failer.getFlag("warhammer-dbc", "seesOnlyCaster")).toEqual({ casterUuid: c.uuid });
    expect(succeeder.getFlag("warhammer-dbc", "seesOnlyCaster")).toBeUndefined();
  });

  it("исключённые (excludedIds) не проходят тест вовсе", async () => {
    const c = champion();
    const excluded = bystander("ex");
    const cToken = token("c1", c);
    cToken.parent = { tokens: { contents: [cToken, token("t1", excluded)] } };

    await applyResplendentRaiment(c, cToken, new Set(["t1"]));
    expect(excluded.getFlag("warhammer-dbc", "seesOnlyCaster")).toBeUndefined();
  });

  it("сам кастер не проходит тест против себя", async () => {
    const c = champion();
    const cToken = token("c1", c);
    cToken.parent = { tokens: { contents: [cToken] } };
    await applyResplendentRaiment(c, cToken);
    expect(captured.chat[0].content).toContain("Больше никого на сцене");
  });
});
