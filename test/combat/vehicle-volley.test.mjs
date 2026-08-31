// test/combat/vehicle-volley.test.mjs
//
// wdbc-y33b (доводка): Залп — Мультиприцел/Продвинутые Прицельные Системы.
// У техники ОД нет, у ОПЕРАТОРА станции — есть: resolveVolleyAction тратит
// у него одно полное действие (2 ОД) на всю станцию разом.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { resolveVolleyAction } from "../../module/combat/vehicle.mjs";

function gunner({ ap = 2 } = {}) {
  const updates = [];
  return {
    uuid: "Actor.gunner", type: "character", name: "Стрелок",
    system: { actionPoints: { value: ap, max: 2 } },
    update: async data => { updates.push(data); },
    _updates: updates
  };
}

function vehicle(stations) {
  return { type: "vehicle", name: "Химера", system: { stations } };
}

const realFromUuid = globalThis.fromUuid;
afterEach(() => { globalThis.fromUuid = realFromUuid; globalThis.game.combat = undefined; });

describe("resolveVolleyAction: гейты", () => {
  it("на станции никто не сидит — ошибка", async () => {
    const v = vehicle([{ id: "s1", role: "gunner", uuid: "" }]);
    const res = await resolveVolleyAction(v, "s1");
    expect(res).toEqual({ ok: false, error: "На этой станции сейчас никто не сидит." });
  });

  it("станции с таким id вообще нет — та же ошибка (uuid пуст по умолчанию)", async () => {
    const v = vehicle([]);
    const res = await resolveVolleyAction(v, "s1");
    expect(res.ok).toBe(false);
  });

  it("оператор не резолвится (удалён) — ошибка", async () => {
    globalThis.fromUuid = async () => null;
    const v = vehicle([{ id: "s1", role: "gunner", uuid: "Actor.gunner" }]);
    const res = await resolveVolleyAction(v, "s1");
    expect(res.error).toContain("не найден");
  });

  it("у оператора не хватает ОД — ошибка, ОД не трогаются", async () => {
    const g = gunner({ ap: 1 });
    globalThis.fromUuid = async () => g;
    globalThis.game.combat = { started: true };
    const v = vehicle([{ id: "s1", role: "gunner", uuid: g.uuid }]);
    const res = await resolveVolleyAction(v, "s1");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("не хватает ОД");
    expect(g._updates).toEqual([]);
    globalThis.game.combat = undefined;
  });
});

describe("resolveVolleyAction: успех", () => {
  it("тратит 2 ОД (полное действие) у оператора, возвращает его", async () => {
    const g = gunner({ ap: 2 });
    globalThis.fromUuid = async () => g;
    globalThis.game.combat = { started: true };
    const v = vehicle([{ id: "s1", role: "gunner", uuid: g.uuid }]);

    const res = await resolveVolleyAction(v, "s1");

    expect(res.ok).toBe(true);
    expect(res.occupant).toBe(g);
    expect(g._updates).toEqual([{ "system.actionPoints.value": 0 }]);
    globalThis.game.combat = undefined;
  });

  it("вне активного Encounter — ОД не проверяются и не тратятся, но проходит", async () => {
    const g = gunner({ ap: 0 });
    globalThis.fromUuid = async () => g;
    const v = vehicle([{ id: "s1", role: "gunner", uuid: g.uuid }]);

    const res = await resolveVolleyAction(v, "s1");

    expect(res.ok).toBe(true);
    expect(g._updates).toEqual([]);
  });
});
