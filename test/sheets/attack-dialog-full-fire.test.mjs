// test/sheets/attack-dialog-full-fire.test.mjs
//
// Full Fire / Полный Огонь (Sahara 3-5fbf, решение владельца 24.10.2026): окно атаки
// предлагает второй ствол пары; основной выстрел платит ОД, второй — Реакцию; оба −10;
// у второго выстрела свой профиль-ствол (магазин, урон).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

const FULL = {
  id: "t-full", name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "rangedCore.core.fullFire", label: "" }] }] } }
};
const BARREL = { label: "Подствольник", ownFire: true, rof_single: 1, rof_semi: 0, rof_full: 0,
  magazineMax: 2, magazineCur: 2, damage: "2d10", damageType: "explosive", penetration: 8, weaponType: "" };

const rifle = () => weaponFor({ weaponClass: "basic", equipped: true, weaponType: "", rof_single: 1, rof_semi: 0, rof_full: 0,
  magazineCur: 5, magazineMax: 5, profiles: [{ ...BARREL }] }, { id: "rifle", name: "Комби-болтер" });

function shooter(items, { reactions = 1, ap = 4 } = {}) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", reactions: { value: reactions }, actionPoints: { value: ap, max: 4 } });
  a.type = "character";
  a.uuid = "Actor.A1"; a.name = "Стрелок";
  const flags = {};
  a.getFlag = (s, k) => flags[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { flags[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete flags[`${s}.${k}`]; };
  a.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split("."); let n = a;
      for (const k of keys.slice(0, -1)) n = (n[k] ??= {});
      n[keys.at(-1)] = value;
    }
  };
  return a;
}

const form = (extra = {}) => fakeForm({
  "#atk-char": "bs", "#atk-modifier": "0", "#atk-aim": "",
  "input[name='atk-rof']:checked": { value: "single", dataset: { bonus: "10" } },
  ...extra
});

const thresholds = () => captured.chat
  .map(m => (m.content ?? "").match(/<label>Порог<\/label><b>(-?\d+)<\/b>/)?.[1])
  .filter(Boolean).map(Number);

beforeEach(() => { resetCaptured(); setTargets([]); globalThis.game.combat = undefined; });
afterEach(() => { globalThis.game.combat = undefined; });

