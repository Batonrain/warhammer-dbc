// test/combat/char-damage-button.test.mjs
//
// Урон в Характеристики кнопкой: из крит-строк (task-174e) и психосил
// (task-5820). Обороты сверены по всем 27 строкам critical-tables.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { parseCritCharDamage, critCharDamageHtml, charDamageButtonHtml, applyCharDamageButton }
  from "../../module/combat/char-damage-button.mjs";
import { CRITICAL_TABLES } from "../../critical-tables.mjs";

beforeEach(resetCaptured);

describe("parseCritCharDamage", () => {
  it("одна, две и три Характеристики; перманентный урон", () => {
    expect(parseCritCharDamage("Цель получает 1d10 урона в T и должна пройти тест"))
      .toEqual([{ formula: "1d10", keys: ["t"], permanent: false }]);
    expect(parseCritCharDamage("Она получает 1d5 урона в WS и BS."))
      .toEqual([{ formula: "1d5", keys: ["ws", "bs"], permanent: false }]);
    expect(parseCritCharDamage("получает 2d10 урона в S, T и A"))
      .toEqual([{ formula: "2d10", keys: ["s", "t", "ag"], permanent: false }]);
    expect(parseCritCharDamage("получить 1 перманентного урона в I."))
      .toEqual([{ formula: "1", keys: ["int"], permanent: true }]);
    expect(parseCritCharDamage("1d10 урона в P и F")[0].keys).toEqual(["per", "fel"]);
  });

  it("все 27 строк таблиц с уроном в Характеристику распознаются", () => {
    let hits = 0;
    const walk = v => {
      if (typeof v === "string") { if (/урона\s+в\s+[A-Z]/u.test(v)) { hits++; expect(parseCritCharDamage(v).length).toBeGreaterThan(0); } }
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(CRITICAL_TABLES);
    expect(hits).toBeGreaterThanOrEqual(25);
  });

  it("без урона в Характеристику — кнопок нет", () => {
    expect(critCharDamageHtml("Оглушена на 1d5 Раундов.", "Actor.a")).toBe("");
  });
});

describe("кнопка и применение", () => {
  it("психосила: готовое число, цель — выделенный токен (actorUuid пуст)", () => {
    const html = charDamageButtonHtml({ amount: 7, keys: ["wp"] }, { source: "Сила" });
    expect(html).toContain('data-amount="7"');
    expect(html).toContain('data-actor-uuid=""');
  });

  function target() {
    return { name: "Цель", items: [], updates: [],
      system: { characteristics: { ws: { total: 40 }, bs: { total: 40 }, int: { total: 30 } }, charLoss: {}, charLossAt: {}, charLossPortions: [] },
      getFlag: () => undefined,
      async update(d) { this.updates.push(d); } };
  }

  it("один бросок ложится в каждую названную Характеристику", async () => {
    const a = target();
    captured.dice = [6];
    const r = await applyCharDamageButton(a, { keys: ["ws", "bs"], formula: "1d10" });
    expect(r.amount).toBe(6);
    expect(a.updates.map(u => Object.keys(u).find(k => k.startsWith("system.charLoss.")))).toEqual(["system.charLoss.ws", "system.charLoss.bs"]);
  });

  it("перманентный — порцией без восстановления", async () => {
    const a = target();
    await applyCharDamageButton(a, { keys: ["int"], amount: 1, permanent: true, source: "Крит" });
    const list = a.updates[0]["system.charLossPortions"];
    expect(list[0]).toMatchObject({ key: "int", amount: 1, hours: 0 });
  });
});
