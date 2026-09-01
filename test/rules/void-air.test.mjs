// test/rules/void-air.test.mjs
//
// Запас воздуха свойства брони Void (wdbc-jtqf, core.json стр. 228): 6ч база,
// Poor.Q −3ч, Good.Q +6ч, Best.Q безлимит; теряется при пробитии (breached).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import {
  voidAirTotalHours, hasVoidSupply, voidAirRemainingSeconds,
  sealVoidArmour, refillVoidArmour, voidAirRemainingDisplay,
  wraithboneRegenIgnoresBreach
} from "../../module/rules/void-air.mjs";

function voidArmour({ quality = "common", breached = false, properties = ["void"], parent = null } = {}) {
  const store = {};
  return {
    system: { quality, breached, properties },
    parent,
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete store[`${scope}.${key}`]; }
  };
}

describe("voidAirTotalHours", () => {
  it("common — 6ч база", () => expect(voidAirTotalHours("common")).toBe(6));
  it("poor — 6−3=3ч", () => expect(voidAirTotalHours("poor")).toBe(3));
  it("good — 6+6=12ч", () => expect(voidAirTotalHours("good")).toBe(12));
  it("best — безлимит", () => expect(voidAirTotalHours("best")).toBe(Infinity));
});

describe("hasVoidSupply", () => {
  it("есть ключ void в properties — true", () => {
    expect(hasVoidSupply(voidArmour())).toBe(true);
  });
  it("нет ключа void — false", () => {
    expect(hasVoidSupply(voidArmour({ properties: ["sealed"] }))).toBe(false);
  });
});

describe("voidAirRemainingSeconds / sealVoidArmour / refillVoidArmour", () => {
  it("не загерметизирована — весь запас цел", () => {
    globalThis.game.time = { worldTime: 100000 };
    expect(voidAirRemainingSeconds(voidArmour({ quality: "common" }))).toBe(6 * 3600);
  });

  it("sealVoidArmour запускает таймер, расход считается от момента герметизации", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = voidArmour({ quality: "common" });
    await sealVoidArmour(item);
    globalThis.game.time = { worldTime: 100000 + 3600 };
    expect(voidAirRemainingSeconds(item)).toBe(5 * 3600);
  });

  it("запас исчерпан — 0, не в минус", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = voidArmour({ quality: "poor" }); // 3ч
    await sealVoidArmour(item);
    globalThis.game.time = { worldTime: 100000 + 4 * 3600 };
    expect(voidAirRemainingSeconds(item)).toBe(0);
  });

  it("Best.Q — безлимит даже после герметизации", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = voidArmour({ quality: "best" });
    await sealVoidArmour(item);
    globalThis.game.time = { worldTime: 100000 + 999999 };
    expect(voidAirRemainingSeconds(item)).toBe(Infinity);
  });

  it("пробитая броня — 0 независимо от таймера (герметичность потеряна немедленно)", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = voidArmour({ quality: "best", breached: true });
    await sealVoidArmour(item); // не должен даже запуститься
    expect(voidAirRemainingSeconds(item)).toBe(0);
  });

  it("Wraithbone Regeneration в руках псайкера (wdbc-8b5): пробитая броня НЕ теряет запас", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = voidArmour({
      quality: "common", breached: true, properties: ["void", "wraithboneRegen"],
      parent: { system: { isPsyker: true } }
    });
    await sealVoidArmour(item);
    globalThis.game.time = { worldTime: 100000 + 3600 };
    expect(voidAirRemainingSeconds(item)).toBe(5 * 3600);
  });

  it("Wraithbone Regeneration без псайкера-носителя — пробитая броня теряет запас как обычно", () => {
    const item = voidArmour({
      breached: true, properties: ["void", "wraithboneRegen"],
      parent: { system: { isPsyker: false } }
    });
    expect(voidAirRemainingSeconds(item)).toBe(0);
  });

  it("sealVoidArmour на пробитой броне не запускает таймер", async () => {
    const item = voidArmour({ breached: true });
    await sealVoidArmour(item);
    expect(item.getFlag("warhammer-dbc", "voidAirStartedAt")).toBeUndefined();
  });

  it("повторная герметизация уже запущенного таймера не сбрасывает расход", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = voidArmour({ quality: "common" });
    await sealVoidArmour(item);
    globalThis.game.time = { worldTime: 100000 + 3600 };
    await sealVoidArmour(item); // не должен передвинуть старт
    expect(voidAirRemainingSeconds(item)).toBe(5 * 3600);
  });

  it("refillVoidArmour снимает таймер — следующая герметизация снова с полного запаса", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = voidArmour({ quality: "common" });
    await sealVoidArmour(item);
    globalThis.game.time = { worldTime: 100000 + 3600 };
    await refillVoidArmour(item);
    expect(voidAirRemainingSeconds(item)).toBe(6 * 3600);
  });
});

describe("voidAirRemainingDisplay", () => {
  it("считает часы и минуты остатка", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const item = voidArmour({ quality: "common" });
    await sealVoidArmour(item);
    globalThis.game.time = { worldTime: 100000 + 3600 + 1800 }; // 1ч30м прошло
    expect(voidAirRemainingDisplay(item)).toEqual({ hours: 4, minutes: 30 });
  });

  it("Best.Q — null (отображается как безлимит)", () => {
    globalThis.game.time = { worldTime: 100000 };
    expect(voidAirRemainingDisplay(voidArmour({ quality: "best" }))).toBe(null);
  });
});