describe("Полный Огонь в окне атаки", () => {
  it("без Таланта галочки нет; с Талантом — есть, со списком стволов", () => {
    const w1 = rifle();
    showAttackDialog(shooter([w1]), w1);
    expect(captured.dialog.content).not.toContain("atk-full-fire");
    resetCaptured();
    const w2 = rifle();
    showAttackDialog(shooter([w2, FULL]), w2);
    expect(captured.dialog.content).toContain('id="atk-full-fire"');
    expect(captured.dialog.content).toContain('value="p:0"');
  });

  it("галочка даёт −10 основному выстрелу и вторую карточку с профилем-подствольником", async () => {
    const w = rifle();
    const a = shooter([w, FULL]);
    const p = showAttackDialog(a, w);
    captured.dice = [10, 3, 4, 4, 10, 3, 4, 4, 4, 4, 4, 4];
    await captured.press("roll", form({ "#atk-full-fire": true, "#atk-full-fire-with": "p:0", "#atk-full-fire-rof": "single" }));
    await p;
    const th = thresholds();
    expect(th).toHaveLength(2);
    // основной: BS 45 + одиночный +10 − 10 Полного Огня = 45; второй с тем же режимом и без Прицеливания — то же
    expect(th[0]).toBe(45);
    expect(th[1]).toBe(45);
    const all = captured.chat.map(m => m.content).join("\n");
    expect(all).toContain("Полный Огонь");
    // магазин подствольника списан отдельно от магазина винтовки
    expect(w.system.profiles[0].magazineCur).toBe(1);
    expect(w.system.magazineCur).toBe(4);
  });

  it("Избирательная атака — только основной выстрел: второй без её штрафа (места попадания у него нет)", async () => {
    const w = rifle();
    const a = shooter([w, FULL]);
    const p = showAttackDialog(a, w);
    captured.dice = [10, 3, 4, 4, 10, 3, 4, 4, 4, 4, 4, 4];
    await captured.press("roll", form({ "#atk-full-fire": true, "#atk-full-fire-with": "p:0", "#atk-full-fire-rof": "single",
      "#atk-aim": "arm", "#atk-aim option:checked": { value: "arm", dataset: { penalty: "-20" } } }));
    await p;
    // основной: 45 + 10 − 10 − 20 = 25; второй — тот же, но без −20 Избирательной
    expect(thresholds()).toEqual([25, 45]);
  });

  it("без галочки — один выстрел, порог без −10", async () => {
    const w = rifle();
    const a = shooter([w, FULL]);
    const p = showAttackDialog(a, w);
    captured.dice = [10, 3, 4, 4, 10, 3, 4, 4, 4, 4, 4, 4];
    await captured.press("roll", form());
    await p;
    expect(thresholds()).toEqual([55]);
    expect(w.system.profiles[0].magazineCur).toBe(2);
  });

  it("в Encounter: ОД за основной выстрел, Реакция — за второй", async () => {
    globalThis.game.combat = { started: true };
    const w = rifle();
    const a = shooter([w, FULL], { reactions: 1, ap: 4 });
    const p = showAttackDialog(a, w);
    captured.dice = [10, 3, 4, 4, 10, 3, 4, 4, 4, 4, 4, 4];
    await captured.press("roll", form({ "#atk-full-fire": true, "#atk-full-fire-with": "p:0" }));
    await p;
    expect(a.system.actionPoints.value).toBe(3);
    expect(a.system.reactions.value).toBe(0);
    expect(thresholds()).toHaveLength(2);
  });

  it("нет Реакции — отказ до списания ОД, ни одного выстрела", async () => {
    globalThis.game.combat = { started: true };
    const w = rifle();
    const a = shooter([w, FULL], { reactions: 0, ap: 4 });
    const p = showAttackDialog(a, w);
    await captured.press("roll", form({ "#atk-full-fire": true, "#atk-full-fire-with": "p:0" }));
    expect(a.system.actionPoints.value).toBe(4);
    expect(captured.warnings.some(m => m.includes("Реакц"))).toBe(true);
    expect(thresholds()).toHaveLength(0);
    captured.dismiss();
    await p;
  });

  it("пустой магазин подствольника — отказ до списания ОД и Реакции", async () => {
    globalThis.game.combat = { started: true };
    const w = rifle();
    w.system.profiles[0].magazineCur = 0;
    const a = shooter([w, FULL], { reactions: 1, ap: 4 });
    const p = showAttackDialog(a, w);
    await captured.press("roll", form({ "#atk-full-fire": true, "#atk-full-fire-with": "p:0" }));
    expect(captured.warnings.some(m => m.includes("пуст"))).toBe(true);
    expect(a.system.actionPoints.value).toBe(4);
    expect(a.system.reactions.value).toBe(1);
    expect(thresholds()).toHaveLength(0);
    captured.dismiss();
    await p;
  });

  it("«Обе руки» и Полный Огонь вместе — отказ", async () => {
    const w = rifle();
    const pistol = weaponFor({ weaponClass: "pistol", equipped: true }, { id: "pi", name: "Пистолет" });
    const a = shooter([w, pistol, FULL]);
    const p = showAttackDialog(a, w);
    await captured.press("roll", form({ "#atk-full-fire": true, "#atk-full-fire-with": "p:0", "#atk-dual-wield": true, "#atk-off-hand": "pi" }));
    expect(captured.warnings.some(m => m.includes("Обе руки"))).toBe(true);
    expect(thresholds()).toHaveLength(0);
    captured.dismiss();
    await p;
  });
});
