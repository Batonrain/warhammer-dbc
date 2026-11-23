// test/sheets/possession-reality-ripple.test.mjs
//
// Sahara 584-4d33. Книга (корбук стр. 114): Проявление — «потратить
// полудействие», заключить демона обратно — тоже полудействие. Талант «Reality
// Ripple / Рябь Реальности»: «может провести Проявление … за свободное
// действие, получив 1 Порчи». Раньше Проявление вовсе не стоило действия,
// и Талант экономить было нечего.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured } from "../support/foundry-stub.mjs";
import { toggleManifest } from "../../module/sheets/tabs/possession.mjs";

const talent = name => ({ id: name, name, type: "talent", system: {}, getFlag: () => undefined });

function possessed({ manifested = false, ripple = false, ap = 2, cor = 40 } = {}) {
  const items = ripple ? [talent("Reality Ripple / Рябь Реальности")] : [];
  items.get = id => items.find(i => i.id === id) ?? null;
  const actor = {
    type: "character", name: "Одержимый", items, getFlag: () => undefined,
    system: {
      possessed: true, possession: { manifested }, corruption: { value: cor },
      wounds: { max: 10, value: 10 }, actionPoints: { value: ap, max: 2 }, conditions: {}
    }
  };
  actor.update = async updates => {
    for (const [path, value] of Object.entries(updates)) {
      const keys = path.replace(/^system\./, "").split(".");
      let node = actor.system;
      for (const k of keys.slice(0, -1)) node = node[k] ??= {};
      node[keys.at(-1)] = value;
    }
  };
  return actor;
}

describe("Проявление: цена действия и Рябь Реальности", () => {
  beforeEach(() => {
    captured.chat.length = 0; captured.nextRoll = 1; captured.confirmAnswer = true; captured.warnings = [];
    globalThis.game.combat = { started: true, id: "c1", round: 1 };
  });
  afterEach(() => { globalThis.game.combat = null; });

  it("в бою вход в Проявление стоит полудействие", async () => {
    const a = possessed();
    await toggleManifest(a);
    expect(a.system.possession.manifested).toBe(true);
    expect(a.system.actionPoints.value).toBe(1);
    expect(a.system.corruption.value).toBe(40);
  });

  it("без ОД в бою Проявления нет", async () => {
    const a = possessed({ ap: 0 });
    await toggleManifest(a);
    expect(a.system.possession.manifested).toBe(false);
    expect(captured.warnings.length).toBeGreaterThan(0);
  });

  it("выход из Проявления — тоже полудействие, Рябь его не удешевляет", async () => {
    const a = possessed({ manifested: true, ripple: true });
    await toggleManifest(a);
    expect(a.system.possession.manifested).toBe(false);
    expect(a.system.actionPoints.value).toBe(1);
    expect(a.system.corruption.value).toBe(40);
  });

  it("Рябь Реальности: «да» — свободно, +1 Порчи; «нет» — полудействие", async () => {
    const free = possessed({ ripple: true });
    await toggleManifest(free);
    expect(free.system.possession.manifested).toBe(true);
    expect(free.system.actionPoints.value).toBe(2);
    expect(free.system.corruption.value).toBe(41);

    captured.confirmAnswer = false;
    const paid = possessed({ ripple: true });
    await toggleManifest(paid);
    expect(paid.system.actionPoints.value).toBe(1);
    expect(paid.system.corruption.value).toBe(40);
  });

  it("Рябь и проваленный тест Cor+20 — две Порчи", async () => {
    captured.nextRoll = 100;
    const a = possessed({ ripple: true });
    await toggleManifest(a);
    expect(a.system.corruption.value).toBe(42);
  });

  it("вне боя — без цены и без вопроса", async () => {
    globalThis.game.combat = null;
    captured.dialog = null;
    const a = possessed({ ripple: true });
    await toggleManifest(a);
    expect(a.system.possession.manifested).toBe(true);
    expect(a.system.corruption.value).toBe(40);
    expect(captured.dialog).toBeNull();
  });
});
