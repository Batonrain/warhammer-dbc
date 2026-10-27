// test/rules/warp-lock.test.mjs
//
// Пачка I2 (Псайкана, Sahara 3-28, решение владельца 26.10.2026): Варп-Замок — кнопки на карточке
// Феномена/Прорыва (игнор: 1d5 непоглощаемого E в голову, поддержания развеяны, метка «не псайкер»
// до начала следующего Хода) + «подавить потенциал» в начале Хода без урона, не более W.b раз в
// час. «Раз в час» — по игровому времени (game.time.worldTime) с ручным сбросом. Талант — из настоящего пака.

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  WARP_LOCK_FLAG, WARP_LOCK_PERIOD, WARP_LOCK_DAMAGE_FORMULA, hasWarpLock, warpLockTalent,
  warpLockActive, warpLockUses, warpLockGate, warpLockRecord, warpLockResetUses, warpLockBlocksManifest,
  warpLockHourLabel
} from "../../module/rules/warp-lock.mjs";
import { TURN_SCOPED_FLAG_KEYS } from "../../module/rules/turn-flags.mjs";

const doc = () => packDocById("packs-src/talents/Псайкана", "qNtduQTIpI7yyfgY");
const talent = (flags = {}) => {
  const d = doc();
  const store = { ...flags };
  return { type: "talent", name: d.name, system: { ...d.system }, flags: { "warhammer-dbc": store }, getFlag: (s, k) => store[k] };
};
const actor = (items, { wb = 4, active = false } = {}) => ({
  type: "character", items,
  system: { characteristics: { wp: { bonus: wb } } },
  getFlag: (s, k) => (k === WARP_LOCK_FLAG ? active : undefined)
});

describe("Варп-Замок — Талант в настоящем паке", () => {
  it("код опознаёт его по имени из пака", () => {
    expect(hasWarpLock(actor([talent()]))).toBe(true);
    expect(warpLockTalent(actor([talent()]))).not.toBeNull();
    expect(hasWarpLock(actor([]))).toBe(false);
    expect(hasWarpLock(actor([{ ...talent(), type: "gear" }]))).toBe(false);
  });
  it("текст Таланта в паке говорит «и не может манифестировать» (решение владельца)", () => {
    expect(doc().system.benefit).toMatch(/не может манифестировать/);
  });
  it("метка «не псайкер» гаснет с началом следующего Хода (реестр turn-flags)", () => {
    expect(TURN_SCOPED_FLAG_KEYS).toContain(WARP_LOCK_FLAG);
  });
});

describe("метка «не псайкер»", () => {
  it("пока метка стоит, манифестация блокирована", () => {
    expect(warpLockBlocksManifest(actor([talent()], { active: true }))).toBe(true);
    expect(warpLockBlocksManifest(actor([talent()], { active: false }))).toBe(false);
  });
  it("метка без Таланта (скопирована/осталась) всё равно блокирует — она про состояние, не про Талант", () => {
    expect(warpLockBlocksManifest(actor([], { active: true }))).toBe(true);
    expect(warpLockActive(actor([], { active: true }))).toBe(true);
  });
});

describe("аварийное применение: раз в час по игровому времени", () => {
  const A = (flags) => actor([talent(flags)]);
  it("первое — можно", () => expect(warpLockGate(A(), "emergency", 1000).ok).toBe(true));
  it("через полчаса — нельзя, осталось полчаса", () => {
    const a = A({ warpLockUses: { emergencyAt: 1000, suppressAt: [] } });
    const g = warpLockGate(a, "emergency", 1000 + 1800);
    expect(g.ok).toBe(false);
    expect(g.code).toBe("cooldown");
    expect(g.remaining).toBe(1800);
  });
  it("ровно через час — снова можно", () => {
    const a = A({ warpLockUses: { emergencyAt: 1000, suppressAt: [] } });
    expect(warpLockGate(a, "emergency", 1000 + WARP_LOCK_PERIOD).ok).toBe(true);
  });
  it("пока метка «не псайкер» стоит, повторять нечего", () => {
    const a = actor([talent()], { active: true });
    expect(warpLockGate(a, "emergency", 5).code).toBe("active");
  });
  it("без Таланта — нельзя", () => {
    expect(warpLockGate(actor([]), "emergency", 5).code).toBe("no-talent");
  });
  it("запись использования и ручной сброс", () => {
    const rec = warpLockRecord(warpLockUses(A()), "emergency", 2000);
    expect(rec.emergencyAt).toBe(2000);
    expect(warpLockResetUses()).toEqual({ emergencyAt: null, suppressAt: [] });
    const a = A({ warpLockUses: warpLockResetUses() });
    expect(warpLockGate(a, "emergency", 2001).ok).toBe(true);
  });
});

describe("подавление в начале Хода: не более W.b раз в час", () => {
  const A = (flags, wb = 3) => actor([talent(flags)], { wb });
  it("W.b раз за час — можно, на следующем — нет", () => {
    let uses = warpLockUses(A());
    for (const t of [100, 200, 300]) {
      expect(warpLockGate(A({ warpLockUses: uses }), "suppress", t).ok).toBe(true);
      uses = warpLockRecord(uses, "suppress", t);
    }
    const g = warpLockGate(A({ warpLockUses: uses }), "suppress", 400);
    expect(g.ok).toBe(false);
    expect(g.code).toBe("limit");
  });
  it("использования старше часа не считаются", () => {
    const uses = { emergencyAt: null, suppressAt: [0, 10, 20] };
    expect(warpLockGate(A({ warpLockUses: uses }), "suppress", WARP_LOCK_PERIOD + 15).ok).toBe(true);
  });
  it("запись выбрасывает использования старше часа", () => {
    const uses = warpLockRecord({ emergencyAt: null, suppressAt: [0, 5000] }, "suppress", 5100);
    expect(uses.suppressAt).toEqual([5000, 5100]);
  });
  it("W.b = 0 — подавить нельзя вовсе", () => {
    expect(warpLockGate(A({}, 0), "suppress", 10).ok).toBe(false);
  });
  it("аварийное и подавление считаются отдельно", () => {
    const uses = { emergencyAt: 100, suppressAt: [] };
    expect(warpLockGate(A({ warpLockUses: uses }), "suppress", 200).ok).toBe(true);
  });
  it("подпись остатка часа читается человеком", () => {
    expect(warpLockHourLabel(1800)).toMatch(/30/);
    expect(warpLockHourLabel(0)).toBe("");
  });
});

describe("константы", () => {
  it("1d5 непоглощаемого урона", () => expect(WARP_LOCK_DAMAGE_FORMULA).toBe("1d5"));
  it("час — 3600 секунд игрового времени", () => expect(WARP_LOCK_PERIOD).toBe(3600));
});
