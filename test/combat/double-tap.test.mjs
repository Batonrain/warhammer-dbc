// test/combat/double-tap.test.mjs
//
// Double Tap / Двойной Выстрел (Стрелок; Sahara 3-5fbf, трактовка А владельца
// 24.10.2026): «Когда он совершает любую не-Избирательную очередь, он может
// выбрать нанести первое успешное попадание (после Избеганий) в торс а второе —
// в голову, но все дальнейшие пролетают над целью и считаются промахами».
// Порядок — жёстко до Избеганий (attack.mjs::locForHit).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { doubleTapAvailable, doubleTapActive, doubleTapLocation, doubleTapHits } from "../../module/rules/gunner-talents.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const locations = () => [...card().matchAll(/<button class="wh-apply-dmg-btn[^>]*data-hit-location="([^"]*)"/g)].map(m => m[1]);

const TAP = { key: "rangedCore.core.doubleTap", name: "Double Tap / Двойной Выстрел" };
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const smg = () => weaponFor({ weaponClass: "basic", damage: "1d10", penetration: 0, rof_single: 1, rof_semi: 3, rof_full: 6,
  equipped: true, grips: "2р" }, { name: "Автомат" });

beforeEach(() => { resetCaptured(); setTargets([]); });

async function burst(items, { mode = "full", opts = { doubleTap: true }, aim = null } = {}) {
  const w = smg();
  const actor = actorFor({ items: [w, ...items], fatigue: { value: 0 }, aiming: "none" });
  // бросок 5 при пороге 45 — 5 Успехов (длинная очередь: попадание за каждый, потолок RoF 6), дальше урон
  captured.dice = [5, 3, 4, 5, 6, 7, 8, 9];
  await _executeAttackRoll(actor, w, "bs", 45, mode, aim, opts);
}

describe("Двойной Выстрел в карточке атаки", () => {
  it("без Таланта галочка не действует: больше двух попаданий", async () => {
    await burst([]);
    expect(locations().length).toBeGreaterThan(2);
  });

  it("по ключу: два попадания — Торс, Голова; остальные отброшены", async () => {
    await burst([byKey(TAP.key)]);
    expect(locations()).toEqual(["Торс", "Голова"]);
    expect(card()).toContain("Двойной Выстрел");
  });

  it("галочка не стоит — Талант ничего не меняет", async () => {
    await burst([byName(TAP.name)], { opts: {} });
    expect(locations().length).toBeGreaterThan(2);
  });

  it("Избирательная атака — не работает", async () => {
    await burst([byName(TAP.name)], { aim: { value: "arm", label: "Рука" } });
    expect(locations().every(l => l === "Рука" || l === "Торс")).toBe(true);
    expect(card()).not.toContain("Двойной Выстрел");
  });

  it("одиночный выстрел — не работает", async () => {
    await burst([byName(TAP.name)], { mode: "single" });
    expect(card()).not.toContain("Двойной Выстрел");
  });

  it("короткая очередь с одним попаданием: только Торс", async () => {
    const w = smg();
    const actor = actorFor({ items: [w, byName(TAP.name)], fatigue: { value: 0 }, aiming: "none" });
    captured.dice = [40, 5, 5, 5];  // 1 Успех → одно попадание короткой очереди
    await _executeAttackRoll(actor, w, "bs", 45, "semi", null, { doubleTap: true });
    expect(locations()).toEqual(["Торс"]);
  });
});

describe("чистые функции и окно атаки", () => {
  it("места и потолок", () => {
    expect([0, 1].map(doubleTapLocation)).toEqual(["Торс", "Голова"]);
    expect([0, 1, 2, 5].map(doubleTapHits)).toEqual([0, 1, 2, 2]);
  });

  it("активен только при галочке, Очереди, без прицела и не по технике", () => {
    const a = actorFor({ items: [byName(TAP.name)] });
    const base = { opts: { doubleTap: true }, isMelee: false, rofMode: "full", aimValue: "", targetIsVehicle: false };
    expect(doubleTapActive(a, base)).toBe(true);
    expect(doubleTapActive(a, { ...base, rofMode: "single" })).toBe(false);
    expect(doubleTapActive(a, { ...base, aimValue: "head" })).toBe(false);
    expect(doubleTapActive(a, { ...base, targetIsVehicle: true })).toBe(false);
    expect(doubleTapActive(a, { ...base, isMelee: true })).toBe(false);
    expect(doubleTapActive(actorFor({ items: [] }), base)).toBe(false);
  });

  it("галочка есть в окне атаки только у носителя Таланта с Очередью", () => {
    const w = smg();
    const mk = items => {
      const a = actorFor({ items: [w, ...items], fatigue: { value: 0 }, aiming: "none" });
      a.update = async () => {}; a.getFlag = () => undefined; a.setFlag = async () => {}; a.unsetFlag = async () => {};
      return a;
    };
    showAttackDialog(mk([byName(TAP.name)]), w);
    expect(captured.dialog.content).toContain('id="atk-double-tap"');
    resetCaptured();
    showAttackDialog(mk([]), w);
    expect(captured.dialog.content).not.toContain('id="atk-double-tap"');
    expect(doubleTapAvailable(mk([byName(TAP.name)]), { isMelee: false, sys: { rof_semi: 0, rof_full: 0 } })).toBe(false);
  });
});
