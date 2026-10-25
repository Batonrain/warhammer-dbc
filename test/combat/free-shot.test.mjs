// test/combat/free-shot.test.mjs
//
// Hip Shooting / Стрельба от Бедра и Draw Fire / Огонь с Вытягивания
// (Стрелок; Sahara 3-5fbf, решения владельца 24.10.2026).
//   Стрельба от Бедра — пункт меню Движения за 2 ОД, метка на акторе, затем один
//     Одиночный Выстрел того же Хода без ОД; не Избирательный, без Прицеливания,
//     не длинная винтовка и не тяжёлое.
//   Огонь с Вытягивания — при Взять пистолет с удобной разгрузки чат предлагает
//     бесплатный выстрел, раз в Раунд; не считается Атакой Хода.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { drawFireOfferHtml, activateFreeShot, consumeHipShooting, consumeFreeShot, freeShotBlockReason, FREE_SHOT_KINDS } from "../../module/combat/free-shot.mjs";
import { movementMenuItems, declareFullMove } from "../../module/combat/movement-actions.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { hipShootingWeapon, hipShootingEligibleWeapon, drawFireOffered, HIP_SHOOTING_FLAG } from "../../module/rules/gunner-talents.mjs";

const HIP  = { key: "rangedCore.core.hipShooting", name: "Hip Shooting / Стрельба от Бедра" };
const DRAW = { key: "rangedCore.core.drawFire", name: "Draw Fire / Огонь с Вытягивания" };
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });

function who(items) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none" });
  a.uuid = "Actor.A1"; a.name = "Стрелок";
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  a.update = async () => {};
  a.store = store;
  return a;
}
const rifle = (extra = {}) => weaponFor({ weaponClass: "basic", equipped: true, grips: "2р", ...extra }, { id: "rifle", name: "Лазган" });
const pistol = () => weaponFor({ weaponClass: "pistol", equipped: false, grips: "1р" }, { id: "pist", name: "Лазпистолет" });

beforeEach(() => { resetCaptured(); globalThis.game.combat = undefined; });
afterEach(() => { globalThis.game.combat = undefined; });

describe("Стрельба от Бедра: оружие и меню", () => {
  it("подходящее оружие: Пистолет и Ручное без длинной винтовки; тяжёлое — нет", () => {
    expect(hipShootingEligibleWeapon(rifle())).toBe(true);
    expect(hipShootingEligibleWeapon(rifle({ weaponClass: "pistol" }))).toBe(true);
    expect(hipShootingEligibleWeapon(rifle({ weaponProps: [{ key: "longRifle" }] }))).toBe(false);
    expect(hipShootingEligibleWeapon(rifle({ weaponClass: "heavy" }))).toBe(false);
  });

  it("hipShootingWeapon: Талант по имени и по ключу; без Таланта или без экипированного — null", () => {
    const w = rifle();
    expect(hipShootingWeapon(who([w, byName(HIP.name)]))).toBe(w);
    expect(hipShootingWeapon(who([w, byKey(HIP.key)]))).toBe(w);
    expect(hipShootingWeapon(who([w]))).toBeNull();
    expect(hipShootingWeapon(who([rifle({ equipped: false }), byName(HIP.name)]))).toBeNull();
  });

  it("пункт «Стрельба от Бедра» в меню Движения есть только у носителя Таланта при бое", () => {
    globalThis.game.combat = { started: true };
    const withTalent = movementMenuItems(who([rifle(), byName(HIP.name)])).map(i => i.key);
    expect(withTalent).toContain("hipshooting");
    expect(movementMenuItems(who([rifle()])).map(i => i.key)).not.toContain("hipshooting");
  });
});

describe("Стрельба от Бедра: объявление и выстрел", () => {
  it("Полное Движение «от бедра» тратит 2 ОД, взводит метку и кладёт кнопку выстрела в карточку", async () => {
    globalThis.game.combat = { started: true };
    const a = who([rifle(), byName(HIP.name)]);
    a.type = "character";
    a.system.actionPoints = { value: 4, max: 4 };
    a.update = async data => {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split("."); let n = a;
        for (const k of keys.slice(0, -1)) n = (n[k] ??= {});
        n[keys.at(-1)] = value;
      }
    };
    await declareFullMove(a, { hipShooting: true });
    expect(a.system.actionPoints.value).toBe(2);
    expect(a.store[`warhammer-dbc.${HIP_SHOOTING_FLAG}`]).toBe(true);
    expect(captured.chat.at(-1).content).toContain('data-kind="hipShooting"');
  });

  it("обычное Полное Движение метку не ставит", async () => {
    globalThis.game.combat = { started: true };
    const a = who([rifle(), byName(HIP.name)]);
    a.type = "character";
    a.system.actionPoints = { value: 4, max: 4 };
    a.update = async () => {};
    await declareFullMove(a);
    expect(a.store[`warhammer-dbc.${HIP_SHOOTING_FLAG}`]).toBeUndefined();
    expect(captured.chat.at(-1).content).not.toContain("wh-free-shot-btn");
  });

  it("выстрел от бедра без метки — отказ", async () => {
    const a = who([rifle(), byName(HIP.name)]);
    globalThis.fromUuid = async () => a;
    await activateFreeShot(a.uuid, FREE_SHOT_KINDS.hipShooting);
    expect(captured.warnings.some(w => w.includes("Стрельба от Бедра"))).toBe(true);
  });

  it("окно атаки в режиме бесплатного выстрела: только Одиночный выстрел и заперт «Без прицела»", async () => {
    const w = rifle({ rof_single: 1, rof_semi: 3, rof_full: 6 });
    const a = who([w, byName(HIP.name)]);
    a.store[`warhammer-dbc.${HIP_SHOOTING_FLAG}`] = true;
    showAttackDialog(a, w, { freeShot: "hipShooting" });
    const html = captured.dialog.content;
    expect(html).toContain('value="single"');
    expect(html).not.toContain('value="semi"');
    expect(html).not.toContain('value="full"');
    expect(html).toMatch(/<select id="atk-aim"[^>]*disabled/);
  });

  it("consumeHipShooting снимает метку", async () => {
    const a = who([rifle()]);
    a.store[`warhammer-dbc.${HIP_SHOOTING_FLAG}`] = true;
    await consumeHipShooting(a);
    expect(a.store[`warhammer-dbc.${HIP_SHOOTING_FLAG}`]).toBeUndefined();
  });
});

