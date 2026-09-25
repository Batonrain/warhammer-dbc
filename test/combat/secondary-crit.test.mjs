// test/combat/secondary-crit.test.mjs
//
// «Раны» (wdbc-x1nz.2.85): при КАЖДОМ получении Отрицательных Ран —
// Критический Эффект по итоговому числу, месту и виду урона, не только от
// удара оружием. Блок тот же, что у основного пути урона.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { secondaryCritHtml } from "../../module/combat/secondary-crit.mjs";
import { getCriticalEffect } from "../../critical-tables.mjs";

const actor = { uuid: "Actor.a", items: [], system: {}, getFlag: () => undefined, async setFlag() {} };

describe("secondaryCritHtml", () => {
  it("ушёл в минус — строка таблицы по виду урона и месту", async () => {
    const html = await secondaryCritHtml(actor, { gotCritical: true, newCritical: 2 }, { damageType: "energy", hitLocation: "Торс" });
    expect(html).toContain("Критический урон");
    expect(html).toContain(getCriticalEffect("energy", "Торс", 2));
  });

  it("вид урона решает таблицу — яд идёт по Химической", async () => {
    const html = await secondaryCritHtml(actor, { gotCritical: true, newCritical: 3 }, { damageType: "chemical", hitLocation: "Л. Рука" });
    expect(html).toContain(getCriticalEffect("chemical", "Л. Рука", 3));
  });

  it("минуса не прибавилось — пусто", async () => {
    expect(await secondaryCritHtml(actor, { gotCritical: false, newCritical: 0 }, { damageType: "energy" })).toBe("");
  });
});
