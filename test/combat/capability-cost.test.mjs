// test/combat/capability-cost.test.mjs
//
// wdbc-1dc8: цена в пуле у записи Конструктора kind:"capability" — кнопка
// «Потратить» на листе списывает Очко(-и) Бесчестия/Судьбы/Боли и постит
// карточку; при пустом пуле гаснет ДО клика (гейт, как wdbc-qjnk), а не
// тостом после. Пул хранится в одном и том же поле актора (fate.value/dp.ip)
// независимо от того, каким термином его назвала конкретная способность —
// см. заголовок module/combat/capability-cost.mjs.

import "../support/foundry-stub.mjs";
import { captured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import {
  CAPABILITY_COST_POOLS, capabilityCostLabel,
  capabilityPoolValue, capabilityPoolMax,
  capabilityCostGate, spendCapabilityCost
} from "../../module/combat/capability-cost.mjs";

function actorFor({ type = "character", ...over } = {}) {
  const doc = {
    id: "actor-1", name: "Подставной", type,
    system: { fate: { value: 2, max: 4 }, characteristics: {}, ...over }
  };
  doc.update = async changes => {
    for (const [path, value] of Object.entries(changes)) {
      const keys = path.split(".");
      let node = doc;
      for (const key of keys.slice(0, -1)) node = (node[key] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  return doc;
}

beforeEach(() => { captured.chat = []; captured.warnings = []; });

describe("capabilityCostLabel", () => {
  it("1 — единственное число, 2-4 — Очка, 5+ — Очков", () => {
    expect(capabilityCostLabel({ pool: "infamy", amount: 1 })).toBe("1 Очко Бесчестия");
    expect(capabilityCostLabel({ pool: "infamy", amount: 2 })).toBe("2 Очка Бесчестия");
    expect(capabilityCostLabel({ pool: "infamy", amount: 5 })).toBe("5 Очков Бесчестия");
    expect(capabilityCostLabel({ pool: "fate", amount: 1 })).toBe("1 Очко Судьбы");
    expect(capabilityCostLabel({ pool: "pain", amount: 1 })).toBe("1 Очко Боли");
  });

  it("без пула — пустая строка (бесплатно)", () => {
    expect(capabilityCostLabel(null)).toBe("");
    expect(capabilityCostLabel({ pool: "" })).toBe("");
  });

  it("три термина зарегистрированы в CAPABILITY_COST_POOLS", () => {
    expect(Object.keys(CAPABILITY_COST_POOLS).sort()).toEqual(["fate", "infamy", "pain"]);
  });
});

describe("capabilityPoolValue / capabilityPoolMax", () => {
  it("обычный актор (Судьба/Бесчестие/Боль) — читает system.fate", () => {
    const actor = actorFor({ fate: { value: 3, max: 5 } });
    expect(capabilityPoolValue(actor)).toBe(3);
    expect(capabilityPoolMax(actor)).toBe(5);
  });

  it("Демон-Принц — читает system.dp.ip, максимум = Inf.b (не fate.max)", () => {
    const actor = actorFor({
      type: "demonPrince",
      dp: { ip: 2 },
      fate: { value: 99, max: 99 },   // не должно читаться для Демон-Принца
      characteristics: { inf: { bonus: 4 } }
    });
    expect(capabilityPoolValue(actor)).toBe(2);
    expect(capabilityPoolMax(actor)).toBe(4);
  });

  it("отрицательные/отсутствующие значения — 0, не NaN", () => {
    const actor = actorFor({ fate: {} });
    expect(capabilityPoolValue(actor)).toBe(0);
    expect(capabilityPoolMax(actor)).toBe(0);
  });
});

describe("capabilityCostGate", () => {
  it("хватает в пуле — не гейтится", () => {
    const actor = actorFor({ fate: { value: 2, max: 4 } });
    expect(capabilityCostGate(actor, { pool: "infamy", amount: 1 })).toEqual({ disabled: false, title: "" });
  });

  it("не хватает — disabled с причиной («нужно X, есть Y»)", () => {
    const actor = actorFor({ fate: { value: 1, max: 4 } });
    const gate = capabilityCostGate(actor, { pool: "infamy", amount: 2 });
    expect(gate.disabled).toBe(true);
    expect(gate.title).toBe("Не хватает: нужно 2 Очка Бесчестия, есть 1");
  });

  it("без цены — всегда {disabled:false}", () => {
    const actor = actorFor({ fate: { value: 0, max: 4 } });
    expect(capabilityCostGate(actor, null)).toEqual({ disabled: false, title: "" });
  });
});

describe("spendCapabilityCost (план теста тикета: пул 2 → клик → 1 + карточка; пул 0 → отказ)", () => {
  it("пул 2, цена 1 — списывает до 1 и постит карточку", async () => {
    const actor = actorFor({ fate: { value: 2, max: 4 } });
    const ok = await spendCapabilityCost(actor, { pool: "infamy", amount: 1 }, "Проверочная способность");
    expect(ok).toBe(true);
    expect(actor.system.fate.value).toBe(1);
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Проверочная способность");
    expect(captured.chat[0].content).toContain("1 Очко Бесчестия");
    expect(captured.chat[0].content).toContain("Осталось: <b>1</b> / 4");
  });

  it("пул 0 — отказ, ничего не списывает и не постит карточку", async () => {
    const actor = actorFor({ fate: { value: 0, max: 4 } });
    const ok = await spendCapabilityCost(actor, { pool: "infamy", amount: 1 }, "Проверочная способность");
    expect(ok).toBe(false);
    expect(actor.system.fate.value).toBe(0);
    expect(captured.chat).toHaveLength(0);
    expect(captured.warnings).toHaveLength(1);
  });

  it("Демон-Принц — списывает dp.ip, не fate.value", async () => {
    const actor = actorFor({
      type: "demonPrince",
      dp: { ip: 2 },
      fate: { value: 99, max: 99 },
      characteristics: { inf: { bonus: 4 } }
    });
    const ok = await spendCapabilityCost(actor, { pool: "infamy", amount: 1 }, "Дар");
    expect(ok).toBe(true);
    expect(actor.system.dp.ip).toBe(1);
    expect(actor.system.fate.value).toBe(99);   // не тронуто
  });

  it("без цены (cost.pool пуст) — no-op, всегда true, ничего не постит", async () => {
    const actor = actorFor({ fate: { value: 0, max: 4 } });
    const ok = await spendCapabilityCost(actor, null, "Бесплатная способность");
    expect(ok).toBe(true);
    expect(captured.chat).toHaveLength(0);
  });
});
