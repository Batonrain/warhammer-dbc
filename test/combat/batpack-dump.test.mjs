// test/combat/batpack-dump.test.mjs
//
// Power Setting / Настройка Мощности и Batpack Dump / Выпуск Батареи (Оружейник; Sahara 3-9d40,
// решение владельца 24.10.2026): режимы Усиление/Перегрузка, длинная очередь RoF 10, +1d10, Storm(2),
// −30 вне упора, расход не меньше 20 зарядов, оружие ломается.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { getModEffects } from "../../module/combat/weapon-mods.mjs";
import {
  hasPowerSetting, powerSettingEffects, powerModeOf, isPowerSettingMod, POWER_MODES
} from "../../module/rules/power-setting.mjs";
import { batpackAvailable, batpackRangePenalty, batpackStormRating } from "../../module/rules/batpack-dump.mjs";

const talent = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const BATPACK = talent("weaponsmith.core.batpackDump");

const lasgun = (flags = {}, extra = {}) => weaponFor(
  { weaponClass: "basic", weaponType: "laser", special: "Моды: Power Setting", equipped: true, damage: "1d10+3",
    rof_single: 1, rof_semi: 3, rof_full: 0, magazineCur: 60, magazineMax: 60, penetration: 0, ...extra },
  { id: "las", name: "Лазган", flags });
const psMod = (installedOn = "las") => ({ id: "ps", type: "weaponMod", name: "Power Tuning / Настройка Мощности", system: { installedOn, effects: {} }, getFlag: () => undefined });

describe("Power Setting: наличие и режимы", () => {
  it("мод распознаётся по обоим названиям; есть у лаз-оружия по пометке или установленному моду; у тяжёлого и рукопашного — нет", () => {
    expect(isPowerSettingMod(psMod())).toBe(true);
    expect(isPowerSettingMod({ type: "weaponMod", name: "Riza Pattern" })).toBe(false);
    expect(hasPowerSetting(lasgun(), [])).toBe(true);
    expect(hasPowerSetting(lasgun({}, { special: "" }), [])).toBe(false);
    expect(hasPowerSetting(lasgun({}, { special: "" }), [psMod()])).toBe(true);
    expect(hasPowerSetting(lasgun({}, { weaponClass: "heavy" }), [psMod()])).toBe(false);
    expect(hasPowerSetting(lasgun({}, { weaponClass: "melee" }), [psMod()])).toBe(false);
  });

  it("режим читается из флага оружия, мусор — обычный", () => {
    expect(powerModeOf(lasgun())).toBe("");
    expect(powerModeOf(lasgun({ "warhammer-dbc.powerMode": "boost" }))).toBe("boost");
    expect(powerModeOf(lasgun({ "warhammer-dbc.powerMode": "что-то" }))).toBe("");
  });

  it("Усиление: Dmg+1, Pen+1, Надёжность−1, Surge 2; Перегрузка: +2/+2/−2, Surge 4 (книга)", () => {
    expect(POWER_MODES.boost).toMatchObject({ damage: 1, pen: 1, reliability: -1, surge: 2 });
    expect(POWER_MODES.overload).toMatchObject({ damage: 2, pen: 2, reliability: -2, surge: 4 });
    const w = lasgun({ "warhammer-dbc.powerMode": "overload" });
    expect(powerSettingEffects(w, [])).toMatchObject({ damageMod: 2, penMod: 2, reliabilityMod: -2 });
    expect(powerSettingEffects(lasgun(), [])).toBeNull();
  });

  it("getModEffects подмешивает режим к эффектам модификаций (Dmg, Pen, Надёжность, Surge)", () => {
    const w = lasgun({ "warhammer-dbc.powerMode": "boost" });
    const fx = getModEffects(actorFor({ items: [w] }), w);
    expect(fx.damageMod).toBe(1);
    expect(fx.penMod).toBe(1);
    expect(fx.reliabilityMod).toBe(-1);
    expect(fx.addProps).toContainEqual({ key: "surge", rating: 2, rating2: 0 });
    const plain = getModEffects(actorFor({ items: [lasgun()] }), lasgun());
    expect(plain.damageMod).toBe(0);
    expect(plain.addProps).toEqual([]);
  });
});

