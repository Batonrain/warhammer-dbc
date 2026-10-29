// test/combat/warp-lock.test.mjs
//
// Варп-Замок (Псайкана, Sahara 3-28, пачка I2): применение, учёт часа по игровому времени, метка
// «не псайкер», блок манифестации. Правила — test/rules/warp-lock.test.mjs. Талант — из настоящего пака.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  applyWarpLock, handleWarpLockClick, warpLockButtonsHtml, resetWarpLockHour, clearWarpLockMark
} from "../../module/combat/warp-lock.mjs";
import { WARP_LOCK_FLAG, WARP_LOCK_USES_FLAG, warpLockUses } from "../../module/rules/warp-lock.mjs";
import { showManifestDialog } from "../../module/sheets/tabs/psychic.mjs";

const talentDoc = () => packDocById("packs-src/talents/Псайкана", "qNtduQTIpI7yyfgY");

function item(type, name, system = {}, flags = {}) {
  const store = { ...flags };
  const it = {
    id: name, type, name, system, _store: store, updates: [],
    getFlag: (s, k) => store[k],
    setFlag: async (s, k, v) => { store[k] = v; },
    unsetFlag: async (s, k) => { delete store[k]; },
    update: async d => { it.updates.push(d); }
  };
  return it;
}
const warpTalent = () => { const d = talentDoc(); return item("talent", d.name, { ...d.system }); };
const sustained = name => item("psychicPower", name, { isSustained: true, sustainedDegree: 3, sustainedEpr: 4, sustainedTargetUuid: "Actor.x" });

function psyker({ items = [], wounds = 20, wb = 3 } = {}) {
  const store = {};
  const list = [...items];
  const a = {
    id: "p1", uuid: "Actor.p1", name: "Псайкер", type: "character", isOwner: true, items: list, _store: store, updates: [],
    system: { wounds: { value: wounds, critical: 0, max: 20 }, characteristics: { wp: { bonus: wb, total: wb * 10 } }, actionPoints: {}, conditions: {} },
    getFlag: (s, k) => store[`${k}`],
    setFlag: async (s, k, v) => { store[k] = v; },
    unsetFlag: async (s, k) => { delete store[k]; },
    update: async d => { a.updates.push(d); for (const [p, v] of Object.entries(d)) { const k = p.split(".").slice(1); let n = a.system; for (const x of k.slice(0, -1)) n = (n[x] ??= {}); n[k.at(-1)] = v; } }
  };
  a.actor = a;
  return a;
}
const chatText = () => captured.chat.map(m => String(m.content ?? "")).join("\n");

let prev;
beforeEach(() => {
  resetCaptured();
  prev = { time: globalThis.game.time, combat: globalThis.game.combat, fromUuid: globalThis.fromUuid, dialog: globalThis.foundry.applications.api.DialogV2 };
  globalThis.game.time = { worldTime: 10000 };
  globalThis.game.combat = null;
});
afterEach(() => {
  globalThis.game.time = prev.time; globalThis.game.combat = prev.combat; globalThis.fromUuid = prev.fromUuid;
  globalThis.foundry.applications.api.DialogV2 = prev.dialog;
});

describe("Варп-Замок: аварийное применение", () => {
  it("1d5 непоглощаемого урона, силы развеяны, метка «не псайкер», час записан", async () => {
    captured.dice = [4];
    const p1 = sustained("Сила А"), p2 = sustained("Сила Б");
    const talent = warpTalent();
    const a = psyker({ items: [talent, p1, p2] });
    expect(await applyWarpLock(a, "emergency")).toBe(true);
    expect(a.system.wounds.value).toBe(16);
    for (const p of [p1, p2]) {
      expect(p.updates[0]["system.isSustained"]).toBe(false);
      expect(p.updates[0]["system.sustainedDegree"]).toBeNull();
      expect(p.updates[0]["system.sustainedEpr"]).toBeNull();
      expect(p.updates[0]["system.sustainedTargetUuid"]).toBe("");
    }
    expect(a._store[WARP_LOCK_FLAG]).toBe(true);
    expect(talent._store[WARP_LOCK_USES_FLAG].emergencyAt).toBe(10000);
    const text = chatText();
    expect(text).toContain("Сила А");
    expect(text).toContain("не может манифестировать");
    expect(text).toContain("E Dmg в голову");
  });

  it("повторно в тот же игровой час — отказ; через час — можно", async () => {
    captured.dice = [2, 2];
    const talent = warpTalent();
    const a = psyker({ items: [talent] });
    expect(await applyWarpLock(a, "emergency")).toBe(true);
    await clearWarpLockMark(a);
    globalThis.game.time.worldTime = 10000 + 1800;
    expect(await applyWarpLock(a, "emergency")).toBe(false);
    expect(captured.warnings.at(-1)).toMatch(/раз в час/);
    globalThis.game.time.worldTime = 10000 + 3600;
    expect(await applyWarpLock(a, "emergency")).toBe(true);
  });

  it("ручной сброс счётчика часа возвращает право", async () => {
    captured.dice = [2, 2];
    const talent = warpTalent();
    const a = psyker({ items: [talent] });
    await applyWarpLock(a, "emergency");
    await clearWarpLockMark(a);
    expect(await resetWarpLockHour(a)).toBe(true);
    expect(warpLockUses(a).emergencyAt).toBeNull();
    expect(await applyWarpLock(a, "emergency")).toBe(true);
  });

  it("тяжёлое ранение даёт Критический урон по таблице E в голову", async () => {
    captured.dice = [5];
    const a = psyker({ items: [warpTalent()], wounds: 2 });
    await applyWarpLock(a, "emergency");
    expect(a.system.wounds.critical).toBeGreaterThan(0);
    expect(chatText()).toContain("Критический урон");
  });

  it("пока метка стоит, второе применение бессмысленно", async () => {
    captured.dice = [2];
    const a = psyker({ items: [warpTalent()] });
    await applyWarpLock(a, "emergency");
    expect(await applyWarpLock(a, "emergency")).toBe(false);
  });
});

