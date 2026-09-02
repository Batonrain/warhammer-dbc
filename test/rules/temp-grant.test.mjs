// test/rules/temp-grant.test.mjs
//
// module/rules/temp-grant.mjs (wdbc-1rno) — истечение/снятие временно
// выданных предметов (Cor.b минут / Cor.b Раундов), общая инфраструктура
// для «активируемых» способностей вида kind:"script".

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { isTempGrantExpired, expiredTempGrantItems, clearExpiredTempGrants } from "../../module/rules/temp-grant.mjs";

afterEach(() => resetCaptured());

describe("isTempGrantExpired: unit=worldTime", () => {
  const grant = { unit: "worldTime", expiresAt: 1000, label: "Тест" };

  it("worldTime меньше expiresAt — не истекло", () => {
    expect(isTempGrantExpired(grant, { worldTime: 500 })).toBe(false);
  });

  it("worldTime равен expiresAt — истекло (>=)", () => {
    expect(isTempGrantExpired(grant, { worldTime: 1000 })).toBe(true);
  });

  it("worldTime больше expiresAt — истекло", () => {
    expect(isTempGrantExpired(grant, { worldTime: 2000 })).toBe(true);
  });
});

describe("isTempGrantExpired: unit=round", () => {
  const grant = { unit: "round", combatId: "c1", expiresAtRound: 5, label: "Тест" };

  it("тот же бой, раунд ещё не наступил — не истекло", () => {
    expect(isTempGrantExpired(grant, { combat: { id: "c1", round: 3 } })).toBe(false);
  });

  it("тот же бой, раунд равен expiresAtRound — ещё не истекло (строго больше)", () => {
    expect(isTempGrantExpired(grant, { combat: { id: "c1", round: 5 } })).toBe(false);
  });

  it("тот же бой, раунд превысил expiresAtRound — истекло", () => {
    expect(isTempGrantExpired(grant, { combat: { id: "c1", round: 6 } })).toBe(true);
  });

  it("другой бой (id не совпадает) — истекло, раундами мерить нечем", () => {
    expect(isTempGrantExpired(grant, { combat: { id: "c2", round: 1 } })).toBe(true);
  });

  it("боя нет вовсе — истекло", () => {
    expect(isTempGrantExpired(grant, {})).toBe(true);
  });
});

describe("isTempGrantExpired: без метки/неизвестный unit", () => {
  it("нет tempGrant — не истекло (нечего снимать)", () => {
    expect(isTempGrantExpired(null, { worldTime: 9999 })).toBe(false);
  });

  it("неизвестный unit — не истекло (не роняем, но и не снимаем вслепую)", () => {
    expect(isTempGrantExpired({ unit: "session" }, {})).toBe(false);
  });
});

describe("expiredTempGrantItems", () => {
  const items = [
    { id: "i1", name: "A", flags: { "warhammer-dbc": { tempGrant: { unit: "worldTime", expiresAt: 100 } } } },
    { id: "i2", name: "B", flags: { "warhammer-dbc": { tempGrant: { unit: "worldTime", expiresAt: 500 } } } },
    { id: "i3", name: "C", flags: {} }
  ];

  it("отбирает только предметы с истёкшей меткой", () => {
    const out = expiredTempGrantItems(items, { worldTime: 200 });
    expect(out.map(i => i.id)).toEqual(["i1"]);
  });

  it("пустой список предметов — пустой результат", () => {
    expect(expiredTempGrantItems([], { worldTime: 999 })).toEqual([]);
  });

  it("undefined вместо списка — пустой результат, не ошибка", () => {
    expect(expiredTempGrantItems(undefined, { worldTime: 999 })).toEqual([]);
  });
});

describe("clearExpiredTempGrants", () => {
  function actorWith(items) {
    const list = [...items];
    const removed = [];
    return {
      name: "Тестовый актор",
      items: list,
      deleteEmbeddedDocuments: async (_type, ids) => {
        for (const id of ids) {
          const idx = list.findIndex(i => i.id === id);
          if (idx >= 0) { removed.push(list[idx]); list.splice(idx, 1); }
        }
      },
      _removed: removed
    };
  }

  it("удаляет истёкшие предметы и постит чат с их именами", async () => {
    const actor = actorWith([
      { id: "i1", name: "Incorporeal / Бесплотный", flags: { "warhammer-dbc": { tempGrant: { unit: "worldTime", expiresAt: 100, label: "Пространственная Нестабильность" } } } },
      { id: "i2", name: "Живой", flags: {} }
    ]);
    await clearExpiredTempGrants(actor, { worldTime: 200 });
    expect(actor.items.map(i => i.id)).toEqual(["i2"]);
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Пространственная Нестабильность");
  });

  it("ничего не истекло — ничего не удаляется, чат не постится", async () => {
    const actor = actorWith([
      { id: "i1", name: "Incorporeal", flags: { "warhammer-dbc": { tempGrant: { unit: "worldTime", expiresAt: 999 } } } }
    ]);
    await clearExpiredTempGrants(actor, { worldTime: 200 });
    expect(actor.items).toHaveLength(1);
    expect(captured.chat).toHaveLength(0);
  });

  it("нет предметов вовсе — не падает", async () => {
    const actor = actorWith([]);
    await clearExpiredTempGrants(actor, { worldTime: 200 });
    expect(captured.chat).toHaveLength(0);
  });
});