describe("Выпуск Батареи: чистые правила", () => {
  it("доступен: Талант + лаз-оружие с Power Setting; не доступен без Таланта, у не-лаза, у сломанного, в рукопашной", () => {
    const w = lasgun();
    expect(batpackAvailable(actorFor({ items: [BATPACK] }), { item: w })).toBe(true);
    expect(batpackAvailable(actorFor({ items: [] }), { item: w })).toBe(false);
    expect(batpackAvailable(actorFor({ items: [BATPACK] }), { item: lasgun({}, { weaponType: "bolt" }) })).toBe(false);
    expect(batpackAvailable(actorFor({ items: [BATPACK] }), { item: lasgun({}, { destroyed: true }) })).toBe(false);
    expect(batpackAvailable(actorFor({ items: [BATPACK] }), { item: w, isMelee: true })).toBe(false);
  });

  it("штраф −30 кроме упора и рукопашной; Storm не ниже 2", () => {
    expect(batpackRangePenalty({ batpackOn: true })).toBe(-30);
    expect(batpackRangePenalty({ batpackOn: true, pointBlank: true })).toBe(0);
    expect(batpackRangePenalty({ batpackOn: true, meleeShot: true })).toBe(0);
    expect(batpackRangePenalty({ batpackOn: false })).toBe(0);
    expect(batpackStormRating(0)).toBe(2);
    expect(batpackStormRating(3)).toBe(3);
  });
});

function shooter(items) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none" });
  a.update = async () => {};
  return a;
}
const form = (extra = {}) => fakeForm({
  "#atk-char": "bs", "#atk-modifier": "0", "#atk-aim": "",
  "input[name='atk-rof']:checked": { value: "single", dataset: { bonus: "10" } },
  ...extra
});
const lastThreshold = () => {
  const m = (captured.chat.at(-1)?.content ?? "").match(/<label>Порог<\/label><b>(-?\d+)<\/b>/);
  return m ? Number(m[1]) : null;
};
const DICE = Array.from({ length: 60 }, (_, i) => (i % 2 ? 4 : 10));

beforeEach(() => { resetCaptured(); setTargets([]); globalThis.game.combat = undefined; });

describe("Выпуск Батареи в окне атаки", () => {
  it("галочка есть только у носителя Таланта с лаз-оружием с Power Setting; переключатель режима — у оружия с Power Setting", () => {
    const w = lasgun();
    showAttackDialog(shooter([w, BATPACK]), w);
    expect(captured.dialog.content).toContain('id="atk-batpack"');
    expect(captured.dialog.content).toContain('id="atk-power-mode"');
    resetCaptured();
    const w2 = lasgun();
    showAttackDialog(shooter([w2]), w2);
    expect(captured.dialog.content).not.toContain("atk-batpack");
    expect(captured.dialog.content).toContain('id="atk-power-mode"');
  });

  it("атака: 10 выстрелов × Storm(2) = 20 зарядов, оружие сломано, в карточке пометка", async () => {
    const w = lasgun();
    const p = showAttackDialog(shooter([w, BATPACK]), w);
    captured.dice = [...DICE];
    await captured.press("roll", form({ "#atk-batpack": true }));
    await p;
    expect(w.system.magazineCur).toBe(40);
    expect(w.system.destroyed).toBe(true);
    const all = captured.chat.map(m => m.content).join("\n");
    expect(all).toContain("Выпуск Батареи");
  });

  it("порог: −30 вне упора, в упор — без штрафа (разница ровно 30)", async () => {
    const run = async extra => {
      resetCaptured();
      const w = lasgun();
      const p = showAttackDialog(shooter([w, BATPACK]), w);
      captured.dice = [...DICE];
      await captured.press("roll", form({ "#atk-batpack": true, ...extra }));
      await p;
      return lastThreshold();
    };
    const far = await run({});
    const close = await run({ "#atk-point-blank": true });
    expect(close - far).toBe(30);
  });

  it("клин на Выпуске Батареи: оружие всё равно сломано, испорчено 2×RoF 10 патронов", async () => {
    const w = lasgun();
    const p = showAttackDialog(shooter([w, BATPACK]), w);
    captured.dice = [98];
    await captured.press("roll", form({ "#atk-batpack": true }));
    await p;
    expect(w.system.jammed).toBe(true);
    expect(w.system.destroyed).toBe(true);
    expect(w.system.jammedAmmo).toBe(20);
  });

  it("без галочки — обычный выстрел: магазин −1, оружие цело", async () => {
    const w = lasgun();
    const p = showAttackDialog(shooter([w, BATPACK]), w);
    captured.dice = [...DICE];
    await captured.press("roll", form());
    await p;
    expect(w.system.magazineCur).toBe(59);
    expect(w.system.destroyed).toBeFalsy();
  });

  it("сломанным оружием стрелять нельзя", async () => {
    const w = lasgun({}, { destroyed: true });
    const p = showAttackDialog(shooter([w]), w);
    await captured.press("roll", form());
    expect(captured.warnings.some(m => m.includes("сломано"))).toBe(true);
    expect(captured.chat).toHaveLength(0);
    captured.dismiss();
    await p;
  });
});
