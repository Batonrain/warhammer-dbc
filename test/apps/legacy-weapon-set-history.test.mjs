// test/apps/legacy-weapon-set-history.test.mjs
//
// setHistory (module/apps/legacy-weapon.mjs) — Наследие Боли (История 5,
// wdbc-1rno.35, стр. 427): единственная из 10 Историй, требующая разового
// постоянного изменения weaponProps в момент записи самой Истории, а не на
// каждой атаке.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { setHistory } from "../../module/apps/legacy-weapon.mjs";
import { weaponFor } from "../support/combat-fixtures.mjs";

const weapon = (props = []) => weaponFor({ weaponClass: "melee", weaponProps: props, legacy: {} });

describe("setHistory: Наследие Боли даёт Crippling/Shocking разово", () => {
  it("роль 5 (Наследие Боли) на оружии без Crippling — добавляет Crippling(1)", async () => {
    const item = weapon([]);
    await setHistory(item, 5);
    expect(item.system.legacy.historyName).toBe("Наследие Боли");
    expect(item.system.weaponProps).toEqual([{ key: "crippling", rating: 1 }]);
  });

  it("роль 5 на оружии, уже имеющем Crippling — добавляет Shocking", async () => {
    const item = weapon([{ key: "crippling", rating: 3 }]);
    await setHistory(item, 5);
    expect(item.system.weaponProps).toEqual([{ key: "crippling", rating: 3 }, { key: "shocking" }]);
  });

  it("другая История (роль 1) — weaponProps не трогает", async () => {
    const item = weapon([{ key: "tearing" }]);
    await setHistory(item, 1);
    expect(item.system.legacy.historyName).toBe("Наследие Бойни");
    expect(item.system.weaponProps).toEqual([{ key: "tearing" }]);
  });
});

describe("setHistory: Наследие Чумы даёт/повышает Toxic разово", () => {
  it("роль 7 (Наследие Чумы) на оружии без Toxic — добавляет Toxic(0)", async () => {
    const item = weapon([]);
    await setHistory(item, 7);
    expect(item.system.legacy.historyName).toBe("Наследие Чумы");
    expect(item.system.weaponProps).toEqual([{ key: "toxic", rating: 0 }]);
  });

  it("роль 7 на оружии, уже имеющем Toxic — рейтинг +1", async () => {
    const item = weapon([{ key: "toxic", rating: 1 }]);
    await setHistory(item, 7);
    expect(item.system.weaponProps).toEqual([{ key: "toxic", rating: 2 }]);
  });
});
