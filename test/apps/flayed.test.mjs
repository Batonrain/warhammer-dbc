// test/apps/flayed.test.mjs
//
// wdbc-w8ws: обвязка Мутации «Flayed / Освежёванный» — касание текущей цели
// (game.user.targets) как донора кожи, и ресинк доли аблативного пула
// (флаг flayedAblative + ablativeMax) при поглощении урона. Арифметика —
// rules/flayed.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { useFlayed, flayedButtonHtml, reconcileFlayedToFit } from "../../module/apps/flayed.mjs";

function fakeActor({ corruptionBonus = 4, ablative = 0, ablativeMax = 0, flags = {}, uuid = "Actor.wearer" } = {}) {
  const actor = {
    uuid, name: "Носитель кожи",
    system: { corruptionBonus, wounds: { ablative, ablativeMax } },
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

function fakeMutation() {
  return { type: "mutation", name: "Flayed / Освежёванный" };
}

describe("useFlayed", () => {
  let wearer, donor, item;
  beforeEach(() => {
    wearer = fakeActor({ corruptionBonus: 4, uuid: "Actor.wearer" });
    donor = { uuid: "Actor.donor", name: "Донор", system: { size: 1 } };
    item = fakeMutation();
    globalThis.game.user.targets = [{ actor: donor }];
  });

  it("без цели — предупреждает, ничего не меняет", async () => {
    globalThis.game.user.targets = [];
    await useFlayed(wearer, item);
    expect(wearer.system.wounds.ablative).toBe(0);
  });

  it("нельзя содрать кожу с самого себя", async () => {
    globalThis.game.user.targets = [{ actor: wearer }];
    await useFlayed(wearer, item);
    expect(wearer.system.wounds.ablative).toBe(0);
  });

  it("даёт 3+Размер донора аблативом, ablativeMax двигается вместе, флаг записан", async () => {
    await useFlayed(wearer, item);
    expect(wearer.system.wounds.ablative).toBe(4); // 3+1
    expect(wearer.system.wounds.ablativeMax).toBe(4);
    expect(wearer.getFlag("warhammer-dbc", "flayedAblative")).toBe(4);
  });

  it("вторая кожа копится с первой, до потолка 3×Cor.b", async () => {
    await useFlayed(wearer, item); // +4 (cap 12)
    const donor2 = { uuid: "Actor.donor2", name: "Донор 2", system: { size: 5 } }; // add 8, would total 12
    globalThis.game.user.targets = [{ actor: donor2 }];
    await useFlayed(wearer, item);
    expect(wearer.system.wounds.ablative).toBe(12);
    expect(wearer.getFlag("warhammer-dbc", "flayedAblative")).toBe(12);
  });

  it("уже на потолке — сообщает и ничего не меняет", async () => {
    wearer = fakeActor({ corruptionBonus: 4, ablative: 12, ablativeMax: 12, flags: { flayedAblative: 12 } });
    await useFlayed(wearer, item);
    expect(wearer.system.wounds.ablative).toBe(12);
  });
});

describe("reconcileFlayedToFit", () => {
  it("пул просел ниже доли (поглощение урона) — доля и ablativeMax сжимаются", async () => {
    const wearer = fakeActor({ ablative: 4, ablativeMax: 10, flags: { flayedAblative: 8 } });
    await reconcileFlayedToFit(wearer);
    expect(wearer.system.wounds.ablativeMax).toBe(6);
    expect(wearer.getFlag("warhammer-dbc", "flayedAblative")).toBe(4);
  });

  it("пул не просел — не трогает ничего", async () => {
    const wearer = fakeActor({ ablative: 8, ablativeMax: 8, flags: { flayedAblative: 8 } });
    await reconcileFlayedToFit(wearer);
    expect(wearer.system.wounds.ablativeMax).toBe(8);
  });
});

describe("flayedButtonHtml", () => {
  it("пусто у другой Мутации/без актора", () => {
    expect(flayedButtonHtml({ type: "mutation", name: "Cancerous Healing" }, {})).toBe("");
    expect(flayedButtonHtml(fakeMutation(), null)).toBe("");
  });
  it("рисует кнопку и потолок 3×Cor.b у своей Мутации", () => {
    const html = flayedButtonHtml(fakeMutation(), { system: { corruptionBonus: 4, wounds: {} } });
    expect(html).toContain("flayed-btn");
    expect(html).toContain("12"); // 3×4
  });
});
