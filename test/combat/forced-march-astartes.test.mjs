// test/combat/forced-march-astartes.test.mjs
//
// Форсированный марш (стр. 29): «Космодесантники, в силу своей физиологии,
// не имеют этого ограничения и могут маршировать сутки напролёт без
// каких-либо негативных последствий.» wdbc-x1nz.2 — раньше не проверялось.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _resolveMarchHour } from "../../module/combat/movement-actions.mjs";

function actor({ race = "human", fatigue = 0 } = {}) {
  const flags = {};
  const a = {
    name: "Подставной", items: [], system: { race, fatigue: { value: fatigue, max: 0 } },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async (data) => {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".");
        let target = a;
        for (const key of keys.slice(0, -1)) target = (target[key] ??= {});
        target[keys.at(-1)] = value;
      }
    }
  };
  return a;
}

const FORCED_DEF = { label: "Форсированный марш" };

beforeEach(resetCaptured);

describe("_resolveMarchHour: Форсированный марш — Астартес освобождён (стр. 29)", () => {
  it("Астартес — карточка без теста, Усталость не растёт", async () => {
    const a = actor({ race: "astartes", fatigue: 0 });
    captured.nextRoll = 99; // если бы тест всё же бросался — гарантированный провал
    await _resolveMarchHour(a, FORCED_DEF, 40, true);
    expect(a.system.fatigue.value).toBe(0);
    expect(captured.rolls.length).toBe(0);
    expect(captured.chat.at(-1).content).toContain("Космодесантник");
  });

  it("человек — тест бросается как обычно (провал даёт Усталость)", async () => {
    const a = actor({ race: "human", fatigue: 0 });
    captured.nextRoll = 99;
    await _resolveMarchHour(a, FORCED_DEF, 40, true);
    expect(a.system.fatigue.value).toBe(1);
  });

  it("Астартес НЕ на форсированном марше (slow:false — Ускоренный марш/Бег) — тест как обычно", async () => {
    // Освобождение книга даёт только от Форсированного марша (после 8ч),
    // не от Ускоренного марша/Бега — те гейтятся отдельным параметром slow.
    const a = actor({ race: "astartes", fatigue: 0 });
    captured.nextRoll = 99;
    await _resolveMarchHour(a, { label: "Ускоренный марш" }, 40, false);
    expect(a.system.fatigue.value).toBe(1);
  });
});
