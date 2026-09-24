// test/combat/extinguish.test.mjs
//
// wdbc-x1nz.2.93 (книга, «Огонь»): «Персонаж может потушить себя за
// полудействие, упав на землю и покатавшись, тестом на А–20… Другие
// персонажи в контакте с горящим могут потушить его полудействием и тестом
// А+0, но при Критическом Провале они сами Загораются.» Раньше тушения не
// было вовсе — только крестик ГМа на теге.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { extinguishBurning, extinguishBookMod } from "../../module/combat/extinguish.mjs";

function makeActor(id, { ag = 40, conditions = {} } = {}) {
  const flags = {};
  const actor = {
    id, name: id, items: [],
    system: { characteristics: { ag: { total: ag, bonus: 4 }, t: { total: 40, bonus: 4 } }, fatigue: { value: 0 }, conditions: { ...conditions } },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^flags\.warhammer-dbc\.(-=)?(.+)$/);
        if (m) { if (m[1]) delete flags[m[2]]; else flags[m[2]] = value; continue; }
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

beforeEach(resetCaptured);

describe("extinguishBurning", () => {
  it("модификатор книги: себя −20, другого +0", () => {
    expect(extinguishBookMod(true)).toBe(-20);
    expect(extinguishBookMod(false)).toBe(0);
  });

  it("себя: Ag−20, успех гасит пламя и формулу источника; упал — Повален", async () => {
    const a = makeActor("Горящий", { conditions: { burning: true } });
    await a.setFlag("warhammer-dbc", "burningDamageFormula", "2d10");
    captured.nextRoll = 15; // 40−20 = 20
    const res = await extinguishBurning(a);

    expect(res.success).toBe(true);
    expect(res.eff).toBe(20);
    expect(a.system.conditions.burning).toBe(false);
    expect(a.getFlag("warhammer-dbc", "burningDamageFormula")).toBeUndefined();
    expect(a.system.conditions.prone).toBe(true);
  });

  it("себя, провал — всё ещё горит, но уже лежит", async () => {
    const a = makeActor("Горящий", { conditions: { burning: true } });
    captured.nextRoll = 30; // > 20
    const res = await extinguishBurning(a);
    expect(res.success).toBe(false);
    expect(a.system.conditions.burning).toBe(true);
    expect(a.system.conditions.prone).toBe(true);
  });

  it("другого: Ag+0, помогающий не ложится", async () => {
    const helper = makeActor("Товарищ");
    const victim = makeActor("Горящий", { conditions: { burning: true } });
    captured.nextRoll = 35; // ≤ 40
    const res = await extinguishBurning(helper, victim);
    expect(res.eff).toBe(40);
    expect(victim.system.conditions.burning).toBe(false);
    expect(helper.system.conditions.prone).toBeUndefined();
  });

  it("другого, Критический Провал — помогающий сам Загорается", async () => {
    const helper = makeActor("Товарищ");
    const victim = makeActor("Горящий", { conditions: { burning: true } });
    captured.nextRoll = 98;
    const res = await extinguishBurning(helper, victim);
    expect(res.critFail).toBe(true);
    expect(victim.system.conditions.burning).toBe(true);
    expect(helper.system.conditions.burning).toBe(true);
    expect(captured.chat[0].content).toContain("Загорается");
  });

  it("обычный провал другого — помогающий не загорается", async () => {
    const helper = makeActor("Товарищ");
    const victim = makeActor("Горящий", { conditions: { burning: true } });
    captured.nextRoll = 70;
    await extinguishBurning(helper, victim);
    expect(helper.system.conditions.burning).toBeUndefined();
  });

  it("не горит — предупреждение, без броска", async () => {
    const a = makeActor("Сухой");
    expect(await extinguishBurning(a)).toBeNull();
    expect(captured.rolls).toHaveLength(0);
  });
});
