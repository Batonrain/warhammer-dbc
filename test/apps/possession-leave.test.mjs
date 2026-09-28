// test/apps/possession-leave.test.mjs
//
// Выход демона из пережившего Одержимость хоста: 3d10 урона КАЖДОЙ
// Характеристике, «восстанавливается в 12 раз медленнее обычного».
//
// Приёмка #527: ветка писала этот урон в ручной «Мод.» system.charDamage —
// мимо единственной точки урона в Характеристики (combat/char-damage.mjs::
// applyCharDamage, #526): без пола 0, без восстановления и без смерти от
// нулевой T. Урон обязан лечь порциями со своим темпом (12 ч за пункт при
// обычном 1 ч, rules/char-loss.mjs).

import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { leavePossessionHost } from "../../module/apps/possession-attack.mjs";
import { POSSESSION_HOST_FLAG } from "../../module/rules/possession-attack.mjs";
import { CHARACTERISTICS } from "../../module/constants/characteristics.mjs";

const NS = "warhammer-dbc";

function setPath(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {});
  cur[keys.at(-1)] = value;
}

function makeHost({ t = 30 } = {}) {
  const flags = { [POSSESSION_HOST_FLAG]: { possessorUuid: "Actor.demon", woundsBonus: 0 } };
  const host = {
    name: "Хост", uuid: "Actor.host", statuses: new Set(), effects: [],
    system: {
      characteristics: Object.fromEntries(Object.keys(CHARACTERISTICS).map(k => [k, { total: k === "t" ? t : 30 }])),
      charLoss: {}, charLossAt: {}, charLossPortions: [],
      wounds: { max: 12, value: 10 }, corruption: { value: 0 }
    },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    deleteEmbeddedDocuments: async () => [],
    async update(data) {
      for (const [k, v] of Object.entries(data)) {
        if (k.startsWith(`flags.${NS}.-=`)) delete flags[k.slice(`flags.${NS}.-=`.length)];
        else if (k.startsWith("system.")) setPath(host, k, v);
      }
    }
  };
  return host;
}

beforeEach(() => {
  resetCaptured();
  captured.nextRoll = 7;
  globalThis.game.time = { worldTime: 1000 };
});

describe("выход демона из хоста — урон Характеристикам по книге", () => {
  it("каждая Характеристика получает порцию урона с темпом 12 ч, ручной «Мод.» не трогается", async () => {
    const host = makeHost();
    globalThis.game.actors = { contents: [host] };

    const r = await leavePossessionHost({ uuid: "Actor.demon", name: "Демон" });

    expect(r.survived).toBe(true);
    expect(host.system.charDamage).toBeUndefined();
    const portions = host.system.charLossPortions;
    expect(portions.map(p => p.key).sort()).toEqual(Object.keys(CHARACTERISTICS).sort());
    for (const p of portions) expect(p).toEqual(expect.objectContaining({ amount: 7, hours: 12 }));
  });

  it("урон не опускает Характеристику ниже 0", async () => {
    const host = makeHost({ t: 5 });
    globalThis.game.actors = { contents: [host] };

    await leavePossessionHost({ uuid: "Actor.demon", name: "Демон" });

    expect(host.system.charLossPortions.find(p => p.key === "t").amount).toBe(5);
  });
});
