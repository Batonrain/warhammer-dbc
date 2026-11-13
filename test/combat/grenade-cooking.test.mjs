// test/combat/grenade-cooking.test.mjs
//
// Grenade Cooking / Выдержка Гранаты (Талант Метания, Sahara 3-8318): перед броском гранаты Logic(I)+0;
// Успех — Уклонение от гранаты −5×Успехи, Провал — граната Очень Ненадёжна (метнуть всё равно).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { resolveGrenadeCooking, grenadeCookingThreshold } from "../../module/combat/grenade-cooking.mjs";

const TALENT = { id: "gc", type: "talent", name: "Grenade Cooking / Выдержка Гранаты", system: {}, getFlag: () => undefined };
const grenadeSys = { weaponClass: "thrown", weaponType: "grenade", damage: "2d10", rof_single: 1, rof_semi: 0, rof_full: 0, weight: 0.5,
  weaponProps: [{ key: "blast", rating: 4 }], magazineCur: 1, magazineMax: 1 };
const grenade = () => weaponFor(grenadeSys, { name: "Фраг-граната" });
const thrower = (items = [], logic = 50) => {
  const a = actorFor({
    items, characteristics: { ws: char(45), bs: char(60), s: char(40), t: char(40), ag: char(35), int: char(40) },
    skills: { logic: { total: logic } }
  });
  a.uuid = "Actor.thrower"; a.isOwner = true;
  return a;
};
const card = () => captured.chat.map(m => m.content ?? "").join("\n");
const dodgeMods = () => [...card().matchAll(/class="wh-dodge-btn"[^>]*data-extra-mod="(-?\d+)"/g)].map(m => Number(m[1]));

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("порог теста", () => {
  it("итог Навыка Логика; без Навыка — Int −20", () => {
    expect(grenadeCookingThreshold(thrower([], 50))).toBe(50);
    expect(grenadeCookingThreshold({ system: { characteristics: { int: { total: 40 } } } })).toBe(20);
  });
});

describe("resolveGrenadeCooking", () => {
  it("без галочки или Таланта — теста нет, кубы не бросаются", async () => {
    captured.dice = [10];
    expect(await resolveGrenadeCooking(thrower([TALENT]), { sys: grenadeSys, toggles: {} })).toBeNull();
    expect(await resolveGrenadeCooking(thrower([]), { sys: grenadeSys, toggles: { grenadeCooking: true } })).toBeNull();
    expect(captured.chat).toHaveLength(0);
  });
  it("Успех: степени считаются от порога Logic (50), карточка названа", async () => {
    captured.dice = [20];                                  // 50−20 = 30 → 4 степени
    const r = await resolveGrenadeCooking(thrower([TALENT], 50), { sys: grenadeSys, toggles: { grenadeCooking: true } });
    expect(r).toMatchObject({ success: true, deg: 4, rv: 20, threshold: 50 });
    expect(card()).toContain("Выдержка Гранаты");
    expect(card()).toContain("−20");
  });
  it("Провал", async () => {
    captured.dice = [90];
    const r = await resolveGrenadeCooking(thrower([TALENT], 50), { sys: grenadeSys, toggles: { grenadeCooking: true } });
    expect(r.success).toBe(false);
  });
  it("повторный вызов с уже оплаченным результатом (переброс атаки) — не бросает заново", async () => {
    captured.dice = [99];
    const paid = { success: true, deg: 2, rv: 30, threshold: 50 };
    expect(await resolveGrenadeCooking(thrower([TALENT]), { sys: grenadeSys, toggles: { grenadeCooking: true }, paid })).toBe(paid);
    expect(captured.chat).toHaveLength(0);
  });
});

describe("бросок гранаты", () => {
  const target = { actor: { id: "t", type: "character", name: "Цель", uuid: "Actor.t", system: {} }, document: { uuid: "Scene.s.Token.t" } };
  const throwIt = async (a, w, toggles) => {
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([target]) };
    await _executeAttackRoll(a, w, "bs", 60, "single", null, { talentToggles: toggles });
  };

  it("Успех теста: кнопка Уклонения несёт −5×Успехи (тест 30 при пороге 50 → 3 Успеха → −15)", async () => {
    const w = grenade(); const a = thrower([TALENT, w], 50);
    captured.dice = [30, 10, 5, 5, 5];                     // тест: 50−30 → 3 степени; затем бросок атаки и урон
    await throwIt(a, w, { grenadeCooking: true });
    const deg = Math.floor((50 - 30) / 10) + 1;            // 3
    expect(dodgeMods()[0]).toBe(-5 * deg);
    expect(card()).toContain("Выдержка Гранаты");
  });
  it("Провал теста: штрафа Уклонению нет, в карточке пометка Очень Ненадёжной", async () => {
    const w = grenade(); const a = thrower([TALENT, w], 50);
    captured.dice = [95, 10, 5, 5, 5];
    await throwIt(a, w, { grenadeCooking: true });
    expect(dodgeMods()[0] ?? 0).toBe(0);
    expect(card()).toContain("Очень Ненадёжное");
  });
  it("без галочки — теста нет, Уклонение без штрафа", async () => {
    const w = grenade(); const a = thrower([TALENT, w], 50);
    captured.dice = [10, 5, 5, 5];
    await throwIt(a, w, {});
    expect(card()).not.toContain("Выдержка Гранаты");
    expect(dodgeMods()[0] ?? 0).toBe(0);
  });
  it("не граната (нож) с галочкой — теста нет", async () => {
    const w = weaponFor({ weaponClass: "thrown", weaponType: "lowtech", damage: "1d5", rof_single: 1, rof_semi: 0, rof_full: 0, weight: 0.2 });
    const a = thrower([TALENT, w], 50);
    captured.dice = [10, 5, 5, 5];
    await throwIt(a, w, { grenadeCooking: true });
    expect(card()).not.toContain("Выдержка Гранаты");
  });
});

describe("окно атаки", () => {
  const attacker = (items) => {
    const a = thrower(items, 50);
    a.updates = []; a.update = async d => { a.updates.push(d); };
    a.getFlag = () => undefined; a.setFlag = async () => {}; a.unsetFlag = async () => {};
    return a;
  };
  it("гранату с Талантом сопровождает галочка «Выдержка Гранаты»", () => {
    const w = grenade();
    showAttackDialog(attacker([w, TALENT]), w);
    expect(captured.dialog.content).toContain('data-key="grenadeCooking"');
  });
  it("без Таланта галочки нет", () => {
    const w = grenade();
    showAttackDialog(attacker([w]), w);
    expect(captured.dialog.content).not.toContain("grenadeCooking");
  });
  it("галочка доезжает до броска: включённая — тест идёт", async () => {
    const w = grenade();
    const a = attacker([w, TALENT]);
    const p = showAttackDialog(a, w);
    captured.dice = [20, 10, 5, 5];
    const cb = { type: "checkbox", checked: true, value: "", dataset: { key: "grenadeCooking" }, addEventListener: () => {} };
    await captured.press("roll", fakeForm({ "#atk-char": "bs", "#atk-modifier": "0", "#atk-aim": "" }, { ".atk-talent-toggle": [cb] }));
    await p;
    expect(card()).toContain("Выдержка Гранаты");
  });
});
