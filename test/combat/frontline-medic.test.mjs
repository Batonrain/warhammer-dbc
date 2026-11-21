// test/combat/frontline-medic.test.mjs
// Фронтовой Медик (Sahara 571-1 / 585-frontline-medic): составное действие — выбор из шести
// по состоянию пациента и снаряжению медика, дальше готовые кнопки с ОД = 0.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  frontlineMedicOptions, frontlineBleedAuto, useFrontlineMedic, hasFrontlineMedic
} from "../../module/combat/frontline-medic.mjs";

const TALENT = { type: "talent", name: "Frontline Medic / Фронтовой Медик" };
const NARTHECIUM = { type: "gear", name: "Narthecium / Нартеций", system: {} };

function makeActor(id, { items = [], conditions = {}, ag = 40 } = {}) {
  const flags = {};
  const list = [...items];
  list.get = k => list.find(i => i.id === k) ?? null;
  const actor = {
    id, uuid: `Actor.${id}`, name: id, items: list,
    system: { characteristics: { ag: { total: ag, bonus: 4 }, t: { total: 40, bonus: 4 } }, fatigue: { value: 0 },
      conditions: { ...conditions }, movement: { charge: 12 } },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        if (path.startsWith("flags.")) continue;
        const parts = path.split(".");
        let t = actor;
        for (const p of parts.slice(0, -1)) t = (t[p] ??= {});
        t[parts.at(-1)] = value;
      }
      return data;
    }
  };
  return actor;
}

const values = opts => opts.map(o => o.value);

beforeEach(resetCaptured);
afterEach(() => { globalThis.game.user = {}; });

describe("frontlineMedicOptions", () => {
  it("по Состояниям пациента: Кровотечение, Горение, Оглушение → переноска", () => {
    const medic = makeActor("Медик", { items: [TALENT] });
    const p = makeActor("Раненый", { conditions: { bleeding: true, burning: true, stunned: true, crippling: true } });
    expect(values(frontlineMedicOptions(medic, p))).toEqual(["bleeding", "burning", "carry"]);
  });

  it("Калечение — только с Нартецием; Химия — только при непустом не-яде", () => {
    const drug = { id: "d1", type: "drug", name: "Стимм", system: { quantity: 1, drugCategory: "medicine" } };
    const poison = { id: "d2", type: "drug", name: "Яд", system: { quantity: 3, drugCategory: "poison" } };
    const medic = makeActor("Медик", { items: [TALENT, NARTHECIUM, drug, poison] });
    const p = makeActor("Раненый", { conditions: { crippling: true } });
    expect(values(frontlineMedicOptions(medic, p))).toEqual(["crippling", "chem"]);
    drug.system.quantity = 0;
    expect(values(frontlineMedicOptions(medic, p))).toEqual(["crippling"]);
  });

  it("Кровотечение без теста: Нартеций или Аптечка Good.Q/Best.Q, обычная — тест", () => {
    expect(frontlineBleedAuto(makeActor("a", { items: [NARTHECIUM] }))).toBe("Нартеций");
    expect(frontlineBleedAuto(makeActor("b", { items: [{ name: "Medkit / Аптечка", system: { quality: "good" } }] }))).toContain("Good.Q");
    expect(frontlineBleedAuto(makeActor("c", { items: [{ name: "Medkit / Аптечка", system: { quality: "common" } }] }))).toBe("");
  });
});

describe("useFrontlineMedic", () => {
  it("без Таланта — отказ", async () => {
    expect(hasFrontlineMedic(makeActor("x"))).toBe(false);
    await useFrontlineMedic(makeActor("x"));
    expect(captured.warnings.join("\n")).toContain("Фронтовой Медик");
  });

  it("единственный вариант — тушение выделенного союзника с A+20", async () => {
    const medic = makeActor("Медик", { items: [TALENT] });
    const p = makeActor("Горящий", { conditions: { burning: true } });
    globalThis.game.user = { targets: new Set([{ actor: p }]) };
    captured.nextRoll = 55; // A 40 + 20 = 60
    const res = await useFrontlineMedic(medic);
    expect(res.eff).toBe(60);
    expect(p.system.conditions.burning).toBe(false);
  });

  it("нет цели — предупреждение", async () => {
    await useFrontlineMedic(makeActor("Медик", { items: [TALENT] }));
    expect(captured.warnings.join("\n")).toContain("Выделите союзника");
  });
});