describe("Варп-Замок: подавление потенциала в начале Хода", () => {
  it("без урона, силы развеяны, метка стоит", async () => {
    const p1 = sustained("Сила А");
    const a = psyker({ items: [warpTalent(), p1] });
    expect(await applyWarpLock(a, "suppress")).toBe(true);
    expect(a.system.wounds.value).toBe(20);
    expect(p1.updates).toHaveLength(1);
    expect(a._store[WARP_LOCK_FLAG]).toBe(true);
    expect(warpLockUses(a).suppressAt).toEqual([10000]);
  });
  it("не более W.b раз в час", async () => {
    const a = psyker({ items: [warpTalent()], wb: 2 });
    for (const t of [10000, 10100]) {
      globalThis.game.time.worldTime = t;
      expect(await applyWarpLock(a, "suppress")).toBe(true);
      await clearWarpLockMark(a);
    }
    globalThis.game.time.worldTime = 10200;
    expect(await applyWarpLock(a, "suppress")).toBe(false);
    globalThis.game.time.worldTime = 10000 + 3600 + 50;
    expect(await applyWarpLock(a, "suppress")).toBe(true);
  });
  it("в бою — только в начале СВОЕГО Хода", async () => {
    const a = psyker({ items: [warpTalent()] });
    globalThis.game.combat = { started: true, combatant: { actor: { uuid: "Actor.other" }, actorId: "other" } };
    expect(await applyWarpLock(a, "suppress")).toBe(false);
    expect(captured.warnings.at(-1)).toMatch(/своего Хода/);
    globalThis.game.combat = { started: true, combatant: { actor: a, actorId: "p1" } };
    expect(await applyWarpLock(a, "suppress")).toBe(true);
  });
});

describe("Варп-Замок: кнопка на карточке", () => {
  const msg = id => { const flags = {}; return { id, isOwner: true, flags, getFlag: (s, k) => flags[k], async setFlag(s, k, v) { flags[k] = v; } }; };
  const confirmWith = v => { globalThis.foundry.applications.api.DialogV2 = { confirm: async () => v }; };

  it("кнопка есть только у носителя Таланта", () => {
    expect(warpLockButtonsHtml(psyker({ items: [warpTalent()] }))).toContain("wh-warplock-btn");
    expect(warpLockButtonsHtml(psyker())).toBe("");
  });
  it("клик: подтверждение → применение; второй клик по той же карточке — отказ", async () => {
    captured.dice = [3];
    confirmWith(true);
    const a = psyker({ items: [warpTalent()] });
    globalThis.fromUuid = async () => a;
    const m = msg("wl1");
    const btn = { dataset: { actorUuid: a.uuid, kind: "emergency" } };
    expect(await handleWarpLockClick(m, btn)).toBe(true);
    expect(a.system.wounds.value).toBe(17);
    expect(await handleWarpLockClick(m, btn)).toBe(false);
  });
  it("отказ в диалоге — ничего не происходит", async () => {
    captured.dice = [3];
    confirmWith(false);
    const a = psyker({ items: [warpTalent()] });
    globalThis.fromUuid = async () => a;
    expect(await handleWarpLockClick(msg("wl2"), { dataset: { actorUuid: a.uuid } })).toBe(false);
    expect(a.system.wounds.value).toBe(20);
    expect(a._store[WARP_LOCK_FLAG]).toBeUndefined();
  });
  it("не владелец — отказ", async () => {
    confirmWith(true);
    const a = psyker({ items: [warpTalent()] });
    a.isOwner = false;
    globalThis.fromUuid = async () => a;
    expect(await handleWarpLockClick(msg("wl3"), { dataset: { actorUuid: a.uuid } })).toBe(false);
  });
});

describe("Варп-Замок: манифестация блокирована, пока стоит метка", () => {
  it("окно манифестации не открывается и говорит почему", () => {
    const a = psyker({ items: [warpTalent()] });
    a._store[WARP_LOCK_FLAG] = true;
    const power = item("psychicPower", "Порицание", { discipline: "", testChar: "wp" });
    const before = captured.warnings.length;
    showManifestDialog(a, power);
    expect(captured.warnings.length).toBe(before + 1);
    expect(captured.warnings.at(-1)).toMatch(/Варп-Замок/);
  });
});

describe("Варп-Замок: ключ флага Таланта", () => {
  it("совпадает с учётом на Таланте (флаг warpLockUses)", () => {
    expect(WARP_LOCK_USES_FLAG).toBe("warpLockUses");
  });
});
