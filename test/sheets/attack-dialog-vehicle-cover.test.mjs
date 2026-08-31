// test/sheets/attack-dialog-vehicle-cover.test.mjs
//
// wdbc-y33b (доводка): Закрытая/Открытая(X) — укрытие экипажа/пассажиров
// техники автоподставляется в то же поле #atk-cover, что и Укрытие
// местности (module/combat/cover.mjs) — складываются, не выбирается большее.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function attacker(over = {}) {
  const a = actorFor({ items: [], fatigue: { value: 0 }, aiming: "none", ...over });
  a.update = async () => {};
  return a;
}

function crewman(uuid) {
  return { uuid, type: "character" };
}

function vehicle({ uuid = "Actor.vehicle", side = 10, traitFlags = {}, stationUuid = "" } = {}) {
  return {
    uuid, type: "vehicle",
    system: {
      armour: { front: 12, side, rear: 8 },
      derived: { traitFlags },
      stations: stationUuid ? [{ id: "s1", role: "gunner", uuid: stationUuid }] : []
    }
  };
}

function coverInDialog() {
  const m = (captured.dialog?.content ?? "").match(/id="atk-cover"[^>]*value="(-?\d+)"/);
  return m ? Number(m[1]) : null;
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.actors = [];
});

describe("Укрытие внутри техники — автоподстановка в #atk-cover", () => {
  it("цель не связана ни с какой техникой — 0", () => {
    const target = crewman("Actor.target");
    globalThis.game.actors = [vehicle({ stationUuid: "Actor.other" })];
    setTargets([target]);

    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker(), weapon);
    expect(coverInDialog()).toBe(0);
  });

  it("Закрытая — полное укрытие, минус АР Бортовой стороны", () => {
    const target = crewman("Actor.target");
    globalThis.game.actors = [vehicle({ side: 14, traitFlags: { enclosed: true }, stationUuid: target.uuid })];
    setTargets([target]);

    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker(), weapon);
    expect(coverInDialog()).toBe(-14);
  });

  it("Открытая(X) рейтинг 1 — тоже полное укрытие", () => {
    const target = crewman("Actor.target");
    globalThis.game.actors = [vehicle({
      side: 10, traitFlags: { openTopped: true, openToppedRating: 1 }, stationUuid: target.uuid
    })];
    setTargets([target]);

    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker(), weapon);
    expect(coverInDialog()).toBe(-10);
  });

  it("Открытая(X) рейтинг 0 — без укрытия", () => {
    const target = crewman("Actor.target");
    globalThis.game.actors = [vehicle({
      side: 10, traitFlags: { openTopped: true, openToppedRating: 0 }, stationUuid: target.uuid
    })];
    setTargets([target]);

    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker(), weapon);
    expect(coverInDialog()).toBe(0);
  });

  it("нет цели вовсе — 0, без падения", () => {
    setTargets([]);
    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker(), weapon);
    expect(coverInDialog()).toBe(0);
  });
});
