// test/apps/hyper-growth.test.mjs
//
// wdbc-utaw: обвязка боеприпаса «Гиперрост» — тик яда Toxic от ИМЕННО этого
// боеприпаса даёт цели столько же аблативных Ран (флаг hyperGrowthAblative +
// ablativeMax), и ресинк доли при поглощении боевого урона. Арифметика —
// rules/hyper-growth.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { applyHyperGrowthTick, reconcileHyperGrowthToFit } from "../../module/apps/hyper-growth.mjs";

function fakeActor({ ablative = 0, ablativeMax = 0, flags = {} } = {}) {
  const actor = {
    uuid: "Actor.target", name: "Цель",
    system: { wounds: { ablative, ablativeMax } },
    flags: { "warhammer-dbc": { ...flags } },
    getFlag(ns, key) { return this.flags?.[ns]?.[key]; },
    async update(data) {
      for (const [path, v] of Object.entries(data)) {
        const parts = path.split(".");
        let obj = actor;
        for (let i = 0; i < parts.length - 1; i++) obj = (obj[parts[i]] ??= {});
        obj[parts.at(-1)] = v;
      }
    }
  };
  return actor;
}

describe("applyHyperGrowthTick", () => {
  it("боеприпас Гиперрост, урон 6 — цель получает +6 аблатива, флаг записан, заметка в HTML", async () => {
    const target = fakeActor();
    const note = await applyHyperGrowthTick(target, { ammoName: "Гиперрост", dmg: 6 });
    expect(target.system.wounds.ablative).toBe(6);
    expect(target.system.wounds.ablativeMax).toBe(6);
    expect(target.getFlag("warhammer-dbc", "hyperGrowthAblative")).toBe(6);
    expect(note).toContain("Гиперрост");
    expect(note).toContain("+6");
  });

  it("второй тик складывается с первым", async () => {
    const target = fakeActor({ ablative: 6, ablativeMax: 6, flags: { hyperGrowthAblative: 6 } });
    await applyHyperGrowthTick(target, { ammoName: "Гиперрост", dmg: 4 });
    expect(target.system.wounds.ablative).toBe(10);
    expect(target.getFlag("warhammer-dbc", "hyperGrowthAblative")).toBe(10);
  });

  // Мутационная проверка привязки к конкретному патрону (wdbc-utaw, шаг 5):
  // сломай сравнение имени на «любой toxic-боеприпас» — этот тест обязан
  // упасть, потому что сейчас он ловит именно НЕ-Гиперрост и требует no-op.
  it("тот же тик яда, но от ДРУГОГО boeприпаса (не Гиперрост) — ничего не меняет", async () => {
    const target = fakeActor();
    const note = await applyHyperGrowthTick(target, { ammoName: "Дум-дум", dmg: 6 });
    expect(target.system.wounds.ablative).toBe(0);
    expect(target.getFlag("warhammer-dbc", "hyperGrowthAblative")).toBeUndefined();
    expect(note).toBe("");
  });

  it("Toxic без dmgFormula/урона (dmg 0) — не создаёт вклад", async () => {
    const target = fakeActor();
    const note = await applyHyperGrowthTick(target, { ammoName: "Гиперрост", dmg: 0 });
    expect(target.system.wounds.ablative).toBe(0);
    expect(note).toBe("");
  });

  it("нет актора — не падает, пусто", async () => {
    expect(await applyHyperGrowthTick(null, { ammoName: "Гиперрост", dmg: 6 })).toBe("");
  });
});

describe("reconcileHyperGrowthToFit", () => {
  it("пул просел ниже доли (поглощение боевого урона) — доля и ablativeMax сжимаются", async () => {
    const target = fakeActor({ ablative: 4, ablativeMax: 10, flags: { hyperGrowthAblative: 8 } });
    await reconcileHyperGrowthToFit(target);
    expect(target.system.wounds.ablativeMax).toBe(6);
    expect(target.getFlag("warhammer-dbc", "hyperGrowthAblative")).toBe(4);
  });

  it("пул не просел — не трогает ничего", async () => {
    const target = fakeActor({ ablative: 8, ablativeMax: 8, flags: { hyperGrowthAblative: 8 } });
    await reconcileHyperGrowthToFit(target);
    expect(target.system.wounds.ablativeMax).toBe(8);
  });

  it("своего вклада не было — не трогает ничего", async () => {
    const target = fakeActor({ ablative: 4, ablativeMax: 10 });
    await reconcileHyperGrowthToFit(target);
    expect(target.system.wounds.ablativeMax).toBe(10);
  });
});
