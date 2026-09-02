// test/combat/snapshot.test.mjs
//
// Snapshot / Выстрел Навскидку (wdbc-1rno, dodge.core.snapshot): «не больше
// полудвижения в свой Ход» → +1 ОД в конце Хода. module/combat/snapshot.mjs.

import { describe, it, expect } from "vitest";
import { hasSnapshot, processSnapshotTurnEnd } from "../../module/combat/snapshot.mjs";

function actorWith({ names = [], degree = undefined, ap = 2, type = "character" } = {}) {
  const flags = { "warhammer-dbc.moveDegreeThisTurn": degree };
  const a = {
    type,
    items: names.map(name => ({ type: "talent", name })),
    system: { actionPoints: { value: ap, max: 2 } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    update: async data => {
      if (data["system.actionPoints.value"] !== undefined) a.system.actionPoints.value = data["system.actionPoints.value"];
    }
  };
  return a;
}

describe("hasSnapshot", () => {
  it("находит Талант по билингвальному имени", () => {
    expect(hasSnapshot(actorWith({ names: ["Snapshot / Выстрел Навскидку"] }))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasSnapshot(actorWith({ names: ["Dodge"] }))).toBe(false);
  });
});

describe("processSnapshotTurnEnd", () => {
  it("не двигался вовсе — +1 ОД", async () => {
    const actor = actorWith({ names: ["Snapshot / Выстрел Навскидку"], degree: undefined, ap: 1 });
    await processSnapshotTurnEnd(actor);
    expect(actor.system.actionPoints.value).toBe(2);
  });

  it("только Полудвижение (degree=half) — +1 ОД", async () => {
    const actor = actorWith({ names: ["Snapshot / Выстрел Навскидку"], degree: "half", ap: 1 });
    await processSnapshotTurnEnd(actor);
    expect(actor.system.actionPoints.value).toBe(2);
  });

  it("Полное Движение/Бег/Натиск (degree=full) — бонус не даётся", async () => {
    const actor = actorWith({ names: ["Snapshot / Выстрел Навскидку"], degree: "full", ap: 0 });
    await processSnapshotTurnEnd(actor);
    expect(actor.system.actionPoints.value).toBe(0);
  });

  it("нет Таланта — бонус не даётся", async () => {
    const actor = actorWith({ names: ["Dodge"], degree: undefined, ap: 1 });
    await processSnapshotTurnEnd(actor);
    expect(actor.system.actionPoints.value).toBe(1);
  });

  it("тип актора без экономики действий — не падает, бонус не даётся", async () => {
    const actor = actorWith({ names: ["Snapshot / Выстрел Навскидку"], degree: undefined, ap: 1, type: "npc" });
    await processSnapshotTurnEnd(actor);
    expect(actor.system.actionPoints.value).toBe(1);
  });

  it("нет актора — не падает", async () => {
    await expect(processSnapshotTurnEnd(null)).resolves.toBeUndefined();
  });
});