describe("Огонь с Вытягивания: предложение при Взять", () => {
  it("пистолет + Талант (имя и ключ) → кнопка с id оружия", () => {
    const p = pistol();
    for (const t of [byName(DRAW.name), byKey(DRAW.key)]) {
      const html = drawFireOfferHtml(who([p, t]), p);
      expect(html).toContain('data-kind="drawFire"');
      expect(html).toContain(`data-item-id="${p.id}"`);
    }
  });

  it("не пистолет и без Таланта — предложения нет", () => {
    const talent = byName(DRAW.name);
    expect(drawFireOfferHtml(who([rifle(), talent]), rifle())).toBe("");
    const p = pistol();
    expect(drawFireOfferHtml(who([p]), p)).toBe("");
  });

  it("раз в Раунд: после использования предложения нет", () => {
    const p = pistol();
    const a = who([p, byName(DRAW.name)]);
    globalThis.game.combat = { round: 3, id: "c1" };
    a.store["warhammer-dbc.usageLimits.drawFire"] = { round: 3 };
    expect(drawFireOfferHtml(a, p)).toBe("");
    globalThis.game.combat = { round: 4, id: "c1" };
    expect(drawFireOfferHtml(a, p)).toContain("wh-free-shot-btn");
  });

  it("неудобная разгрузка: предложение гаснет (чистая функция)", () => {
    const p = pistol();
    const a = who([p, byName(DRAW.name)]);
    expect(drawFireOffered(a, p, { awkwardRig: true })).toBe(false);
    expect(drawFireOffered(a, p, { awkwardRig: false })).toBe(true);
  });

  it("клик: помечает Раунд и открывает окно только с Одиночным выстрелом", async () => {
    const p = pistol();
    p.system.rof_semi = 3;
    const a = who([p, byName(DRAW.name)]);
    globalThis.game.combat = { round: 2, id: "c1" };
    a.items.get = id => (id === p.id ? p : null);
    globalThis.fromUuid = async () => a;
    // Окно атаки живёт, пока его не закроют, — его промис не ждём, смотрим на то, что уже открыто.
    activateFreeShot(a.uuid, FREE_SHOT_KINDS.drawFire, p.id);
    await new Promise(r => setTimeout(r, 30));
    // Раунд отмечается, когда выстрел сделан (consumeFreeShot), а не при открытии окна: отмена его не сжигает.
    expect(a.store["warhammer-dbc.usageLimits.drawFire"]).toBeUndefined();
    expect(captured.dialog.content).not.toContain('value="semi"');
  });
});

describe("повторная проверка условий на самом выстреле", () => {
  it("Бедро: метки нет — выстрел заблокирован; Вытягивание: Раунд израсходован — заблокирован", async () => {
    const a = who([rifle(), byName(HIP.name)]);
    expect(freeShotBlockReason(a, FREE_SHOT_KINDS.hipShooting)).toContain("уже сделан");
    a.store[`warhammer-dbc.${HIP_SHOOTING_FLAG}`] = true;
    expect(freeShotBlockReason(a, FREE_SHOT_KINDS.hipShooting)).toBe("");
    globalThis.game.combat = { round: 5, id: "c1" };
    expect(freeShotBlockReason(a, FREE_SHOT_KINDS.drawFire)).toBe("");
    await consumeFreeShot(a, FREE_SHOT_KINDS.drawFire);
    expect(freeShotBlockReason(a, FREE_SHOT_KINDS.drawFire)).toContain("уже использован");
  });

  it("consumeFreeShot Бедра снимает метку (второе окно упрётся в блок)", async () => {
    const a = who([rifle(), byName(HIP.name)]);
    a.store[`warhammer-dbc.${HIP_SHOOTING_FLAG}`] = true;
    await consumeFreeShot(a, FREE_SHOT_KINDS.hipShooting);
    expect(freeShotBlockReason(a, FREE_SHOT_KINDS.hipShooting)).toContain("уже сделан");
  });

  it("оружие без Одиночного выстрела для Бедра не подходит", () => {
    expect(hipShootingEligibleWeapon(rifle({ rof_single: 0 }))).toBe(false);
  });
});
