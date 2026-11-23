// test/combat/medic-chemistry-buttons.test.mjs
// Кнопки Талантов Медика поверх химии (combat/medic-chemistry.mjs): траты — после проверок,
// запас — только если запись на цель ушла, Плацебо — Deceive(I).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { makeAntivenom, giveAntivenom, usePlacebo } from "../../module/combat/medic-chemistry.mjs";
import { spendInfamyPoint } from "../../module/combat/noise-marine.mjs";

// Оплата Очка — настоящая, но в одном тесте её можно «закрыть», как окно «Чем заплатить?».
vi.mock("../../module/combat/noise-marine.mjs", async orig => {
  const m = await orig();
  return { ...m, spendInfamyPoint: vi.fn(m.spendInfamyPoint) };
});

const NS = "warhammer-dbc";

function makeActor(id, { items = [], fate = 0, flags = {}, owner = true, chars = {}, skills = {} } = {}) {
  const actor = {
    id, uuid: `Actor.${id}`, name: id, type: "character", isOwner: owner, items,
    flags: { [NS]: { ...flags } },
    system: { fate: { value: fate }, characteristics: chars, skills },
    getFlag: (_s, k) => actor.flags[NS][k],
    setFlag: async (_s, k, v) => { actor.flags[NS][k] = v; },
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let t = actor;
        for (const p of parts.slice(0, -1)) t = (t[p] ??= {});
        const last = parts.at(-1);
        if (last.startsWith("-=")) delete t[last.slice(2)]; else t[last] = value;
      }
      return data;
    }
  };
  return actor;
}

const item = (name, extra = {}) => {
  const it = { id: name, name, type: "drug", system: { quantity: 3 }, ...extra };
  it.update = async d => { it.system.quantity = d["system.quantity"]; };
  return it;
};

beforeEach(resetCaptured);
afterEach(() => { globalThis.game.user = {}; globalThis.game.users = []; });

describe("Противоядие", () => {
  it("без Очка Бесчестия Детокс не списывается", async () => {
    const detox = item("Detox / Детокс");
    const poison = { name: "Чёрная Смерть", type: "drug", system: { drugCategory: "poison" } };
    const medic = makeActor("Медик", { items: [{ type: "talent", name: "Antivenom / Противоядие" }, poison, detox], fate: 0 });
    await makeAntivenom(medic);
    expect(detox.system.quantity).toBe(3);
    expect(captured.warnings.join("\n")).toContain("Бесчестия");
  });

  it("окно оплаты Очка закрыто — Детокс не списывается", async () => {
    const detox = item("Detox / Детокс");
    const poison = { name: "Чёрная Смерть", type: "drug", system: { drugCategory: "poison" } };
    const medic = makeActor("Медик", { items: [{ type: "talent", name: "Antivenom / Противоядие" }, poison, detox], fate: 1 });
    spendInfamyPoint.mockResolvedValueOnce(false);
    await makeAntivenom(medic);
    expect(detox.system.quantity).toBe(3);
  });

  it("ввести чужому без ГМа — доза остаётся в запасе", async () => {
    const medic = makeActor("Медик", {
      items: [{ type: "talent", name: "Antivenom / Противоядие" }],
      flags: { medicStock: { antivenom: { Яд: 2 } } }
    });
    const target = makeActor("Чужой", { owner: false });
    globalThis.game.user = { targets: new Set([{ actor: target }]) };
    await giveAntivenom(medic);
    expect(medic.flags[NS].medicStock.antivenom.Яд).toBe(2);
  });
});

describe("Плацебо", () => {
  it("Deceive от Интеллекта: Порог Обмана — I + Ранг", async () => {
    const medic = makeActor("Медик", {
      items: [{ type: "talent", name: "Placebo / Плацебо" }],
      chars: { int: { total: 50 }, fel: { total: 20 } },
      skills: { deceive: { rank: "knows", total: 20 }, medicae: { rank: "knows", total: 50 } }
    });
    const target = makeActor("Пациент");
    globalThis.game.user = { targets: new Set([{ actor: target }]) };
    captured.nextRoll = 99;
    await usePlacebo(medic);
    const html = captured.chat.map(c => c.content ?? "").join("\n");
    expect(html).toContain("Deceive(I) 50");
  });
});
